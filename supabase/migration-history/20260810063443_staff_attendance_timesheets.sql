begin;

create table public.staff_shifts (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies(id) on delete cascade,
  staff_user_id uuid not null references auth.users(id) on delete restrict,
  role_label text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'scheduled',
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint staff_shifts_role_length check (char_length(trim(role_label)) between 2 and 80),
  constraint staff_shifts_time_order check (ends_at > starts_at and ends_at <= starts_at + interval '24 hours'),
  constraint staff_shifts_status check (status in ('scheduled', 'cancelled'))
);

create table public.staff_time_entries (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies(id) on delete cascade,
  shift_id uuid not null unique references public.staff_shifts(id) on delete restrict,
  staff_user_id uuid not null references auth.users(id) on delete restrict,
  clock_in_at timestamptz not null,
  clock_out_at timestamptz,
  break_minutes integer not null default 0,
  status text not null default 'open',
  correction_note text,
  reviewed_by uuid references auth.users(id) on delete restrict,
  reviewed_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint staff_time_entries_order check (clock_out_at is null or clock_out_at > clock_in_at),
  constraint staff_time_entries_break_range check (break_minutes between 0 and 600),
  constraint staff_time_entries_status check (status in ('open', 'submitted', 'approved', 'rejected')),
  constraint staff_time_entries_review_state check ((status in ('approved', 'rejected')) = (reviewed_by is not null and reviewed_at is not null)),
  constraint staff_time_entries_closed_state check ((status = 'open') = (clock_out_at is null)),
  constraint staff_time_entries_note_length check (correction_note is null or char_length(correction_note) between 2 and 500)
);

create table public.staff_attendance_events (
  id bigint generated always as identity primary key,
  academy_id uuid not null references public.academies(id) on delete cascade,
  shift_id uuid references public.staff_shifts(id) on delete restrict,
  time_entry_id uuid references public.staff_time_entries(id) on delete restrict,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  staff_user_id uuid not null references auth.users(id) on delete restrict,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint staff_attendance_events_action check (action in ('shift.created', 'shift.cancelled', 'clock.in', 'clock.out', 'timesheet.corrected', 'timesheet.approved', 'timesheet.rejected'))
);

create index staff_shifts_academy_start_idx on public.staff_shifts (academy_id, starts_at, status);
create index staff_shifts_staff_start_idx on public.staff_shifts (staff_user_id, starts_at desc);
create index staff_shifts_created_by_idx on public.staff_shifts (created_by);
create index staff_shifts_updated_by_idx on public.staff_shifts (updated_by);
create index staff_time_entries_academy_status_idx on public.staff_time_entries (academy_id, status, clock_in_at desc);
create index staff_time_entries_staff_clock_idx on public.staff_time_entries (staff_user_id, clock_in_at desc);
create index staff_time_entries_reviewed_by_idx on public.staff_time_entries (reviewed_by) where reviewed_by is not null;
create index staff_time_entries_created_by_idx on public.staff_time_entries (created_by);
create index staff_time_entries_updated_by_idx on public.staff_time_entries (updated_by);
create index staff_attendance_events_academy_created_idx on public.staff_attendance_events (academy_id, created_at desc);
create index staff_attendance_events_shift_idx on public.staff_attendance_events (shift_id) where shift_id is not null;
create index staff_attendance_events_entry_idx on public.staff_attendance_events (time_entry_id) where time_entry_id is not null;
create index staff_attendance_events_actor_idx on public.staff_attendance_events (actor_user_id);
create index staff_attendance_events_staff_idx on public.staff_attendance_events (staff_user_id, created_at desc);

alter table public.staff_shifts enable row level security;
alter table public.staff_time_entries enable row level security;
alter table public.staff_attendance_events enable row level security;

revoke all on public.staff_shifts, public.staff_time_entries, public.staff_attendance_events from public, anon, authenticated;
grant select, insert, update on public.staff_shifts, public.staff_time_entries to authenticated;
grant select on public.staff_attendance_events to authenticated;
grant select, insert, update, delete on public.staff_shifts, public.staff_time_entries, public.staff_attendance_events to service_role;

