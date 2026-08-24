-- Roll back Stable Operations Console & Daily Workflows only.
-- Batch 1 stable operations, canonical horses, lessons, and Video Release 1 remain intact.
begin;

revoke all on function public.update_stable_task_workflow(uuid, uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.create_stable_task(uuid, uuid, text, text, timestamptz, text) from public, anon, authenticated;
revoke all on function public.complete_horse_care_schedule(uuid, uuid) from public, anon, authenticated;
revoke all on function public.upsert_horse_care_schedule(uuid, uuid, uuid, text, date, text, text) from public, anon, authenticated;
revoke all on function public.release_horse_operation_hold(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.create_horse_operation_hold(uuid, uuid, text, text, timestamptz, text, text, text) from public, anon, authenticated;
revoke all on function public.update_horse_operation_profile(uuid, uuid, text, text, boolean, integer, text) from public, anon, authenticated;
revoke all on function public.get_stable_operations_audit_timeline(uuid, integer) from public, anon, authenticated;
revoke all on function public.get_stable_care_schedules(uuid) from public, anon, authenticated;
revoke all on function public.get_stable_daily_tasks(uuid, text) from public, anon, authenticated;
revoke all on function public.get_stable_operations_console(uuid) from public, anon, authenticated;
revoke all on function public.check_horse_assignment_eligibility(uuid, uuid, timestamptz, integer, uuid, boolean) from public, anon, authenticated;

drop function if exists public.update_stable_task_workflow(uuid, uuid, text, text, text);
drop function if exists public.create_stable_task(uuid, uuid, text, text, timestamptz, text);
drop function if exists public.complete_horse_care_schedule(uuid, uuid);
drop function if exists public.upsert_horse_care_schedule(uuid, uuid, uuid, text, date, text, text);
drop function if exists public.release_horse_operation_hold(uuid, uuid, text);
drop function if exists public.create_horse_operation_hold(uuid, uuid, text, text, timestamptz, text, text, text);
drop function if exists public.update_horse_operation_profile(uuid, uuid, text, text, boolean, integer, text);
drop function if exists public.get_stable_operations_audit_timeline(uuid, integer);
drop function if exists public.get_stable_care_schedules(uuid);
drop function if exists public.get_stable_daily_tasks(uuid, text);
drop function if exists public.get_stable_operations_console(uuid);
drop function if exists public.check_horse_assignment_eligibility(uuid, uuid, timestamptz, integer, uuid, boolean);

drop index if exists public.lessons_horse_workload_console_idx;
drop index if exists public.stable_tasks_console_idx;
drop index if exists public.horse_care_schedules_console_idx;
drop index if exists public.horse_operation_holds_console_idx;

alter table public.stable_tasks
  drop constraint if exists stable_tasks_escalation_note_check,
  drop constraint if exists stable_tasks_escalation_level_check,
  drop column if exists escalation_note,
  drop column if exists escalated_by,
  drop column if exists escalated_at,
  drop column if exists escalation_level;

alter table public.horse_care_schedules
  drop constraint if exists horse_care_schedules_type_check;
do $$
begin
  if exists (
    select 1
    from public.horse_care_schedules
    where care_type in ('feeding', 'turnout', 'tack_equipment')
  ) then
    raise exception 'cannot roll back Batch 2 while feeding, turnout, or tack equipment care schedules exist; complete or archive those schedules first';
  end if;
end;
$$;
alter table public.horse_care_schedules
  add constraint horse_care_schedules_type_check
  check (care_type in ('veterinary', 'farrier', 'vaccination', 'routine_care'));

alter table public.horse_operation_holds
  drop constraint if exists horse_operation_holds_reason_check,
  drop column if exists reason;

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
  if tg_op = 'INSERT' then new.created_by := coalesce(new.created_by, v_actor_id); end if;
  new.updated_at := now();
  return new;
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
  v_has_profile boolean := false;
  v_existing_workload integer := 0;
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
  if v_has_profile and v_profile.workload_limit_minutes_7d is not null then
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

commit;