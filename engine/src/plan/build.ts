import { ASPECT_SIZES, LAYOUT_IDS, type LayoutId, type Scene, type VideoPlanInput, type Word } from './schema';
import { derivePalette, directionFor, PACE_SECONDS, STYLE_FONTS, type ProjectSettings } from './settings';

/** Planner output for one scene, anchored to transcript word indices. */
export type SceneDraft = {
  startWord: number;
  endWord: number;
  layout: LayoutId;
  title: string;
  subtitle?: string | null;
  emphasis?: string[];
  icon?: string | null;
  items?: { text: string; icon?: string | null }[];
  stat?: { value: number; prefix?: string; suffix?: string; label?: string } | null;
  /** Index into the project's product images. */
  productImage?: number | null;
  /** Index into the project's media (photos/clips). */
  media?: number | null;
};

export type MediaRef = { url: string; type: 'image' | 'video' };

export type AssembleInput = {
  settings: ProjectSettings;
  words: Word[];
  durationMs: number;
  drafts: SceneDraft[];
  voiceUrl?: string;
  speakerUrl?: string;
  musicUrl?: string;
  logoUrl?: string;
  productImages?: string[];
  media?: MediaRef[];
  watermark?: boolean;
  seed?: number;
};

const MIN_SCENE_MS = 900;

/** Fix overlaps/gaps so scenes tile the whole timeline in order. */
export const normalizeDrafts = (drafts: SceneDraft[], wordCount: number): SceneDraft[] => {
  if (wordCount === 0) return drafts.slice(0, 1).map((d) => ({ ...d, startWord: 0, endWord: 0 }));
  const sorted = drafts
    .filter((d) => Number.isFinite(d.startWord) && Number.isFinite(d.endWord))
    .map((d) => ({
      ...d,
      startWord: Math.max(0, Math.min(wordCount - 1, Math.round(d.startWord))),
      endWord: Math.max(0, Math.min(wordCount - 1, Math.round(d.endWord))),
    }))
    .sort((a, b) => a.startWord - b.startWord);
  const out: SceneDraft[] = [];
  for (const d of sorted) {
    const prev = out[out.length - 1];
    const start = prev ? prev.endWord + 1 : 0;
    if (start >= wordCount) break;
    out.push({ ...d, startWord: start, endWord: Math.max(start, d.endWord) });
  }
  if (out.length) out[out.length - 1].endWord = wordCount - 1;
  return out;
};

/** Make each layout valid for what's actually available. */
const fitLayout = (d: SceneDraft, input: AssembleInput): LayoutId => {
  const has = {
    speaker: Boolean(input.speakerUrl),
    media: d.media != null && Boolean(input.media?.[d.media]),
    product: (d.productImage != null && Boolean(input.productImages?.[d.productImage])) || Boolean(input.settings.product?.price),
  };
  let layout: LayoutId = (LAYOUT_IDS as readonly string[]).includes(d.layout) ? d.layout : 'statement';
  if ((layout === 'speaker' || layout === 'speaker_split') && !has.speaker) layout = 'statement';
  if (layout === 'media' && !has.media) layout = d.icon ? 'icon_point' : 'statement';
  if (layout === 'product' && !has.product) layout = 'icon_point';
  if ((layout === 'list' || layout === 'steps') && (d.items?.length ?? 0) < 2) layout = 'statement';
  if (layout === 'compare' && (d.items?.length ?? 0) < 2) layout = 'statement';
  if (layout === 'stat' && !d.stat) layout = 'statement';
  return layout;
};

/** Everything in a plan except the scenes. */
export const planShell = (input: Omit<AssembleInput, 'drafts'>): Omit<VideoPlanInput, 'scenes'> => {
  const { settings, words, durationMs } = input;
  const size = ASPECT_SIZES[settings.aspect];
  return {
    version: 1,
    width: size.width,
    height: size.height,
    fps: 30,
    durationMs,
    direction: directionFor(settings.captionLanguage, settings.captionScript),
    style: settings.style,
    palette: derivePalette(settings.style, settings.colors),
    fonts: {
      heading: settings.headingFont ?? STYLE_FONTS[settings.style].heading,
      body: settings.bodyFont ?? STYLE_FONTS[settings.style].body,
    },
    captions: { mode: settings.captionMode, position: 'bottom' },
    words,
    voice: input.voiceUrl ? { url: input.voiceUrl, volume: 1 } : undefined,
    music: input.musicUrl ? { url: input.musicUrl, volume: 0.16 } : undefined,
    sfx: settings.sfx,
    speaker: input.speakerUrl ? { url: input.speakerUrl, startFromMs: 0 } : undefined,
    logoUrl: input.logoUrl,
    watermark: input.watermark ?? false,
    endCard: settings.endCard,
    seed: input.seed ?? 1,
  };
};

/** Give the last scene a short tail and make the plan cover every scene. */
export const finishTimeline = (scenes: Scene[], durationMs: number) => {
  const last = scenes[scenes.length - 1];
  const tail = last.layout === 'cta' ? 1200 : 400;
  const total = Math.max(durationMs, last.startMs + MIN_SCENE_MS) + tail;
  last.endMs = total;
  return total;
};

