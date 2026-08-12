begin;

create table public.platform_audit_events (
  id bigint generated always as identity primary key,
  actor_user_id uuid not null references auth.users(id),
  action text not null check (char_length(action) between 3 and 120),
  target_user_id uuid references auth.users(id),
  academy_id uuid references public.academies(id),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index platform_audit_events_created_idx
  on public.platform_audit_events (created_at desc);
create index platform_audit_events_target_idx
  on public.platform_audit_events (target_user_id, created_at desc)
  where target_user_id is not null;
create index platform_audit_events_academy_idx
  on public.platform_audit_events (academy_id, created_at desc)
  where academy_id is not null;

alter table public.platform_audit_events enable row level security;

revoke all on public.platform_audit_events from public, anon, authenticated;
revoke all on sequence public.platform_audit_events_id_seq from public, anon, authenticated;
grant select on public.platform_audit_events to authenticated;
grant select, insert on public.platform_audit_events to service_role;
grant usage, select on sequence public.platform_audit_events_id_seq to service_role;

create policy platform_audit_events_select_administrators
on public.platform_audit_events for select
to authenticated
using ((select private.is_platform_administrator()));

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
  previous_access_level public.platform_access_level;
  previous_status public.membership_status;
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

  select access_level, status
    into previous_access_level, previous_status
  from public.platform_access
  where user_id = target_user_id;

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

  insert into public.platform_audit_events (
    actor_user_id,
    action,
    target_user_id,
    metadata
  )
  values (
    current_user_id,
    'platform.access_changed',
    target_user_id,
    jsonb_build_object(
      'previous_access_level', previous_access_level,
      'previous_status', previous_status,
      'access_level', target_access_level,
      'status', target_status
    )
  );
end;
$$;

revoke all on function public.set_platform_access(uuid, public.platform_access_level, public.membership_status)
  from public, anon;
grant execute on function public.set_platform_access(uuid, public.platform_access_level, public.membership_status)
  to authenticated;

commit;
