import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import * as z from 'zod/v4';
import type { SceneDraft } from './build';
import { iconNames } from './icons';
import { LAYOUT_IDS, type Word } from './schema';
import { PACE_SECONDS, type ProjectSettings } from './settings';

/** Icons the planner is encouraged to use (all exist in Phosphor). */
const CURATED_ICONS = [
  'clock', 'timer', 'hourglass', 'calendar', 'alarm', 'bell', 'lightning', 'fire', 'sparkle', 'star', 'heart', 'crown',
  'trophy', 'medal', 'target', 'rocket-launch', 'trend-up', 'trend-down', 'chart-line-up', 'chart-bar', 'chart-pie',
  'currency-circle-dollar', 'money', 'wallet', 'credit-card', 'piggy-bank', 'coins', 'tag', 'percent', 'receipt',
  'shopping-cart', 'shopping-bag', 'storefront', 'package', 'truck', 'gift', 'basket', 'barcode', 'handshake',
  'users', 'users-three', 'user', 'user-circle', 'smiley', 'smiley-sad', 'thumbs-up', 'thumbs-down', 'hand-tap',
  'hand-pointing', 'chat-circle-text', 'chats', 'megaphone', 'microphone', 'phone', 'envelope', 'whatsapp-logo',
  'instagram-logo', 'tiktok-logo', 'youtube-logo', 'facebook-logo', 'share-network', 'link', 'globe', 'map-pin',
  'house', 'buildings', 'factory', 'briefcase', 'suitcase', 'graduation-cap', 'book-open', 'books', 'pencil',
  'lightbulb', 'brain', 'puzzle-piece', 'gear', 'wrench', 'hammer', 'magic-wand', 'paint-brush', 'palette',
  'camera', 'video-camera', 'film-slate', 'play-circle', 'music-notes', 'headphones', 'image', 'monitor', 'laptop',
  'device-mobile', 'robot', 'cpu', 'wifi-high', 'cloud', 'lock', 'shield-check', 'key', 'eye', 'magnifying-glass',
  'check-circle', 'x-circle', 'warning', 'info', 'question', 'prohibit', 'arrow-right', 'arrows-clockwise',
  'leaf', 'plant', 'flower-lotus', 'tree', 'drop', 'sun', 'moon', 'snowflake', 'thermometer', 'wind',
  'heartbeat', 'first-aid', 'pill', 'tooth', 'stethoscope', 'syringe', 'barbell', 'person-simple-run', 'bicycle',
  'coffee', 'pizza', 'hamburger', 'cooking-pot', 'fork-knife', 'cake', 'wine', 'car', 'airplane', 'gas-pump',
  'scissors', 't-shirt', 'dress', 'sneaker', 'diamond', 'baby', 'paw-print', 'mosque', 'moon-stars', 'confetti',
];

const SceneSchema = z.object({
  startWord: z.number().int().describe('Index of the first transcript word in this scene'),
  endWord: z.number().int().describe('Index of the last transcript word in this scene (inclusive)'),
  layout: z.enum(LAYOUT_IDS),
  title: z.string().describe('Main on-screen text, short (max ~7 words), in the caption language'),
  subtitle: z.string().nullable().describe('Optional supporting line, max ~8 words'),
  emphasis: z.array(z.string()).describe('1-2 words copied exactly from title to highlight'),
  icon: z.string().nullable().describe('Phosphor icon name, e.g. "clock"'),
  items: z
    .array(z.object({ text: z.string(), icon: z.string().nullable() }))
    .describe('For list/steps (2-4 items) or compare (exactly 2: before, after)'),
  stat: z
    .object({ value: z.number(), prefix: z.string(), suffix: z.string(), label: z.string() })
    .nullable()
    .describe('For stat scenes: the number to animate'),
  productImage: z.number().int().nullable().describe('Index of a product image to show, for product scenes'),
  media: z.number().int().nullable().describe('Index of a user photo/clip, for media scenes'),
});

const PlanSchema = z.object({
  scenes: z.array(SceneSchema),
});

