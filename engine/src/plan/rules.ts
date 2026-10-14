import type { SceneDraft } from './build';
import type { LayoutId, Surface, VisualId, Word } from './schema';
import { PACE_SECONDS, type ProjectSettings } from './settings';

/**
 * Rule-based scene planner (used without an LLM key, or when the LLM fails).
 * It still tries to behave like an editor: short on-screen titles instead of
 * the transcript, an illustration that matches what is said, numbers that
 * count up, numbered steps, and a background that changes between scenes.
 */

const clean = (w: string) => w.replace(/[^\p{L}\p{N}%]/gu, '');
const norm = (w: string) =>
  clean(w)
    .toLowerCase()
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه');

/** Function words and dialect fillers that never make a good title. */
const STOP = new Set(
  [
    // Arabic (MSA + Maghrebi dialects)
    'في', 'فى', 'من', 'على', 'عل', 'و', 'او', 'أو', 'ان', 'أن', 'إن', 'هذا', 'هذه', 'هذي', 'هاذ', 'هادا', 'هادي', 'ذلك', 'تلك', 'هو', 'هي', 'هم', 'انا', 'أنا', 'انت', 'انتي', 'احنا', 'حنا',
    'اللي', 'الي', 'لي', 'الذي', 'التي', 'ما', 'ماشي', 'مش', 'لا', 'لم', 'لن', 'قد', 'كان', 'كانت', 'يكون', 'تكون', 'تكوني', 'راه', 'راهي', 'راك', 'كي', 'كيما', 'باش', 'بش', 'باه', 'حتى', 'مع', 'عند', 'عن', 'الى', 'إلى',
    'كل', 'شي', 'حاجه', 'حاجة', 'وحده', 'وحدة', 'واحد', 'بصح', 'برك', 'غير', 'كامل', 'بعد', 'قبل', 'وقبل', 'كذلك', 'هكا', 'هكدا', 'هكذا', 'ايه', 'اه', 'يعني', 'تاع', 'نتاع', 'ديال', 'دال', 'وين', 'واش', 'كيفاش', 'علاش',
    'اذا', 'إذا', 'وإذا', 'واذا', 'لو', 'لكن', 'بل', 'ثم', 'بعدها', 'أول', 'اول', 'ونزيدوا', 'نزيدو', 'عدنا', 'عندنا', 'بيها', 'فيها', 'فيه', 'ليك', 'ليكم', 'منها', 'منه', 'هنا', 'تما', 'هاك',
    // French
    'le', 'la', 'les', 'un', 'une', 'des', 'de', 'du', 'et', 'ou', 'en', 'au', 'aux', 'pour', 'par', 'sur', 'avec', 'dans', 'que', 'qui', 'ce', 'cette', 'ces', 'est', 'sont', 'on', 'nous', 'vous', 'il', 'elle', 'pas', 'ne', 'plus', 'tout', 'très', 'mais', 'donc',
    // English
    'the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'on', 'for', 'with', 'is', 'are', 'it', 'this', 'that', 'you', 'we', 'i', 'so', 'but', 'just', 'very', 'all', 'be', 'at', 'by', 'from',
  ].map(norm),
);

/** Words that start a new step in an explanation. */
const STEP_RE = /^(و?اول|بعدها|ثم|وثم|ثاني|ثالث|كذلك|وكذلك|وفي|اخيرا|وبعدها|premierement|dabord|ensuite|puis|enfin|first|then|next|finally|second|third)$/;
const QUESTION_RE = /[?؟]$|^(واش|كيفاش|علاش|شحال|وين|هل|ماذا|لماذا|كيف|كم|comment|pourquoi|combien|quoi|what|how|why|when)$/;

