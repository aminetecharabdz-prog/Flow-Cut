-- MotionCut core schema: catalogs, profiles, projects, assets, transcripts,
-- scenes, jobs, exports and the generation-minutes ledger.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.plan_tier as enum ('free', 'pro', 'business');
create type public.project_status as enum ('draft', 'queued', 'processing', 'ready', 'failed');
create type public.job_type as enum ('full_generation', 'rerender', 'export');
create type public.job_status as enum ('queued', 'running', 'succeeded', 'failed', 'canceled');
create type public.job_stage as enum ('enhance_audio', 'transcribe', 'plan_scenes', 'render', 'encode');
create type public.asset_kind as enum (
  'source_audio', 'source_video', 'processed_audio',
  'product_image', 'product_cutout', 'logo',
  'preview_video', 'final_video', 'subtitles'
);
create type public.caption_style as enum ('word', 'line', 'sentence', 'headline');
create type public.motion_pace as enum ('calm', 'medium', 'fast');
create type public.music_mode as enum ('music', 'percussion', 'none');
create type public.text_script as enum ('arabic', 'latin');
create type public.aspect_ratio as enum ('9:16', '1:1', '4:5', '16:9');
create type public.export_resolution as enum ('720p', '1080p', '4k');
-- western = 0123456789, eastern_arabic = ٠١٢٣٤٥٦٧٨٩
create type public.digit_style as enum ('western', 'eastern_arabic');
create type public.ledger_reason as enum (
  'signup_grant', 'monthly_grant', 'topup',
  'generation_charge', 'generation_refund', 'adjustment'
);

-- ---------------------------------------------------------------------------
-- Shared trigger: updated_at
-- ---------------------------------------------------------------------------
create function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Catalogs (read-only for clients, managed by admins / service role)
-- ---------------------------------------------------------------------------
create table public.languages (
  code text primary key,
  name text not null,
  name_native text not null,
  is_rtl boolean not null default false,
  is_dialect boolean not null default false,
  is_enabled boolean not null default false,
  sort_order int not null default 0
);

create table public.video_goals (
  code text primary key,
  name text not null,
  name_ar text not null,
  -- Ordered scene roles the planner should follow, e.g. {hook,value,cta}.
  structure text[] not null,
  is_enabled boolean not null default false,
  sort_order int not null default 0
);

create table public.templates (
  id text primary key,
  name text not null,
  name_ar text not null,
  tier public.plan_tier not null default 'free',
  goals text[] not null default '{}',
  -- Motion parameters consumed by the renderer (entry/exit, transitions, background...).
  config jsonb not null default '{}',
  preview_path text,
  is_enabled boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table public.fonts (
  id text primary key,
  family text not null,
  scripts public.text_script[] not null,
  tier public.plan_tier not null default 'free',
  file_path text,
  license text not null,
  is_enabled boolean not null default true,
  sort_order int not null default 0
);

create table public.music_tracks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  moods text[] not null default '{}',
  goals text[] not null default '{}',
  bpm int check (bpm > 0),
  duration_ms int not null check (duration_ms > 0),
  file_path text not null,
  is_percussion_only boolean not null default false,
  tier public.plan_tier not null default 'free',
  license text not null,
  is_enabled boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  ui_locale text not null default 'ar',
  digit_style public.digit_style not null default 'western',
  plan public.plan_tier not null default 'free',
  plan_expires_at timestamptz,
  -- Explicit opt-in before any user audio may be used to fine-tune models.
  allow_training_use boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Brand kits (F7)
-- ---------------------------------------------------------------------------
create table public.brand_kits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  logo_path text,
  colors jsonb not null default '{}',
  heading_font_id text references public.fonts (id),
  body_font_id text references public.fonts (id),
  outro_text text,
  watermark_position text
    check (watermark_position in ('top_left', 'top_right', 'bottom_left', 'bottom_right')),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);
