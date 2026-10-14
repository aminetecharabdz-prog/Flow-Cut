import 'package:flutter/material.dart';

/// A selectable option shown as a chip or card in the wizard.
class Opt {
  const Opt(this.id, this.label, {this.hint, this.icon});
  final String id;
  final String label;
  final String? hint;
  final IconData? icon;
}

const businessTypes = [
  Opt('ecommerce', 'متجر إلكتروني', icon: Icons.storefront),
  Opt('real_estate', 'بناء وعقار', icon: Icons.apartment),
  Opt('services', 'خدمات', icon: Icons.handyman),
  Opt('food', 'مطعم ومقهى', icon: Icons.restaurant),
  Opt('beauty_health', 'تجميل وصحة', icon: Icons.spa),
  Opt('education', 'تعليم وتكوين', icon: Icons.school),
  Opt('creator', 'صانع محتوى', icon: Icons.videocam),
  Opt('other', 'أخرى', icon: Icons.more_horiz),
];

const goals = [
  Opt('content_marketing', 'تسويق بالمحتوى', hint: 'خطّاف، قيمة، ثم دعوة للمتابعة'),
  Opt('product_ad', 'إعلان منتج', hint: 'مشكلة، المنتج كحل، العرض، اطلب الآن'),
  Opt('educational', 'تعليمي / شرح', hint: 'عنوان، خطوات، ملخص'),
  Opt('story', 'قصة / تحفيز', hint: 'إيقاع هادئ واقتباسات بارزة'),
  Opt('news', 'خبر أو معلومة سريعة', hint: 'عنوان عاجل وأرقام متحركة'),
  Opt('event', 'خدمة أو حدث', hint: 'ما هو، متى وأين، كيف تحجز'),
];

const videoTypes = [
  Opt('motion_graphics', 'موشن غرافيك', hint: 'نصوص وأيقونات ورسوم متحركة على صوتك', icon: Icons.auto_awesome),
  Opt('media_montage', 'مونتاج صور وفيديوهات', hint: 'صورك ومقاطعك مع نصوص متحركة', icon: Icons.photo_library),
  Opt('talking_head', 'شخص يتكلم', hint: 'فيديو المتحدث مع رسوم توضيحية وكابشن', icon: Icons.record_voice_over),
];

class StyleOpt {
  const StyleOpt(this.id, this.label, this.hint, this.bg, this.primary, this.secondary, this.font);
  final String id;
  final String label;
  final String hint;
  final Color bg;
  final Color primary;
  final Color secondary;
  final String font;
}

const styles = [
  StyleOpt('vivid', 'طاقة', 'مرح وسريع', Color(0xFF0E1230), Color(0xFFFFC83D), Color(0xFFFF4F7B), 'MC Lalezar'),
  StyleOpt('luxury', 'أناقة', 'داكن وراقٍ', Color(0xFF0B0A08), Color(0xFFD4A64A), Color(0xFF8E1F2F), 'MC El Messiri'),
  StyleOpt('poster', 'جرأة', 'كتابة عريضة', Color(0xFFF4EFE6), Color(0xFFFFD400), Color(0xFFE63946), 'MC Baloo Bhaijaan'),
  StyleOpt('clean', 'صفاء', 'بسيط ونظيف', Color(0xFFFAFAF7), Color(0xFF2563EB), Color(0xFFF59E0B), 'MC Alexandria'),
  StyleOpt('neon', 'ليل', 'متوهج وتقني', Color(0xFF07020F), Color(0xFFA855F7), Color(0xFF22D3EE), 'MC Changa'),
  StyleOpt('editorial', 'حبر', 'رصين كالمجلة', Color(0xFFF7F3EA), Color(0xFFC2410C), Color(0xFF1E3A8A), 'MC Readex Pro'),
];

class FontOpt {
  const FontOpt(this.id, this.family, this.label);
  final String id;
  final String family;
  final String label;
}

/// `null` id = let the style decide.
const headingFonts = [
  FontOpt('lalezar', 'MC Lalezar', 'Lalezar'),
  FontOpt('alexandria', 'MC Alexandria', 'Alexandria'),
  FontOpt('el_messiri', 'MC El Messiri', 'El Messiri'),
  FontOpt('readex_pro', 'MC Readex Pro', 'Readex'),
  FontOpt('baloo_bhaijaan', 'MC Baloo Bhaijaan', 'Baloo'),
  FontOpt('cairo', 'MC Cairo', 'Cairo'),
  FontOpt('tajawal', 'MC Tajawal', 'Tajawal'),
  FontOpt('changa', 'MC Changa', 'Changa'),
  FontOpt('almarai', 'MC Almarai', 'Almarai'),
  FontOpt('noto_kufi', 'MC Noto Kufi', 'Kufi'),
  FontOpt('aref_ruqaa', 'MC Aref Ruqaa', 'Ruqaa'),
  FontOpt('amiri', 'MC Amiri', 'Amiri'),
  FontOpt('rubik', 'MC Rubik', 'Rubik'),
  FontOpt('montserrat', 'MC Montserrat', 'Montserrat'),
  FontOpt('bebas_neue', 'MC Bebas Neue', 'Bebas'),
];

