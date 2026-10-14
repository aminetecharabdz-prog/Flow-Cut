import type { Word } from '../plan/schema';

export const clamp = (v: number, min = 0, max = 1) => Math.min(max, Math.max(min, v));

const hexToRgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const;
};

export const alpha = (hex: string, a: number) => {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${clamp(a)})`;
};

export const mix = (a: string, b: string, t: number) => {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const c = ca.map((v, i) => Math.round(v + (cb[i] - v) * t));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
};

const luminance = (hex: string) => {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** Black or white, whichever reads better on `bg`. */
export const onColor = (bg: string) => (luminance(bg) > 0.45 ? '#111111' : '#FFFFFF');

export const isDark = (hex: string) => luminance(hex) < 0.35;

const RTL_RE = /[֐-ࣿיִ-﷿ﹰ-﻿]/;
export const isRtlText = (text: string) => RTL_RE.test(text);

/** Strip Arabic diacritics/tatweel and punctuation for fuzzy word matching. */
export const normalizeWord = (w: string) =>
  w
    .toLowerCase()
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[^\p{L}\p{N}]/gu, '');

export const splitWords = (text: string) => text.split(/\s+/).filter(Boolean);

/**
 * For each displayed token, find when it is spoken (ms, relative to the
 * video). Tokens that cannot be matched are spread evenly between their
 * matched neighbours so text still feels synced to the voice.
 */
export const revealTimes = (
  tokens: string[],
  words: Word[],
  startMs: number,
  endMs: number,
  /** Never wait longer than this per token: keeps the screen from sitting empty. */
  maxStepMs = 160,
): number[] => {
  const inScene = words.filter((w) => w.endMs > startMs - 150 && w.startMs < endMs);
  const result: (number | null)[] = tokens.map(() => null);
  let cursor = 0;
  tokens.forEach((tok, i) => {
    const n = normalizeWord(tok);
    if (!n) return;
    for (let j = cursor; j < inScene.length; j++) {
      const wn = normalizeWord(inScene[j].text);
      if (wn && (wn === n || (n.length > 3 && (wn.startsWith(n) || n.startsWith(wn))))) {
        result[i] = Math.max(startMs, inScene[j].startMs);
        cursor = j + 1;
        break;
      }
    }
  });
  // Default pacing for unmatched tokens: reveal within the first 55% of the scene.
  const span = Math.max(300, (endMs - startMs) * 0.55);
  const step = span / Math.max(1, tokens.length);
  const filled = result.map((t, i) => Math.min(t ?? startMs + 120 + i * step, startMs + 80 + i * maxStepMs));
  // Keep the order monotonic.
  for (let i = 1; i < filled.length; i++) filled[i] = Math.max(filled[i], filled[i - 1]);
  return filled;
};

export const isEmphasis = (token: string, emphasis: string[]) => {
  const n = normalizeWord(token);
  return n.length > 0 && emphasis.some((e) => splitWords(e).some((p) => normalizeWord(p) === n));
};
