// Turns timed words into scenes: where to cut, which composition each scene gets, what to highlight.
import { clamp, rng, uid, type Kind, type Scene, type Surface, type Word } from './core';

const ARABIC = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/;
export const isRTL = (s: string) => ARABIC.test(s);

const PUNCT = /^[\s"'«»“”()[\]{}.,!?؟،؛;:…\-–—]+|[\s"'«»“”()[\]{}.,!?؟،؛;:…\-–—]+$/g;
export const bare = (w: string) => w.replace(PUNCT, '');
export const tokenize = (text: string) => text.split(/\s+/).map((w) => w.trim()).filter((w) => bare(w).length > 0);

const toLatinDigits = (s: string) =>
  s.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
export const hasNumber = (w: string) => /\d/.test(toLatinDigits(w));

/** Parses "1,500", "٢٥%", "3.5k" into value + parts for a counting animation. */
export const parseNumber = (w: string) => {
  const latin = toLatinDigits(w);
  const m = latin.match(/(\d[\d,.\s]*)/);
  if (!m) return null;
  const raw = m[1].replace(/[\s,]/g, '');
  const value = parseFloat(raw);
  if (!Number.isFinite(value)) return null;
  const decimals = raw.includes('.') ? raw.split('.')[1].length : 0;
  const idx = latin.indexOf(m[1]);
  return {
    value,
    decimals,
    prefix: bare(w.slice(0, idx)),
    suffix: bare(w.slice(idx + m[1].length)),
    arabicDigits: /[٠-٩]/.test(w),
  };
};
export const formatNumber = (v: number, decimals: number, arabic: boolean) => {
  const s = v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return arabic ? s.replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[+d]) : s;
};

const STOP = new Set(
  (
    'في من على إلى الى عن مع هذا هذه ذلك تلك هو هي هم أنا انا أنت انت نحن كان كانت يكون لا ما لم لن قد ثم أو او و ف ب ل كل بعض أي اي إن ان أن التي الذي الذين عند حتى إذا اذا لكن بل كما مثل غير بين ' +
    'راني راك راه راهي واش باش بلي هاذ هاد هادي هاذي هذاك بزاف شوية تاع ديال نتا نتي حنا هوما كيما وين كي مور قبل بعد غير برك يا ' +
    'le la les un une des de du et ou en au aux pour par sur dans avec ce cette ces est sont qui que quoi il elle on nous vous ils pas ne plus très ' +
    'the a an and or of to in on at for with is are was were be this that these those it its you your we our they their not but so if as by from'
  ).split(/\s+/),
);
export const isStop = (w: string) => {
  const b = bare(w).toLowerCase();
  if (b.length <= 1) return true;
  if (STOP.has(b)) return true;
  // Arabic attached conjunction / preposition: و، ف، ب، ل
  if (/^[وفبل]/.test(b) && STOP.has(b.slice(1))) return true;
  return false;
};

const QUESTION = /^(واش|علاش|كيفاش|شنو|شكون|وين|فاين|قداش|هل|لماذا|ليش|كيف|ماذا|متى|أين|اين|من|كم|why|how|what|when|where|who|pourquoi|comment|quoi|quand|où|qui)$/i;
const STEP = /^(أولا|أولاً|اولا|ثانيا|ثانياً|ثالثا|ثالثاً|رابعا|خامسا|أخيرا|أخيراً|الخطوة|خطوة|first|second|third|then|finally|step|d'abord|ensuite|enfin|premièrement|deuxièmement)$/i;
export const isQuestion = (ws: Word[]) =>
  ws.length > 0 && (/[?؟]$/.test(ws[ws.length - 1].t) || QUESTION.test(bare(ws[0].t)) || (ws.length > 1 && QUESTION.test(bare(ws[1].t))));
const isStepWord = (w: string) => STEP.test(bare(w)) || /^\d+[.)-]$/.test(toLatinDigits(w));

