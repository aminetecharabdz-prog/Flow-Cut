import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assemblePlan, normalizeDrafts, rulePlanner, type SceneDraft } from './build';
import { resolvePlanIcons } from './icons';
import { VideoPlan, type Word } from './schema';
import type { ProjectSettings } from './settings';
import { revealTimes } from '../remotion/util';
import { toSrt } from '../pipeline/srt';

const words: Word[] = 'هذا عطر الياسمين الأصلي بسعر خاص اطلبي الآن التوصيل متوفر لكل الولايات'
  .split(' ')
  .map((text, i) => ({ text, startMs: 200 + i * 450, endMs: 200 + i * 450 + 380 }));

const settings: ProjectSettings = {
  title: 'Test',
  goal: 'product_ad',
  videoType: 'motion_graphics',
  captionLanguage: 'ar-DZ',
  captionScript: 'arabic',
  style: 'luxury',
  colors: { primary: '#D4A64A' },
  pace: 'medium',
  captionMode: 'word_box',
  aspect: '9:16',
  sfx: true,
  product: { name: 'Yasmine', price: '2900 دج' },
  endCard: { phone: '0555 00 00 00' },
};

test('normalizeDrafts tiles the transcript without gaps or overlaps', () => {
  const drafts: SceneDraft[] = [
    { startWord: 4, endWord: 8, layout: 'list', title: 'b' },
    { startWord: 0, endWord: 5, layout: 'hook', title: 'a' },
    { startWord: 9, endWord: 30, layout: 'cta', title: 'c' },
  ];
  const out = normalizeDrafts(drafts, words.length);
  assert.equal(out[0].startWord, 0);
  for (let i = 1; i < out.length; i++) assert.equal(out[i].startWord, out[i - 1].endWord + 1);
  assert.equal(out[out.length - 1].endWord, words.length - 1);
});

test('assemblePlan produces a valid, contiguous VideoPlan and downgrades impossible layouts', () => {
  const drafts: SceneDraft[] = [
    { startWord: 0, endWord: 3, layout: 'hook', title: 'عطر الياسمين', emphasis: ['الياسمين'], icon: 'sparkle' },
    { startWord: 4, endWord: 5, layout: 'speaker', title: 'بسعر خاص' }, // no speaker clip -> statement
    { startWord: 6, endWord: 8, layout: 'list', title: 'one item only', items: [{ text: 'x' }] }, // too few items
    { startWord: 9, endWord: 12, layout: 'cta', title: 'اطلبي الآن', icon: 'shopping-bag' },
  ];
  const plan = VideoPlan.parse(resolvePlanIcons(assemblePlan({ settings, words, durationMs: 6500, drafts })));
  assert.equal(plan.scenes[0].startMs, 0);
  for (let i = 1; i < plan.scenes.length; i++) assert.equal(plan.scenes[i].startMs, plan.scenes[i - 1].endMs);
  assert.equal(plan.scenes[plan.scenes.length - 1].endMs, plan.durationMs);
  assert.ok(plan.scenes.every((s) => s.layout !== 'speaker'));
  assert.equal(plan.direction, 'rtl');
  assert.ok(plan.scenes[0].icon?.body, 'icon resolved to SVG');
});

test('rulePlanner always returns a usable plan', () => {
  const drafts = rulePlanner(words, settings);
  assert.ok(drafts.length >= 2);
  assert.ok(['hook', 'visual'].includes(drafts[0].layout), 'opens with a hook or a visual');
  const plan = VideoPlan.parse(resolvePlanIcons(assemblePlan({ settings, words, durationMs: 6500, drafts })));
  assert.ok(plan.scenes.length >= 2);
});

test('revealTimes follows the voice but never leaves the screen empty for long', () => {
  const times = revealTimes(['عطر', 'الياسمين', 'غائب'], words, 0, 3000, 200);
  assert.equal(times[0], 80); // spoken at 650ms, but shown by 80ms so the scene never starts empty
  assert.ok(times[2] <= 80 + 2 * 200);
  assert.ok(times[1] >= times[0] && times[2] >= times[1]);
});

test('toSrt writes numbered cues', () => {
  const srt = toSrt(words);
  assert.match(srt, /^1\n00:00:00,200 --> /);
});

test('null optional fields from the database never reach the plan', () => {
  const plan = VideoPlan.parse(
    resolvePlanIcons(
      assemblePlan({
        settings: { ...settings, endCard: { phone: '0799', handle: undefined }, product: undefined },
        words,
        durationMs: 6500,
        drafts: rulePlanner(words, settings),
      }),
    ),
  );
  assert.equal(plan.endCard?.phone, '0799');
});
