-- Signup, credits, and the generation queue.
-- Client-facing RPCs: get_credit_balance, start_generation, request_rerender, request_export.
-- Worker-only RPCs (service_role): claim_next_job, complete_job, fail_job, requeue_stale_jobs.

-- Free plan: 3 generation minutes (PRD §9).
create function public.plan_monthly_seconds(p_plan public.plan_tier) returns int
language sql immutable set search_path = '' as $$
  select case p_plan when 'free' then 180 when 'pro' then 1800 when 'business' then 7200 end
$$;

create function public.plan_brand_kit_limit(p_plan public.plan_tier) returns int
language sql immutable set search_path = '' as $$
  select case p_plan when 'free' then 0 when 'pro' then 1 when 'business' then 5 end
$$;

-- ---------------------------------------------------------------------------
-- New user: profile + free minutes
-- ---------------------------------------------------------------------------
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'));

  insert into public.credit_ledger (user_id, delta_seconds, reason, note)
  values (new.id, public.plan_monthly_seconds('free'), 'signup_grant', 'Free plan minutes');
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Brand kit limit per plan
-- ---------------------------------------------------------------------------
create function public.enforce_brand_kit_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_plan public.plan_tier;
  v_count int;
begin
  select plan into v_plan from public.profiles where id = new.user_id;
  select count(*) into v_count from public.brand_kits where user_id = new.user_id;
  if v_count >= public.plan_brand_kit_limit(coalesce(v_plan, 'free')) then
    raise exception 'Brand kit limit reached for plan %', coalesce(v_plan, 'free')
      using errcode = 'P0001', hint = 'PLAN_LIMIT';
  end if;
  return new;
end;
$$;

create trigger brand_kits_enforce_limit before insert on public.brand_kits
  for each row execute function public.enforce_brand_kit_limit();

-- ---------------------------------------------------------------------------
-- Credits
-- ---------------------------------------------------------------------------
create function public.get_credit_balance() returns int
language sql stable security invoker set search_path = '' as $$
  select coalesce(sum(delta_seconds), 0)::int
  from public.credit_ledger
  where user_id = (select auth.uid())
$$;

-- ---------------------------------------------------------------------------
-- Client RPC: start a full generation (enhance -> transcribe -> plan -> render)
-- ---------------------------------------------------------------------------
create function public.start_generation(p_project_id uuid) returns public.jobs
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_plan public.plan_tier;
  v_project public.projects;
  v_audio public.assets;
  v_seconds int;
  v_balance int;
  v_job public.jobs;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  -- Lock the profile row to serialize credit operations for this user.
  select plan into v_plan from public.profiles where id = v_uid for update;

  select * into v_project from public.projects
  where id = p_project_id and user_id = v_uid and deleted_at is null
  for update;
  if not found then
    raise exception 'Project not found' using errcode = 'P0002';
  end if;

  if v_project.source_audio_id is null then
    raise exception 'Project has no audio' using errcode = 'P0001', hint = 'NO_AUDIO';
  end if;

  select * into v_audio from public.assets where id = v_project.source_audio_id;
  -- The worker re-probes the real duration and fails the job if this was understated.
  if v_audio.duration_ms is null or v_audio.duration_ms < 5000 or v_audio.duration_ms > 180000 then
    raise exception 'Audio must be between 5 seconds and 3 minutes'
      using errcode = 'P0001', hint = 'INVALID_DURATION';
  end if;

  if exists (select 1 from public.jobs where project_id = p_project_id and status in ('queued', 'running')) then
    raise exception 'A job is already running for this project' using errcode = 'P0001', hint = 'JOB_ACTIVE';
  end if;

  v_seconds := ceil(v_audio.duration_ms / 1000.0)::int;
  select coalesce(sum(delta_seconds), 0) into v_balance from public.credit_ledger where user_id = v_uid;
  if v_balance < v_seconds then
    raise exception 'Not enough generation minutes' using errcode = 'P0001', hint = 'INSUFFICIENT_CREDITS';
  end if;

  insert into public.jobs (project_id, user_id, type, priority, charged_seconds)
  values (
    p_project_id, v_uid, 'full_generation',
    case v_plan when 'business' then 10 when 'pro' then 5 else 0 end,
    v_seconds
  )
  returning * into v_job;

  insert into public.credit_ledger (user_id, delta_seconds, reason, job_id)
  values (v_uid, -v_seconds, 'generation_charge', v_job.id);

  update public.projects
  set status = 'queued', error = null, duration_ms = v_audio.duration_ms
  where id = p_project_id;

  return v_job;
