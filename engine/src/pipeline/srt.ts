import type { Word } from '../plan/schema';

const ts = (ms: number) => {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const r = Math.floor(ms % 1000);
  const p = (n: number, l = 2) => String(n).padStart(l, '0');
  return `${p(h)}:${p(m)}:${p(s)},${p(r, 3)}`;
};

/** SubRip subtitles: up to ~7 words per cue, broken on pauses and punctuation. */
export const toSrt = (words: Word[]) => {
  const cues: Word[][] = [];
  let cur: Word[] = [];
  words.forEach((w, i) => {
    const gap = i > 0 ? w.startMs - words[i - 1].endMs : 0;
    if (cur.length && (cur.length >= 7 || gap > 600)) {
      cues.push(cur);
      cur = [];
    }
    cur.push(w);
    if (/[.!?؟]$/.test(w.text)) {
      cues.push(cur);
      cur = [];
    }
  });
  if (cur.length) cues.push(cur);
  return cues
    .map((c, i) => `${i + 1}\n${ts(c[0].startMs)} --> ${ts(c[c.length - 1].endMs)}\n${c.map((w) => w.text).join(' ')}\n`)
    .join('\n');
};
