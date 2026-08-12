begin;

create extension if not exists btree_gist with schema extensions;

create type public.lesson_status as enum (
  'scheduled',
  'confirmed',
  'completed',
  'cancelled'
);

create table public.lesson_sessions (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies(id) on delete cascade,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  horse_id uuid references public.horses(id) on delete restrict,
  coach_user_id uuid references auth.users(id) on delete restrict,
  rider_user_id uuid references auth.users(id) on delete restrict,
  status public.lesson_status not null default 'scheduled',
  notes text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lesson_sessions_title_length
    check (char_length(btrim(title)) between 2 and 120),
  constraint lesson_sessions_valid_window
    check (ends_at > starts_at and ends_at - starts_at <= interval '8 hours'),
  constraint lesson_sessions_notes_length
    check (notes is null or char_length(notes) between 1 and 1000),
  constraint lesson_sessions_horse_no_overlap
    exclude using gist (
      academy_id with =,
      horse_id with =,
      tstzrange(starts_at, ends_at, '[)') with &&
    ) where (
      horse_id is not null
      and status in ('scheduled'::public.lesson_status, 'confirmed'::public.lesson_status)
    ),
  constraint lesson_sessions_coach_no_overlap
    exclude using gist (
      academy_id with =,
      coach_user_id with =,
      tstzrange(starts_at, ends_at, '[)') with &&
    ) where (
      coach_user_id is not null
      and status in ('scheduled'::public.lesson_status, 'confirmed'::public.lesson_status)
    ),
  constraint lesson_sessions_rider_no_overlap
    exclude using gist (
      academy_id with =,
      rider_user_id with =,
      tstzrange(starts_at, ends_at, '[)') with &&
    ) where (
      rider_user_id is not null
      and status in ('scheduled'::public.lesson_status, 'confirmed'::public.lesson_status)
    )
);

create index lesson_sessions_academy_starts_idx
  on public.lesson_sessions (academy_id, starts_at);
create index lesson_sessions_horse_idx
  on public.lesson_sessions (horse_id)
  where horse_id is not null;
create index lesson_sessions_coach_idx
  on public.lesson_sessions (coach_user_id)
  where coach_user_id is not null;
create index lesson_sessions_rider_idx
  on public.lesson_sessions (rider_user_id)
  where rider_user_id is not null;
create index lesson_sessions_created_by_idx
  on public.lesson_sessions (created_by);

comment on table public.lesson_sessions is
  'Academy-scoped lessons protected by role-aware RLS and resource conflict constraints.';

create function private.can_access_lesson_session(
  target_academy_id uuid,
  target_coach_user_id uuid,
  target_rider_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.has_academy_role(
      target_academy_id,
      array['academy_admin']::public.app_role[]
    )
    or (
      target_coach_user_id = (select auth.uid())
      and private.has_academy_role(
        target_academy_id,
        array['coach']::public.app_role[]
      )
    )
    or (
      target_rider_user_id = (select auth.uid())
      and private.has_academy_role(
        target_academy_id,
        array['rider']::public.app_role[]
      )
    )
    or (
      private.has_academy_role(
        target_academy_id,
        array['parent']::public.app_role[]
      )
      and exists (
        select 1
        from public.parent_rider_links link
        where link.academy_id = target_academy_id
          and link.parent_user_id = (select auth.uid())
          and link.rider_user_id = target_rider_user_id
      )
    );
$$;

create function private.validate_lesson_session_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.horse_id is not null and not exists (
    select 1
    from public.horses horse
    where horse.id = new.horse_id
      and horse.academy_id = new.academy_id
  ) then
    raise exception 'Horse must belong to the lesson academy'
      using errcode = '23514';
  end if;

  if new.coach_user_id is not null and not exists (
    select 1
    from public.academy_memberships membership
    where membership.academy_id = new.academy_id
      and membership.user_id = new.coach_user_id
      and membership.role = 'coach'
      and membership.status = 'active'
  ) then
    raise exception 'Coach must have an active coach membership in the lesson academy'
      using errcode = '23514';
  end if;

  if new.rider_user_id is not null and not exists (
    select 1
    from public.academy_memberships membership
    where membership.academy_id = new.academy_id
      and membership.user_id = new.rider_user_id
      and membership.role = 'rider'
      and membership.status = 'active'
  ) then
    raise exception 'Rider must have an active rider membership in the lesson academy'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create function private.touch_lesson_session_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger lesson_sessions_validate_scope
before insert or update of academy_id, horse_id, coach_user_id, rider_user_id
on public.lesson_sessions
for each row execute function private.validate_lesson_session_scope();

create trigger lesson_sessions_touch_updated_at
before update on public.lesson_sessions
for each row execute function private.touch_lesson_session_updated_at();

alter table public.lesson_sessions enable row level security;

create policy lesson_sessions_select_scoped
on public.lesson_sessions
for select
to authenticated
using (
  private.can_access_lesson_session(
    academy_id,
    coach_user_id,
    rider_user_id
  )
);

create policy lesson_sessions_insert_admins
on public.lesson_sessions
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and private.has_academy_role(
    academy_id,
    array['academy_admin']::public.app_role[]
  )
);

create policy lesson_sessions_update_admins_or_assigned_coaches
on public.lesson_sessions
for update
to authenticated
using (
  private.has_academy_role(
    academy_id,
    array['academy_admin']::public.app_role[]
  )
  or (
    coach_user_id = (select auth.uid())
    and private.has_academy_role(
      academy_id,
      array['coach']::public.app_role[]
    )
  )
)
with check (
  private.has_academy_role(
    academy_id,
    array['academy_admin']::public.app_role[]
  )
  or (
    coach_user_id = (select auth.uid())
    and private.has_academy_role(
      academy_id,
      array['coach']::public.app_role[]
    )
  )
);

revoke all on public.lesson_sessions from anon, authenticated;
grant select on public.lesson_sessions to authenticated;
grant insert (
  academy_id,
  title,
  starts_at,
  ends_at,
  horse_id,
  coach_user_id,
  rider_user_id,
  status,
  notes,
  created_by
) on public.lesson_sessions to authenticated;
grant update (status) on public.lesson_sessions to authenticated;
grant usage on type public.lesson_status to authenticated;

revoke all on function private.can_access_lesson_session(uuid, uuid, uuid)
  from public, anon;
grant execute on function private.can_access_lesson_session(uuid, uuid, uuid)
  to authenticated;
revoke all on function private.validate_lesson_session_scope()
  from public, anon, authenticated;
revoke all on function private.touch_lesson_session_updated_at()
  from public, anon, authenticated;

commit;
