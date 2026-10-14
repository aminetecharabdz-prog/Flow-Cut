import type { VideoPlanInput, Word } from './schema';

/** Build evenly paced word timings for a demo script (real videos use ASR timings). */
const timeline = (lines: string[], startMs = 300, msPerWord = 380, pauseMs = 450) => {
  const words: Word[] = [];
  const spans: [number, number][] = [];
  let t = startMs;
  for (const line of lines) {
    const s = t;
    for (const w of line.split(/\s+/).filter(Boolean)) {
      const d = msPerWord + Math.min(240, w.length * 18);
      words.push({ text: w, startMs: t, endMs: t + d - 40 });
      t += d;
    }
    spans.push([s, t]);
    t += pauseMs;
  }
  return { words, spans, end: t };
};

const script = [
  'سبعين بالمية من الزبائن يقرروا في ثلاث ثواني برك',
  'الفيديو العادي يتنسى بسرعة أما الموشن جرافيك يشد العين',
  'السر في ثلاث حوايج خطاف قوي رسالة واضحة ودعوة للفعل',
  'والنتيجة تفاعل أكثر بثلاث مرات',
  'المحتوى الجيد يبيع وحدو',
  'ابدا اليوم وخلي فيديوهاتك تخدم عليك',
];

const { words, spans, end } = timeline(script);
const at = (i: number) => ({ startMs: i === 0 ? 0 : spans[i][0] - 200, endMs: i === spans.length - 1 ? end + 1200 : spans[i + 1][0] - 200 });

export const SAMPLE_PLAN: VideoPlanInput = {
  version: 1,
  width: 1080,
  height: 1920,
  fps: 30,
  durationMs: end + 1200,
  direction: 'rtl',
  style: 'vivid',
  palette: {
    background: '#0E1230',
    surface: '#1A2050',
    text: '#FFFFFF',
    muted: '#A9B1E0',
    primary: '#FFC83D',
    secondary: '#FF4F7B',
  },
  fonts: { heading: 'lalezar', body: 'cairo' },
  captions: { mode: 'karaoke_line', position: 'bottom' },
  words,
  sfx: true,
  seed: 7,
  endCard: { handle: '@motioncut', phone: '0555 12 34 56', buttonText: 'اطلب الآن' },
  scenes: [
    {
      id: 's1',
      ...at(0),
      layout: 'hook',
      title: '70% من الزبائن يقرروا في 3 ثواني',
      emphasis: ['3', 'ثواني'],
      icon: { name: 'timer' },
    },
    {
      id: 's2',
      ...at(1),
      layout: 'compare',
      title: 'الفرق واضح',
      emphasis: ['واضح'],
      items: [
        { text: 'فيديو عادي', icon: { name: 'video-camera' } },
        { text: 'موشن جرافيك', icon: { name: 'sparkle' } },
      ],
      subtitle: 'يشد العين من أول ثانية',
    },
    {
      id: 's3',
      ...at(2),
      layout: 'list',
      title: 'السر في 3 حوايج',
      emphasis: ['السر'],
      items: [
        { text: 'خطّاف قوي', icon: { name: 'lightning' } },
        { text: 'رسالة واضحة', icon: { name: 'chat-circle-text' } },
        { text: 'دعوة للفعل', icon: { name: 'hand-tap' } },
      ],
    },
    {
      id: 's4',
      ...at(3),
      layout: 'stat',
      stat: { value: 3, decimals: 0, prefix: '×', suffix: '' },
      title: 'تفاعل أكثر',
      emphasis: ['أكثر'],
      accent: 'secondary',
    },
    {
      id: 's5',
      ...at(4),
      layout: 'quote',
      title: 'المحتوى الجيد يبيع وحدو',
      emphasis: ['يبيع'],
      subtitle: 'قاعدة التسويق الذهبية',
    },
    {
      id: 's6',
      ...at(5),
      layout: 'cta',
      title: 'ابدا اليوم',
      emphasis: ['اليوم'],
      icon: { name: 'rocket-launch' },
    },
  ],
};

const adScript = [
  'عطر يخليك مميزة في كل مكان',
  'عطر الياسمين الأصلي بسعر خاص',
  'ثبات طويل ريحة فخمة وتغليف هدية',
  'يدوم معاك أربعة وعشرين ساعة',
  'اطلبي الآن والتوصيل لكل الولايات',
];

/** Product ad demo: luxury style, word-box captions, product image + price. */
export const productPlan = (imageUrl: string): VideoPlanInput => {
  const t = timeline(adScript, 250, 360, 420);
  const span = (i: number) => ({
    startMs: i === 0 ? 0 : t.spans[i][0] - 200,
    endMs: i === t.spans.length - 1 ? t.end + 1300 : t.spans[i + 1][0] - 200,
  });
  return {
    version: 1,
    width: 1080,
    height: 1920,
    fps: 30,
    durationMs: t.end + 1300,
    direction: 'rtl',
    style: 'luxury',
    palette: {
      background: '#0B0A08',
      surface: '#1C1812',
      text: '#FBF4E4',
      muted: '#B9AC8E',
      primary: '#D4A64A',
      secondary: '#8E1F2F',
    },
    fonts: { heading: 'el_messiri', body: 'tajawal' },
    captions: { mode: 'word_box', position: 'bottom' },
    words: t.words,
    sfx: true,
    seed: 3,
    endCard: { handle: '@yasmine.parfum', phone: '0661 22 33 44', buttonText: 'اطلبي الآن' },
    scenes: [
      { id: 'p1', ...span(0), layout: 'hook', title: 'عطر يخليك مميزة', emphasis: ['مميزة'], icon: { name: 'sparkle' } },
      {
        id: 'p2',
        ...span(1),
        layout: 'product',
        title: 'عطر الياسمين',
        emphasis: ['الياسمين'],
        product: { imageUrl, price: '2900 دج', oldPrice: '4200 دج', badge: '-30%', name: 'Eau de Parfum · 100ml' },
      },
      {
        id: 'p3',
        ...span(2),
        layout: 'list',
        title: 'علاش تختاريه؟',
        emphasis: ['تختاريه'],
        items: [
          { text: 'ثبات طويل', icon: { name: 'hourglass' } },
          { text: 'ريحة فخمة', icon: { name: 'flower-lotus' } },
          { text: 'تغليف هدية', icon: { name: 'gift' } },
        ],
      },
      { id: 'p4', ...span(3), layout: 'stat', stat: { value: 24, decimals: 0, prefix: '', suffix: 'h' }, title: 'ثبات طول النهار', emphasis: ['النهار'] },
      { id: 'p5', ...span(4), layout: 'cta', title: 'اطلبي الآن', emphasis: ['الآن'], icon: { name: 'shopping-bag' }, subtitle: 'توصيل 58 ولاية' },
    ],
  };
};
