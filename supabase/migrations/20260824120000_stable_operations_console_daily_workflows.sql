-- Stable Operations Console & Daily Workflows.
-- Additive staff workflows over the Batch 1 stable and horse operations foundation.
-- No public sharing, medical analysis, automatic treatment guidance, or production-only behavior.
begin;

alter table public.horse_operation_holds
  add column if not exists reason text not null default 'Operational hold requires staff review.';

alter table public.horse_operation_holds
  drop constraint if exists horse_operation_holds_reason_check;
alter table public.horse_operation_holds
  add constraint horse_operation_holds_reason_check
  check (char_length(btrim(reason)) between 3 and 240);

alter table public.horse_care_schedules
  drop constraint if exists horse_care_schedules_type_check;
alter table public.horse_care_schedules
  add constraint horse_care_schedules_type_check
  check (care_type in ('veterinary', 'farrier', 'vaccination', 'feeding', 'turnout', 'tack_equipment', 'routine_care'));

alter table public.stable_tasks
  add column if not exists escalation_level text not null default 'none',
  add column if not exists escalated_at timestamptz,
  add column if not exists escalated_by uuid references public.profiles(id) on delete set null,
  add column if not exists escalation_note text;

alter table public.stable_tasks
  drop constraint if exists stable_tasks_escalation_level_check;
alter table public.stable_tasks
  add constraint stable_tasks_escalation_level_check
  check (escalation_level in ('none', 'attention', 'escalated'));
alter table public.stable_tasks
  drop constraint if exists stable_tasks_escalation_note_check;
alter table public.stable_tasks
  add constraint stable_tasks_escalation_note_check
  check (escalation_note is null or char_length(btrim(escalation_note)) between 3 and 500);

create index if not exists horse_operation_holds_console_idx
  on public.horse_operation_holds (organization_id, status, ends_at, hold_type);
create index if not exists horse_care_schedules_console_idx
  on public.horse_care_schedules (organization_id, status, due_on, care_type);
create index if not exists stable_tasks_console_idx
  on public.stable_tasks (organization_id, status, due_at, escalation_level);
create index if not exists lessons_horse_workload_console_idx
  on public.lessons (organization_id, horse_id, date_time, status)
  where horse_id is not null and status in ('pending', 'confirmed', 'completed');

-- A hold is active until staff explicitly releases it or marks it expired.
-- Closed holds retain their reason and timestamps for the audit timeline.
create or replace function private.prepare_horse_operation_hold()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
begin
  if tg_op = 'UPDATE'
    and (new.organization_id, new.horse_id) is distinct from (old.organization_id, old.horse_id) then
    raise exception 'horse operation holds cannot be reassigned; close the existing hold and create a new hold' using errcode = '23514';
  end if;
  if tg_op = 'INSERT' and new.status <> 'active' then
    raise exception 'new horse operation holds must start active' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' and old.status <> 'active' then
    if new is distinct from old then
      raise exception 'released or expired horse operation holds are immutable' using errcode = '23514';
    end if;
  end if;
  if new.status = 'active' and new.ends_at is not null and new.ends_at <= now() then
    raise exception 'active horse operation holds must expire in the future' using errcode = '23514';
  end if;
  perform private.lock_horse_operation(new.organization_id, new.horse_id);
  if not exists (
    select 1 from public.horses
    where id = new.horse_id and organization_id = new.organization_id
  ) then
    raise exception 'horse operation hold must use a horse in its organization' using errcode = '23514';
  end if;
  if not private.can_manage_stable_operations(new.organization_id) then
    raise exception 'academy administrator or coach access required for stable operations' using errcode = '42501';
  end if;
  if new.status <> 'active' then
    new.released_by := coalesce(new.released_by, v_actor_id);
    new.released_at := coalesce(new.released_at, now());
  else
    new.released_by := null;
    new.released_at := null;
  end if;
  if tg_op = 'INSERT' then new.created_by := coalesce(new.created_by, v_actor_id); end if;
  new.updated_at := now();
  return new;
end;
$$;