const captionModes = [
  Opt('word_box', 'كلمة بكلمة مع إطار', hint: 'الكلمة المنطوقة داخل إطار ملوّن'),
  Opt('word_color', 'تلوين الكلمة', hint: 'الكلمة المنطوقة تتلوّن وتكبر'),
  Opt('karaoke_line', 'سطر كاريوكي', hint: 'سطر صغير يتلوّن مع الكلام'),
  Opt('none', 'بدون كابشن', hint: 'النصوص المتحركة فقط'),
];

const paces = [
  Opt('fast', 'سريع', hint: 'مشهد كل 1–2 ثانية'),
  Opt('medium', 'عادي', hint: 'مشهد كل 2–3 ثواني'),
  Opt('calm', 'هادئ', hint: 'مشهد كل 3–4.5 ثواني'),
];

const aspects = [
  Opt('9:16', '9:16', hint: 'ريلز · تيك توك · ستوري'),
  Opt('1:1', '1:1', hint: 'بوست مربع'),
  Opt('4:5', '4:5', hint: 'بوست طويل'),
  Opt('16:9', '16:9', hint: 'يوتيوب'),
];

const languages = [
  Opt('auto', 'كشف تلقائي'),
  Opt('ar', 'العربية الفصحى'),
  Opt('ar-DZ', 'الدارجة الجزائرية'),
  Opt('ar-MA', 'الدارجة المغربية'),
  Opt('ar-EG', 'المصرية'),
  Opt('ar-GULF', 'الخليجية'),
  Opt('ar-LEV', 'الشامية'),
  Opt('fr', 'Français'),
  Opt('en', 'English'),
  Opt('es', 'Español'),
  Opt('tr', 'Türkçe'),
];

/// Ready-made palettes: primary, secondary, background.
const palettes = <List<Color>>[
  [Color(0xFFFFC83D), Color(0xFFFF4F7B), Color(0xFF0E1230)],
  [Color(0xFFD4A64A), Color(0xFF8E1F2F), Color(0xFF0B0A08)],
  [Color(0xFF1E88E5), Color(0xFFE53935), Color(0xFF0B3A75)],
  [Color(0xFF22C55E), Color(0xFF0EA5E9), Color(0xFF052E1B)],
  [Color(0xFFFF6B35), Color(0xFF2EC4B6), Color(0xFFFFF8F0)],
  [Color(0xFFE11D48), Color(0xFFFACC15), Color(0xFFFFFFFF)],
  [Color(0xFFA855F7), Color(0xFF22D3EE), Color(0xFF07020F)],
  [Color(0xFF111111), Color(0xFFFFD400), Color(0xFFF4EFE6)],
];

String colorToHex(Color c) {
  final v = c.toARGB32() & 0xFFFFFF;
  return '#${v.toRadixString(16).padLeft(6, '0').toUpperCase()}';
}

Color? hexToColor(String? hex) {
  if (hex == null) return null;
  final m = RegExp(r'^#?([0-9a-fA-F]{6})$').firstMatch(hex.trim());
  if (m == null) return null;
  return Color(0xFF000000 | int.parse(m.group(1)!, radix: 16));
}

const stageLabels = {
  'enhance_audio': 'تحسين الصوت',
  'transcribe': 'تفريغ الكلام إلى نص',
  'plan_scenes': 'تخطيط المشاهد',
  'render': 'صناعة الفيديو',
  'encode': 'التصدير',
};

const statusLabels = {
  'draft': 'مسودة',
  'queued': 'في الانتظار',
  'processing': 'جارٍ التوليد...',
  'ready': 'جاهز',
  'failed': 'فشل',
};

/// Server error hints (see the generate function / RPCs) -> Arabic messages.
String friendlyError(String? code, String fallback) => switch (code) {
      'INSUFFICIENT_CREDITS' => 'رصيد الدقائق لا يكفي لهذا الفيديو.',
      'INVALID_DURATION' => 'مدة الصوت يجب أن تكون بين 5 ثواني و3 دقائق.',
      'NO_AUDIO' => 'أضف تعليقاً صوتياً أولاً.',
      'JOB_ACTIVE' => 'هناك عملية جارية على هذا المشروع، انتظر حتى تنتهي.',
      'PLAN_LIMIT' => 'هذه الجودة تتطلب اشتراكاً أعلى.',
      'NOT_READY' => 'الفيديو لم يجهز بعد.',
      'NOT_GENERATED' => 'ولّد الفيديو أولاً.',
      _ => fallback,
    };
