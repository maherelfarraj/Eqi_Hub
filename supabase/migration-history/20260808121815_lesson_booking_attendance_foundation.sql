begin;

create type public.lesson_booking_status as enum (
  'requested',
  'confirmed',
  'waitlisted',
  'declined',
  'cancelled',
  'attended',
  'no_show'
);

alter table public.lesson_sessions
  add column capacity smallint not null default 1,
  add constraint lesson_sessions_capacity_range check (capacity between 1 and 50);

create table public.lesson_bookings (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies(id) on delete cascade,
  lesson_session_id uuid not null references public.lesson_sessions(id) on delete cascade,
  rider_user_id uuid not null references auth.users(id) on delete restrict,
  requested_by uuid not null references auth.users(id) on delete restrict,
  status public.lesson_booking_status not null default 'requested',
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references auth.users(id) on delete restrict,
  attendance_recorded_at timestamptz,
  attendance_recorded_by uuid references auth.users(id) on delete restrict,
  updated_at timestamptz not null default now(),
  constraint lesson_bookings_unique_rider unique (lesson_session_id, rider_user_id),
  constraint lesson_bookings_decision_consistent check (
    (decided_at is null and decided_by is null)
    or (decided_at is not null and decided_by is not null)
  ),
  constraint lesson_bookings_attendance_consistent check (
    (attendance_recorded_at is null and attendance_recorded_by is null)
    or (attendance_recorded_at is not null and attendance_recorded_by is not null)
  )
);

create index lesson_bookings_academy_status_idx
  on public.lesson_bookings (academy_id, status, requested_at);
create index lesson_bookings_session_status_idx
  on public.lesson_bookings (lesson_session_id, status, requested_at);
create index lesson_bookings_rider_idx
  on public.lesson_bookings (rider_user_id, requested_at desc);
create index lesson_bookings_requested_by_idx
  on public.lesson_bookings (requested_by);
create index lesson_bookings_decided_by_idx
  on public.lesson_bookings (decided_by)
  where decided_by is not null;
create index lesson_bookings_attendance_by_idx
  on public.lesson_bookings (attendance_recorded_by)
  where attendance_recorded_by is not null;

comment on table public.lesson_bookings is
  'Role-scoped lesson requests, capacity waitlisting, and attendance records.';

