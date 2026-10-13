-- Launch catalogs. MVP scope (PRD §6): 4 languages, 2 goals, 6 motion templates.
-- Everything else is seeded disabled so V2 is a data change, not a migration.

insert into public.languages (code, name, name_native, is_rtl, is_dialect, is_enabled, sort_order) values
  ('ar',      'Modern Standard Arabic', 'العربية الفصحى',     true,  false, true,  1),
  ('ar-DZ',   'Algerian Darja',         'الدارجة الجزائرية',  true,  true,  true,  2),
  ('fr',      'French',                 'Français',          false, false, true,  3),
  ('en',      'English',                'English',           false, false, true,  4),
  ('ar-MA',   'Moroccan Darija',        'الدارجة المغربية',   true,  true,  false, 5),
  ('ar-EG',   'Egyptian Arabic',        'المصرية',           true,  true,  false, 6),
  ('ar-GULF', 'Gulf Arabic',            'الخليجية',          true,  true,  false, 7),
  ('ar-LEV',  'Levantine Arabic',       'الشامية',           true,  true,  false, 8),
  ('es',      'Spanish',                'Español',           false, false, false, 9),
  ('tr',      'Turkish',                'Türkçe',            false, false, false, 10);

insert into public.video_goals (code, name, name_ar, structure, is_enabled, sort_order) values
  ('content_marketing', 'Content marketing',   'تسويق بالمحتوى',   '{hook,value,cta}',                          true,  1),
  ('product_ad',        'Product ad',          'إعلان منتج',       '{problem,solution,features,offer,cta}',     true,  2),
  ('educational',       'Educational',         'تعليمي / شرح',     '{title,steps,summary}',                     false, 3),
  ('story',             'Story / motivational','قصة / تحفيزي',     '{opening,story,quote}',                     false, 4),
  ('news',              'Quick news',          'أخبار / معلومة سريعة', '{headline,facts,source}',               false, 5),
  ('event',             'Service or event',    'إعلان خدمة أو حدث', '{what,when_where,how_to_book}',            false, 6);

insert into public.templates (id, name, name_ar, tier, goals, config, sort_order) values
  ('minimal', 'Minimal', 'بسيط', 'free', '{content_marketing,product_ad}', '{
    "textIn": "fade_up", "textOut": "fade", "transition": "crossfade",
    "background": {"type": "solid"}, "iconStyle": "line",
    "palette": {"background": "#FFFFFF", "text": "#111111", "accent": "#2563EB", "highlight": "#F59E0B"},
    "paceMultiplier": 1.0
  }', 1),
  ('kinetic_typography', 'Kinetic Typography', 'كتابة حركية', 'free', '{content_marketing}', '{
    "textIn": "word_pop", "textOut": "slide_out", "transition": "whip_pan",
    "background": {"type": "solid"}, "iconStyle": "none",
    "palette": {"background": "#0B0B0F", "text": "#FFFFFF", "accent": "#FACC15", "highlight": "#FACC15"},
    "paceMultiplier": 1.2
  }', 2),
  ('bold_pop', 'Bold Pop', 'جريء', 'free', '{content_marketing,product_ad}', '{
    "textIn": "scale_bounce", "textOut": "scale_down", "transition": "shape_wipe",
    "background": {"type": "gradient", "angle": 135}, "iconStyle": "filled",
    "palette": {"background": "#FF3D7F", "text": "#FFFFFF", "accent": "#00E0FF", "highlight": "#FFE600"},
    "paceMultiplier": 1.15
  }', 3),
  ('corporate', 'Corporate', 'احترافي', 'pro', '{content_marketing,product_ad}', '{
    "textIn": "mask_reveal", "textOut": "fade", "transition": "slide",
    "background": {"type": "gradient", "angle": 180}, "iconStyle": "line",
    "palette": {"background": "#0F2A4A", "text": "#FFFFFF", "accent": "#38BDF8", "highlight": "#38BDF8"},
    "paceMultiplier": 0.95
  }', 4),
  ('neon', 'Neon', 'نيون', 'pro', '{content_marketing,product_ad}', '{
    "textIn": "flicker", "textOut": "glitch", "transition": "glitch",
    "background": {"type": "animated_pattern", "pattern": "grid"}, "iconStyle": "glow",
    "palette": {"background": "#05010F", "text": "#F5F3FF", "accent": "#A855F7", "highlight": "#22D3EE"},
    "paceMultiplier": 1.1
  }', 5),
  ('islamic_pattern', 'Islamic Pattern', 'زخرفة إسلامية', 'pro', '{content_marketing,product_ad}', '{
    "textIn": "fade_up", "textOut": "fade", "transition": "pattern_reveal",
    "background": {"type": "animated_pattern", "pattern": "girih"}, "iconStyle": "line",
    "palette": {"background": "#0E3B36", "text": "#FDF6E3", "accent": "#C9A44C", "highlight": "#C9A44C"},
    "paceMultiplier": 0.9
  }', 6);

-- Open-licensed (SIL OFL 1.1) Arabic + Latin families. Font files are uploaded later.
insert into public.fonts (id, family, scripts, tier, license, sort_order) values
  ('cairo',               'Cairo',               '{arabic,latin}', 'free', 'OFL-1.1', 1),
  ('tajawal',             'Tajawal',             '{arabic,latin}', 'free', 'OFL-1.1', 2),
  ('almarai',             'Almarai',             '{arabic,latin}', 'free', 'OFL-1.1', 3),
  ('ibm_plex_sans_arabic','IBM Plex Sans Arabic','{arabic,latin}', 'pro',  'OFL-1.1', 4),
  ('noto_kufi_arabic',    'Noto Kufi Arabic',    '{arabic,latin}', 'pro',  'OFL-1.1', 5),
  ('readex_pro',          'Readex Pro',          '{arabic,latin}', 'pro',  'OFL-1.1', 6),
  ('el_messiri',          'El Messiri',          '{arabic,latin}', 'pro',  'OFL-1.1', 7),
  ('lalezar',             'Lalezar',             '{arabic,latin}', 'pro',  'OFL-1.1', 8),
  ('changa',              'Changa',              '{arabic,latin}', 'pro',  'OFL-1.1', 9),
  ('rubik',               'Rubik',               '{arabic,latin}', 'pro',  'OFL-1.1', 10),
  ('inter',               'Inter',               '{latin}',        'free', 'OFL-1.1', 11),
  ('montserrat',          'Montserrat',          '{latin}',        'pro',  'OFL-1.1', 12),
  ('poppins',             'Poppins',             '{latin}',        'pro',  'OFL-1.1', 13),
  ('bebas_neue',          'Bebas Neue',          '{latin}',        'pro',  'OFL-1.1', 14);