create index brand_kits_user_id_idx on public.brand_kits (user_id);
create unique index brand_kits_one_default_idx on public.brand_kits (user_id) where is_default;
create trigger brand_kits_updated_at before update on public.brand_kits
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Projects
-- ---------------------------------------------------------------------------
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null default '',
  status public.project_status not null default 'draft',
  goal text not null default 'content_marketing' references public.video_goals (code),
  -- null = auto-detect
  audio_language text references public.languages (code),
  detected_language text references public.languages (code),
  -- null = same as the audio language
  caption_language text references public.languages (code),
  caption_script public.text_script not null default 'arabic',
  template_id text not null default 'minimal' references public.templates (id),
  font_id text references public.fonts (id),
  palette jsonb not null default '{}',
  pace public.motion_pace not null default 'medium',
  caption_style public.caption_style not null default 'word',
  karaoke boolean not null default true,
  auto_emoji boolean not null default false,
  music_mode public.music_mode not null default 'music',
  music_track_id uuid references public.music_tracks (id) on delete set null,
  aspect_ratio public.aspect_ratio not null default '9:16',
  brand_kit_id uuid,
  -- Product ad data: {name, price, currency, offer, url}
  product jsonb,
  source_audio_id uuid,
  duration_ms int check (duration_ms between 0 and 180000),
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, user_id),
  foreign key (brand_kit_id, user_id)
    references public.brand_kits (id, user_id) on delete set null (brand_kit_id)
);
create index projects_user_id_idx on public.projects (user_id, updated_at desc) where deleted_at is null;
create index projects_goal_idx on public.projects (goal);
create index projects_template_id_idx on public.projects (template_id);
create index projects_font_id_idx on public.projects (font_id);
create index projects_music_track_id_idx on public.projects (music_track_id);
create index projects_audio_language_idx on public.projects (audio_language);
create index projects_detected_language_idx on public.projects (detected_language);
create index projects_caption_language_idx on public.projects (caption_language);
create index projects_brand_kit_idx on public.projects (brand_kit_id, user_id);
create trigger projects_updated_at before update on public.projects
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Assets: every file in Storage the app knows about
-- ---------------------------------------------------------------------------
create table public.assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id uuid,
  kind public.asset_kind not null,
  bucket text not null,
  path text not null,
  mime_type text,
  size_bytes bigint check (size_bytes >= 0),
  duration_ms int check (duration_ms >= 0),
  width int,
  height int,
  metadata jsonb not null default '{}',
  -- Source audio is purged after 30 days (privacy requirement).
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  unique (id, user_id),
  unique (bucket, path),
  -- Storage paths are always namespaced by owner: <user_id>/...
  check (split_part(path, '/', 1) = user_id::text),
  foreign key (project_id, user_id) references public.projects (id, user_id) on delete cascade
);
create index assets_project_idx on public.assets (project_id, user_id);
create index assets_user_id_idx on public.assets (user_id);
create index assets_expires_at_idx on public.assets (expires_at) where expires_at is not null;

create function public.set_asset_expiry() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.expires_at is null and new.kind in ('source_audio', 'source_video', 'processed_audio') then
    new.expires_at := now() + interval '30 days';
  end if;
  return new;
end;
$$;
create trigger assets_set_expiry before insert on public.assets
  for each row execute function public.set_asset_expiry();

alter table public.projects
  add foreign key (source_audio_id, user_id)
  references public.assets (id, user_id) on delete set null (source_audio_id);
create index projects_source_audio_idx on public.projects (source_audio_id, user_id);

