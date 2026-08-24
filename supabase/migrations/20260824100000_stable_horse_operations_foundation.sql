-- Stable & Horse Operations Foundation.
-- Tenant-scoped operational records only. No medical analysis, public sharing, or automatic treatment guidance.
begin;

create table public.horse_operation_profiles (
  horse_id uuid primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  ownership_type text not null,
  availability_state text not null default 'unavailable',
  availability_approved boolean not null default false,
  workload_limit_minutes_7d integer not null default 360,
  private_operations_note text,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint horse_operation_profiles_horse_organization_fkey
    foreign key (horse_id, organization_id)
    references public.horses(id, organization_id) on delete cascade,
  constraint horse_operation_profiles_ownership_type_check
    check (ownership_type in ('academy', 'personal', 'guest')),
  constraint horse_operation_profiles_availability_state_check
    check (availability_state in ('available', 'limited', 'unavailable')),
  constraint horse_operation_profiles_workload_limit_check
    check (workload_limit_minutes_7d between 30 and 1680),
  constraint horse_operation_profiles_note_length_check
    check (private_operations_note is null or char_length(btrim(private_operations_note)) <= 2000)
);

create table public.horse_operation_holds (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  horse_id uuid not null,
  hold_type text not null,
  status text not null default 'active',
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  safe_availability_state text not null default 'unavailable',
  safe_message text not null default 'Not available for lesson assignment.',
  private_welfare_note text,
  created_by uuid references public.profiles(id) on delete set null,
  released_by uuid references public.profiles(id) on delete set null,
  released_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint horse_operation_holds_horse_organization_fkey
    foreign key (horse_id, organization_id)
    references public.horses(id, organization_id) on delete cascade,
  constraint horse_operation_holds_type_check
    check (hold_type in ('rest', 'injury', 'veterinary', 'welfare')),
  constraint horse_operation_holds_status_check
    check (status in ('active', 'released', 'expired')),
  constraint horse_operation_holds_time_check
    check (ends_at is null or ends_at > starts_at),
  constraint horse_operation_holds_safe_state_check
    check (safe_availability_state in ('limited', 'unavailable')),
  constraint horse_operation_holds_safe_message_check
    check (char_length(btrim(safe_message)) between 3 and 240),
  constraint horse_operation_holds_private_note_check
    check (private_welfare_note is null or char_length(btrim(private_welfare_note)) <= 4000),
  constraint horse_operation_holds_release_check
    check (
      (status = 'active' and released_by is null and released_at is null)
      or (status in ('released', 'expired'))
    )
);

create table public.horse_care_schedules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  horse_id uuid not null,
  care_type text not null,
  status text not null default 'scheduled',
  due_on date not null,
  completed_on date,
  safe_summary text not null,
  private_care_note text,
  created_by uuid references public.profiles(id) on delete set null,
  completed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint horse_care_schedules_horse_organization_fkey
    foreign key (horse_id, organization_id)
    references public.horses(id, organization_id) on delete cascade,
  constraint horse_care_schedules_type_check
    check (care_type in ('veterinary', 'farrier', 'vaccination', 'routine_care')),
  constraint horse_care_schedules_status_check
    check (status in ('scheduled', 'completed', 'cancelled')),
  constraint horse_care_schedules_completion_check
    check (
      (status = 'completed' and completed_on is not null and completed_by is not null)
      or (status <> 'completed' and completed_on is null and completed_by is null)
    ),
  constraint horse_care_schedules_safe_summary_check
    check (char_length(btrim(safe_summary)) between 3 and 240),
  constraint horse_care_schedules_private_note_check
    check (private_care_note is null or char_length(btrim(private_care_note)) <= 4000)
);

create table public.stable_tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  horse_id uuid,
  task_type text not null,
  status text not null default 'open',
  title text not null,
  due_at timestamptz not null,
  private_task_note text,
  completed_by uuid references public.profiles(id) on delete set null,
  completed_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stable_tasks_horse_organization_fkey
    foreign key (horse_id, organization_id)
    references public.horses(id, organization_id) on delete set null (horse_id),
  constraint stable_tasks_type_check
    check (task_type in ('feeding', 'turnout', 'tack_equipment', 'safety_check', 'routine_care')),
  constraint stable_tasks_status_check
    check (status in ('open', 'in_progress', 'completed', 'cancelled')),
  constraint stable_tasks_title_check
    check (char_length(btrim(title)) between 3 and 240),
  constraint stable_tasks_completion_check
    check (
      (status = 'completed' and completed_by is not null and completed_at is not null)
      or (status <> 'completed' and completed_by is null and completed_at is null)
    ),
  constraint stable_tasks_private_note_check
    check (private_task_note is null or char_length(btrim(private_task_note)) <= 4000)
);

