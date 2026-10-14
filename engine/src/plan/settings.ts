import type { AspectRatio, CaptionMode, FontId, Palette, StyleId } from './schema';

export const VIDEO_TYPES = ['motion_graphics', 'media_montage', 'talking_head'] as const;
export type VideoType = (typeof VIDEO_TYPES)[number];

export const GOALS = ['content_marketing', 'product_ad', 'educational', 'story', 'news', 'event'] as const;
export type Goal = (typeof GOALS)[number];

export type Pace = 'calm' | 'medium' | 'fast';

/** Everything the user chose in the app, normalised for the engine. */
export type ProjectSettings = {
  title: string;
  businessName?: string;
  businessType?: string;
  goal: Goal;
  videoType: VideoType;
  /** Free-text brief: what the video is about / the problem it solves. */
  idea?: string;
  /** Language of the on-screen text (BCP-47-ish, e.g. ar, ar-DZ, fr, en). */
  captionLanguage: string;
  captionScript: 'arabic' | 'latin';
  style: StyleId;
  headingFont?: FontId;
  bodyFont?: FontId;
  colors: { primary?: string; secondary?: string; background?: string };
  pace: Pace;
  captionMode: CaptionMode;
  aspect: AspectRatio;
  sfx: boolean;
  product?: { name?: string; price?: string; oldPrice?: string; offer?: string; url?: string };
  endCard?: { handle?: string; phone?: string; website?: string; buttonText?: string };
};

/** Seconds per scene for each pace (matches what viewers expect on Reels/TikTok). */
export const PACE_SECONDS: Record<Pace, [number, number]> = {
  fast: [1.2, 2.2],
  medium: [2, 3.2],
  calm: [3, 4.5],
};

/** Default fonts per style when the user doesn't pick one. */
export const STYLE_FONTS: Record<StyleId, { heading: FontId; body: FontId }> = {
  vivid: { heading: 'lalezar', body: 'cairo' },
  luxury: { heading: 'el_messiri', body: 'tajawal' },
  poster: { heading: 'baloo_bhaijaan', body: 'cairo' },
  clean: { heading: 'alexandria', body: 'readex_pro' },
  neon: { heading: 'changa', body: 'cairo' },
  editorial: { heading: 'readex_pro', body: 'noto_kufi' },
};

/** Default colours per style. */
const STYLE_COLORS: Record<StyleId, { background: string; primary: string; secondary: string }> = {
  vivid: { background: '#0E1230', primary: '#FFC83D', secondary: '#FF4F7B' },
  luxury: { background: '#0B0A08', primary: '#D4A64A', secondary: '#8E1F2F' },
  poster: { background: '#F4EFE6', primary: '#FFD400', secondary: '#E63946' },
  clean: { background: '#FAFAF7', primary: '#2563EB', secondary: '#F59E0B' },
  neon: { background: '#07020F', primary: '#A855F7', secondary: '#22D3EE' },
  editorial: { background: '#F7F3EA', primary: '#C2410C', secondary: '#1E3A8A' },
};

const HEX = /^#[0-9a-fA-F]{6}$/;
const toHex = (c: string | undefined) => (c && HEX.test(c) ? c.toUpperCase() : undefined);

const rgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const hexOf = (c: number[]) => `#${c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`;
const mixHex = (a: string, b: string, t: number) => hexOf(rgb(a).map((v, i) => v + (rgb(b)[i] - v) * t));
const lum = (hex: string) => {
  const [r, g, b] = rgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** Build a full, readable palette from the user's 1-3 colours. */
export const derivePalette = (style: StyleId, colors: ProjectSettings['colors']): Palette => {
  const d = STYLE_COLORS[style];
  const primary = toHex(colors.primary) ?? d.primary;
  const secondary = toHex(colors.secondary) ?? d.secondary;
  const background = toHex(colors.background) ?? d.background;
  const dark = lum(background) < 0.35;
  const text = dark ? '#FFFFFF' : '#111111';
  return {
    background,
    surface: dark ? mixHex(background, '#FFFFFF', 0.08) : '#FFFFFF',
    text,
    muted: mixHex(text, background, 0.42),
    primary,
    secondary,
  };
};

export const directionFor = (lang: string, script: 'arabic' | 'latin') =>
  lang.startsWith('ar') && script === 'arabic' ? ('rtl' as const) : ('ltr' as const);