-- Keep task completion metadata and escalation metadata server-owned.
create or replace function private.prepare_stable_task()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
begin
  if new.horse_id is not null and not exists (
    select 1 from public.horses
    where id = new.horse_id and organization_id = new.organization_id
  ) then
    raise exception 'stable task horse must belong to its organization' using errcode = '23514';
  end if;
  if not private.can_manage_stable_operations(new.organization_id) then
    raise exception 'academy administrator or coach access required for stable operations' using errcode = '42501';
  end if;
  if new.status = 'completed' then
    new.completed_by := coalesce(new.completed_by, v_actor_id);
    new.completed_at := coalesce(new.completed_at, now());
  else
    new.completed_by := null;
    new.completed_at := null;
  end if;
  if new.escalation_level = 'none' then
    new.escalated_by := null;
    new.escalated_at := null;
  else
    new.escalated_by := coalesce(new.escalated_by, v_actor_id);
    new.escalated_at := coalesce(new.escalated_at, now());
  end if;
  if tg_op = 'INSERT' then new.created_by := coalesce(new.created_by, v_actor_id); end if;
  new.updated_at := now();
  return new;
end;
$$;

create function public.check_horse_assignment_eligibility(
  p_organization_id uuid,
  p_horse_id uuid,
  p_starts_at timestamptz,
  p_duration_minutes integer,
  p_exclude_lesson_id uuid default null,
  p_staff_confirmation boolean default false
)
returns table (
  eligible boolean,
  reason_code text,
  feedback text,
  scheduled_minutes_7d integer,
  workload_limit_minutes_7d integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.horse_operation_profiles%rowtype;
  v_existing_workload integer := 0;
  v_hold record;
begin
  if p_organization_id is null or p_horse_id is null or p_starts_at is null
    or p_duration_minutes is null or p_duration_minutes not between 15 and 480 then
    return query select false, 'invalid_input', 'invalid_input', 0, null::integer;
    return;
  end if;

  perform private.lock_horse_operation(p_organization_id, p_horse_id);

  if not private.can_manage_stable_operations(p_organization_id) then
    raise exception 'academy administrator or coach access required for assignment eligibility' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.horses
    where id = p_horse_id and organization_id = p_organization_id and status = 'active'
  ) then
    return query select false, 'horse_inactive', 'horse_inactive', 0, null::integer;
    return;
  end if;

  select * into v_profile
  from public.horse_operation_profiles
  where horse_id = p_horse_id and organization_id = p_organization_id;
  if not found then
    return query select false, 'profile_missing', 'profile_missing', 0, null::integer;
    return;
  end if;
  if not v_profile.availability_approved then
    return query select false, 'availability_unapproved', 'availability_unapproved', 0, v_profile.workload_limit_minutes_7d;
    return;
  end if;
  if v_profile.availability_state = 'unavailable' then
    return query select false, 'availability_unavailable', 'availability_unavailable', 0, v_profile.workload_limit_minutes_7d;
    return;
  end if;
  if v_profile.availability_state = 'limited'
    and (not p_staff_confirmation or not private.can_manage_stable_operations(p_organization_id)) then
    return query select false, 'limited_requires_confirmation', 'limited_requires_confirmation', 0, v_profile.workload_limit_minutes_7d;
    return;
  end if;

  select hold.hold_type, hold.reason, hold.ends_at
  into v_hold
  from public.horse_operation_holds as hold
  where hold.organization_id = p_organization_id
    and hold.horse_id = p_horse_id
    and hold.status = 'active'
    and hold.starts_at < p_starts_at + make_interval(mins => p_duration_minutes)
    and (hold.ends_at is null or hold.ends_at > p_starts_at)
  order by hold.starts_at desc
  limit 1;
  if found then
    return query select
      false,
      'active_hold',
      'active_hold',
      0,
      v_profile.workload_limit_minutes_7d;
    return;
  end if;

  select coalesce(sum(lesson.duration_min), 0)::integer into v_existing_workload
  from public.lessons as lesson
  where lesson.organization_id = p_organization_id
    and lesson.horse_id = p_horse_id
    and lesson.status in ('pending', 'confirmed', 'completed')
    and lesson.date_time >= p_starts_at - interval '6 days'
    and lesson.date_time < p_starts_at + interval '1 day'
    and (p_exclude_lesson_id is null or lesson.id <> p_exclude_lesson_id);
  if v_existing_workload + p_duration_minutes > v_profile.workload_limit_minutes_7d then
    return query select
      false,
      'workload_exceeded',
      'workload_exceeded',
      v_existing_workload,
      v_profile.workload_limit_minutes_7d;
    return;
  end if;

  return query select
    true,
    'eligible',
    'eligible',
    v_existing_workload,
    v_profile.workload_limit_minutes_7d;
