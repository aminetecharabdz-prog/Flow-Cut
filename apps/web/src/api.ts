import { createClient, FunctionsHttpError } from '@supabase/supabase-js';

// Public client values: safe in the browser, data is protected by row level security.
const SUPABASE_URL = 'https://ukekgjillyhxbiexewpi.supabase.co';
const SUPABASE_KEY = 'sb_publishable_AUhKj0D_LkM_cKkn2dWB9A_BFT5Zsij';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

export class AppError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
  }
}

const MIME: Record<string, string> = {
  mp3: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/aac', wav: 'audio/wav', ogg: 'audio/ogg', webm: 'audio/webm',
  mp4: 'video/mp4', mov: 'video/quicktime', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic', svg: 'image/svg+xml',
};
export const extOf = (name: string) => (name.includes('.') ? name.split('.').pop()!.toLowerCase() : 'bin');
export const mimeOf = (file: File) => file.type || MIME[extOf(file.name)] || 'application/octet-stream';
export const isVideo = (file: File) => mimeOf(file).startsWith('video/');

export const userId = async () => {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new AppError('سجّل الدخول أولاً');
  return data.user.id;
};

/** Upload to `<user>/<project>/<name>.<ext>` and register the asset row. */
export const uploadAsset = async (opts: { projectId: string; file: File; bucket: string; kind: string; name: string; durationMs?: number }) => {
  const uid = await userId();
  const path = `${uid}/${opts.projectId}/${opts.name}.${extOf(opts.file.name)}`;
  const contentType = mimeOf(opts.file);
  const up = await supabase.storage.from(opts.bucket).upload(path, opts.file, { contentType, upsert: true });
  if (up.error) throw new AppError(`تعذّر رفع الملف: ${up.error.message}`);
  const { data, error } = await supabase
    .from('assets')
    .insert({
      project_id: opts.projectId,
      kind: opts.kind,
      bucket: opts.bucket,
      path,
      mime_type: contentType,
      size_bytes: opts.file.size,
      ...(opts.durationMs ? { duration_ms: Math.round(opts.durationMs) } : {}),
    })
    .select('id')
    .single();
  if (error) throw new AppError(`تعذّر حفظ الملف: ${error.message}`);
  return data.id as string;
};

export type Job = {
  id: string;
  project_id: string;
  type: 'full_generation' | 'rerender' | 'export';
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'canceled';
  stage: string | null;
  progress: number;
  error: string | null;
};

/** Queue a job through the `generate` function (it also wakes the render worker). */
export const requestJob = async (projectId: string, action: 'generate' | 'rerender' | 'export', extra: Record<string, unknown> = {}) => {
  const { data, error } = await supabase.functions.invoke('generate', { body: { action, project_id: projectId, ...extra } });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const body = await error.context.json().catch(() => ({}));
      throw new AppError(body.error ?? 'تعذّر بدء العملية', body.code);
    }
    throw new AppError('تعذّر الاتصال بالخادم، تحقق من الإنترنت');
  }
  return data as { job: Job; dispatched: boolean };
};

export const signedUrl = async (assetId?: string | null, download?: string) => {
  if (!assetId) return null;
  const { data: a } = await supabase.from('assets').select('bucket, path').eq('id', assetId).maybeSingle();
  if (!a) return null;
  const { data } = await supabase.storage.from(a.bucket).createSignedUrl(a.path, 3600, download ? { download } : undefined);
  return data?.signedUrl ?? null;
};

export const creditSeconds = async () => {
  const { data } = await supabase.rpc('get_credit_balance');
  return Number(data ?? 0);
};

export const currentPlan = async () => {
  const uid = await userId();
  const { data } = await supabase.from('profiles').select('plan').eq('id', uid).maybeSingle();
  return (data?.plan as string) ?? 'free';
};

export const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/** Media duration from the browser's decoder. */
export const mediaDurationMs = (file: File) =>
  new Promise<number>((resolve, reject) => {
    const el = document.createElement(isVideo(file) ? 'video' : 'audio');
    const url = URL.createObjectURL(file);
    el.preload = 'metadata';
    el.onloadedmetadata = () => {
      const d = el.duration;
      URL.revokeObjectURL(url);
      Number.isFinite(d) ? resolve(d * 1000) : reject(new Error('unknown duration'));
    };
    el.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('unreadable'));
    };
    el.src = url;
  });

export const friendlyError = (e: unknown) => {
  const code = e instanceof AppError ? e.code : undefined;
  const map: Record<string, string> = {
    INSUFFICIENT_CREDITS: 'رصيد الدقائق لا يكفي لهذا الفيديو.',
    INVALID_DURATION: 'مدة الصوت يجب أن تكون بين 5 ثوانٍ و3 دقائق.',
    NO_AUDIO: 'أضف صوتك أولاً.',
    JOB_ACTIVE: 'هناك عملية جارية على هذا الفيديو، انتظر حتى تنتهي.',
    PLAN_LIMIT: 'هذه الجودة متاحة في الاشتراك المدفوع.',
    NOT_READY: 'الفيديو لم يجهز بعد.',
    NOT_GENERATED: 'اصنع الفيديو أولاً.',
  };
  return (code && map[code]) || (e instanceof Error ? e.message : 'حدث خطأ غير متوقع');
};
