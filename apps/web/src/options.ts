/** Choices offered in the creator. Ids match the database / engine. */

export type Opt = { id: string; label: string; hint?: string; emoji?: string };

export const goals: Opt[] = [
  { id: 'product_ad', label: 'أبيع منتجاً', hint: 'المنتج، سعره، ولماذا يشتريه الزبون', emoji: '🛍️' },
  { id: 'content_marketing', label: 'أنشر محتوى مفيد', hint: 'نصيحة أو معلومة تجلب متابعين', emoji: '💡' },
  { id: 'educational', label: 'أشرح طريقة', hint: 'خطوات واضحة مرقّمة', emoji: '🧭' },
  { id: 'story', label: 'أحكي قصة', hint: 'إيقاع هادئ وجمل مؤثرة', emoji: '📖' },
  { id: 'news', label: 'أعلن خبراً', hint: 'عنوان قوي وأرقام', emoji: '📣' },
  { id: 'event', label: 'أروّج لخدمة أو حدث', hint: 'ماذا، متى، وكيف تحجز', emoji: '📅' },
];

export const videoTypes: Opt[] = [
  { id: 'motion_graphics', label: 'رسوم متحركة', hint: 'رسومات ونصوص تتحرك مع صوتك', emoji: '✨' },
  { id: 'media_montage', label: 'صوري ومقاطعي', hint: 'مونتاج لصورك ومقاطعك مع نصوص', emoji: '🖼️' },
  { id: 'talking_head', label: 'أنا أتكلم', hint: 'فيديو لك مع رسوم توضيحية', emoji: '🎙️' },
];

export type Mood = { id: string; label: string; hint: string; bg: string; fg: string; a: string; b: string; font: string };

/** Visual moods (engine styles). Names are our own. */
export const moods: Mood[] = [
  { id: 'vivid', label: 'طاقة', hint: 'مرح وسريع', bg: '#1E1B4B', fg: '#FFFFFF', a: '#FFC83D', b: '#FF4F7B', font: 'Readex Pro' },
  { id: 'luxury', label: 'أناقة', hint: 'داكن وراقٍ', bg: '#0B0A08', fg: '#FBF4E4', a: '#D4A64A', b: '#8E1F2F', font: 'Readex Pro' },
  { id: 'poster', label: 'جرأة', hint: 'كتابة عريضة', bg: '#F4EFE6', fg: '#111111', a: '#FFD400', b: '#E63946', font: 'Readex Pro' },
  { id: 'clean', label: 'صفاء', hint: 'بسيط ونظيف', bg: '#FAFAF7', fg: '#111111', a: '#2563EB', b: '#F59E0B', font: 'IBM Plex Sans Arabic' },
  { id: 'neon', label: 'ليل', hint: 'متوهج وتقني', bg: '#07020F', fg: '#F5F3FF', a: '#A855F7', b: '#22D3EE', font: 'Readex Pro' },
  { id: 'editorial', label: 'حبر', hint: 'رصين كالمجلة', bg: '#F7F3EA', fg: '#1A1A1A', a: '#C2410C', b: '#1E3A8A', font: 'IBM Plex Sans Arabic' },
];

/** Brand colour pairs: primary, secondary. */
export const palettes: [string, string][] = [
  ['#5B3DF5', '#FF7A45'],
  ['#FFC83D', '#FF4F7B'],
  ['#D4A64A', '#8E1F2F'],
  ['#1E88E5', '#E53935'],
  ['#12A26B', '#0EA5E9'],
  ['#E11D48', '#FACC15'],
  ['#A855F7', '#22D3EE'],
  ['#111111', '#FFD400'],
];

export const captionModes: Opt[] = [
  { id: 'word_box', label: 'الكلمة في إطار' },
  { id: 'word_color', label: 'الكلمة تتلوّن' },
  { id: 'karaoke_line', label: 'سطر صغير' },
  { id: 'none', label: 'بدون' },
];

export const paces: Opt[] = [
  { id: 'calm', label: 'هادئ' },
  { id: 'medium', label: 'متوسط' },
  { id: 'fast', label: 'سريع' },
];

export const formats: Opt[] = [
  { id: '9:16', label: 'عمودي 9:16', hint: 'تيك توك · ريلز · شورتس' },
  { id: '1:1', label: 'مربع 1:1', hint: 'منشور' },
  { id: '4:5', label: 'طولي 4:5', hint: 'منشور إنستغرام' },
  { id: '16:9', label: 'أفقي 16:9', hint: 'يوتيوب' },
];

export const languages: Opt[] = [
  { id: 'auto', label: 'اكتشاف تلقائي' },
  { id: 'ar-DZ', label: 'الدارجة الجزائرية' },
  { id: 'ar-MA', label: 'الدارجة المغربية' },
  { id: 'ar', label: 'العربية الفصحى' },
  { id: 'ar-EG', label: 'المصرية' },
  { id: 'ar-GULF', label: 'الخليجية' },
  { id: 'ar-LEV', label: 'الشامية' },
  { id: 'fr', label: 'Français' },
  { id: 'en', label: 'English' },
  { id: 'es', label: 'Español' },
  { id: 'tr', label: 'Türkçe' },
];

export const stageLabels: Record<string, string> = {
  enhance_audio: 'تنقية الصوت',
  transcribe: 'كتابة كلامك',
  plan_scenes: 'تصميم المشاهد',
  render: 'تحريك الفيديو',
};

export const statusLabels: Record<string, string> = {
  draft: 'مسودة',
  queued: 'في الانتظار',
  processing: 'قيد الصنع',
  ready: 'جاهز',
  failed: 'لم يكتمل',
};