end;
$$;

create or replace function public.assert_horse_assignment_allowed(
  p_organization_id uuid,
  p_horse_id uuid,
  p_starts_at timestamptz,
  p_duration_minutes integer,
  p_exclude_lesson_id uuid default null,
  p_staff_confirmation boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.horse_operation_profiles%rowtype;
  v_existing_workload integer := 0;
  v_has_profile boolean := false;
begin
  if p_organization_id is null or p_horse_id is null or p_starts_at is null
    or p_duration_minutes is null or p_duration_minutes not between 15 and 480 then
    raise exception 'organization, horse, start time, and a valid duration are required' using errcode = '23514';
  end if;
  perform private.lock_horse_operation(p_organization_id, p_horse_id);
  if not private.can_read_safe_horse_availability(p_organization_id, p_horse_id) then
    raise exception 'horse assignment access required' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.horses
    where id = p_horse_id and organization_id = p_organization_id and status = 'active'
  ) then
    raise exception 'horse is not active for assignment' using errcode = '23514';
  end if;

  select * into v_profile
  from public.horse_operation_profiles
  where horse_id = p_horse_id and organization_id = p_organization_id;
  v_has_profile := found;
  if not v_has_profile then
    raise exception 'horse operational profile is required before assignment' using errcode = '23514';
  end if;
  if not v_profile.availability_approved or v_profile.availability_state = 'unavailable' then
    raise exception 'horse availability has not been approved for assignment' using errcode = '23514';
  end if;
  if v_profile.availability_state = 'limited'
    and (not p_staff_confirmation or not private.can_manage_stable_operations(p_organization_id)) then
    raise exception 'limited horse availability requires staff confirmation' using errcode = '42501';
  end if;
  if exists (
    select 1
    from public.horse_operation_holds as hold
    where hold.organization_id = p_organization_id
      and hold.horse_id = p_horse_id
      and hold.status = 'active'
      and hold.starts_at < p_starts_at + make_interval(mins => p_duration_minutes)
      and (hold.ends_at is null or hold.ends_at > p_starts_at)
  ) then
    raise exception 'horse has an active welfare or care hold during this assignment' using errcode = '23514';
  end if;
  if v_profile.workload_limit_minutes_7d is not null then
    select coalesce(sum(lesson.duration_min), 0)::integer into v_existing_workload
    from public.lessons as lesson
    where lesson.organization_id = p_organization_id
      and lesson.horse_id = p_horse_id
      and lesson.status in ('pending', 'confirmed', 'completed')
      and lesson.date_time >= p_starts_at - interval '6 days'
      and lesson.date_time < p_starts_at + interval '1 day'
      and (p_exclude_lesson_id is null or lesson.id <> p_exclude_lesson_id);
    if v_existing_workload + p_duration_minutes > v_profile.workload_limit_minutes_7d then
      raise exception 'horse workload limit would be exceeded by this assignment' using errcode = '23514';
    end if;
  end if;
end;
$$;

