// Shared types and small helpers for the motion engine.

export type Word = { t: string; s: number; e: number };

export type Kind =
  | 'slam' | 'stack' | 'focus' | 'counter' | 'split' | 'steps'
  | 'question' | 'quote' | 'grid' | 'orbit' | 'bars' | 'cta' | 'outro';

export type Surface = 'base' | 'ink' | 'accent' | 'alt';

export type Scene = {
  id: string;
  kind: Kind;
  surface: Surface;
  start: number;
  end: number;
  words: Word[];
  /** Indexes of highlighted words. */
  hl: number[];
  step?: number;
};

export type Format = '9:16' | '1:1' | '4:5' | '16:9';
export type Captions = 'off' | 'line' | 'box';
export type Bed = 'none' | 'pulse' | 'ambient' | 'file';

export type Settings = {
  theme: string;
  colors: Colors | null;
  font: string;
  format: Format;
  energy: number;
  captions: Captions;
  grain: boolean;
  progress: boolean;
  sfx: boolean;
  sfxVol: number;
  bed: Bed;
  bedVol: number;
  voiceVol: number;
  brand: string;
  handle: string;
  cta: string;
  logo: string | null;
  outro: boolean;
  seed: number;
};

export type Colors = { bg: string; ink: string; accent: string; alt: string };

export type Project = {
  words: Word[];
  scenes: Scene[];
  duration: number;
  /** Seconds of audio (without the outro). */
  speech: number;
  hasVoice: boolean;
  settings: Settings;
};

export const FORMAT_SIZE: Record<Format, [number, number]> = {
  '9:16': [1080, 1920],
  '1:1': [1080, 1080],
  '4:5': [1080, 1350],
  '16:9': [1920, 1080],
};

// ---------- math ----------
export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const prog = (t: number, start: number, dur: number) => clamp((t - start) / Math.max(dur, 1e-6));
export const outExpo = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
export const outCubic = (t: number) => 1 - Math.pow(1 - t, 3);
export const outQuint = (t: number) => 1 - Math.pow(1 - t, 5);
export const inOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const inOutQuart = (t: number) => (t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2);
export const outBack = (t: number, s = 1.7) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);
export const outElastic = (t: number) =>
  t <= 0 ? 0 : t >= 1 ? 1 : Math.pow(2, -10 * t) * Math.sin(((t * 10 - 0.75) * 2 * Math.PI) / 3) + 1;
export const TAU = Math.PI * 2;

export const rng = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
export const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};
export const uid = () => Math.random().toString(36).slice(2, 10);

