/**
 * Generation worker. Claims jobs from the Supabase queue and runs them:
 *   full_generation: enhance audio -> transcribe -> plan scenes -> render preview
 *   rerender:        rebuild from the (edited) scenes -> render preview
 *   export:          render the final file at the requested quality
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, optional ANTHROPIC_API_KEY,
 * ASR provider keys (see pipeline/asr.ts), REMOTION_BROWSER, MAX_JOBS.
 */
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { assemblePlan, finishTimeline, planShell, rulePlanner, type MediaRef, type SceneDraft } from './plan/build';
import { claudePlanner } from './plan/llm';
import { ASPECT_SIZES, FONT_IDS, STYLE_IDS, type AspectRatio, type CaptionMode, type FontId, type Scene, type StyleId, type VideoPlanInput, type Word } from './plan/schema';
import { GOALS, VIDEO_TYPES, type Goal, type ProjectSettings, type VideoType } from './plan/settings';
import { transcribe } from './pipeline/asr';
import { enhanceVoice, normalizeSpeakerVideo, probe, toAsrWav } from './pipeline/audio';
import { toSrt } from './pipeline/srt';
import { renderPlan } from './render';

const env = (k: string) => {
  const v = process.env[k];
  if (!v) throw new Error(`Missing env ${k}`);
  return v;
};

const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
const WORKER_ID = process.env.WORKER_ID ?? `worker-${os.hostname()}-${process.pid}`;
const URL_TTL = 6 * 3600;

type Row = Record<string, any>;

/** Errors that retrying will not fix. */
class PermanentError extends Error {}

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------

const signedUrl = async (bucket: string, p: string) => {
  const { data, error } = await db.storage.from(bucket).createSignedUrl(p, URL_TTL);
  if (error || !data) throw new Error(`Signed URL failed for ${bucket}/${p}: ${error?.message}`);
  return data.signedUrl;
};

const download = async (bucket: string, p: string, to: string) => {
  const { data, error } = await db.storage.from(bucket).download(p);
  if (error || !data) throw new Error(`Download failed for ${bucket}/${p}: ${error?.message}`);
  await writeFile(to, Buffer.from(await data.arrayBuffer()));
  return to;
};

const upload = async (bucket: string, p: string, file: string, contentType: string) => {
  const { error } = await db.storage.from(bucket).upload(p, await readFile(file), { contentType, upsert: true });
  if (error) throw new Error(`Upload failed for ${bucket}/${p}: ${error.message}`);
};

const registerAsset = async (job: Row, kind: string, bucket: string, p: string, mime: string, extra: Row = {}) => {
  const { data, error } = await db
    .from('assets')
    .upsert({ user_id: job.user_id, project_id: job.project_id, kind, bucket, path: p, mime_type: mime, ...extra }, { onConflict: 'bucket,path' })
    .select('id')
    .single();
  if (error) throw new Error(`Asset insert failed: ${error.message}`);
  return data.id as string;
};

// ---------------------------------------------------------------------------
// Job helpers
// ---------------------------------------------------------------------------

const setProgress = async (job: Row, stage: string, progress: number) => {
  await db.from('jobs').update({ stage, progress: Math.round(Math.min(99, progress)) }).eq('id', job.id);
};

const settingsFrom = (p: Row): ProjectSettings => {
  const style = (STYLE_IDS as readonly string[]).includes(p.template_id) ? (p.template_id as StyleId) : 'vivid';
  const font = (FONT_IDS as readonly string[]).includes(p.font_id) ? (p.font_id as FontId) : undefined;
  return {
    title: p.title ?? '',
    businessName: p.business_name ?? undefined,
    businessType: p.business_type ?? undefined,
    goal: (GOALS as readonly string[]).includes(p.goal) ? (p.goal as Goal) : 'content_marketing',
    videoType: (VIDEO_TYPES as readonly string[]).includes(p.video_type) ? (p.video_type as VideoType) : 'motion_graphics',
    idea: p.idea ?? undefined,
    captionLanguage: p.caption_language ?? p.audio_language ?? p.detected_language ?? 'ar',
    captionScript: p.caption_script ?? 'arabic',
    style,
    headingFont: font,
    colors: p.palette ?? {},
    pace: p.pace ?? 'medium',
    captionMode: (p.caption_mode ?? 'word_box') as CaptionMode,
    aspect: (p.aspect_ratio ?? '9:16') as AspectRatio,
    sfx: p.sfx ?? true,
    product: p.product ?? undefined,
    endCard: p.end_card && Object.values(p.end_card).some(Boolean) ? p.end_card : undefined,
  };
};

