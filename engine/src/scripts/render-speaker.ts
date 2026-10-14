import { mkdirSync } from 'node:fs';
import { assemblePlan, type SceneDraft } from '../plan/build';
import type { Word } from '../plan/schema';
import type { ProjectSettings } from '../plan/settings';
import { renderPlan } from '../render';

// Usage: tsx src/scripts/render-speaker.ts <speakerUrl> [out]
const speakerUrl = process.argv[2];
const out = process.argv[3] ?? 'out/speaker-clean.mp4';
mkdirSync('out', { recursive: true });

const text = 'التشققات الصغار في السنان ماشي خطيرة بصح الكبار لازم تعالجهم بكري ومرة في ستة شهور زور طبيب الأسنان';
const words: Word[] = text.split(' ').map((t, i) => ({ text: t, startMs: 150 + i * 520, endMs: 150 + i * 520 + 460 }));
const settings: ProjectSettings = {
  title: 'Dental tips',
  goal: 'educational',
  videoType: 'talking_head',
  captionLanguage: 'ar-DZ',
  captionScript: 'arabic',
  style: 'clean',
  colors: { primary: '#1E88E5', secondary: '#E53935', background: '#0B3A75' },
  pace: 'medium',
  captionMode: 'word_box',
  aspect: '9:16',
  sfx: true,
  endCard: { handle: '@dr.dentist', phone: '0555 12 34 56', buttonText: 'احجز موعدك' },
};
const drafts: SceneDraft[] = [
  { startWord: 0, endWord: 3, layout: 'speaker', title: 'تشققات صغار', icon: 'tooth' },
  { startWord: 4, endWord: 6, layout: 'speaker_split', title: 'ماشي خطيرة', emphasis: ['خطيرة'], icon: 'check-circle' },
  { startWord: 7, endWord: 10, layout: 'compare', title: 'الصغار ولا الكبار؟', items: [{ text: 'صغار', icon: 'smiley' }, { text: 'كبار', icon: 'warning' }] },
  { startWord: 11, endWord: 13, layout: 'speaker', title: '' },
  { startWord: 14, endWord: 17, layout: 'speaker_split', title: 'كل 6 شهور', emphasis: ['6'], icon: 'calendar', items: [{ text: 'فحص' }, { text: 'تنظيف' }] },
  { startWord: 18, endWord: 19, layout: 'cta', title: 'زور طبيبك', emphasis: ['طبيبك'], icon: 'stethoscope' },
];
const durationMs = words[words.length - 1].endMs + 300;
await renderPlan(assemblePlan({ settings, words, durationMs, drafts, speakerUrl, seed: 11 }), { outFile: out });
console.log(`Rendered ${out}`);