// ---------- colour ----------
export const rgb = (hex: string): [number, number, number] => {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
export const rgba = (hex: string, a: number) => {
  const [r, g, b] = rgb(hex);
  return `rgba(${r},${g},${b},${clamp(a)})`;
};
export const lum = (hex: string) => {
  const c = rgb(hex).map((v) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
export const contrast = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};
/** The candidate that reads best on `bg`. */
export const readable = (bg: string, ...cands: string[]) =>
  cands.reduce((best, c) => (contrast(bg, c) > contrast(bg, best) ? c : best), cands[0]);
export const mix = (a: string, b: string, t: number) => {
  const x = rgb(a), y = rgb(b);
  const c = x.map((v, i) => Math.round(lerp(v, y[i], t)));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
};

// ---------- themes ----------
export type Theme = Colors & { id: string; name: string; mood: string };

export const THEMES: Theme[] = [
  { id: 'onyx', name: 'أونيكس', mood: 'أسود حاد وأخضر كهربائي', bg: '#0B0B0D', ink: '#F4F1EA', accent: '#D7FF3A', alt: '#FF4D2E' },
  { id: 'ivory', name: 'عاج', mood: 'ورق دافئ وحبر أحمر', bg: '#F2EEE5', ink: '#141414', accent: '#E5341D', alt: '#1D3BFF' },
  { id: 'abyss', name: 'عمق', mood: 'كحلي ليلي وكهرمان', bg: '#06122A', ink: '#EAF2FF', accent: '#FFB21E', alt: '#38D9FF' },
  { id: 'carbon', name: 'كربون', mood: 'رمادي تقني وفيروزي', bg: '#16181D', ink: '#F3F4F6', accent: '#00E3B5', alt: '#8B6CFF' },
  { id: 'royal', name: 'ملكي', mood: 'بنفسجي عميق وذهب', bg: '#170B2E', ink: '#F8F2FF', accent: '#F6C453', alt: '#FF5C8A' },
  { id: 'signal', name: 'إشارة', mood: 'أصفر صارخ وأسود', bg: '#FFD60A', ink: '#0A0A0A', accent: '#0A0A0A', alt: '#FF3B30' },
  { id: 'dune', name: 'كثبان', mood: 'رملي هادئ وأخضر زيتي', bg: '#ECE2CF', ink: '#1E1A15', accent: '#C2410C', alt: '#0F766E' },
  { id: 'crimson', name: 'قرمزي', mood: 'أحمر قاتم وكريمي', bg: '#2A0A0E', ink: '#FFF1E6', accent: '#FF3D3D', alt: '#FFC9A8' },
];

export const themeColors = (s: Settings): Colors => s.colors ?? THEMES.find((t) => t.id === s.theme) ?? THEMES[0];

export type Pal = { bg: string; fg: string; acc: string; acc2: string; on: string };

/** Colours for a scene, depending on which surface it sits on. */
export const surfacePal = (c: Colors, s: Surface): Pal => {
  let bg = c.bg, fg = c.ink, acc = c.accent, acc2 = c.alt;
  if (s === 'ink') { bg = c.ink; fg = c.bg; }
  if (s === 'accent') { bg = c.accent; fg = readable(c.accent, c.ink, c.bg); acc = readable(c.accent, c.bg, c.ink); acc2 = c.alt; }
  if (s === 'alt') { bg = c.alt; fg = readable(c.alt, c.ink, c.bg, '#ffffff', '#000000'); acc = readable(c.alt, c.accent, fg); }
  if (contrast(bg, acc) < 1.8) acc = readable(bg, c.accent, c.alt, fg);
  if (contrast(bg, acc2) < 1.5) acc2 = readable(bg, c.alt, c.accent, fg);
  return { bg, fg, acc, acc2, on: readable(acc, '#0B0B0D', '#FFFFFF', bg, fg) };
};

// ---------- fonts ----------
export type FontDef = { id: string; family: string; weight: number; label: string; scale: number };

export const FONTS: FontDef[] = [
  { id: 'alexandria', family: 'Alexandria', weight: 900, label: 'الإسكندرية', scale: 0.92 },
  { id: 'cairo', family: 'Cairo', weight: 900, label: 'القاهرة', scale: 1 },
  { id: 'kufi', family: 'Noto Kufi Arabic', weight: 900, label: 'كوفي', scale: 0.9 },
  { id: 'changa', family: 'Changa', weight: 800, label: 'شانغا', scale: 1 },
  { id: 'lalezar', family: 'Lalezar', weight: 400, label: 'لاله‌زار', scale: 1.08 },
  { id: 'readex', family: 'Readex Pro', weight: 700, label: 'ريدكس', scale: 0.95 },
  { id: 'messiri', family: 'El Messiri', weight: 700, label: 'المسيري', scale: 1.05 },
  { id: 'rakkas', family: 'Rakkas', weight: 400, label: 'رقّاص', scale: 1.08 },
];
export const fontOf = (id: string) => FONTS.find((f) => f.id === id) ?? FONTS[0];
export const fontCss = (f: FontDef, px: number) => `${f.weight} ${Math.round(px)}px "${f.family}", "Cairo", sans-serif`;

export const loadFonts = async () => {
  await Promise.all(FONTS.map((f) => document.fonts.load(fontCss(f, 40), 'أبجد abc 123').catch(() => undefined)));
};

export const defaultSettings = (): Settings => ({
  theme: 'onyx',
  colors: null,
  font: 'alexandria',
  format: '9:16',
  energy: 1,
  captions: 'off',
  grain: true,
  progress: true,
  sfx: true,
  sfxVol: 0.7,
  bed: 'pulse',
  bedVol: 0.35,
  voiceVol: 1,
  brand: '',
  handle: '',
  cta: '',
  logo: null,
  outro: true,
  seed: 7,
});
