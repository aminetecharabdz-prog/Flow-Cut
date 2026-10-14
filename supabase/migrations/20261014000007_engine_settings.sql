-- Settings used by the motion engine (engine/): video type, brief, caption
-- mode, end card, and the six motion styles that replace the first templates.

alter table public.projects
  add column video_type text not null default 'motion_graphics'
    check (video_type in ('motion_graphics', 'media_montage', 'talking_head')),
  add column business_name text,
  add column business_type text,
  add column idea text,
  add column caption_mode text not null default 'word_box'
    check (caption_mode in ('none', 'word_box', 'word_color', 'karaoke_line')),
  add column end_card jsonb,
  add column sfx boolean not null default true,
  -- Last VideoPlan sent to the renderer (debugging and re-renders).
  add column plan jsonb,
  add column preview_asset_id uuid references public.assets (id) on delete set null;
create index projects_preview_asset_idx on public.projects (preview_asset_id);

grant insert (video_type, business_name, business_type, idea, caption_mode, end_card, sfx)
  on public.projects to authenticated;
grant update (video_type, business_name, business_type, idea, caption_mode, end_card, sfx)
  on public.projects to authenticated;

-- Motion styles (engine/src/remotion/styles.ts). Colours come from the user.
insert into public.templates (id, name, name_ar, tier, goals, config, sort_order) values
  ('vivid', 'Vivid', 'حيوي', 'free', '{content_marketing,product_ad,educational,story,news,event}', '{"engineStyle": "vivid"}', 1),
  ('luxury', 'Luxury', 'فاخر', 'free', '{content_marketing,product_ad,story,event}', '{"engineStyle": "luxury"}', 2),
  ('poster', 'Poster', 'ملصق', 'free', '{content_marketing,product_ad,news,event}', '{"engineStyle": "poster"}', 3),
  ('clean', 'Clean', 'بسيط', 'pro', '{content_marketing,educational,news}', '{"engineStyle": "clean"}', 4),
  ('neon', 'Neon', 'نيون', 'pro', '{content_marketing,product_ad,event}', '{"engineStyle": "neon"}', 5),
  ('editorial', 'Editorial', 'صحفي', 'pro', '{educational,story,news}', '{"engineStyle": "editorial"}', 6)
on conflict (id) do update set
  name = excluded.name, name_ar = excluded.name_ar, tier = excluded.tier, goals = excluded.goals,
  config = excluded.config, sort_order = excluded.sort_order, is_enabled = true;
alter table public.projects alter column template_id set default 'vivid';

-- Fonts bundled with the engine (engine/public/fonts).
insert into public.fonts (id, family, scripts, tier, license, sort_order) values
  ('alexandria', 'Alexandria', '{arabic,latin}', 'free', 'OFL-1.1', 15),
  ('baloo_bhaijaan', 'Baloo Bhaijaan 2', '{arabic,latin}', 'free', 'OFL-1.1', 16),
  ('noto_kufi', 'Noto Kufi Arabic', '{arabic,latin}', 'pro', 'OFL-1.1', 17),
  ('aref_ruqaa', 'Aref Ruqaa', '{arabic,latin}', 'pro', 'OFL-1.1', 18),
  ('amiri', 'Amiri', '{arabic,latin}', 'pro', 'OFL-1.1', 19)
on conflict (id) do nothing;

-- Allow registering montage media and background music uploads.
create policy "Assets: register montage media and music" on public.assets
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and bucket in ('product-images', 'audio')
    and kind in ('media_image', 'media_video', 'music')
  );