create function private.can_access_lesson_booking(
  target_academy_id uuid,
  target_session_id uuid,
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
    or target_rider_user_id = (select auth.uid())
    or exists (
      select 1
      from public.lesson_sessions lesson
      where lesson.id = target_session_id
        and lesson.academy_id = target_academy_id
        and lesson.coach_user_id = (select auth.uid())
        and private.has_academy_role(
          target_academy_id,
          array['coach']::public.app_role[]
        )
    )
    or exists (
      select 1
      from public.parent_rider_links link
      where link.academy_id = target_academy_id
        and link.parent_user_id = (select auth.uid())
        and link.rider_user_id = target_rider_user_id
        and private.has_academy_role(
          target_academy_id,
          array['parent']::public.app_role[]
        )
    );
$$;

create function private.touch_lesson_booking_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger lesson_bookings_touch_updated_at
before update on public.lesson_bookings
for each row execute function private.touch_lesson_booking_updated_at();

create function public.request_lesson_booking(
  target_session_id uuid,
  target_rider_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  scoped_lesson public.lesson_sessions%rowtype;
  existing_booking public.lesson_bookings%rowtype;
  new_booking_id uuid;
  can_request boolean := false;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into scoped_lesson
  from public.lesson_sessions
  where id = target_session_id
  for update;

  if not found
    or scoped_lesson.status not in (
      'scheduled'::public.lesson_status,
      'confirmed'::public.lesson_status
    )
    or scoped_lesson.starts_at <= now()
  then
    raise exception 'Lesson is not open for booking' using errcode = '23514';
  end if;

  if private.has_academy_role(
    scoped_lesson.academy_id,
    array['rider']::public.app_role[]
  ) and current_user_id = target_rider_user_id then
    can_request := true;
  elsif private.has_academy_role(
    scoped_lesson.academy_id,
    array['parent']::public.app_role[]
  ) and exists (
    select 1
    from public.parent_rider_links link
    where link.academy_id = scoped_lesson.academy_id
      and link.parent_user_id = current_user_id
      and link.rider_user_id = target_rider_user_id
  ) then
    can_request := true;
  end if;

  if not can_request or not exists (
    select 1
    from public.academy_memberships rider
    where rider.academy_id = scoped_lesson.academy_id
      and rider.user_id = target_rider_user_id
      and rider.role = 'rider'::public.app_role
      and rider.status = 'active'::public.membership_status
  ) then
    raise exception 'Rider booking scope is invalid' using errcode = '42501';
  end if;

  if scoped_lesson.rider_user_id = target_rider_user_id then
    raise exception 'Rider is already directly assigned' using errcode = '23505';
  end if;

  select * into existing_booking
  from public.lesson_bookings
  where lesson_session_id = target_session_id
    and rider_user_id = target_rider_user_id
  for update;

  if found then
    if existing_booking.status not in (
      'cancelled'::public.lesson_booking_status,
      'declined'::public.lesson_booking_status
    ) then
      raise exception 'An active booking already exists' using errcode = '23505';
    end if;

    update public.lesson_bookings
    set status = 'requested'::public.lesson_booking_status,
        requested_by = current_user_id,
        requested_at = now(),
        decided_at = null,
        decided_by = null,
        attendance_recorded_at = null,
        attendance_recorded_by = null
    where id = existing_booking.id
    returning id into new_booking_id;
  else
    insert into public.lesson_bookings (
      academy_id,
      lesson_session_id,
      rider_user_id,
      requested_by
    ) values (
      scoped_lesson.academy_id,
      target_session_id,
      target_rider_user_id,
      current_user_id
    )
    returning id into new_booking_id;
  end if;

  perform public.write_audit_event(
    scoped_lesson.academy_id,
    'lesson_booking.requested',
    'lesson_booking',
    new_booking_id,
    jsonb_build_object(
      'lesson_session_id', target_session_id,
      'rider_user_id', target_rider_user_id
    )
  );

  return new_booking_id;
end;
$$;

create function public.decide_lesson_booking(
  target_booking_id uuid,
  decision text
)
returns public.lesson_booking_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  scoped_booking public.lesson_bookings%rowtype;
  scoped_lesson public.lesson_sessions%rowtype;
  occupied_count integer;
  next_status public.lesson_booking_status;
begin
  if current_user_id is null or decision not in ('approve', 'decline') then
    raise exception 'Invalid booking decision' using errcode = '22023';
  end if;

  select * into scoped_booking
  from public.lesson_bookings
  where id = target_booking_id
  for update;

  if not found or scoped_booking.status <> 'requested'::public.lesson_booking_status then
    raise exception 'Booking is not awaiting a decision' using errcode = '23514';
  end if;

  if not private.has_academy_role(
    scoped_booking.academy_id,
    array['academy_admin']::public.app_role[]
  ) then
    raise exception 'Academy Admin access required' using errcode = '42501';
  end if;

  select * into scoped_lesson
  from public.lesson_sessions
  where id = scoped_booking.lesson_session_id
    and academy_id = scoped_booking.academy_id
  for update;

  if not found or scoped_lesson.status = 'cancelled'::public.lesson_status then
    raise exception 'Lesson is unavailable' using errcode = '23514';
  end if;

  if decision = 'decline' then
    next_status := 'declined'::public.lesson_booking_status;
  else
    select count(*) into occupied_count
    from public.lesson_bookings booking
    where booking.lesson_session_id = scoped_lesson.id
      and booking.status in (
        'confirmed'::public.lesson_booking_status,
        'attended'::public.lesson_booking_status,
        'no_show'::public.lesson_booking_status
      );

    if scoped_lesson.rider_user_id is not null
      and scoped_lesson.rider_user_id <> scoped_booking.rider_user_id then
      occupied_count := occupied_count + 1;
    end if;

    next_status := case
      when occupied_count < scoped_lesson.capacity
        then 'confirmed'::public.lesson_booking_status
      else 'waitlisted'::public.lesson_booking_status
    end;
  end if;

  update public.lesson_bookings
  set status = next_status,
      decided_at = now(),
      decided_by = current_user_id
  where id = target_booking_id;

  perform public.write_audit_event(
    scoped_booking.academy_id,
    'lesson_booking.' || next_status::text,
    'lesson_booking',
    target_booking_id,
    jsonb_build_object('lesson_session_id', scoped_booking.lesson_session_id)
  );

  return next_status;
end;
$$;

create function public.cancel_lesson_booking(target_booking_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  scoped_booking public.lesson_bookings%rowtype;
  promoted_booking_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into scoped_booking
  from public.lesson_bookings
  where id = target_booking_id
  for update;

  if not found or scoped_booking.status not in (
    'requested'::public.lesson_booking_status,
    'confirmed'::public.lesson_booking_status,
    'waitlisted'::public.lesson_booking_status
  ) then
    raise exception 'Booking cannot be cancelled' using errcode = '23514';
  end if;

  if not (
    private.has_academy_role(
      scoped_booking.academy_id,
      array['academy_admin']::public.app_role[]
    )
    or scoped_booking.rider_user_id = current_user_id
    or scoped_booking.requested_by = current_user_id
  ) then
    raise exception 'Booking cancellation is not authorized' using errcode = '42501';
  end if;

  perform 1 from public.lesson_sessions
  where id = scoped_booking.lesson_session_id
  for update;

  update public.lesson_bookings
  set status = 'cancelled'::public.lesson_booking_status
  where id = target_booking_id;

  if scoped_booking.status = 'confirmed'::public.lesson_booking_status then
    select id into promoted_booking_id
    from public.lesson_bookings
    where lesson_session_id = scoped_booking.lesson_session_id
      and status = 'waitlisted'::public.lesson_booking_status
    order by requested_at, id
    for update skip locked
    limit 1;

    if promoted_booking_id is not null then
      update public.lesson_bookings
      set status = 'confirmed'::public.lesson_booking_status,
          decided_at = now(),
          decided_by = current_user_id
      where id = promoted_booking_id;

      perform public.write_audit_event(
        scoped_booking.academy_id,
        'lesson_booking.promoted',
        'lesson_booking',
        promoted_booking_id,
        jsonb_build_object('lesson_session_id', scoped_booking.lesson_session_id)
      );
    end if;
  end if;

  perform public.write_audit_event(
    scoped_booking.academy_id,
    'lesson_booking.cancelled',
    'lesson_booking',
    target_booking_id,
    jsonb_build_object('lesson_session_id', scoped_booking.lesson_session_id)
  );

  return promoted_booking_id;
end;
$$;

create function public.record_lesson_attendance(
  target_booking_id uuid,
  attendance text
)
returns public.lesson_booking_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  scoped_booking public.lesson_bookings%rowtype;
  scoped_lesson public.lesson_sessions%rowtype;
  next_status public.lesson_booking_status;
begin
  if current_user_id is null or attendance not in ('attended', 'no_show') then
    raise exception 'Invalid attendance outcome' using errcode = '22023';
  end if;

  select * into scoped_booking
  from public.lesson_bookings
  where id = target_booking_id
  for update;

  if not found or scoped_booking.status <> 'confirmed'::public.lesson_booking_status then
    raise exception 'Only confirmed bookings can record attendance' using errcode = '23514';
  end if;

  select * into scoped_lesson
  from public.lesson_sessions
  where id = scoped_booking.lesson_session_id
    and academy_id = scoped_booking.academy_id;

  if not found or scoped_lesson.status = 'cancelled'::public.lesson_status then
    raise exception 'Lesson is unavailable' using errcode = '23514';
  end if;

  if not (
    private.has_academy_role(
      scoped_booking.academy_id,
      array['academy_admin']::public.app_role[]
    )
    or (
      scoped_lesson.coach_user_id = current_user_id
      and private.has_academy_role(
        scoped_booking.academy_id,
        array['coach']::public.app_role[]
      )
    )
  ) then
    raise exception 'Staff attendance access required' using errcode = '42501';
  end if;

  next_status := attendance::public.lesson_booking_status;

  update public.lesson_bookings
  set status = next_status,
      attendance_recorded_at = now(),
      attendance_recorded_by = current_user_id
  where id = target_booking_id;

  perform public.write_audit_event(
    scoped_booking.academy_id,
    'lesson_booking.' || next_status::text,
    'lesson_booking',
    target_booking_id,
    jsonb_build_object('lesson_session_id', scoped_booking.lesson_session_id)
  );

  return next_status;
end;
$$;

alter table public.lesson_bookings enable row level security;

create policy lesson_bookings_select_scoped
on public.lesson_bookings
for select
to authenticated
using (
  private.can_access_lesson_booking(
    academy_id,
    lesson_session_id,
    rider_user_id
  )
);

revoke all on public.lesson_bookings from anon, authenticated;
grant select on public.lesson_bookings to authenticated;
grant insert (capacity) on public.lesson_sessions to authenticated;
grant usage on type public.lesson_booking_status to authenticated;

revoke all on function private.can_access_lesson_booking(uuid, uuid, uuid)
  from public, anon;
grant execute on function private.can_access_lesson_booking(uuid, uuid, uuid)
  to authenticated;
revoke all on function private.touch_lesson_booking_updated_at()
  from public, anon, authenticated;

revoke all on function public.request_lesson_booking(uuid, uuid)
  from public, anon;
revoke all on function public.decide_lesson_booking(uuid, text)
  from public, anon;
revoke all on function public.cancel_lesson_booking(uuid)
  from public, anon;
revoke all on function public.record_lesson_attendance(uuid, text)
  from public, anon;
grant execute on function public.request_lesson_booking(uuid, uuid)
  to authenticated;
grant execute on function public.decide_lesson_booking(uuid, text)
  to authenticated;
grant execute on function public.cancel_lesson_booking(uuid)
  to authenticated;
grant execute on function public.record_lesson_attendance(uuid, text)
  to authenticated;

commit;