const SYSTEM = `You are a senior motion designer and short-form video editor. You turn a voice-over transcript into a scene-by-scene plan for a vertical motion-graphics video (Reels / TikTok / Shorts).

How to plan:
- Scenes tile the whole transcript in order with no gaps or overlaps: scene N+1 starts at the word right after scene N ends. Cut on natural phrase boundaries.
- The first scene is a hook that stops the scroll. When the brief has an end card or the goal is marketing, the last scene is a "cta".
- Choose each layout from what is being said, never from habit:
  hook = bold opening claim or question; statement = a key sentence; icon_point = one concept that has a clear icon;
  list = 2-4 parallel points; steps = an ordered process; compare = before/after, problem/solution, A vs B (exactly 2 items, the better one second);
  stat = a number, percentage, price or duration that deserves to count up; quote = a memorable line or testimonial;
  product = the product itself is named or shown (price/offer); media = show one of the user's photos/clips;
  speaker = the speaker talks on camera (talking-head videos only); speaker_split = speaker on top with a graphic panel explaining the point below (talking-head only);
  cta = call to action / contact.
- Never use the same layout twice in a row. Vary rhythm and composition so the video never feels like one repeated template.
- On-screen text is not a transcript: write short, punchy titles that capture the idea, in the requested caption language and script, with correct spelling (fix speech-recognition mistakes). If the caption language is a dialect, keep its natural wording.
- emphasis words must appear exactly in the title. Prefer numbers, the product name, or the strongest word.
- icon must be a Phosphor icon name. Prefer the suggested list; pick the most literal match for the scene's meaning.
- Respect the requested pace: target scene lengths are given in seconds; use word timings to judge length.`;

const describeSettings = (s: ProjectSettings, extras: { productImages: number; media: number; speaker: boolean }) => {
  const [minS, maxS] = PACE_SECONDS[s.pace];
  const lines = [
    `Video type: ${s.videoType}${s.videoType === 'talking_head' && extras.speaker ? ' (speaker footage available: use speaker for roughly half the scenes, speaker_split for key explanations, and an occasional full motion scene)' : ''}`,
    `Goal: ${s.goal}`,
    s.businessName && `Business: ${s.businessName}${s.businessType ? ` (${s.businessType})` : ''}`,
    s.idea && `Brief from the creator: ${s.idea}`,
    s.product && `Product: ${JSON.stringify(s.product)}`,
    `Caption language: ${s.captionLanguage} (${s.captionScript} script)`,
    `Pace: ${s.pace} - each scene ${minS}-${maxS}s`,
    `Visual style: ${s.style}`,
    s.endCard && `End card: ${JSON.stringify(s.endCard)}`,
    `Product images available: ${extras.productImages}${extras.productImages ? ' (indices 0..' + (extras.productImages - 1) + ')' : ''}`,
    `User photos/clips available: ${extras.media}${extras.media ? ' (indices 0..' + (extras.media - 1) + ')' : ''}`,
  ];
  return lines.filter(Boolean).join('\n');
};

export type LlmPlanInput = {
  words: Word[];
  settings: ProjectSettings;
  productImages: number;
  media: number;
  speaker: boolean;
};

/** Ask Claude for a scene plan. Throws if the model refuses or returns nothing usable. */
export const claudePlanner = async (input: LlmPlanInput, client = new Anthropic()): Promise<SceneDraft[]> => {
  const transcript = input.words.map((w, i) => `${i}|${(w.startMs / 1000).toFixed(2)}|${w.text}`).join('\n');
  const known = new Set(iconNames());
  const suggested = CURATED_ICONS.filter((n) => known.has(n));

  const response = await client.beta.messages.parse({
    model: 'claude-opus-5-5',
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'high', format: betaZodOutputFormat(PlanSchema) },
    system: SYSTEM,
    messages: [
      {
        role: 'user',
        content: [
          `<project>\n${describeSettings(input.settings, input)}\n</project>`,
          `<suggested_icons>\n${suggested.join(', ')}\n</suggested_icons>`,
          `<transcript format="index|start_seconds|word">\n${transcript}\n</transcript>`,
          'Plan the scenes.',
        ].join('\n\n'),
      },
    ],
  });

  if (response.stop_reason === 'refusal') {
    throw new Error(`Planner refused: ${response.stop_details?.category ?? 'unknown'}`);
  }
  const parsed = response.parsed_output;
  if (!parsed || parsed.scenes.length === 0) throw new Error(`Planner returned no scenes (stop_reason=${response.stop_reason})`);
  return parsed.scenes;
};