type Media = {
  voiceUrl?: string;
  speakerUrl?: string;
  musicUrl?: string;
  logoUrl?: string;
  productImages: string[];
  media: MediaRef[];
};

/** Signed URLs for everything the renderer needs. */
const collectMedia = async (project: Row): Promise<Media> => {
  const { data: assets, error } = await db.from('assets').select('*').eq('project_id', project.id).order('created_at');
  if (error) throw new Error(error.message);
  const byKind = (k: string) => (assets ?? []).filter((a) => a.kind === k);
  const url = (a?: Row) => (a ? signedUrl(a.bucket, a.path) : Promise.resolve(undefined));
  const last = (k: string) => byKind(k).slice(-1)[0];
  const processed = byKind('processed_audio');
  return {
    voiceUrl: await url(processed.find((a) => a.metadata?.role === 'voice')),
    speakerUrl: await url(processed.find((a) => a.metadata?.role === 'speaker')),
    musicUrl: project.music_mode === 'none' ? undefined : await url(last('music')),
    logoUrl: await url(last('logo')),
    productImages: await Promise.all(byKind('product_image').map((a) => signedUrl(a.bucket, a.path))),
    media: await Promise.all(
      [...byKind('media_image'), ...byKind('media_video')].map(async (a) => ({
        url: await signedUrl(a.bucket, a.path),
        type: a.kind === 'media_video' ? ('video' as const) : ('image' as const),
      })),
    ),
  };
};

const planIsFree = async (userId: string) => {
  const { data } = await db.from('profiles').select('plan').eq('id', userId).single();
  return (data?.plan ?? 'free') === 'free';
};

/** Scene rows (editable in the app) <-> engine scenes. */
const sceneToRow = (job: Row, s: Scene, i: number, words: Word[]) => ({
  project_id: job.project_id,
  user_id: job.user_id,
  position: i,
  role: s.layout,
  layout: s.layout,
  start_ms: s.startMs,
  end_ms: s.endMs,
  spoken_text: words.filter((w) => w.startMs >= s.startMs && w.startMs < s.endMs).map((w) => w.text).join(' '),
  display_text: s.title ?? '',
  keywords: s.emphasis,
  elements: { subtitle: s.subtitle ?? null, icon: s.icon?.name ?? null, items: s.items.map((it) => ({ text: it.text, icon: it.icon?.name ?? null })), stat: s.stat ?? null, product: s.product ?? null, media: s.media ?? null, accent: s.accent },
});

const rowToScene = (r: Row): Scene => {
  const e = r.elements ?? {};
  return {
    id: r.id,
    startMs: r.start_ms,
    endMs: r.end_ms,
    layout: r.layout,
    title: r.display_text || undefined,
    subtitle: e.subtitle ?? undefined,
    emphasis: r.keywords ?? [],
    icon: e.icon ? { name: e.icon } : undefined,
    items: (e.items ?? []).map((it: Row) => ({ text: it.text, icon: it.icon ? { name: it.icon } : undefined })),
    stat: e.stat ?? undefined,
    product: e.product ?? undefined,
    media: e.media ?? undefined,
    accent: e.accent ?? 'primary',
  };
};

const loadProject = async (job: Row) => {
  const { data, error } = await db.from('projects').select('*').eq('id', job.project_id).single();
  if (error || !data) throw new PermanentError(`Project not found: ${error?.message}`);
  return data;
};

/** Rebuild a plan from the saved transcript + (possibly user-edited) scenes. */
const planFromDb = async (job: Row, project: Row, overrides: { aspect?: AspectRatio; watermark?: boolean } = {}) => {
  const [{ data: tr }, { data: rows }] = await Promise.all([
    db.from('transcripts').select('*').eq('project_id', project.id).single(),
    db.from('scenes').select('*').eq('project_id', project.id).order('position'),
  ]);
  if (!tr || !rows?.length) throw new PermanentError('Project has not been generated yet');
  const settings = { ...settingsFrom(project), ...(overrides.aspect ? { aspect: overrides.aspect } : {}) };
  const media = await collectMedia(project);
  const scenes = rows.map(rowToScene);
  // Product/media URLs in saved scenes are signed and may have expired: refresh them.
  scenes.forEach((s, i) => {
    if (s.product) s.product.imageUrl = media.productImages[0] ?? s.product.imageUrl;
    const saved = rows[i].elements?.media;
    if (saved && media.media.length) {
      const idx = Math.max(0, media.media.findIndex((m) => saved.url?.split('?')[0].endsWith(m.url.split('?')[0].split('/').pop() ?? '')));
      s.media = { ...saved, url: media.media[idx]?.url ?? saved.url };
    }
  });
  const words = (tr.words ?? []) as Word[];
  const durationMs = project.duration_ms ?? scenes[scenes.length - 1].endMs;
  const total = finishTimeline(scenes, Math.max(durationMs, scenes[scenes.length - 1].startMs));
  const plan: VideoPlanInput = {
    ...planShell({ settings, words, durationMs: total, ...media, watermark: overrides.watermark ?? (await planIsFree(job.user_id)), seed: hashSeed(project.id) }),
    durationMs: total,
    scenes,
  };
  return plan;
};