end;
$$;

-- ---------------------------------------------------------------------------
-- Client RPC: re-render after edits (template/font/colors/scene text). No charge:
-- transcription and planning are reused (PRD §8).
-- ---------------------------------------------------------------------------
create function public.request_rerender(p_project_id uuid) returns public.jobs
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_plan public.plan_tier;
  v_job public.jobs;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  select plan into v_plan from public.profiles where id = v_uid;

  perform 1 from public.projects
  where id = p_project_id and user_id = v_uid and deleted_at is null
  for update;
  if not found then
    raise exception 'Project not found' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.scenes where project_id = p_project_id) then
    raise exception 'Project has no scenes yet' using errcode = 'P0001', hint = 'NOT_GENERATED';
  end if;
  if exists (select 1 from public.jobs where project_id = p_project_id and status in ('queued', 'running')) then
    raise exception 'A job is already running for this project' using errcode = 'P0001', hint = 'JOB_ACTIVE';
  end if;

  insert into public.jobs (project_id, user_id, type, priority)
  values (p_project_id, v_uid, 'rerender', case v_plan when 'business' then 10 when 'pro' then 5 else 0 end)
  returning * into v_job;

  update public.projects set status = 'queued', error = null where id = p_project_id;
  return v_job;
end;
$$;

-- ---------------------------------------------------------------------------
-- Client RPC: final export. Quality is gated by plan (PRD §9).
-- ---------------------------------------------------------------------------
create function public.request_export(
  p_project_id uuid,
  p_resolution public.export_resolution default '1080p',
  p_fps smallint default 30,
  p_aspect_ratio public.aspect_ratio default null,
  p_include_subtitles boolean default false
) returns public.jobs
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_plan public.plan_tier;
  v_project public.projects;
  v_job public.jobs;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  select plan into v_plan from public.profiles where id = v_uid;

  select * into v_project from public.projects
  where id = p_project_id and user_id = v_uid and deleted_at is null
  for update;
  if not found then
    raise exception 'Project not found' using errcode = 'P0002';
  end if;
  if v_project.status <> 'ready' then
    raise exception 'Project is not ready to export' using errcode = 'P0001', hint = 'NOT_READY';
  end if;
  if p_fps not in (30, 60) then
    raise exception 'fps must be 30 or 60' using errcode = '22023';
  end if;
  if (p_resolution = '1080p' and v_plan = 'free') or (p_resolution = '4k' and v_plan <> 'business') then
    raise exception 'Resolution % requires a higher plan', p_resolution
      using errcode = 'P0001', hint = 'PLAN_LIMIT';
  end if;
  if exists (select 1 from public.jobs where project_id = p_project_id and status in ('queued', 'running')) then
    raise exception 'A job is already running for this project' using errcode = 'P0001', hint = 'JOB_ACTIVE';
  end if;

  insert into public.jobs (project_id, user_id, type, priority, params)
  values (
    p_project_id, v_uid, 'export',
    case v_plan when 'business' then 10 when 'pro' then 5 else 0 end,
    jsonb_build_object(
      'resolution', p_resolution,
      'fps', p_fps,
      'aspect_ratio', coalesce(p_aspect_ratio, v_project.aspect_ratio),
      'include_subtitles', p_include_subtitles,
      'watermark', v_plan = 'free'
    )
  )
  returning * into v_job;

  return v_job;
end;
$$;

-- ---------------------------------------------------------------------------
-- Worker RPCs
-- ---------------------------------------------------------------------------
create function public.claim_next_job(p_worker_id text) returns setof public.jobs
language plpgsql security definer set search_path = '' as $$
declare
  v_job public.jobs;
