begin;

create type public.platform_access_level as enum ('basic', 'administrator');

create table public.platform_access (
  user_id uuid primary key references auth.users(id) on delete cascade,
  access_level public.platform_access_level not null default 'basic',
  status public.membership_status not null default 'active',
  granted_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.platform_access is
  'Platform-wide login authorization. Academy memberships remain operational assignments only.';

insert into public.platform_access (user_id, access_level, status, granted_by)
select
  users.id,
  case
    when exists (
      select 1
      from public.academy_memberships membership
      where membership.user_id = users.id
        and membership.role = 'academy_admin'
        and membership.status = 'active'
    ) then 'administrator'::public.platform_access_level
    else 'basic'::public.platform_access_level
  end,
  'active'::public.membership_status,
  users.id
from auth.users users
on conflict (user_id) do nothing;

create or replace function private.is_platform_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.platform_access access
    where access.user_id = (select auth.uid())
      and access.status = 'active'
  );
$$;

create or replace function private.is_platform_administrator()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.platform_access access
    where access.user_id = (select auth.uid())
      and access.status = 'active'
      and access.access_level = 'administrator'
  );
$$;

create or replace function private.is_academy_member(target_academy_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_platform_administrator()
    and exists (select 1 from public.academies academy where academy.id = target_academy_id);
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
  select private.is_platform_administrator()
    and exists (select 1 from public.academies academy where academy.id = target_academy_id);
$$;

create or replace function private.can_access_profile(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.is_platform_administrator()
    or target_user_id = (select auth.uid())
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
      select 1 from public.coach_rider_assignments assignment
      where assignment.coach_user_id = (select auth.uid())
        and assignment.rider_user_id = target_user_id
    )
    or exists (
      select 1 from public.parent_rider_links link
      where link.parent_user_id = (select auth.uid())
        and link.rider_user_id = target_user_id
    );
$$;

create or replace function private.has_operational_assignment(target_academy_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_platform_administrator()
    or exists (
      select 1
      from public.academy_memberships membership
      where membership.academy_id = target_academy_id
        and membership.user_id = (select auth.uid())
        and membership.status = 'active'
    );
$$;

alter table public.platform_access enable row level security;

create policy platform_access_read
on public.platform_access
for select
to authenticated
using (
  user_id = (select auth.uid())
  or (select private.is_platform_administrator())
);

grant select on public.platform_access to authenticated;
grant execute on function private.is_platform_user() to authenticated;
grant execute on function private.is_platform_administrator() to authenticated;
grant execute on function private.has_operational_assignment(uuid) to authenticated;

create policy platform_academy_directory_read
on public.academies for select to authenticated
using ((select private.is_platform_user()));

create policy platform_plan_catalog_read
on public.membership_plans for select to authenticated
using ((select private.is_platform_user()));

create policy platform_horses_scoped_read
on public.horses for select to authenticated
using ((select private.has_operational_assignment(academy_id)));

create policy platform_lessons_scoped_read
on public.lesson_sessions for select to authenticated
using ((select private.has_operational_assignment(academy_id)));

create policy platform_bookings_scoped_read
on public.lesson_bookings for select to authenticated
using ((select private.has_operational_assignment(academy_id)));

create policy platform_reports_scoped_read
on public.lesson_reports for select to authenticated
using ((select private.has_operational_assignment(academy_id)));

create policy platform_pathway_scoped_read
on public.rider_pathway_assessments for select to authenticated
using ((select private.has_operational_assignment(academy_id)));

create policy platform_approved_analysis_scoped_read
on public.riding_video_analyses for select to authenticated
using (
  status = 'approved'
  and deleted_at is null
  and (select private.has_operational_assignment(academy_id))
);

create or replace function public.set_platform_access(
  target_user_id uuid,
  target_access_level public.platform_access_level,
  target_status public.membership_status default 'active'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null or not private.is_platform_administrator() then
    raise exception 'platform administrator access required' using errcode = '42501';
  end if;

  if target_status = 'invited' then
    raise exception 'platform access must be active or suspended';
  end if;

  if target_user_id = current_user_id
    and (target_access_level <> 'administrator' or target_status <> 'active')
    and (
      select count(*)
      from public.platform_access access
      where access.access_level = 'administrator'
        and access.status = 'active'
    ) = 1
  then
    raise exception 'the final active administrator cannot remove their own access';
  end if;

  insert into public.platform_access (
    user_id,
    access_level,
    status,
    granted_by,
    updated_at
  )
  values (
    target_user_id,
    target_access_level,
    target_status,
    current_user_id,
    now()
  )
  on conflict (user_id) do update
  set access_level = excluded.access_level,
      status = excluded.status,
      granted_by = excluded.granted_by,
      updated_at = now();
end;
$$;

revoke all on function public.set_platform_access(uuid, public.platform_access_level, public.membership_status)
  from public, anon;
grant execute on function public.set_platform_access(uuid, public.platform_access_level, public.membership_status)
  to authenticated;

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
  if current_user_id is null or not private.is_platform_administrator() then
    raise exception 'platform administrator access required' using errcode = '42501';
  end if;

  if char_length(trim(academy_name)) not between 2 and 120 then
    raise exception 'academy name must be between 2 and 120 characters';
  end if;

  insert into public.academies (name, timezone, created_by)
  values (trim(academy_name), trim(academy_timezone), current_user_id)
  returning id into new_academy_id;

  insert into public.academy_memberships (
    academy_id, user_id, role, status, invited_by
  )
  values (
    new_academy_id, current_user_id, 'academy_admin', 'active', current_user_id
  );

  insert into public.audit_events (
    academy_id, actor_user_id, action, entity_type, entity_id
  )
  values (
    new_academy_id, current_user_id, 'academy.created', 'academy', new_academy_id
  );

  return new_academy_id;
end;
$$;

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

  insert into public.platform_access (user_id, access_level, status)
  values (new.id, 'basic', 'active')
  on conflict (user_id) do nothing;

  return new;
end;
$$;

commit;