/** Keyword -> illustration. Order matters: first match wins. */
const VISUAL_HINTS: [RegExp, VisualId][] = [
  [/تكسر|كسر|خوف|مشكل|خطر|ضرر|cass|brise|probl|peur|risque|broken|crack|fear|risk|problem/, 'crack'],
  [/تغليف|غلاف|يغلف|نغلف|كارتون|كرتون|علبه|طرد|كولي|بلاستيك|فقاع|colis|emball|carton|paquet|package|parcel|box|wrap/, 'package'],
  [/توصيل|توصل|نوصل|يوصل|شحن|livr|exped|deliver|shipping|truck/, 'truck'],
  [/ولايه|ولايات|مدينه|مدن|مكان|wilaya|ville|region|city|location|map/, 'pins'],
  [/حمايه|حمايات|امان|امن|سليم|ضمان|محمي|protect|garant|secur|safe|warrant|secure/, 'shield'],
  [/لوحه|لوحات|ديكور|حايط|حائط|جدار|زجاج|tableau|deco|mur|verre|frame|painting|wall|glass|art/, 'frame'],
  [/الباب|باب|دار|بيت|منزل|maison|porte|domicile|home|door|house/, 'house'],
  [/نفحص|فحص|نتاكد|نشوف|تفتيش|نراقب|verif|control|inspect|check|review/, 'magnifier'],
  [/سعر|ثمن|دينار|دج|تخفيض|تخفيضات|عرض|برومو|promo|prix|reduc|solde|price|sale|discount|offer|deal/, 'tag'],
  [/هديه|مجاني|مجانا|بلاش|cadeau|gratuit|offert|gift|free|bonus/, 'gift'],
  [/وقت|ساعه|دقيقه|ثانيه|بسرعه|سريع|temps|heure|minute|rapide|vite|time|hour|fast|quick/, 'clock'],
  [/نتيجه|نتايج|نمو|مبيعات|ارباح|زياده|ربح|resultat|vente|croiss|result|growth|sales|profit/, 'chart'],
  [/جوده|ممتاز|احسن|افضل|رضا|تقييم|اصلي|qualite|meilleur|avis|original|quality|best|review|rating/, 'stars'],
  [/هاتف|تلفون|تطبيق|انستغرام|انستا|تيك|فيسبوك|موقع|telephone|appli|insta|site|phone|app|online/, 'phone'],
  [/رساله|تواصل|اتصل|كلمنا|ميساج|خدمه|message|contact|appel|chat|dm|call/, 'chat'],
  [/خطوه|خطوات|مراحل|ترتيب|etape|methode|step|process|list/, 'checklist'],
  [/فكره|سر|نصيحه|نصايح|حل|idee|astuce|secret|solution|conseil|idea|tip|solution/, 'bulb'],
  [/اعلان|جديد|اكتشف|حصري|annonce|nouveau|decouvr|exclusi|new|announce|launch/, 'megaphone'],
  [/نجاح|ابدا|ابدأ|انطلق|كبر|مشروع|succes|lancer|commenc|projet|success|start|grow|business/, 'rocket'],
  [/حب|تحب|تحبو|تحبوا|يعجب|عجب|aime|ador|love|like/, 'heart'],
];

const FALLBACK_VISUALS: VisualId[] = ['bulb', 'stars', 'rocket', 'heart', 'megaphone'];

const visualFor = (tokens: string[]): VisualId | undefined => {
  const joined = tokens.map(norm);
  for (const [re, id] of VISUAL_HINTS) if (joined.some((t) => t.length > 1 && re.test(t))) return id;
  return undefined;
};

/** Surface rhythm per style: alternates the video background with colour blocks. */
const SURFACE_CYCLE: Record<ProjectSettings['style'], Surface[]> = {
  vivid: ['base', 'primary', 'base', 'light', 'secondary', 'base'],
  luxury: ['base', 'dark', 'base', 'light', 'base', 'primary'],
  poster: ['light', 'primary', 'base', 'secondary', 'light', 'dark'],
  clean: ['base', 'primary', 'base', 'light', 'base', 'secondary'],
  neon: ['base', 'dark', 'primary', 'base', 'secondary', 'dark'],
  editorial: ['base', 'light', 'dark', 'base', 'primary', 'light'],
};

type Segment = { a: number; b: number };

/** Cut the transcript into phrases: punctuation, pauses, step words and the pace limits. */
const segment = (words: Word[], pace: ProjectSettings['pace']): Segment[] => {
  const [minS, maxS] = PACE_SECONDS[pace];
  const out: Segment[] = [];
  let a = 0;
  for (let i = 0; i < words.length; i++) {
    const dur = (words[i].endMs - words[a].startMs) / 1000;
    const next = words[i + 1];
    const gap = next ? next.startMs - words[i].endMs : 0;
    const punct = /[.!?؟،,:;]$/.test(words[i].text);
    const nextIsStep = next ? STEP_RE.test(norm(next.text)) : false;
    const last = i === words.length - 1;
    // Keep a number with its unit ("69 ولاية") in the same phrase.
    const isNumber = /^\d+([.,]\d+)?%?$/.test(clean(words[i].text));
    if (last || (!isNumber && (dur >= maxS || (dur >= minS * 0.8 && (punct || gap > 280 || nextIsStep))))) {
      out.push({ a, b: i });
      a = i + 1;
    }
  }
  // Fold a trailing fragment into the previous phrase.
  if (out.length > 1) {
    const tail = out[out.length - 1];
    if ((words[tail.b].endMs - words[tail.a].startMs) / 1000 < minS * 0.5) {
      out[out.length - 2].b = tail.b;
      out.pop();
    }
  }
  return out;
};

/** Up to `max` content words, in spoken order. */
/** Stop word, also when glued to an Arabic conjunction/preposition (وهذا، فالدار، بالكل). */
const isStop = (n: string) => STOP.has(n) || (/^[وفبل]/.test(n) && STOP.has(n.slice(1))) || (/^(وال|بال|فال|لل)/.test(n) && STOP.has(n.slice(2)));

