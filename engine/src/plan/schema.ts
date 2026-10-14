import { z } from 'zod';

/**
 * VideoPlan is the contract between the planner (LLM + rules) and the
 * renderer (Remotion). Everything the renderer needs is in here: no network
 * lookups happen at render time except for media URLs.
 */

export const STYLE_IDS = ['vivid', 'luxury', 'poster', 'clean', 'neon', 'editorial'] as const;
export const StyleId = z.enum(STYLE_IDS);
export type StyleId = z.infer<typeof StyleId>;

export const LAYOUT_IDS = [
  'hook', // big kinetic title that grabs attention
  'statement', // title + supporting line (+ optional icon)
  'icon_point', // one big animated icon with a short line
  'list', // 2-4 items revealed one by one
  'steps', // numbered timeline
  'compare', // A vs B / before -> after, connected
  'stat', // big animated number
  'quote', // highlighted quote
  'product', // product image + price / offer badges
  'media', // user photo or clip, full frame, with title
  'speaker', // talking-head moment (speaker full frame, captions only)
  'speaker_split', // speaker on top, graphic panel below
  'cta', // end card / call to action
] as const;
export const LayoutId = z.enum(LAYOUT_IDS);
export type LayoutId = z.infer<typeof LayoutId>;

export const FONT_IDS = [
  'cairo', 'tajawal', 'lalezar', 'el_messiri', 'readex_pro', 'alexandria', 'baloo_bhaijaan',
  'almarai', 'changa', 'noto_kufi', 'rubik', 'aref_ruqaa', 'amiri', 'inter', 'montserrat', 'bebas_neue',
] as const;
export const FontId = z.enum(FONT_IDS);
export type FontId = z.infer<typeof FontId>;

export const CAPTION_MODES = ['none', 'word_box', 'word_color', 'karaoke_line'] as const;
export const CaptionMode = z.enum(CAPTION_MODES);
export type CaptionMode = z.infer<typeof CaptionMode>;

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Expected #RRGGBB');

export const Palette = z.object({
  background: hex,
  surface: hex,
  text: hex,
  muted: hex,
  primary: hex,
  secondary: hex,
});
export type Palette = z.infer<typeof Palette>;

export const Word = z.object({
  text: z.string().min(1),
  startMs: z.number().int().nonnegative(),
  endMs: z.number().int().nonnegative(),
});
export type Word = z.infer<typeof Word>;

/** Icons are resolved to raw SVG before rendering (see plan/icons.ts). */
export const Icon = z.object({
  name: z.string(),
  body: z.string().optional(),
  viewBox: z.string().optional(),
});
export type Icon = z.infer<typeof Icon>;

export const Item = z.object({
  text: z.string().min(1),
  icon: Icon.optional(),
});
export type Item = z.infer<typeof Item>;

export const Media = z.object({
  url: z.string().url(),
  type: z.enum(['image', 'video']),
  fit: z.enum(['cover', 'contain']).default('cover'),
  /** Offset into a video clip. */
  startFromMs: z.number().int().nonnegative().default(0),
});
export type Media = z.infer<typeof Media>;

export const Scene = z.object({
  id: z.string(),
  startMs: z.number().int().nonnegative(),
  endMs: z.number().int().positive(),
  layout: LayoutId,
  title: z.string().optional(),
  subtitle: z.string().optional(),
  /** Words of `title` to highlight with the style's emphasis treatment. */
  emphasis: z.array(z.string()).default([]),
  icon: Icon.optional(),
  items: z.array(Item).max(5).default([]),
  stat: z
    .object({
      value: z.number(),
      decimals: z.number().int().min(0).max(2).default(0),
      prefix: z.string().default(''),
      suffix: z.string().default(''),
      label: z.string().optional(),
    })
    .optional(),
  product: z
    .object({
      imageUrl: z.string().url().optional(),
      name: z.string().optional(),
      price: z.string().optional(),
      oldPrice: z.string().optional(),
      badge: z.string().optional(),
    })
    .optional(),
  media: Media.optional(),
  /** Use the secondary colour instead of the primary for this scene's accents. */
  accent: z.enum(['primary', 'secondary']).default('primary'),
});
export type Scene = z.infer<typeof Scene>;

export const EndCard = z.object({
  title: z.string().optional(),
  handle: z.string().optional(),
  phone: z.string().optional(),
  website: z.string().optional(),
  buttonText: z.string().optional(),
});
export type EndCard = z.infer<typeof EndCard>;

export const VideoPlan = z
  .object({
    version: z.literal(1),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    fps: z.union([z.literal(30), z.literal(60)]),
    durationMs: z.number().int().positive(),
    direction: z.enum(['rtl', 'ltr']),
    style: StyleId,
    palette: Palette,
    fonts: z.object({ heading: FontId, body: FontId }),
    captions: z.object({
      mode: CaptionMode,
      position: z.enum(['bottom', 'middle', 'top']).default('bottom'),
    }),
    words: z.array(Word).default([]),
    voice: z.object({ url: z.string().url(), volume: z.number().min(0).max(2).default(1) }).optional(),
    music: z.object({ url: z.string().url(), volume: z.number().min(0).max(1).default(0.18) }).optional(),
    sfx: z.boolean().default(true),
    /** Base talking-head clip; when present, speaker layouts show it. */
    speaker: z.object({ url: z.string().url(), startFromMs: z.number().int().nonnegative().default(0) }).optional(),
    logoUrl: z.string().url().optional(),
    watermark: z.boolean().default(false),
    endCard: EndCard.optional(),
    scenes: z.array(Scene).min(1),
    /** Seed for the controlled randomness that keeps videos from looking identical. */
    seed: z.number().int().default(1),
  })
  .superRefine((plan, ctx) => {
    plan.scenes.forEach((s, i) => {
      if (s.endMs <= s.startMs) {
        ctx.addIssue({ code: 'custom', path: ['scenes', i, 'endMs'], message: 'Scene must end after it starts' });
      }
      if (s.endMs > plan.durationMs + 50) {
        ctx.addIssue({ code: 'custom', path: ['scenes', i, 'endMs'], message: 'Scene ends after the video' });
      }
    });
  });
export type VideoPlan = z.infer<typeof VideoPlan>;
export type VideoPlanInput = z.input<typeof VideoPlan>;

export const ASPECT_SIZES = {
  '9:16': { width: 1080, height: 1920 },
  '1:1': { width: 1080, height: 1080 },
  '4:5': { width: 1080, height: 1350 },
  '16:9': { width: 1920, height: 1080 },
} as const;
export type AspectRatio = keyof typeof ASPECT_SIZES;
