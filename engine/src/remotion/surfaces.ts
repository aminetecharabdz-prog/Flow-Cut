import type { Palette, Scene, Surface } from '../plan/schema';
import { contrast, mix } from './util';

const pickAccent = (bg: string, options: string[]) =>
  options.find((c) => contrast(c, bg) >= 2.6) ?? (contrast('#FFFFFF', bg) > contrast('#111111', bg) ? '#FFFFFF' : '#111111');

/** Palette for a scene drawn on a given surface, keeping text and accents readable. */
export const surfacePalette = (base: Palette, surface: Surface): Palette => {
  const bgFor: Record<Surface, string> = {
    base: base.background,
    primary: base.primary,
    secondary: base.secondary,
    light: contrast(base.background, '#FFFFFF') < 1.3 ? mix(base.background, '#000000', 0.04) : '#F6F4EF',
    dark: contrast(base.background, '#000000') < 1.3 ? mix(base.background, '#FFFFFF', 0.06) : '#0D0E14',
  };
  if (surface === 'base') return base;
  const bg = bgFor[surface];
  const text = contrast('#FFFFFF', bg) >= contrast('#111111', bg) ? '#FFFFFF' : '#111111';
  const accent = pickAccent(bg, surface === 'primary' ? [base.secondary, text] : surface === 'secondary' ? [base.primary, text] : [base.primary, base.secondary]);
  const second = pickAccent(bg, [base.secondary, base.primary, text].filter((c) => c !== accent));
  return {
    background: bg,
    surface: mix(bg, text, 0.08),
    text,
    muted: mix(text, bg, 0.35),
    primary: accent,
    secondary: second,
  };
};

export const scenePalette = (base: Palette, scene: Scene) =>
  surfacePalette(base, scene.layout === 'speaker' || scene.layout === 'speaker_split' ? 'base' : scene.surface);