create policy staff_shifts_read_platform on public.staff_shifts for select to authenticated using ((select private.is_platform_user()));
create policy staff_shifts_insert_administrators on public.staff_shifts for insert to authenticated with check ((select private.is_platform_administrator()) and created_by = (select auth.uid()) and updated_by = (select auth.uid()));
create policy staff_shifts_update_administrators on public.staff_shifts for update to authenticated using ((select private.is_platform_administrator())) with check ((select private.is_platform_administrator()) and updated_by = (select auth.uid()));
create policy staff_time_entries_read_scoped on public.staff_time_entries for select to authenticated using ((select private.is_platform_administrator()) or staff_user_id = (select auth.uid()));
create policy staff_time_entries_insert_scoped on public.staff_time_entries for insert to authenticated with check (((select private.is_platform_administrator()) or staff_user_id = (select auth.uid())) and created_by = (select auth.uid()) and updated_by = (select auth.uid()));
create policy staff_time_entries_update_scoped on public.staff_time_entries for update to authenticated using ((select private.is_platform_administrator()) or staff_user_id = (select auth.uid())) with check (((select private.is_platform_administrator()) or staff_user_id = (select auth.uid())) and updated_by = (select auth.uid()));
create policy staff_attendance_events_read_scoped on public.staff_attendance_events for select to authenticated using ((select private.is_platform_administrator()) or staff_user_id = (select auth.uid()));

create or replace function private.validate_staff_time_entry_write()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare actor uuid := (select auth.uid()); administrator boolean := private.is_platform_administrator(); scoped_shift public.staff_shifts%rowtype;
begin
  if actor is null then raise exception 'authentication required' using errcode='42501'; end if;
  select * into scoped_shift from public.staff_shifts where id=new.shift_id;
  if not found or scoped_shift.academy_id<>new.academy_id or scoped_shift.staff_user_id<>new.staff_user_id then raise exception 'time entry must match its shift' using errcode='23514'; end if;
  if administrator then return new; end if;
  if tg_op='INSERT' then
    if new.staff_user_id<>actor or scoped_shift.status<>'scheduled' or new.status<>'open' or new.clock_out_at is not null or new.break_minutes<>0 or new.correction_note is not null or new.reviewed_by is not null or new.reviewed_at is not null or new.created_by<>actor or new.updated_by<>actor or new.clock_in_at not between now()-interval '1 minute' and now()+interval '1 minute' then raise exception 'staff may only clock in to their assigned shift' using errcode='42501'; end if;
  elsif old.staff_user_id<>actor or new.staff_user_id<>old.staff_user_id or new.academy_id<>old.academy_id or new.shift_id<>old.shift_id or new.clock_in_at<>old.clock_in_at or old.status<>'open' or new.status<>'submitted' or old.clock_out_at is not null or new.clock_out_at not between now()-interval '1 minute' and now()+interval '1 minute' or new.break_minutes<>old.break_minutes or new.correction_note is distinct from old.correction_note or new.reviewed_by is distinct from old.reviewed_by or new.reviewed_at is distinct from old.reviewed_at or new.created_by<>old.created_by or new.created_at<>old.created_at or new.updated_by<>actor then
    raise exception 'staff may only clock out their own open entry' using errcode='42501';
  end if;
  return new;
end; $$;

create trigger validate_staff_time_entry_write before insert or update on public.staff_time_entries for each row execute function private.validate_staff_time_entry_write();
revoke all on function private.validate_staff_time_entry_write() from public, anon, authenticated;

create or replace function private.audit_staff_attendance_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); event_action text; event_metadata jsonb := '{}'::jsonb; event_academy uuid; event_shift uuid; event_entry uuid; event_staff uuid;
begin
  if actor is null then raise exception 'authentication required' using errcode='42501'; end if;
  if tg_table_name='staff_shifts' then
    event_academy:=new.academy_id; event_shift:=new.id; event_staff:=new.staff_user_id;
    event_action:=case when tg_op='INSERT' then 'shift.created' when old.status='scheduled' and new.status='cancelled' then 'shift.cancelled' end;
  else
    event_academy:=new.academy_id; event_shift:=new.shift_id; event_entry:=new.id; event_staff:=new.staff_user_id;
    event_action:=case when tg_op='INSERT' then 'clock.in' when old.status='open' and new.status='submitted' then 'clock.out' when old.status='submitted' and new.status='approved' then 'timesheet.approved' when old.status='submitted' and new.status='rejected' then 'timesheet.rejected' else 'timesheet.corrected' end;
    event_metadata:=jsonb_build_object('status',new.status,'break_minutes',new.break_minutes);
  end if;
  if event_action is not null then insert into public.staff_attendance_events(academy_id,shift_id,time_entry_id,actor_user_id,staff_user_id,action,metadata) values(event_academy,event_shift,event_entry,actor,event_staff,event_action,event_metadata); end if;
  return new;