create function public.get_stable_operations_console(p_organization_id uuid)
returns table (
  horse_id uuid,
  horse_name text,
  breed text,
  photo_url text,
  horse_status text,
  ownership_type text,
  availability_state text,
  availability_approved boolean,
  workload_used_minutes_7d integer,
  workload_limit_minutes_7d integer,
  active_hold_id uuid,
  active_hold_type text,
  active_hold_reason text,
  active_hold_ends_at timestamptz,
  open_task_count integer,
  overdue_task_count integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    horse.id,
    horse.name,
    horse.breed,
    horse.photo_url,
    horse.status,
    profile.ownership_type,
    profile.availability_state,
    profile.availability_approved,
    coalesce(workload.used_minutes, 0)::integer,
    profile.workload_limit_minutes_7d,
    active_hold.id,
    active_hold.hold_type,
    active_hold.reason,
    active_hold.ends_at,
    coalesce(tasks.open_count, 0)::integer,
    coalesce(tasks.overdue_count, 0)::integer
  from public.horses as horse
  join public.horse_operation_profiles as profile
    on profile.horse_id = horse.id and profile.organization_id = horse.organization_id
  left join lateral (
    select
      coalesce(sum(lesson.duration_min), 0)::integer as used_minutes
    from public.lessons as lesson
    where lesson.organization_id = horse.organization_id
      and lesson.horse_id = horse.id
      and lesson.status in ('pending', 'confirmed', 'completed')
      and lesson.date_time >= now() - interval '6 days'
      and lesson.date_time < now() + interval '1 day'
  ) as workload on true
  left join lateral (
    select hold.id, hold.hold_type, hold.reason, hold.ends_at
    from public.horse_operation_holds as hold
    where hold.organization_id = horse.organization_id
      and hold.horse_id = horse.id
      and hold.status = 'active'
      and hold.starts_at <= now()
      and (hold.ends_at is null or hold.ends_at > now())
    order by hold.starts_at desc
    limit 1
  ) as active_hold on true
  left join lateral (
    select
      count(*) filter (where task.status in ('open', 'in_progress')) as open_count,
      count(*) filter (where task.status in ('open', 'in_progress') and task.due_at < now()) as overdue_count
    from public.stable_tasks as task
    where task.organization_id = horse.organization_id
      and task.horse_id = horse.id
  ) as tasks on true
  where horse.organization_id = p_organization_id
    and private.can_manage_stable_operations(p_organization_id)
  order by horse.name;
$$;

create function public.get_stable_daily_tasks(
  p_organization_id uuid,
  p_state text default 'all'
)
returns table (
  task_id uuid,
  horse_id uuid,
  horse_name text,
  task_type text,
  title text,
  due_at timestamptz,
  status text,
  workflow_state text,
  escalation_level text,
  escalation_note text,
  private_task_note text,
  completed_by uuid,
  completed_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    task.id,
    task.horse_id,
    horse.name,
    task.task_type,
    task.title,
    task.due_at,
    task.status,
    case
      when task.status in ('open', 'in_progress') and task.due_at < now() then 'overdue'
      else task.status
    end,
    task.escalation_level,
    task.escalation_note,
    task.private_task_note,
    task.completed_by,
    task.completed_at
  from public.stable_tasks as task
  left join public.horses as horse
    on horse.id = task.horse_id and horse.organization_id = task.organization_id
  where task.organization_id = p_organization_id
    and private.can_manage_stable_operations(p_organization_id)
    and (
      p_state = 'all'
      or p_state = 'overdue' and task.status in ('open', 'in_progress') and task.due_at < now()
      or p_state = 'escalated' and task.escalation_level <> 'none'
      or p_state = task.status
    )
  order by task.due_at asc, task.created_at asc;
$$;

create function public.get_stable_care_schedules(p_organization_id uuid)
returns table (
  schedule_id uuid,
  horse_id uuid,
  horse_name text,
  care_type text,
  status text,
  due_on date,
  workflow_state text,
  safe_summary text,
  private_care_note text,
  completed_on date,
  completed_by uuid
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    schedule.id,
    schedule.horse_id,
    horse.name,
    schedule.care_type,
    schedule.status,
    schedule.due_on,
    case
      when schedule.status = 'scheduled' and schedule.due_on < current_date then 'overdue'
      else schedule.status
    end,
    schedule.safe_summary,
    schedule.private_care_note,
    schedule.completed_on,
    schedule.completed_by
  from public.horse_care_schedules as schedule
  join public.horses as horse
    on horse.id = schedule.horse_id and horse.organization_id = schedule.organization_id
  where schedule.organization_id = p_organization_id
    and private.can_manage_stable_operations(p_organization_id)
  order by schedule.due_on asc, horse.name;
$$;

create function public.get_stable_operations_audit_timeline(
  p_organization_id uuid,
  p_limit integer default 100
)
returns table (
  event_id uuid,
  horse_id uuid,
  entity_type text,
  entity_id uuid,
  action text,
  actor_user_id uuid,
  actor_name text,
  occurred_at timestamptz,
  before_data jsonb,
  after_data jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    event.id,
    event.horse_id,
    event.entity_type,
    event.entity_id,
    event.action,
    event.actor_user_id,
    actor.full_name,
    event.occurred_at,
    event.before_data,
    event.after_data
  from public.horse_operation_audit_events as event
  left join public.profiles as actor on actor.id = event.actor_user_id
  where event.organization_id = p_organization_id
    and private.can_manage_stable_operations(p_organization_id)
  order by event.occurred_at desc
  limit greatest(1, least(coalesce(p_limit, 100), 250));
$$;

create function public.update_horse_operation_profile(
  p_organization_id uuid,
  p_horse_id uuid,
  p_ownership_type text,
  p_availability_state text,
  p_availability_approved boolean,
  p_workload_limit_minutes_7d integer,
  p_private_operations_note text default null
)
returns public.horse_operation_profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.horse_operation_profiles;
begin
  if not private.can_manage_stable_operations(p_organization_id) then
    raise exception 'academy administrator or coach access required for stable operations' using errcode = '42501';
  end if;
  insert into public.horse_operation_profiles (
    horse_id, organization_id, ownership_type, availability_state,
    availability_approved, workload_limit_minutes_7d, private_operations_note
  )
  values (
    p_horse_id, p_organization_id, p_ownership_type, p_availability_state,
    p_availability_approved, p_workload_limit_minutes_7d, p_private_operations_note
  )
  on conflict (horse_id) do update set
    ownership_type = excluded.ownership_type,
    availability_state = excluded.availability_state,
    availability_approved = excluded.availability_approved,
    workload_limit_minutes_7d = excluded.workload_limit_minutes_7d,
    private_operations_note = excluded.private_operations_note;
  select * into v_profile
  from public.horse_operation_profiles
  where horse_id = p_horse_id and organization_id = p_organization_id;
  return v_profile;
end;
$$;

create function public.create_horse_operation_hold(
  p_organization_id uuid,
  p_horse_id uuid,
  p_hold_type text,
  p_reason text,
  p_ends_at timestamptz default null,
  p_safe_availability_state text default 'unavailable',
  p_safe_message text default 'This horse is temporarily unavailable for assignment.',
  p_private_welfare_note text default null
)
returns public.horse_operation_holds
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hold public.horse_operation_holds;
begin
  if not private.can_manage_stable_operations(p_organization_id) then
    raise exception 'academy administrator or coach access required for stable operations' using errcode = '42501';
  end if;
  insert into public.horse_operation_holds (
    organization_id, horse_id, hold_type, reason, ends_at,
    safe_availability_state, safe_message, private_welfare_note
  )
  values (
    p_organization_id, p_horse_id, p_hold_type, p_reason, p_ends_at,
    p_safe_availability_state, p_safe_message, p_private_welfare_note
  )
  returning * into v_hold;
  return v_hold;
end;
$$;

create function public.release_horse_operation_hold(
  p_organization_id uuid,
  p_hold_id uuid,
  p_status text default 'released'
)
returns public.horse_operation_holds
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hold public.horse_operation_holds;
begin
  if not private.can_manage_stable_operations(p_organization_id) then
    raise exception 'academy administrator or coach access required for stable operations' using errcode = '42501';
  end if;
  if p_status not in ('released', 'expired') then
    raise exception 'hold closure must be released or expired' using errcode = '23514';
  end if;
  update public.horse_operation_holds
  set status = p_status
  where organization_id = p_organization_id
    and id = p_hold_id
    and status = 'active'
  returning * into v_hold;
  if not found then
    raise exception 'active horse operation hold was not found' using errcode = 'P0002';
  end if;
  return v_hold;
end;
$$;

create function public.upsert_horse_care_schedule(
  p_organization_id uuid,
  p_schedule_id uuid,
  p_horse_id uuid,
  p_care_type text,
  p_due_on date,
  p_safe_summary text,
  p_private_care_note text default null
)
returns public.horse_care_schedules
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_schedule public.horse_care_schedules;
begin
  if not private.can_manage_stable_operations(p_organization_id) then
    raise exception 'academy administrator or coach access required for stable operations' using errcode = '42501';
  end if;
  if p_schedule_id is null then
    insert into public.horse_care_schedules (
      organization_id, horse_id, care_type, due_on, safe_summary, private_care_note
    )
    values (
      p_organization_id, p_horse_id, p_care_type, p_due_on, p_safe_summary, p_private_care_note
    )
    returning * into v_schedule;
  else
    update public.horse_care_schedules
    set horse_id = p_horse_id,
        care_type = p_care_type,
        due_on = p_due_on,
        safe_summary = p_safe_summary,
        private_care_note = p_private_care_note
    where id = p_schedule_id and organization_id = p_organization_id
    returning * into v_schedule;
    if not found then raise exception 'care schedule was not found' using errcode = 'P0002'; end if;
  end if;
  return v_schedule;
end;
$$;

create function public.complete_horse_care_schedule(
  p_organization_id uuid,
  p_schedule_id uuid
)
returns public.horse_care_schedules
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_schedule public.horse_care_schedules;
begin
  if not private.can_manage_stable_operations(p_organization_id) then
    raise exception 'academy administrator or coach access required for stable operations' using errcode = '42501';
  end if;
  update public.horse_care_schedules
  set status = 'completed'
  where id = p_schedule_id and organization_id = p_organization_id and status = 'scheduled'
  returning * into v_schedule;
  if not found then raise exception 'scheduled care item was not found' using errcode = 'P0002'; end if;
  return v_schedule;
end;
$$;

create function public.create_stable_task(
  p_organization_id uuid,
  p_horse_id uuid,
  p_task_type text,
  p_title text,
  p_due_at timestamptz,
  p_private_task_note text default null
)
returns public.stable_tasks
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_task public.stable_tasks;
begin
  if not private.can_manage_stable_operations(p_organization_id) then
    raise exception 'academy administrator or coach access required for stable operations' using errcode = '42501';
  end if;
  insert into public.stable_tasks (
    organization_id, horse_id, task_type, title, due_at, private_task_note
  )
  values (
    p_organization_id, p_horse_id, p_task_type, p_title, p_due_at, p_private_task_note
  )
  returning * into v_task;
  return v_task;
end;
$$;

create function public.update_stable_task_workflow(
  p_organization_id uuid,
  p_task_id uuid,
  p_status text,
  p_escalation_level text default 'none',
  p_escalation_note text default null
)
returns public.stable_tasks
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_task public.stable_tasks;
begin
  if not private.can_manage_stable_operations(p_organization_id) then
    raise exception 'academy administrator or coach access required for stable operations' using errcode = '42501';
  end if;
  update public.stable_tasks
  set status = p_status,
      escalation_level = p_escalation_level,
      escalation_note = p_escalation_note
  where id = p_task_id and organization_id = p_organization_id
  returning * into v_task;
  if not found then raise exception 'stable task was not found' using errcode = 'P0002'; end if;
  return v_task;
end;
$$;

revoke all on function public.check_horse_assignment_eligibility(uuid, uuid, timestamptz, integer, uuid, boolean) from public, anon;
revoke all on function public.get_stable_operations_console(uuid) from public, anon;
revoke all on function public.get_stable_daily_tasks(uuid, text) from public, anon;
revoke all on function public.get_stable_care_schedules(uuid) from public, anon;
revoke all on function public.get_stable_operations_audit_timeline(uuid, integer) from public, anon;
revoke all on function public.update_horse_operation_profile(uuid, uuid, text, text, boolean, integer, text) from public, anon;
revoke all on function public.create_horse_operation_hold(uuid, uuid, text, text, timestamptz, text, text, text) from public, anon;
revoke all on function public.release_horse_operation_hold(uuid, uuid, text) from public, anon;
revoke all on function public.upsert_horse_care_schedule(uuid, uuid, uuid, text, date, text, text) from public, anon;
revoke all on function public.complete_horse_care_schedule(uuid, uuid) from public, anon;
revoke all on function public.create_stable_task(uuid, uuid, text, text, timestamptz, text) from public, anon;
revoke all on function public.update_stable_task_workflow(uuid, uuid, text, text, text) from public, anon;

grant execute on function public.check_horse_assignment_eligibility(uuid, uuid, timestamptz, integer, uuid, boolean) to authenticated;
grant execute on function public.get_stable_operations_console(uuid) to authenticated;
grant execute on function public.get_stable_daily_tasks(uuid, text) to authenticated;
grant execute on function public.get_stable_care_schedules(uuid) to authenticated;
grant execute on function public.get_stable_operations_audit_timeline(uuid, integer) to authenticated;
grant execute on function public.update_horse_operation_profile(uuid, uuid, text, text, boolean, integer, text) to authenticated;
grant execute on function public.create_horse_operation_hold(uuid, uuid, text, text, timestamptz, text, text, text) to authenticated;
grant execute on function public.release_horse_operation_hold(uuid, uuid, text) to authenticated;
grant execute on function public.upsert_horse_care_schedule(uuid, uuid, uuid, text, date, text, text) to authenticated;
grant execute on function public.complete_horse_care_schedule(uuid, uuid) to authenticated;
grant execute on function public.create_stable_task(uuid, uuid, text, text, timestamptz, text) to authenticated;
grant execute on function public.update_stable_task_workflow(uuid, uuid, text, text, text) to authenticated;

commit;