create table public.horse_operation_audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  horse_id uuid references public.horses(id) on delete set null,
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  actor_user_id uuid references public.profiles(id) on delete set null,
  before_data jsonb,
  after_data jsonb,
  occurred_at timestamptz not null default now(),
  constraint horse_operation_audit_entity_type_check
    check (entity_type in ('horse_operation_profile', 'horse_operation_hold', 'horse_care_schedule', 'stable_task')),
  constraint horse_operation_audit_action_check
    check (action in ('created', 'updated', 'deleted'))
);

create index horse_operation_profiles_organization_availability_idx
  on public.horse_operation_profiles (organization_id, availability_state, availability_approved);
create index horse_operation_holds_active_attention_idx
  on public.horse_operation_holds (organization_id, horse_id, starts_at, ends_at)
  where status = 'active';
create index horse_care_schedules_due_idx
  on public.horse_care_schedules (organization_id, due_on)
  where status = 'scheduled';
create index stable_tasks_due_idx
  on public.stable_tasks (organization_id, due_at)
  where status in ('open', 'in_progress');
create index horse_operation_audit_history_idx
  on public.horse_operation_audit_events (organization_id, horse_id, occurred_at desc);

-- Existing organization horses enter the operational model unapproved. This preserves
-- historical records while requiring staff to explicitly establish availability.
insert into public.horse_operation_profiles (
  horse_id, organization_id, ownership_type, availability_state, availability_approved
)
select
  horse.id, horse.organization_id, 'academy', 'unavailable', false
from public.horses as horse
where horse.organization_id is not null
on conflict (horse_id) do nothing;

comment on table public.horse_operation_profiles is
  'Private, tenant-scoped operational profile. Availability remains unavailable to audiences until explicitly approved.';
comment on table public.horse_operation_holds is
  'Private staff welfare and assignment hold records. Only a curated safe availability state can reach riders or guardians.';
comment on table public.horse_operation_audit_events is
  'Append-only private operational audit history; client roles receive SELECT only.';

create function private.can_manage_stable_operations(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.is_platform_admin()
    or private.has_organization_role(
      p_organization_id, array['academy_admin', 'coach']
    );
$$;

create function private.can_read_safe_horse_availability(
  p_organization_id uuid,
  p_horse_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.can_manage_stable_operations(p_organization_id)
    or exists (
      select 1
      from public.horse_access_assignments as direct_access
      where direct_access.organization_id = p_organization_id
        and direct_access.horse_id = p_horse_id
        and direct_access.profile_id = (select auth.uid())
        and direct_access.active
        and direct_access.access_type in ('rider', 'guardian')
    )
    or exists (
      select 1
      from public.horse_access_assignments as rider_access
      where rider_access.organization_id = p_organization_id
        and rider_access.horse_id = p_horse_id
        and rider_access.active
        and rider_access.access_type = 'rider'
        and private.can_guardian_access_rider(
          p_organization_id,
          (select auth.uid()),
          rider_access.profile_id
        )
    );
$$;

create function private.lock_horse_operation(
  p_organization_id uuid,
  p_horse_id uuid
)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  select pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_organization_id::text || ':' || p_horse_id::text, 0)
  );
$$;

create function private.prepare_horse_operation_profile()
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
    raise exception 'horse operation profiles cannot be reassigned; create or update the profile for its original horse' using errcode = '23514';
  end if;
  perform private.lock_horse_operation(new.organization_id, new.horse_id);
  if not exists (
    select 1 from public.horses
    where id = new.horse_id and organization_id = new.organization_id
  ) then
    raise exception 'horse operation profile must use a horse in its organization' using errcode = '23514';
  end if;
  if not private.can_manage_stable_operations(new.organization_id) then
    raise exception 'academy administrator or coach access required for stable operations' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, v_actor_id);
  end if;
  new.updated_by := coalesce(v_actor_id, new.updated_by);
  new.updated_at := now();
  return new;