end; $$;

create trigger audit_staff_shift_change after insert or update on public.staff_shifts for each row execute function private.audit_staff_attendance_change();
create trigger audit_staff_time_entry_change after insert or update on public.staff_time_entries for each row execute function private.audit_staff_attendance_change();
revoke all on function private.audit_staff_attendance_change() from public, anon, authenticated;

create or replace function public.create_staff_shift(target_academy_id uuid,target_staff_user_id uuid,target_role_label text,target_starts_at timestamptz,target_ends_at timestamptz)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare actor uuid := (select auth.uid()); new_shift_id uuid;
begin
  if actor is null or not private.is_platform_administrator() then raise exception 'platform administrator access required' using errcode='42501'; end if;
  if target_ends_at<=target_starts_at or target_ends_at>target_starts_at+interval '24 hours' then raise exception 'invalid shift duration' using errcode='22023'; end if;
  if not exists(select 1 from public.academy_memberships m where m.academy_id=target_academy_id and m.user_id=target_staff_user_id and m.status='active' and m.role in ('academy_admin','coach')) then raise exception 'active staff membership required' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(target_academy_id::text||target_staff_user_id::text,0));
  if exists(select 1 from public.staff_shifts s where s.academy_id=target_academy_id and s.staff_user_id=target_staff_user_id and s.status='scheduled' and tstzrange(s.starts_at,s.ends_at,'[)')&&tstzrange(target_starts_at,target_ends_at,'[)')) then raise exception 'staff shift overlaps an existing shift' using errcode='23P01'; end if;
  insert into public.staff_shifts(academy_id,staff_user_id,role_label,starts_at,ends_at,created_by,updated_by) values(target_academy_id,target_staff_user_id,trim(target_role_label),target_starts_at,target_ends_at,actor,actor) returning id into new_shift_id;
  return new_shift_id;
end; $$;

create or replace function public.clock_staff_shift(target_shift_id uuid,target_action text)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare actor uuid := (select auth.uid()); scoped public.staff_shifts%rowtype; entry public.staff_time_entries%rowtype;
begin
  select * into scoped from public.staff_shifts where id=target_shift_id for update;
  if not found or actor is null or (actor<>scoped.staff_user_id and not private.is_platform_administrator()) then raise exception 'staff shift access required' using errcode='42501'; end if;
  if scoped.status<>'scheduled' then raise exception 'shift is not active' using errcode='23514'; end if;
  select * into entry from public.staff_time_entries where shift_id=scoped.id for update;
  if target_action='clock_in' then
    if found then raise exception 'shift already clocked in' using errcode='23505'; end if;
    insert into public.staff_time_entries(academy_id,shift_id,staff_user_id,clock_in_at,created_by,updated_by) values(scoped.academy_id,scoped.id,scoped.staff_user_id,now(),actor,actor) returning * into entry;
  elsif target_action='clock_out' then
    if not found or entry.status<>'open' then raise exception 'open time entry required' using errcode='23514'; end if;
    update public.staff_time_entries set clock_out_at=now(),status='submitted',updated_by=actor,updated_at=now() where id=entry.id returning * into entry;
  else raise exception 'invalid clock action' using errcode='22023'; end if;
  return entry.id;
end; $$;

create or replace function public.cancel_staff_shift(target_shift_id uuid)
returns void language plpgsql security invoker set search_path = '' as $$
declare actor uuid := (select auth.uid());
begin
  if actor is null or not private.is_platform_administrator() then raise exception 'platform administrator access required' using errcode='42501'; end if;
  update public.staff_shifts set status='cancelled',updated_by=actor,updated_at=now() where id=target_shift_id and status='scheduled' and not exists(select 1 from public.staff_time_entries e where e.shift_id=target_shift_id);
  if not found then raise exception 'only an unclocked scheduled shift can be cancelled' using errcode='23514'; end if;
end; $$;