const keywords = (tokens: string[], max: number) => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of tokens) {
    const c = clean(t);
    const n = norm(t);
    if (c.length < 2 || isStop(n) || seen.has(n)) continue;
    seen.add(n);
    out.push(c);
    if (out.length >= max) break;
  }
  return out;
};

const ARABIC_NUMBERS: Record<string, number> = {
  واحد: 1, زوج: 2, اثنين: 2, جوج: 2, ثلاثه: 3, ثلاث: 3, تلاته: 3, اربعه: 4, اربع: 4, خمسه: 5, خمس: 5, سته: 6, ست: 6, سبعه: 7, ثمانيه: 8, تسعه: 9, عشره: 10, عشرين: 20, ثلاثين: 30, خمسين: 50, ميه: 100, مية: 100, الف: 1000,
};

const findNumber = (tokens: string[]) => {
  for (let i = 0; i < tokens.length; i++) {
    const c = clean(tokens[i]).replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
    const m = c.match(/^(\d+(?:[.,]\d+)?)(%?)$/);
    const word = ARABIC_NUMBERS[norm(tokens[i])];
    if (m || word) {
      const value = m ? Number(m[1].replace(',', '.')) : word;
      if (value === 1) continue;
      const label = keywords(tokens.slice(i + 1), 2).join(' ');
      return { value, suffix: m?.[2] ?? '', label, index: i };
    }
  }
  return null;
};

export const rulePlanner = (words: Word[], settings: ProjectSettings): SceneDraft[] => {
  if (words.length === 0) return [{ startWord: 0, endWord: 0, layout: 'hook', title: settings.title, emphasis: [] }];
  const segments = segment(words, settings.pace);
  const surfaces = SURFACE_CYCLE[settings.style];
  const talking = settings.videoType === 'talking_head';
  let step = 0;
  let lastVisual: VisualId | undefined;
  let lastLayout: LayoutId | undefined;
  let fallbackIndex = 0;

  const drafts = segments.map(({ a, b }, i): SceneDraft => {
    const tokens = words.slice(a, b + 1).map((w) => w.text);
    const isFirst = i === 0;
    const isLast = i === segments.length - 1;
    const startsStep = STEP_RE.test(norm(tokens[0])) || (tokens[1] ? STEP_RE.test(norm(tokens[1])) : false);
    const question = tokens.some((t) => QUESTION_RE.test(norm(t)) || /[?؟]$/.test(t));
    const number = findNumber(tokens);
    let visual = visualFor(tokens);
    if (visual && visual === lastVisual) visual = undefined;

    const kw = keywords(tokens, number ? 2 : 3);
    let title = kw.join(' ');
    // Numbers are the strongest hook: put them in the title ("69 ولاية").
    if (number && (isFirst || talking)) title = `${kw.filter((w) => w !== String(number.value)).slice(0, 2).join(' ')} ${number.value}${number.suffix} ${number.label}`.trim();
    if (question && title) title += '؟';
    const emphasis = kw.length ? [kw.reduce((x, y) => (y.length > x.length ? y : x))] : [];

    let layout: LayoutId;
    let draft: Partial<SceneDraft> = {};
    if (talking) {
      layout = isLast && settings.endCard ? 'cta' : i % 3 === 1 ? 'speaker_split' : 'speaker';
      if (layout === 'speaker') title = '';
    } else if (isLast && settings.endCard) {
      layout = 'cta';
    } else if (number && !isFirst) {
      layout = 'stat';
      draft.stat = { value: number.value, suffix: number.suffix, prefix: '', label: number.label || title };
    } else if (startsStep) {
      step += 1;
      layout = 'visual';
      draft.step = step;
      visual = visual ?? 'checklist';
    } else if (isFirst) {
      layout = visual ? 'visual' : 'hook';
    } else if (visual) {
      layout = lastLayout === 'visual' ? 'statement' : 'visual';
    } else {
      // No literal match: alternate pure kinetic typography with a mood visual.
      layout = lastLayout === 'statement' || lastLayout === 'hook' ? 'visual' : 'statement';
      if (layout === 'visual') visual = FALLBACK_VISUALS[fallbackIndex++ % FALLBACK_VISUALS.length];
    }
    if (layout === lastLayout && layout !== 'speaker') layout = layout === 'statement' ? 'hook' : 'statement';

    lastVisual = visual ?? lastVisual;
    lastLayout = layout;
    return {
      startWord: a,
      endWord: b,
      layout,
      title: title || kw.join(' ') || tokens.slice(0, 3).join(' '),
      emphasis: number ? [String(number.value)] : emphasis,
      visual: visual ?? null,
      surface: isLast && layout === 'cta' ? 'primary' : surfaces[i % surfaces.length],
      ...draft,
    };
  });

  // Never put two identical backgrounds side by side.
  for (let i = 1; i < drafts.length; i++) {
    if (drafts[i].surface === drafts[i - 1].surface) drafts[i].surface = drafts[i].surface === 'base' ? 'light' : 'base';
  }
  return drafts;
};