end;
$$;

create function private.prevent_horse_operation_profile_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.lock_horse_operation(old.organization_id, old.horse_id);
  -- A horse delete reaches this trigger through the foreign-key cascade. It must
  -- retain the canonical horse lifecycle while direct operational profile deletes
  -- stay fail-closed.
  if pg_trigger_depth() > 1 then
    return old;
  end if;
  raise exception 'horse operation profiles cannot be deleted; mark them unavailable and unapproved instead' using errcode = '23514';
end;
$$;

create function private.prepare_horse_operation_hold()
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

create function private.prepare_horse_operation_hold_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Direct deletion changes assignment eligibility and must serialize with
  -- lesson assignment. The canonical horse cascade keeps its lifecycle path,
  -- but still takes the same per-horse lock before dependent cleanup.
  if pg_trigger_depth() <= 1
    and not private.can_manage_stable_operations(old.organization_id) then
    raise exception 'academy administrator or coach access required for stable operations' using errcode = '42501';
  end if;
  perform private.lock_horse_operation(old.organization_id, old.horse_id);
  return old;
end;
$$;

create function private.lock_horse_operation_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status
    and old.organization_id is not null then
    perform private.lock_horse_operation(old.organization_id, old.id);
  end if;
  return new;
end;
$$;

create function private.prepare_horse_care_schedule()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
begin
  if not exists (
    select 1 from public.horses
    where id = new.horse_id and organization_id = new.organization_id
  ) then
    raise exception 'horse care schedule must use a horse in its organization' using errcode = '23514';
  end if;
  if not private.can_manage_stable_operations(new.organization_id) then
    raise exception 'academy administrator or coach access required for stable operations' using errcode = '42501';
  end if;
  if new.status = 'completed' then
    new.completed_by := coalesce(new.completed_by, v_actor_id);
    new.completed_on := coalesce(new.completed_on, current_date);
  else
    new.completed_by := null;
    new.completed_on := null;
  end if;
  if tg_op = 'INSERT' then new.created_by := coalesce(new.created_by, v_actor_id); end if;
  new.updated_at := now();
  return new;
end;
$$;

create function private.prepare_stable_task()
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

create function private.audit_horse_operation_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before jsonb;
  v_after jsonb;
  v_organization_id uuid;
  v_horse_id uuid;
  v_entity_id uuid;
begin
  v_before := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end;
  v_after := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end;
  v_organization_id := coalesce((v_after ->> 'organization_id')::uuid, (v_before ->> 'organization_id')::uuid);
  v_horse_id := nullif(coalesce(v_after ->> 'horse_id', v_before ->> 'horse_id'), '')::uuid;
  v_entity_id := coalesce((v_after ->> 'id')::uuid, (v_before ->> 'id')::uuid, v_horse_id);
  -- Canonical horse deletion cascades to profiles, holds, and care schedules.
  -- Avoid a foreign key to the deleting horse; profiles use the former horse
  -- identity while holds and care schedules retain their own record identity.
  if tg_table_name in ('horse_operation_profiles', 'horse_operation_holds', 'horse_care_schedules')
    and tg_op = 'DELETE'
    and pg_trigger_depth() > 1 then
    if tg_table_name = 'horse_operation_profiles' then
      v_entity_id := v_horse_id;
    end if;
    v_horse_id := null;
  end if;
  -- A canonical horse delete retains its stable tasks but clears their horse
  -- reference. Do not restore that deleting UUID through the audit fallback.
  if tg_table_name = 'stable_tasks'
    and tg_op = 'UPDATE'
    and pg_trigger_depth() > 1
    and (v_after ->> 'horse_id') is null
    and (v_before ->> 'horse_id') is not null then
    v_horse_id := null;
  end if;

  insert into public.horse_operation_audit_events (
    organization_id, horse_id, entity_type, entity_id, action, actor_user_id, before_data, after_data
  )
  values (
    v_organization_id,
    v_horse_id,
    case tg_table_name
      when 'horse_operation_profiles' then 'horse_operation_profile'
      when 'horse_operation_holds' then 'horse_operation_hold'
      when 'horse_care_schedules' then 'horse_care_schedule'
      when 'stable_tasks' then 'stable_task'
    end,
    v_entity_id,
    lower(tg_op),
    (select auth.uid()),
    v_before,
    v_after
  );
  insert into public.audit_events (
    organization_id, source, actor_user_id, entity_type, entity_id, action, before_data, after_data
  )
  values (
    v_organization_id,
    'system',
    (select auth.uid()),
    case tg_table_name
      when 'horse_operation_profiles' then 'horse_operation_profile'
      when 'horse_operation_holds' then 'horse_operation_hold'
      when 'horse_care_schedules' then 'horse_care_schedule'
      when 'stable_tasks' then 'stable_task'
    end,
    v_entity_id,
    'stable_operations.' || lower(tg_op),
    v_before,
    v_after
  );
  return null;