create or replace function public.correct_staff_time_entry(target_entry_id uuid,target_clock_in_at timestamptz,target_clock_out_at timestamptz,target_break_minutes integer,target_note text)
returns void language plpgsql security invoker set search_path = '' as $$
declare actor uuid := (select auth.uid());
begin
  if actor is null or not private.is_platform_administrator() then raise exception 'platform administrator access required' using errcode='42501'; end if;
  if target_clock_out_at<=target_clock_in_at or target_break_minutes not between 0 and 600 or char_length(trim(target_note)) not between 2 and 500 then raise exception 'invalid timesheet correction' using errcode='22023'; end if;
  update public.staff_time_entries set clock_in_at=target_clock_in_at,clock_out_at=target_clock_out_at,break_minutes=target_break_minutes,status='submitted',correction_note=trim(target_note),reviewed_by=null,reviewed_at=null,updated_by=actor,updated_at=now() where id=target_entry_id;
  if not found then raise exception 'time entry not found' using errcode='P0002'; end if;
end; $$;

create or replace function public.review_staff_time_entry(target_entry_id uuid,target_status text)
returns void language plpgsql security invoker set search_path = '' as $$
declare actor uuid := (select auth.uid());
begin
  if actor is null or not private.is_platform_administrator() then raise exception 'platform administrator access required' using errcode='42501'; end if;
  if target_status not in ('approved','rejected') then raise exception 'invalid review status' using errcode='22023'; end if;
  update public.staff_time_entries set status=target_status,reviewed_by=actor,reviewed_at=now(),updated_by=actor,updated_at=now() where id=target_entry_id and status='submitted';
  if not found then raise exception 'submitted timesheet required' using errcode='23514'; end if;
end; $$;

revoke all on function public.create_staff_shift(uuid,uuid,text,timestamptz,timestamptz),public.clock_staff_shift(uuid,text),public.cancel_staff_shift(uuid),public.correct_staff_time_entry(uuid,timestamptz,timestamptz,integer,text),public.review_staff_time_entry(uuid,text) from public,anon,authenticated;
grant execute on function public.create_staff_shift(uuid,uuid,text,timestamptz,timestamptz),public.clock_staff_shift(uuid,text),public.cancel_staff_shift(uuid),public.correct_staff_time_entry(uuid,timestamptz,timestamptz,integer,text),public.review_staff_time_entry(uuid,text) to authenticated;

alter table public.action_center_tracking drop constraint action_center_tracking_category;
alter table public.action_center_tracking add constraint action_center_tracking_category check (category in ('finance','booking','welfare','payroll','ai','conduct','inventory','supplier','attendance'));

create or replace function public.update_action_center_item(target_action_key text,target_academy_id uuid,target_category text,target_status public.action_center_workflow_status,target_assigned_to uuid default null,target_due_at timestamptz default null,target_note text default null)
returns void language plpgsql security invoker set search_path = '' as $$
declare current_user_id uuid := (select auth.uid()); normalized_note text := nullif(trim(coalesce(target_note,'')),'');
begin
  if current_user_id is null or not private.is_platform_administrator() then raise exception 'platform administrator access required' using errcode='42501'; end if;
  if char_length(target_action_key) not between 3 and 150 or target_category not in ('finance','booking','welfare','payroll','ai','conduct','inventory','supplier','attendance') or (target_category='conduct' and target_academy_id is not null) or (target_category<>'conduct' and not exists(select 1 from public.academies academy where academy.id=target_academy_id)) then raise exception 'invalid action center item'; end if;
  if normalized_note is not null and char_length(normalized_note)>1000 then raise exception 'action note must not exceed 1000 characters'; end if;
  if target_assigned_to is not null and not exists(select 1 from public.platform_access access where access.user_id=target_assigned_to and access.access_level='administrator' and access.status='active') then raise exception 'assignee must be an active platform administrator'; end if;
  insert into public.action_center_tracking as tracking(action_key,academy_id,category,status,assigned_to,due_at,note,updated_by,resolved_at) values(target_action_key,target_academy_id,target_category,target_status,target_assigned_to,target_due_at,normalized_note,current_user_id,case when target_status='resolved' then now() else null end)
  on conflict(action_key) do update set academy_id=excluded.academy_id,category=excluded.category,status=excluded.status,assigned_to=excluded.assigned_to,due_at=excluded.due_at,note=excluded.note,updated_by=current_user_id,resolved_at=case when excluded.status='resolved' then coalesce(tracking.resolved_at,now()) else null end,updated_at=now();
end; $$;

revoke all on function public.update_action_center_item(text,uuid,text,public.action_center_workflow_status,uuid,timestamptz,text) from public,anon,authenticated;
grant execute on function public.update_action_center_item(text,uuid,text,public.action_center_workflow_status,uuid,timestamptz,text) to authenticated;

commit;
