-- Row level security and column-level grants.
-- Rule of thumb: clients read their own rows; anything that affects billing,
-- plan or job state is written only by security-definer RPCs or the worker
-- (service role, which bypasses RLS).

alter table public.languages enable row level security;
alter table public.video_goals enable row level security;
alter table public.templates enable row level security;
alter table public.fonts enable row level security;
alter table public.music_tracks enable row level security;
alter table public.profiles enable row level security;
alter table public.brand_kits enable row level security;
alter table public.projects enable row level security;
alter table public.assets enable row level security;
alter table public.transcripts enable row level security;
alter table public.scenes enable row level security;
alter table public.jobs enable row level security;
alter table public.exports enable row level security;
alter table public.credit_ledger enable row level security;

-- ---------------------------------------------------------------------------
-- Catalogs: readable by everyone (the onboarding flow runs before sign-in)
-- ---------------------------------------------------------------------------
revoke insert, update, delete, truncate on
  public.languages, public.video_goals, public.templates, public.fonts, public.music_tracks
  from anon, authenticated;

create policy "Catalog: languages are readable" on public.languages
  for select to anon, authenticated using (true);
create policy "Catalog: goals are readable" on public.video_goals
  for select to anon, authenticated using (true);
create policy "Catalog: enabled templates are readable" on public.templates
  for select to anon, authenticated using (is_enabled);
create policy "Catalog: enabled fonts are readable" on public.fonts
  for select to anon, authenticated using (is_enabled);
create policy "Catalog: enabled music is readable" on public.music_tracks
  for select to anon, authenticated using (is_enabled);

-- ---------------------------------------------------------------------------
-- User-owned data is never visible to anon
-- ---------------------------------------------------------------------------
revoke all on
  public.profiles, public.brand_kits, public.projects, public.assets, public.transcripts,
  public.scenes, public.jobs, public.exports, public.credit_ledger
  from anon;

-- Profiles: plan and expiry are managed by the billing webhook only.
revoke insert, update, delete, truncate on public.profiles from authenticated;
grant update (display_name, ui_locale, digit_style, allow_training_use)
  on public.profiles to authenticated;

create policy "Profiles: read own" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "Profiles: update own" on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Brand kits: full CRUD on own rows (plan limit enforced by trigger).
create policy "Brand kits: read own" on public.brand_kits
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Brand kits: create own" on public.brand_kits
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Brand kits: update own" on public.brand_kits
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Brand kits: delete own" on public.brand_kits
  for delete to authenticated using (user_id = (select auth.uid()));

-- Projects: users edit settings; status, duration and errors belong to the pipeline.
revoke insert, update on public.projects from authenticated;
grant insert (
  id, title, goal, audio_language, caption_language, caption_script, template_id, font_id,
  palette, pace, caption_style, karaoke, auto_emoji, music_mode, music_track_id, aspect_ratio,
  brand_kit_id, product, source_audio_id
) on public.projects to authenticated;
grant update (
  title, goal, audio_language, caption_language, caption_script, template_id, font_id,
  palette, pace, caption_style, karaoke, auto_emoji, music_mode, music_track_id, aspect_ratio,
  brand_kit_id, product, source_audio_id, deleted_at
) on public.projects to authenticated;

create policy "Projects: read own" on public.projects
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Projects: create own" on public.projects
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Projects: update own" on public.projects
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Projects: delete own" on public.projects
  for delete to authenticated using (user_id = (select auth.uid()));

-- Assets: users register their uploads; render outputs are written by the worker.
revoke update on public.assets from authenticated;
create policy "Assets: read own" on public.assets
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Assets: register own uploads" on public.assets
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and bucket in ('audio', 'product-images', 'brand')
    and kind in ('source_audio', 'source_video', 'product_image', 'logo')
  );
create policy "Assets: delete own" on public.assets
  for delete to authenticated using (user_id = (select auth.uid()));

-- Transcripts: created by the worker, corrected by the user.
revoke insert, update, delete on public.transcripts from authenticated;
grant update (words, full_text, is_edited) on public.transcripts to authenticated;
create policy "Transcripts: read own" on public.transcripts
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Transcripts: update own" on public.transcripts
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Scenes: the editor can split, merge, reorder and edit scene cards.
revoke update on public.scenes from authenticated;
grant update (
  position, role, start_ms, end_ms, display_text, keywords, layout, elements, background, overrides
) on public.scenes to authenticated;
create policy "Scenes: read own" on public.scenes
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Scenes: create own" on public.scenes
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Scenes: update own" on public.scenes
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Scenes: delete own" on public.scenes
  for delete to authenticated using (user_id = (select auth.uid()));

-- Jobs, exports, ledger: read-only for clients.
revoke insert, update, delete, truncate on public.jobs, public.exports, public.credit_ledger
  from authenticated;
create policy "Jobs: read own" on public.jobs
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Exports: read own" on public.exports
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Ledger: read own" on public.credit_ledger
  for select to authenticated using (user_id = (select auth.uid()));