end;
$$;

create function public.assert_horse_assignment_allowed(
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

create function private.enforce_lesson_horse_operation_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.horse_id is not null and new.status in ('pending', 'confirmed', 'completed') then
    perform public.assert_horse_assignment_allowed(
      new.organization_id,
      new.horse_id,
      new.date_time,
      new.duration_min,
      new.id,
      private.can_manage_stable_operations(new.organization_id)
    );
  end if;
  return new;
end;
$$;

create function public.get_safe_horse_availability(p_organization_id uuid)
returns table (
  horse_id uuid,
  horse_name text,
  availability_state text,
  safe_message text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    horse.id,
    horse.name,
    case
      when horse.status <> 'active' then 'unavailable'
      when profile.availability_approved is not true then 'unavailable'
      when active_hold.id is not null then active_hold.safe_availability_state
      else profile.availability_state
    end,
    case
      when horse.status <> 'active' then 'This horse is not active for lesson assignment.'
      when profile.availability_approved is not true then 'Availability has not been approved.'
      when active_hold.id is not null then active_hold.safe_message
      when profile.availability_state = 'available' then 'Available for suitable lesson assignment.'
      when profile.availability_state = 'limited' then 'Limited availability; staff confirmation is required.'
      else 'Not available for lesson assignment.'
    end
  from public.horses as horse
  join public.horse_operation_profiles as profile
    on profile.horse_id = horse.id and profile.organization_id = horse.organization_id
  left join lateral (
    select hold.id, hold.safe_availability_state, hold.safe_message
    from public.horse_operation_holds as hold
    where hold.organization_id = horse.organization_id
      and hold.horse_id = horse.id
      and hold.status = 'active'
      and hold.starts_at <= now()
      and (hold.ends_at is null or hold.ends_at > now())
    order by hold.starts_at desc
    limit 1
  ) as active_hold on true
  where horse.organization_id = p_organization_id
    and private.can_read_safe_horse_availability(p_organization_id, horse.id);
$$;

create function public.get_stable_operations_roster(p_organization_id uuid)
returns table (
  horse_id uuid,
  horse_name text,
  breed text,
  photo_url text,
  horse_status text,
  rider_count integer
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
    count(rider_access.profile_id)::integer
  from public.horses as horse
  left join public.horse_access_assignments as rider_access
    on rider_access.organization_id = horse.organization_id
    and rider_access.horse_id = horse.id
    and rider_access.active
    and rider_access.access_type = 'rider'
  where horse.organization_id = p_organization_id
    and private.can_manage_stable_operations(p_organization_id)
  group by horse.id, horse.name, horse.breed, horse.photo_url, horse.status
  order by horse.name;
$$;

create trigger horse_operation_profiles_prepare
before insert or update on public.horse_operation_profiles
for each row execute function private.prepare_horse_operation_profile();
create trigger horse_operation_profiles_prevent_delete
before delete on public.horse_operation_profiles
for each row execute function private.prevent_horse_operation_profile_delete();
create trigger horse_operation_holds_prepare
before insert or update on public.horse_operation_holds
for each row execute function private.prepare_horse_operation_hold();
create trigger horse_operation_holds_prepare_delete
before delete on public.horse_operation_holds
for each row execute function private.prepare_horse_operation_hold_delete();
create trigger horses_horse_operation_status_lock
before update of status on public.horses
for each row execute function private.lock_horse_operation_status_change();
create trigger horse_care_schedules_prepare
before insert or update on public.horse_care_schedules
for each row execute function private.prepare_horse_care_schedule();
create trigger stable_tasks_prepare
before insert or update on public.stable_tasks
for each row execute function private.prepare_stable_task();
create trigger horse_operation_profiles_audit
after insert or update or delete on public.horse_operation_profiles
for each row execute function private.audit_horse_operation_change();
create trigger horse_operation_holds_audit
after insert or update or delete on public.horse_operation_holds
for each row execute function private.audit_horse_operation_change();
create trigger horse_care_schedules_audit
after insert or update or delete on public.horse_care_schedules
for each row execute function private.audit_horse_operation_change();
create trigger stable_tasks_audit
after insert or update or delete on public.stable_tasks
for each row execute function private.audit_horse_operation_change();
create trigger lessons_horse_operation_assignment_guard
before insert or update of organization_id, horse_id, date_time, duration_min, status on public.lessons
for each row execute function private.enforce_lesson_horse_operation_assignment();

alter table public.horse_operation_profiles enable row level security;
alter table public.horse_operation_holds enable row level security;
alter table public.horse_care_schedules enable row level security;
alter table public.stable_tasks enable row level security;
alter table public.horse_operation_audit_events enable row level security;

create policy horse_operation_profiles_staff_only
on public.horse_operation_profiles for all to authenticated
using (private.can_manage_stable_operations(organization_id))
with check (private.can_manage_stable_operations(organization_id));
create policy horse_operation_holds_staff_only
on public.horse_operation_holds for all to authenticated
using (private.can_manage_stable_operations(organization_id))
with check (private.can_manage_stable_operations(organization_id));
create policy horse_care_schedules_staff_only
on public.horse_care_schedules for all to authenticated
using (private.can_manage_stable_operations(organization_id))
with check (private.can_manage_stable_operations(organization_id));
create policy stable_tasks_staff_only
on public.stable_tasks for all to authenticated
using (private.can_manage_stable_operations(organization_id))
with check (private.can_manage_stable_operations(organization_id));
create policy horse_operation_audit_staff_select
on public.horse_operation_audit_events for select to authenticated
using (private.can_manage_stable_operations(organization_id));

revoke all on function private.can_manage_stable_operations(uuid) from public, anon, authenticated, service_role;
revoke all on function private.can_read_safe_horse_availability(uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function private.prepare_horse_operation_profile() from public, anon, authenticated, service_role;
revoke all on function private.prepare_horse_operation_hold() from public, anon, authenticated, service_role;
revoke all on function private.prepare_horse_operation_hold_delete() from public, anon, authenticated, service_role;
revoke all on function private.lock_horse_operation_status_change() from public, anon, authenticated, service_role;
revoke all on function private.prepare_horse_care_schedule() from public, anon, authenticated, service_role;
revoke all on function private.prepare_stable_task() from public, anon, authenticated, service_role;
revoke all on function private.audit_horse_operation_change() from public, anon, authenticated, service_role;
revoke all on function private.enforce_lesson_horse_operation_assignment() from public, anon, authenticated, service_role;
revoke all on function public.assert_horse_assignment_allowed(uuid, uuid, timestamptz, integer, uuid, boolean) from public, anon;
revoke all on function public.get_safe_horse_availability(uuid) from public, anon;
revoke all on function public.get_stable_operations_roster(uuid) from public, anon;
grant execute on function private.can_manage_stable_operations(uuid) to authenticated;
grant execute on function private.can_read_safe_horse_availability(uuid, uuid) to authenticated;
grant execute on function public.assert_horse_assignment_allowed(uuid, uuid, timestamptz, integer, uuid, boolean) to authenticated;
grant execute on function public.get_safe_horse_availability(uuid) to authenticated;
grant execute on function public.get_stable_operations_roster(uuid) to authenticated;

grant select, insert, update, delete on public.horse_operation_profiles to authenticated;
grant select, insert, update, delete on public.horse_operation_holds to authenticated;
grant select, insert, update, delete on public.horse_care_schedules to authenticated;
grant select, insert, update, delete on public.stable_tasks to authenticated;
grant select on public.horse_operation_audit_events to authenticated;

commit;