-- ---------------------------------------------------------------------------
-- Transcripts: word-level ASR output, editable by the user
-- ---------------------------------------------------------------------------
create table public.transcripts (
  project_id uuid primary key,
  user_id uuid not null default auth.uid(),
  language text references public.languages (code),
  provider text not null,
  -- [{ "text": "...", "start_ms": 0, "end_ms": 420, "confidence": 0.93 }]
  words jsonb not null default '[]',
  full_text text not null default '',
  is_edited boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (project_id, user_id) references public.projects (id, user_id) on delete cascade
);
create index transcripts_project_user_idx on public.transcripts (project_id, user_id);
create index transcripts_language_idx on public.transcripts (language);
create trigger transcripts_updated_at before update on public.transcripts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Scenes: the planner's output, one row per scene card in the editor
-- ---------------------------------------------------------------------------
create table public.scenes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  user_id uuid not null default auth.uid(),
  position int not null check (position >= 0),
  -- hook, value, cta, problem, solution, feature, offer, ...
  role text not null,
  start_ms int not null check (start_ms >= 0),
  end_ms int not null,
  -- What was said (from the transcript).
  spoken_text text not null,
  -- What is shown on screen (may be corrected or translated).
  display_text text not null,
  keywords text[] not null default '{}',
  layout text not null default 'caption',
  -- Icons, stickers, shapes, product images: see packages/scene-plan.
  elements jsonb not null default '[]',
  background jsonb,
  -- Per-scene user overrides applied on top of the template.
  overrides jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_ms > start_ms),
  unique (project_id, position) deferrable initially deferred,
  foreign key (project_id, user_id) references public.projects (id, user_id) on delete cascade
);
create index scenes_project_user_idx on public.scenes (project_id, user_id);
create index scenes_user_id_idx on public.scenes (user_id);
create trigger scenes_updated_at before update on public.scenes
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Jobs: the generation queue consumed by the render worker
-- ---------------------------------------------------------------------------
create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  user_id uuid not null,
  type public.job_type not null,
  status public.job_status not null default 'queued',
  stage public.job_stage,
  progress smallint not null default 0 check (progress between 0 and 100),
  priority smallint not null default 0,
  -- Seconds debited from the ledger; refunded if the job finally fails.
  charged_seconds int not null default 0 check (charged_seconds >= 0),
  params jsonb not null default '{}',
  result jsonb,
  error text,
  attempts smallint not null default 0,
  max_attempts smallint not null default 3,
  locked_by text,
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  foreign key (project_id, user_id) references public.projects (id, user_id) on delete cascade
);
create index jobs_queue_idx on public.jobs (priority desc, created_at) where status = 'queued';
create index jobs_running_idx on public.jobs (locked_at) where status = 'running';
create index jobs_project_user_idx on public.jobs (project_id, user_id);
create index jobs_user_id_idx on public.jobs (user_id, created_at desc);
create unique index jobs_one_active_per_project_idx on public.jobs (project_id)
  where status in ('queued', 'running');

-- ---------------------------------------------------------------------------
-- Exports (F9)
-- ---------------------------------------------------------------------------
create table public.exports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  user_id uuid not null,
  job_id uuid references public.jobs (id) on delete set null,
  resolution public.export_resolution not null,
  fps smallint not null check (fps in (30, 60)),
  aspect_ratio public.aspect_ratio not null,
  has_watermark boolean not null,
  video_asset_id uuid references public.assets (id) on delete set null,
  subtitles_asset_id uuid references public.assets (id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (project_id, user_id) references public.projects (id, user_id) on delete cascade
);
create index exports_project_user_idx on public.exports (project_id, user_id);
create index exports_user_id_idx on public.exports (user_id);
create index exports_job_id_idx on public.exports (job_id);
create index exports_video_asset_idx on public.exports (video_asset_id);
create index exports_subtitles_asset_idx on public.exports (subtitles_asset_id);

-- ---------------------------------------------------------------------------
-- Credit ledger: generation minutes, stored in seconds (F10)
-- ---------------------------------------------------------------------------
create table public.credit_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  delta_seconds int not null check (delta_seconds <> 0),
  reason public.ledger_reason not null,
  job_id uuid references public.jobs (id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);
create index credit_ledger_user_id_idx on public.credit_ledger (user_id);
create index credit_ledger_job_id_idx on public.credit_ledger (job_id);
-- A job can be charged once and refunded once.
create unique index credit_ledger_one_charge_per_job_idx on public.credit_ledger (job_id, reason)
  where job_id is not null;