export const assemblePlan = (input: AssembleInput): VideoPlanInput => {
  const { settings, words, durationMs } = input;
  const drafts = normalizeDrafts(input.drafts, words.length);

  // Convert word anchors to times. Scenes start just before their first word.
  const starts = drafts.map((d, i) => (i === 0 ? 0 : Math.max(0, (words[d.startWord]?.startMs ?? 0) - 150)));
  let scenes: Scene[] = drafts.map((d, i) => {
    const layout = fitLayout(d, input);
    const productUrl = d.productImage != null ? input.productImages?.[d.productImage] : input.productImages?.[0];
    const media = d.media != null ? input.media?.[d.media] : undefined;
    return {
      id: `s${i + 1}`,
      startMs: starts[i],
      endMs: i + 1 < drafts.length ? starts[i + 1] : durationMs,
      layout,
      title: d.title?.trim() || undefined,
      subtitle: d.subtitle?.trim() || undefined,
      emphasis: (d.emphasis ?? []).filter(Boolean).slice(0, 3),
      icon: d.icon ? { name: d.icon } : undefined,
      items: (d.items ?? []).slice(0, 5).map((it) => ({ text: it.text, icon: it.icon ? { name: it.icon } : undefined })),
      stat: d.stat
        ? { value: Number(d.stat.value) || 0, decimals: Number.isInteger(Number(d.stat.value)) ? 0 : 1, prefix: d.stat.prefix ?? '', suffix: d.stat.suffix ?? '', label: d.stat.label }
        : undefined,
      product:
        layout === 'product'
          ? {
              imageUrl: productUrl,
              name: settings.product?.name,
              price: settings.product?.price,
              oldPrice: settings.product?.oldPrice,
              badge: settings.product?.offer,
            }
          : undefined,
      media: layout === 'media' && media ? { url: media.url, type: media.type, fit: 'cover', startFromMs: 0 } : undefined,
      accent: i % 3 === 2 ? 'secondary' : 'primary',
    };
  });

  // Merge scenes that are too short to read into their predecessor.
  scenes = scenes.reduce<Scene[]>((acc, s) => {
    const prev = acc[acc.length - 1];
    if (prev && s.endMs - s.startMs < MIN_SCENE_MS && s.layout !== 'cta') {
      prev.endMs = s.endMs;
      return acc;
    }
    acc.push(s);
    return acc;
  }, []);
  if (scenes.length === 0) {
    scenes = [{ id: 's1', startMs: 0, endMs: durationMs, layout: 'hook', title: settings.title || ' ', emphasis: [], items: [], accent: 'primary' }];
  }

  const total = finishTimeline(scenes, durationMs);
  return { ...planShell(input), durationMs: total, scenes };
};

// ---------------------------------------------------------------------------
// Rule-based planner: used when no LLM key is configured or the LLM fails.
// ---------------------------------------------------------------------------

const STOP = new Set(['في', 'من', 'على', 'و', 'أن', 'ان', 'هذا', 'هذه', 'the', 'a', 'an', 'and', 'of', 'to', 'le', 'la', 'les', 'de', 'et', 'un', 'une']);

const ICON_HINTS: [RegExp, string][] = [
  [/وقت|ثاني|دقيق|ساع|time|temps|heure/i, 'clock'],
  [/مال|سعر|دينار|دج|price|prix|money|argent/i, 'currency-circle-dollar'],
  [/زبون|زبائن|عميل|client|customer/i, 'users-three'],
  [/فيديو|video|vidéo|montage|مونتاج/i, 'video-camera'],
  [/بيع|شراء|متجر|shop|achat|vente|store/i, 'shopping-bag'],
  [/نجاح|ربح|success|réussite|win/i, 'trophy'],
  [/مشكل|problem|problème/i, 'warning'],
  [/حل|solution/i, 'lightbulb'],
  [/صحة|طبيب|health|santé|doctor/i, 'heartbeat'],
  [/توصيل|delivery|livraison/i, 'truck'],
  [/هاتف|اتصل|phone|appel/i, 'phone'],
  [/تعلم|درس|learn|cours/i, 'graduation-cap'],
];

const pickIcon = (text: string) => ICON_HINTS.find(([re]) => re.test(text))?.[1] ?? 'sparkle';

export const rulePlanner = (words: Word[], settings: ProjectSettings): SceneDraft[] => {
  if (words.length === 0) return [{ startWord: 0, endWord: 0, layout: 'hook', title: settings.title, emphasis: [] }];
  const [minS, maxS] = PACE_SECONDS[settings.pace];
  const groups: [number, number][] = [];
  let start = 0;
  for (let i = 0; i < words.length; i++) {
    const dur = (words[i].endMs - words[start].startMs) / 1000;
    const gap = i + 1 < words.length ? words[i + 1].startMs - words[i].endMs : 0;
    const punct = /[.!?؟،,:;]$/.test(words[i].text);
    if (i === words.length - 1 || dur >= maxS || (dur >= minS && (punct || gap > 300))) {
      groups.push([start, i]);
      start = i + 1;
    }
  }
  const cycle: LayoutId[] =
    settings.videoType === 'talking_head' ? ['speaker', 'speaker_split', 'speaker', 'icon_point'] : ['statement', 'icon_point', 'statement', 'hook'];
  return groups.map(([a, b], gi) => {
    const text = words.slice(a, b + 1).map((w) => w.text).join(' ');
    const longest = words
      .slice(a, b + 1)
      .map((w) => w.text.replace(/[^\p{L}\p{N}]/gu, ''))
      .filter((w) => !STOP.has(w))
      .sort((x, y) => y.length - x.length)[0];
    const isLast = gi === groups.length - 1;
    const layout: LayoutId = gi === 0 ? 'hook' : isLast && settings.endCard ? 'cta' : cycle[gi % cycle.length];
    return { startWord: a, endWord: b, layout, title: text, emphasis: longest ? [longest] : [], icon: pickIcon(text) };
  });
};