/** The most meaningful words of a phrase (longest non-stop words), up to `n`. */
export const pickHighlights = (ws: Word[], n: number) =>
  ws
    .map((w, i) => ({ i, score: isStop(w.t) ? -1 : bare(w.t).length + (hasNumber(w.t) ? 6 : 0) }))
    .filter((x) => x.score > 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
    .map((x) => x.i)
    .sort((a, b) => a - b);

// ---------- timing helpers ----------

/** Even timing for typed text (no audio): reading speed with pauses at punctuation. */
export const timeText = (text: string, start = 0.35, wps = 2.6): Word[] => {
  const out: Word[] = [];
  let t = start;
  for (const w of tokenize(text)) {
    const d = clamp(0.18 + bare(w).length * 0.045, 0.24, 0.7) / (wps / 2.6);
    out.push({ t: w, s: t, e: t + d });
    t += d + (/[.!?؟]$/.test(w) ? 0.42 : /[،,;؛:]$/.test(w) ? 0.22 : 0.04);
  }
  return out;
};

/** Spread new words over a time range, weighted by length (used when a scene's text is edited). */
export const spreadWords = (text: string, s: number, e: number): Word[] => {
  const tokens = tokenize(text);
  const weights = tokens.map((w) => bare(w).length + 2);
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  let acc = 0;
  return tokens.map((w, i) => {
    const ws = s + ((e - s) * acc) / total;
    acc += weights[i];
    return { t: w, s: ws, e: s + ((e - s) * acc) / total };
  });
};

// ---------- direction ----------

const POOL: Kind[] = ['stack', 'split', 'orbit', 'quote', 'grid', 'bars', 'stack', 'focus', 'split'];
const SURFACES: Surface[] = ['base', 'ink', 'base', 'accent', 'alt'];

/** Cut words into phrases at pauses, punctuation and step words; keep numbers with their unit. */
const phrases = (words: Word[]) => {
  const groups: Word[][] = [];
  let cur: Word[] = [];
  const flush = () => {
    if (cur.length) groups.push(cur);
    cur = [];
  };
  words.forEach((w, i) => {
    const next = words[i + 1];
    if (cur.length >= 2 && isStepWord(w.t)) flush();
    cur.push(w);
    if (!next) return;
    const dur = w.e - cur[0].s;
    const gap = next.s - w.e;
    const strong = /[.!?؟]$/.test(w.t);
    const soft = /[،,;؛:]$/.test(w.t);
    if (hasNumber(w.t) && !strong && gap < 0.4 && cur.length < 6) return;
    if (
      (strong && dur > 0.5) ||
      gap > 0.55 ||
      cur.length >= 7 ||
      dur > 3.3 ||
      (soft && dur > 1.4) ||
      (dur > 1.9 && gap > 0.2)
    )
      flush();
  });
  flush();
  // Merge phrases that are too short to read.
  for (let i = 0; i < groups.length; i++) {
    const g = groups[i];
    const d = g[g.length - 1].e - g[0].s;
    if (groups.length > 1 && (d < 0.75 || (g.length === 1 && d < 1)) && !hasNumber(g[0].t)) {
      const prev = groups[i - 1], next = groups[i + 1];
      const target = !prev ? next : !next ? prev : prev.length <= next.length ? prev : next;
      if (target && target.length + g.length <= 8) {
        if (target === prev) prev.push(...g);
        else next.unshift(...g);
        groups.splice(i, 1);
        i--;
      }
    }
  }
  return groups;
};

export const chooseKind = (ws: Word[], i: number, n: number, prev: Kind[], r: () => number): Kind => {
  if (i === 0) return 'slam';
  if (i === n - 1 && n >= 3) return 'cta';
  if (ws.some((w) => hasNumber(w.t)) && !prev.slice(-1).includes('counter')) return 'counter';
  if (isQuestion(ws) && !prev.slice(-1).includes('question')) return 'question';
  if (isStepWord(ws[0].t)) return 'steps';
  if (ws.length <= 2 && prev[prev.length - 1] !== 'focus') return 'focus';
  const options = POOL.filter((k) => !prev.slice(-2).includes(k) && !(k === 'focus' && ws.length > 5));
  return options[Math.floor(r() * options.length)] ?? 'stack';
};

export const direct = (words: Word[], seed: number, speech: number, outro: boolean): Scene[] => {
  const r = rng(seed * 7919 + words.length);
  const groups = words.length ? phrases(words) : [];
  const kinds: Kind[] = [];
  const surfaces: Surface[] = [];
  let step = 0;
  const scenes: Scene[] = groups.map((g, i) => {
    const kind = chooseKind(g, i, groups.length, kinds, r);
    kinds.push(kind);
    let surface: Surface = kind === 'cta' ? 'accent' : kind === 'slam' ? 'base' : SURFACES[Math.floor(r() * SURFACES.length)];
    if (surface === surfaces[surfaces.length - 1]) surface = surface === 'base' ? 'ink' : 'base';
    if (kind === 'counter' && surfaces[surfaces.length - 1] !== 'accent') surface = 'accent';
    surfaces.push(surface);
    if (kind === 'steps') step++;
    return {
      id: uid(),
      kind,
      surface,
      start: i === 0 ? 0 : g[0].s - 0.06,
      end: 0,
      words: g,
      hl: pickHighlights(g, g.length >= 6 ? 2 : 1),
      step: kind === 'steps' ? step : undefined,
    };
  });
  const tail = Math.max(speech, words.length ? words[words.length - 1].e + 0.4 : 2);
  scenes.forEach((s, i) => (s.end = i < scenes.length - 1 ? scenes[i + 1].start : tail));
  if (outro) scenes.push({ id: uid(), kind: 'outro', surface: 'accent', start: tail, end: tail + 2.4, words: [], hl: [] });
  return scenes;
};

/** Re-time scene boundaries after edits so scenes stay contiguous. */
export const reflow = (scenes: Scene[]) => {
  scenes.forEach((s, i) => {
    if (i > 0) s.start = scenes[i - 1].end;
  });
  return scenes;
};
