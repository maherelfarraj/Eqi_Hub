begin;

create extension if not exists pgcrypto;

create type public.app_role as enum (
  'academy_admin',
  'coach',
  'rider',
  'parent'
);

create type public.membership_status as enum (
  'invited',
  'active',
  'suspended'
);

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_display_name_length check (
    display_name is null or char_length(display_name) between 1 and 120
  )
);

create table public.academies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  timezone text not null default 'Asia/Amman',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint academies_name_length check (char_length(name) between 2 and 120),
  constraint academies_timezone_length check (char_length(timezone) between 1 and 80)
);

create table public.academy_memberships (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  status public.membership_status not null default 'invited',
  invited_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (academy_id, user_id, role)
);

create table public.coach_rider_assignments (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies(id) on delete cascade,
  coach_user_id uuid not null references auth.users(id) on delete cascade,
  rider_user_id uuid not null references auth.users(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (academy_id, coach_user_id, rider_user_id),
  constraint coach_is_not_rider check (coach_user_id <> rider_user_id)
);

create table public.parent_rider_links (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies(id) on delete cascade,
  parent_user_id uuid not null references auth.users(id) on delete cascade,
  rider_user_id uuid not null references auth.users(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (academy_id, parent_user_id, rider_user_id),
  constraint parent_is_not_rider check (parent_user_id <> rider_user_id)
);

create table public.audit_events (
  id bigint generated always as identity primary key,
  academy_id uuid not null references public.academies(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint audit_action_length check (char_length(action) between 2 and 100),
  constraint audit_entity_type_length check (char_length(entity_type) between 2 and 80),
  constraint audit_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create index academy_memberships_user_idx
  on public.academy_memberships (user_id, status);
create index academy_memberships_academy_idx
  on public.academy_memberships (academy_id, role, status);
create index coach_assignments_coach_idx
  on public.coach_rider_assignments (academy_id, coach_user_id);
create index coach_assignments_rider_idx
  on public.coach_rider_assignments (academy_id, rider_user_id);
create index parent_links_parent_idx
  on public.parent_rider_links (academy_id, parent_user_id);
create index parent_links_rider_idx
  on public.parent_rider_links (academy_id, rider_user_id);
create index audit_events_academy_created_idx
  on public.audit_events (academy_id, created_at desc);

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create or replace function private.is_academy_member(target_academy_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.academy_memberships membership
    where membership.academy_id = target_academy_id
      and membership.user_id = (select auth.uid())
      and membership.status = 'active'
  );
$$;

create or replace function private.has_academy_role(
  target_academy_id uuid,
  allowed_roles public.app_role[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.academy_memberships membership
    where membership.academy_id = target_academy_id
      and membership.user_id = (select auth.uid())
      and membership.status = 'active'
      and membership.role = any(allowed_roles)
  );
$$;

create or replace function private.can_access_profile(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    target_user_id = (select auth.uid())
    or exists (
      select 1
      from public.academy_memberships viewer
      join public.academy_memberships target
        on target.academy_id = viewer.academy_id
       and target.user_id = target_user_id
       and target.status = 'active'
      where viewer.user_id = (select auth.uid())
        and viewer.status = 'active'
        and viewer.role = 'academy_admin'
    )
    or exists (
      select 1
      from public.coach_rider_assignments assignment
      where assignment.coach_user_id = (select auth.uid())
        and assignment.rider_user_id = target_user_id
    )
    or exists (
      select 1
      from public.parent_rider_links link
      where link.parent_user_id = (select auth.uid())
        and link.rider_user_id = target_user_id
    );
$$;

create or replace function private.validate_coach_rider_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.academy_memberships membership
    where membership.academy_id = new.academy_id
      and membership.user_id = new.coach_user_id
      and membership.role = 'coach'
      and membership.status = 'active'
  ) then
    raise exception 'coach must have an active academy membership'
      using errcode = '23514';
  end if;

  if not exists (
    select 1
    from public.academy_memberships membership
    where membership.academy_id = new.academy_id
      and membership.user_id = new.rider_user_id
      and membership.role = 'rider'
      and membership.status = 'active'
  ) then
    raise exception 'rider must have an active academy membership'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function private.validate_parent_rider_link()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.academy_memberships membership
    where membership.academy_id = new.academy_id
      and membership.user_id = new.parent_user_id
      and membership.role = 'parent'
      and membership.status = 'active'
  ) then
    raise exception 'parent must have an active academy membership'
      using errcode = '23514';
  end if;

  if not exists (
    select 1
    from public.academy_memberships membership
    where membership.academy_id = new.academy_id
      and membership.user_id = new.rider_user_id
      and membership.role = 'rider'
      and membership.status = 'active'
  ) then
    raise exception 'rider must have an active academy membership'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger validate_coach_rider_assignment
  before insert or update on public.coach_rider_assignments
  for each row execute procedure private.validate_coach_rider_assignment();

create trigger validate_parent_rider_link
  before insert or update on public.parent_rider_links
  for each row execute procedure private.validate_parent_rider_link();

grant execute on function private.is_academy_member(uuid) to authenticated;
grant execute on function private.has_academy_role(uuid, public.app_role[]) to authenticated;
grant execute on function private.can_access_profile(uuid) to authenticated;

revoke all on function private.validate_coach_rider_assignment() from public, anon, authenticated;
revoke all on function private.validate_parent_rider_link() from public, anon, authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (
    new.id,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), '')
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.create_academy(
  academy_name text,
  academy_timezone text default 'Asia/Amman'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  new_academy_id uuid;
begin
  if current_user_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  if char_length(trim(academy_name)) not between 2 and 120 then
    raise exception 'academy name must be between 2 and 120 characters';
  end if;

  insert into public.academies (name, timezone, created_by)
  values (trim(academy_name), trim(academy_timezone), current_user_id)
  returning id into new_academy_id;

  insert into public.academy_memberships (
    academy_id,
    user_id,
    role,
    status,
    invited_by
  )
  values (
    new_academy_id,
    current_user_id,
    'academy_admin',
    'active',
    current_user_id
  );

  insert into public.audit_events (
    academy_id,
    actor_user_id,
    action,
    entity_type,
    entity_id
  )
  values (
    new_academy_id,
    current_user_id,
    'academy.created',
    'academy',
    new_academy_id
  );

  return new_academy_id;
end;
$$;

create or replace function public.write_audit_event(
  target_academy_id uuid,
  event_action text,
  event_entity_type text,
  event_entity_id uuid default null,
  event_metadata jsonb default '{}'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  new_event_id bigint;
begin
  if current_user_id is null
    or not private.is_academy_member(target_academy_id) then
    raise exception 'academy membership required' using errcode = '42501';
  end if;

  insert into public.audit_events (
    academy_id,
    actor_user_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  values (
    target_academy_id,
    current_user_id,
    event_action,
    event_entity_type,
    event_entity_id,
    event_metadata
  )
  returning id into new_event_id;

  return new_event_id;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.create_academy(text, text) from public, anon;
revoke all on function public.write_audit_event(uuid, text, text, uuid, jsonb) from public, anon;
grant execute on function public.create_academy(text, text) to authenticated;
grant execute on function public.write_audit_event(uuid, text, text, uuid, jsonb) to authenticated;

alter table public.profiles enable row level security;
alter table public.academies enable row level security;
alter table public.academy_memberships enable row level security;
alter table public.coach_rider_assignments enable row level security;
alter table public.parent_rider_links enable row level security;
alter table public.audit_events enable row level security;

create policy profiles_select_authorized
  on public.profiles for select to authenticated
  using (private.can_access_profile(user_id));

create policy profiles_update_self
  on public.profiles for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy academies_select_members
  on public.academies for select to authenticated
  using (private.is_academy_member(id));

create policy academies_update_admins
  on public.academies for update to authenticated
  using (private.has_academy_role(id, array['academy_admin']::public.app_role[]))
  with check (private.has_academy_role(id, array['academy_admin']::public.app_role[]));

create policy memberships_select_scoped
  on public.academy_memberships for select to authenticated
  using (
    user_id = (select auth.uid())
    or private.has_academy_role(academy_id, array['academy_admin']::public.app_role[])
    or private.can_access_profile(user_id)
  );

create policy memberships_insert_admins
  on public.academy_memberships for insert to authenticated
  with check (private.has_academy_role(academy_id, array['academy_admin']::public.app_role[]));

create policy memberships_update_admins
  on public.academy_memberships for update to authenticated
  using (private.has_academy_role(academy_id, array['academy_admin']::public.app_role[]))
  with check (private.has_academy_role(academy_id, array['academy_admin']::public.app_role[]));

create policy memberships_delete_admins
  on public.academy_memberships for delete to authenticated
  using (private.has_academy_role(academy_id, array['academy_admin']::public.app_role[]));

create policy coach_assignments_select_scoped
  on public.coach_rider_assignments for select to authenticated
  using (
    coach_user_id = (select auth.uid())
    or rider_user_id = (select auth.uid())
    or private.has_academy_role(academy_id, array['academy_admin']::public.app_role[])
  );

create policy coach_assignments_insert_admins
  on public.coach_rider_assignments for insert to authenticated
  with check (private.has_academy_role(academy_id, array['academy_admin']::public.app_role[]));

create policy coach_assignments_update_admins
  on public.coach_rider_assignments for update to authenticated
  using (private.has_academy_role(academy_id, array['academy_admin']::public.app_role[]))
  with check (private.has_academy_role(academy_id, array['academy_admin']::public.app_role[]));

create policy coach_assignments_delete_admins
  on public.coach_rider_assignments for delete to authenticated
  using (private.has_academy_role(academy_id, array['academy_admin']::public.app_role[]));

create policy parent_links_select_scoped
  on public.parent_rider_links for select to authenticated
  using (
    parent_user_id = (select auth.uid())
    or rider_user_id = (select auth.uid())
    or private.has_academy_role(academy_id, array['academy_admin']::public.app_role[])
  );

create policy parent_links_insert_admins
  on public.parent_rider_links for insert to authenticated
  with check (private.has_academy_role(academy_id, array['academy_admin']::public.app_role[]));

create policy parent_links_update_admins
  on public.parent_rider_links for update to authenticated
  using (private.has_academy_role(academy_id, array['academy_admin']::public.app_role[]))
  with check (private.has_academy_role(academy_id, array['academy_admin']::public.app_role[]));

create policy parent_links_delete_admins
  on public.parent_rider_links for delete to authenticated
  using (private.has_academy_role(academy_id, array['academy_admin']::public.app_role[]));

create policy audit_events_select_admin_or_actor
  on public.audit_events for select to authenticated
  using (
    actor_user_id = (select auth.uid())
    or private.has_academy_role(academy_id, array['academy_admin']::public.app_role[])
  );

revoke all on all tables in schema public from anon, authenticated;
grant select, update on public.profiles to authenticated;
grant select, update on public.academies to authenticated;
grant select, insert, update, delete on public.academy_memberships to authenticated;
grant select, insert, update, delete on public.coach_rider_assignments to authenticated;
grant select, insert, update, delete on public.parent_rider_links to authenticated;
grant select on public.audit_events to authenticated;
grant usage, select on sequence public.audit_events_id_seq to authenticated;

commit;