const hashSeed = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7) & 0x7fffffff;

const renderAndUpload = async (job: Row, plan: VideoPlanInput, kind: 'preview_video' | 'final_video', scale: number, fromProgress: number) => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'mc-render-'));
  try {
    const out = path.join(tmp, 'video.mp4');
    let lastReported = 0;
    await renderPlan(plan, {
      outFile: out,
      scale,
      onProgress: (p) => {
        const overall = fromProgress + p * (98 - fromProgress);
        if (overall - lastReported >= 4) {
          lastReported = overall;
          void setProgress(job, 'render', overall);
        }
      },
    });
    const name = `${kind === 'final_video' ? 'final' : 'preview'}-${job.id}.mp4`;
    const p = `${job.user_id}/${job.project_id}/${name}`;
    await upload('renders', p, out, 'video/mp4');
    const info = await probe(out);
    return registerAsset(job, kind, 'renders', p, 'video/mp4', { duration_ms: info.durationMs, width: Math.round(plan.width * scale), height: Math.round(plan.height * scale) });
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
};

// ---------------------------------------------------------------------------
// Job types
// ---------------------------------------------------------------------------

const fullGeneration = async (job: Row) => {
  const project = await loadProject(job);
  const settings = settingsFrom(project);
  const { data: source } = await db.from('assets').select('*').eq('id', project.source_audio_id).single();
  if (!source) throw new PermanentError('Source audio is missing');

  const tmp = await mkdtemp(path.join(os.tmpdir(), 'mc-job-'));
  try {
    // 1. Audio
    await setProgress(job, 'enhance_audio', 3);
    const src = await download(source.bucket, source.path, path.join(tmp, `source${path.extname(source.path) || '.bin'}`));
    const info = await probe(src);
    if (!info.hasAudio) throw new PermanentError('The uploaded file has no audio track');
    if (info.durationMs > (source.duration_ms ?? 0) + 3000) {
      throw new PermanentError('Audio is longer than declared; please re-upload');
    }
    const useSpeaker = settings.videoType === 'talking_head' && info.hasVideo;
    const voice = path.join(tmp, 'voice.m4a');
    await enhanceVoice(src, voice, { trimSilence: !useSpeaker });
    const base = `${job.user_id}/${job.project_id}`;
    await upload('audio', `${base}/voice.m4a`, voice, 'audio/mp4');
    const voiceInfo = await probe(voice);
    await registerAsset(job, 'processed_audio', 'audio', `${base}/voice.m4a`, 'audio/mp4', { duration_ms: voiceInfo.durationMs, metadata: { role: 'voice' } });
    if (useSpeaker) {
      const speaker = path.join(tmp, 'speaker.mp4');
      await normalizeSpeakerVideo(src, speaker);
      await upload('renders', `${base}/speaker.mp4`, speaker, 'video/mp4');
      await registerAsset(job, 'processed_audio', 'renders', `${base}/speaker.mp4`, 'video/mp4', { metadata: { role: 'speaker' } });
    }

    // 2. Transcribe
    await setProgress(job, 'transcribe', 12);
    const wav = path.join(tmp, 'asr.wav');
    await toAsrWav(voice, wav);
    const transcript = await transcribe(wav, project.audio_language);
    if (transcript.words.length === 0) throw new PermanentError('No speech was detected in the audio');
    await db.from('transcripts').upsert({
      project_id: job.project_id,
      user_id: job.user_id,
      language: null,
      provider: transcript.provider,
      words: transcript.words,
      full_text: transcript.words.map((w) => w.text).join(' '),
      is_edited: false,
    });

    // 3. Plan
    await setProgress(job, 'plan_scenes', 38);
    const media = await collectMedia(project);
    let drafts: SceneDraft[];
    if (process.env.ANTHROPIC_API_KEY) {
      try {
        drafts = await claudePlanner({
          words: transcript.words,
          settings,
          productImages: media.productImages.length,
          media: media.media.length,
          speaker: Boolean(media.speakerUrl),
        });
      } catch (err) {
        console.error('Claude planner failed, using rule planner:', err);
        drafts = rulePlanner(transcript.words, settings);
      }
    } else {
      drafts = rulePlanner(transcript.words, settings);
    }
    const plan = assemblePlan({
      settings,
      words: transcript.words,
      durationMs: voiceInfo.durationMs,
      drafts,
      ...media,
      watermark: await planIsFree(job.user_id),
      seed: hashSeed(project.id),
    });
    await db.from('scenes').delete().eq('project_id', job.project_id);
    const { error: sceneErr } = await db.from('scenes').insert(plan.scenes.map((s, i) => sceneToRow(job, s as Scene, i, transcript.words)));
    if (sceneErr) throw new Error(`Saving scenes failed: ${sceneErr.message}`);

    // 4. Render a 720p preview
    await setProgress(job, 'render', 50);
    const assetId = await renderAndUpload(job, plan, 'preview_video', 720 / Math.min(plan.width, plan.height), 50);
    await db.from('projects').update({ plan, preview_asset_id: assetId, duration_ms: voiceInfo.durationMs }).eq('id', job.project_id);
    return { preview_asset_id: assetId, scenes: plan.scenes.length, planner: process.env.ANTHROPIC_API_KEY ? 'claude' : 'rules' };
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
};

const rerender = async (job: Row) => {
  const project = await loadProject(job);
  await setProgress(job, 'render', 10);
  const plan = await planFromDb(job, project);
  const assetId = await renderAndUpload(job, plan, 'preview_video', 720 / Math.min(plan.width, plan.height), 10);
  await db.from('projects').update({ plan, preview_asset_id: assetId }).eq('id', job.project_id);
  return { preview_asset_id: assetId };
};

const exportVideo = async (job: Row) => {
  const project = await loadProject(job);
  const params = job.params ?? {};
  const aspect = (params.aspect_ratio ?? project.aspect_ratio ?? '9:16') as AspectRatio;
  await setProgress(job, 'render', 5);
  const plan = await planFromDb(job, project, { aspect, watermark: Boolean(params.watermark) });
  plan.fps = params.fps === 60 ? 60 : 30;
  const short = Math.min(ASPECT_SIZES[aspect].width, ASPECT_SIZES[aspect].height);
  const target = params.resolution === '4k' ? 2160 : params.resolution === '1080p' ? 1080 : 720;
  const assetId = await renderAndUpload(job, plan, 'final_video', target / short, 5);

  let subtitlesId: string | null = null;
  if (params.include_subtitles) {
    const tmp = await mkdtemp(path.join(os.tmpdir(), 'mc-srt-'));
    const file = path.join(tmp, 'captions.srt');
    await writeFile(file, toSrt(plan.words ?? []));
    const p = `${job.user_id}/${job.project_id}/captions-${job.id}.srt`;
    await upload('renders', p, file, 'application/x-subrip');
    subtitlesId = await registerAsset(job, 'subtitles', 'renders', p, 'application/x-subrip');
    await rm(tmp, { recursive: true, force: true });
  }
  const { error } = await db.from('exports').insert({
    project_id: job.project_id,
    user_id: job.user_id,
    job_id: job.id,
    resolution: params.resolution ?? '720p',
    fps: plan.fps,
    aspect_ratio: aspect,
    has_watermark: Boolean(params.watermark),
    video_asset_id: assetId,
    subtitles_asset_id: subtitlesId,
  });
  if (error) throw new Error(`Saving export failed: ${error.message}`);
  return { video_asset_id: assetId, subtitles_asset_id: subtitlesId };
};

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------

const processJob = async (job: Row) => {
  console.log(`[${WORKER_ID}] job ${job.id} (${job.type}) attempt ${job.attempts}`);
  try {
    const result = job.type === 'full_generation' ? await fullGeneration(job) : job.type === 'rerender' ? await rerender(job) : await exportVideo(job);
    await db.rpc('complete_job', { p_job_id: job.id, p_result: result });
    console.log(`[${WORKER_ID}] job ${job.id} done`, result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[${WORKER_ID}] job ${job.id} failed:`, err);
    await db.rpc('fail_job', { p_job_id: job.id, p_error: message.slice(0, 500), p_retryable: !(err instanceof PermanentError) });
  }
};

const main = async () => {
  const maxJobs = Number(process.env.MAX_JOBS ?? 20);
  await db.rpc('requeue_stale_jobs', { p_older_than: '15 minutes' });
  for (let n = 0; n < maxJobs; n++) {
    const { data, error } = await db.rpc('claim_next_job', { p_worker_id: WORKER_ID });
    if (error) throw new Error(`claim_next_job failed: ${error.message}`);
    const job = (data as Row[] | null)?.[0];
    if (!job) {
      console.log(`[${WORKER_ID}] queue empty`);
      return;
    }
    await processJob(job);
  }
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