begin
  update public.jobs j
  set status = 'running',
      locked_by = p_worker_id,
      locked_at = now(),
      started_at = coalesce(j.started_at, now()),
      attempts = j.attempts + 1
  where j.id = (
    select id from public.jobs
    where status = 'queued'
    order by priority desc, created_at
    for update skip locked
    limit 1
  )
  returning j.* into v_job;

  if v_job.id is null then
    return;
  end if;

  if v_job.type <> 'export' then
    update public.projects set status = 'processing' where id = v_job.project_id;
  end if;
  return next v_job;
end;
$$;

create function public.complete_job(p_job_id uuid, p_result jsonb default '{}') returns public.jobs
language plpgsql security definer set search_path = '' as $$
declare
  v_job public.jobs;
begin
  update public.jobs
  set status = 'succeeded', progress = 100, result = p_result, error = null,
      finished_at = now(), locked_by = null, locked_at = null
  where id = p_job_id and status = 'running'
  returning * into v_job;
  if not found then
    raise exception 'Job % is not running', p_job_id using errcode = 'P0001';
  end if;

  if v_job.type <> 'export' then
    update public.projects set status = 'ready', error = null where id = v_job.project_id;
  end if;
  return v_job;
end;
$$;

-- Retryable failures go back to the queue until max_attempts; final failures
-- refund the charged minutes.
create function public.fail_job(p_job_id uuid, p_error text, p_retryable boolean default true)
returns public.jobs
language plpgsql security definer set search_path = '' as $$
declare
  v_job public.jobs;
begin
  select * into v_job from public.jobs where id = p_job_id and status = 'running' for update;
  if not found then
    raise exception 'Job % is not running', p_job_id using errcode = 'P0001';
  end if;

  if p_retryable and v_job.attempts < v_job.max_attempts then
    update public.jobs
    set status = 'queued', error = p_error, locked_by = null, locked_at = null
    where id = p_job_id
    returning * into v_job;
    return v_job;
  end if;

  update public.jobs
  set status = 'failed', error = p_error, finished_at = now(), locked_by = null, locked_at = null
  where id = p_job_id
  returning * into v_job;

  if v_job.charged_seconds > 0 then
    insert into public.credit_ledger (user_id, delta_seconds, reason, job_id, note)
    values (v_job.user_id, v_job.charged_seconds, 'generation_refund', v_job.id, 'Refund for failed generation')
    on conflict do nothing;
  end if;

  if v_job.type <> 'export' then
    update public.projects set status = 'failed', error = p_error where id = v_job.project_id;
  else
    update public.projects set error = p_error where id = v_job.project_id;
  end if;
  return v_job;
end;
$$;

-- Recover jobs whose worker died mid-run.
create function public.requeue_stale_jobs(p_older_than interval default interval '10 minutes')
returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_job public.jobs;
  v_count int := 0;
begin
  for v_job in
    select * from public.jobs
    where status = 'running' and locked_at < now() - p_older_than
    for update skip locked
  loop
    perform public.fail_job(v_job.id, 'Worker timed out', true);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Execute privileges: Postgres grants EXECUTE to PUBLIC by default.
-- ---------------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function public.get_credit_balance() to authenticated;
grant execute on function public.start_generation(uuid) to authenticated;
grant execute on function public.request_rerender(uuid) to authenticated;
grant execute on function
  public.request_export(uuid, public.export_resolution, smallint, public.aspect_ratio, boolean)
  to authenticated;
grant execute on function public.plan_monthly_seconds(public.plan_tier) to authenticated;
grant execute on function public.plan_brand_kit_limit(public.plan_tier) to authenticated;

grant execute on function public.claim_next_job(text) to service_role;
grant execute on function public.complete_job(uuid, jsonb) to service_role;
grant execute on function public.fail_job(uuid, text, boolean) to service_role;
grant execute on function public.requeue_stale_jobs(interval) to service_role;

-- Live progress in the app.
alter publication supabase_realtime add table public.jobs, public.projects;
