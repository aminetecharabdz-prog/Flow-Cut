import { mkdirSync, readFileSync } from 'node:fs';
import { assemblePlan, rulePlanner } from '../plan/build';
import type { StyleId, Word } from '../plan/schema';
import type { ProjectSettings } from '../plan/settings';
import { renderPlan } from '../render';

// Render a real transcript with the rule planner (no LLM).
// Usage: tsx src/scripts/render-transcript.ts <words.json> <voiceUrl> [style] [out] [phone]
const [wordsFile, voiceUrl, style = 'vivid', out = 'out/transcript.mp4', phone] = process.argv.slice(2);
const words = JSON.parse(readFileSync(wordsFile, 'utf8')) as Word[];
mkdirSync('out', { recursive: true });
const settings: ProjectSettings = {
  title: '',
  goal: 'product_ad',
  videoType: 'motion_graphics',
  captionLanguage: 'ar-DZ',
  captionScript: 'arabic',
  style: style as StyleId,
  colors: {},
  pace: 'medium',
  captionMode: 'word_box',
  aspect: '9:16',
  sfx: true,
  endCard: phone ? { phone } : undefined,
};
const drafts = rulePlanner(words, settings);
for (const d of drafts) console.log(`${d.layout.padEnd(10)} ${String(d.visual ?? '').padEnd(10)} ${d.surface?.padEnd(9)} ${d.step ?? ''} ${d.title}`);
const durationMs = words[words.length - 1].endMs + 300;
await renderPlan(assemblePlan({ settings, words, durationMs, drafts, voiceUrl, seed: 5 }), { outFile: out, scale: 2 / 3 });
console.log(`Rendered ${out}`);
