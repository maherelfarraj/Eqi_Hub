-- Phase 0B.2: operational organization context and audited member management.
-- This migration does not backfill legacy rows or create production tenants.

begin;

do $preflight$
begin
  if to_regclass('public.organizations') is null
     or to_regclass('public.organization_memberships') is null
     or to_regclass('public.organization_member_roles') is null
     or to_regclass('public.audit_events') is null
     or to_regprocedure('private.is_platform_admin()') is null
     or to_regprocedure('private.has_organization_role(uuid,text[])') is null then
    raise exception 'Phase 0B.2 preflight failed: Phase 0B.1 is not present';
  end if;

  if to_regprocedure('public.get_organization_members(uuid)') is not null
     or to_regprocedure('public.create_organization(text,text,text)') is not null
     or to_regprocedure('public.manage_organization_member(uuid,text,text,text[])') is not null
     or to_regprocedure('public.update_organization_name(uuid,text)') is not null then
    raise exception 'Phase 0B.2 preflight failed: public RPCs already exist';
  end if;

  if to_regclass('public.horse_access_assignments_horse_organization_idx') is not null then
    raise exception 'Phase 0B.2 preflight failed: target index already exists';
  end if;
end
$preflight$;

-- Cover the Phase 0B.1 composite FK in its declared column order.
create index horse_access_assignments_horse_organization_idx
  on public.horse_access_assignments(horse_id, organization_id);

create function private.phase_0b2_is_organization_manager(
  p_organization_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select
    (select private.is_platform_admin())
    or (select private.has_organization_role(
      p_organization_id,
      array['academy_admin']::text[]
    ));
$function$;

create function private.phase_0b2_get_organization_members(
  p_organization_id uuid
)
returns table (
  membership_id uuid,
  user_id uuid,
  email text,
  full_name text,
  status text,
  roles text[],
  joined_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if (select auth.uid()) is null then
    raise insufficient_privilege using message = 'Authentication required';
  end if;

  if not (select private.phase_0b2_is_organization_manager(p_organization_id)) then
    raise insufficient_privilege using message = 'Organization administrator access required';
  end if;

  return query
  select
    membership.id,
    membership.user_id,
    profile.email,
    profile.full_name,
    membership.status,
    coalesce(
      array_agg(member_role.role order by member_role.role)
        filter (where member_role.role is not null),
      '{}'::text[]
    ),
    membership.joined_at
  from public.organization_memberships as membership
  join public.profiles as profile on profile.id = membership.user_id
  left join public.organization_member_roles as member_role
    on member_role.membership_id = membership.id
  where membership.organization_id = p_organization_id
  group by membership.id, profile.email, profile.full_name
  order by profile.full_name, profile.email;
end;
$function$;

create function private.phase_0b2_create_organization(
  p_name text,
  p_slug text,
  p_organization_type text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor_id uuid := (select auth.uid());
  organization_id uuid;
  created_membership_id uuid;
begin
  if actor_id is null then
    raise insufficient_privilege using message = 'Authentication required';
  end if;

  if not (select private.is_platform_admin()) then
    raise insufficient_privilege using message = 'Platform administrator access required';
  end if;

  insert into public.organizations (
    name,
    slug,
    organization_type,
    created_by
  ) values (
    btrim(p_name),
    lower(btrim(p_slug)),
    p_organization_type,
    actor_id
  )
  returning id into organization_id;

  insert into public.organization_memberships (
    organization_id,
    user_id,
    status,
    invited_by,
    joined_at
  ) values (
    organization_id,
    actor_id,
    'active',
    actor_id,
    now()
  )
  returning id into created_membership_id;

  insert into public.organization_member_roles (
    membership_id,
    role,
    assigned_by
  ) values (
    created_membership_id,
    'academy_admin',
    actor_id
  );

  insert into public.audit_events (
    organization_id,
    request_id,
    source,
    actor_user_id,
    entity_type,
    entity_id,
    action,
    after_data
  ) values (
    organization_id,
    gen_random_uuid(),
    'application',
    actor_id,
    'organization',
    organization_id,
    'organization.created',
    jsonb_build_object(
      'name', btrim(p_name),
      'slug', lower(btrim(p_slug)),
      'organization_type', p_organization_type
    )
  );

  return organization_id;
end;
$function$;

create function private.phase_0b2_manage_organization_member(
  p_organization_id uuid,
  p_email text,
  p_status text,
  p_roles text[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor_id uuid := (select auth.uid());
  target_user_id uuid;
  target_count integer;
  managed_membership_id uuid;
  previous_status text;
  previous_roles text[] := '{}'::text[];
  normalized_roles text[];
  actor_is_platform_admin boolean;
  target_was_academy_admin boolean := false;
begin
  if actor_id is null then
    raise insufficient_privilege using message = 'Authentication required';
  end if;

  actor_is_platform_admin := (select private.is_platform_admin());

  if not actor_is_platform_admin
     and not (select private.has_organization_role(
       p_organization_id,
       array['academy_admin']::text[]
     )) then
    raise insufficient_privilege using message = 'Organization administrator access required';
  end if;

  -- Serialize member administration so two concurrent requests cannot remove
  -- the last active academy administrators at the same time.
  perform 1
  from public.organizations as organization
  where organization.id = p_organization_id
  for update;

  if not found then
    raise no_data_found using message = 'Organization not found';
  end if;

  if p_status not in ('active', 'suspended', 'left') then
    raise check_violation using message = 'Unsupported organization membership status';
  end if;

  select coalesce(array_agg(distinct requested_role order by requested_role), '{}'::text[])
  into normalized_roles
  from unnest(coalesce(p_roles, '{}'::text[])) as requested_role;

  if p_status = 'active' and cardinality(normalized_roles) = 0 then
    raise check_violation using message = 'An active member requires at least one role';
  end if;

  if exists (
    select 1
    from unnest(normalized_roles) as requested_role
    where requested_role <> all(array[
      'academy_admin', 'coach', 'rider', 'guardian', 'horse_owner',
      'stable_manager', 'accountant', 'competition_manager'
    ]::text[])
  ) then
    raise check_violation using message = 'Unsupported organization role';
  end if;

  select count(*), min(profile.id::text)::uuid
  into target_count, target_user_id
  from public.profiles as profile
  where lower(profile.email) = lower(btrim(p_email));

  if target_count <> 1 then
    raise no_data_found using message = 'Exactly one registered EquiVista account is required';
  end if;

  if not actor_is_platform_admin and target_user_id = actor_id then
    raise insufficient_privilege using message = 'Organization administrators cannot change their own access';
  end if;

  select membership.id, membership.status
  into managed_membership_id, previous_status
  from public.organization_memberships as membership
  where membership.organization_id = p_organization_id
    and membership.user_id = target_user_id
  for update;

  if managed_membership_id is not null then
    select coalesce(array_agg(member_role.role order by member_role.role), '{}'::text[])
    into previous_roles
    from public.organization_member_roles as member_role
    where member_role.membership_id = managed_membership_id;

    target_was_academy_admin := 'academy_admin' = any(previous_roles);
  end if;

  if not actor_is_platform_admin
     and (
       target_was_academy_admin
       or 'academy_admin' = any(normalized_roles)
     ) then
    raise insufficient_privilege using message = 'Only a platform administrator may manage academy administrators';
  end if;

  if target_was_academy_admin
     and (p_status <> 'active' or not ('academy_admin' = any(normalized_roles)))
     and not exists (
       select 1
       from public.organization_memberships as other_membership
       join public.organization_member_roles as other_role
         on other_role.membership_id = other_membership.id
       where other_membership.organization_id = p_organization_id
         and other_membership.status = 'active'
         and other_membership.user_id <> target_user_id
         and other_role.role = 'academy_admin'
     ) then
    raise check_violation using message = 'An organization must retain at least one active academy administrator';
  end if;

  insert into public.organization_memberships (
    organization_id,
    user_id,
    status,
    invited_by,
    joined_at
  ) values (
    p_organization_id,
    target_user_id,
    p_status,
    actor_id,
    case when p_status = 'active' then now() end
  )
  on conflict (organization_id, user_id) do update
  set status = excluded.status,
      joined_at = case
        when excluded.status = 'active'
          then coalesce(public.organization_memberships.joined_at, now())
        else public.organization_memberships.joined_at
      end,
      updated_at = now()
  returning id into managed_membership_id;

  delete from public.organization_member_roles
  where organization_member_roles.membership_id = managed_membership_id;

  insert into public.organization_member_roles (
    membership_id,
    role,
    assigned_by
  )
  select managed_membership_id, requested_role, actor_id
  from unnest(normalized_roles) as requested_role;

  insert into public.audit_events (
    organization_id,
    request_id,
    source,
    actor_user_id,
    entity_type,
    entity_id,
    action,
    before_data,
    after_data
  ) values (
    p_organization_id,
    gen_random_uuid(),
    'application',
    actor_id,
    'organization_membership',
    managed_membership_id,
    case when previous_status is null then 'organization_member.created'
         else 'organization_member.updated' end,
    case when previous_status is null then null
         else jsonb_build_object('status', previous_status, 'roles', previous_roles) end,
    jsonb_build_object(
      'user_id', target_user_id,
      'status', p_status,
      'roles', normalized_roles
    )
  );

  return managed_membership_id;
end;
$function$;

create function private.phase_0b2_update_organization_name(
  p_organization_id uuid,
  p_name text
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor_id uuid := (select auth.uid());
  previous_name text;
begin
  if actor_id is null then
    raise insufficient_privilege using message = 'Authentication required';
  end if;

  if not (select private.phase_0b2_is_organization_manager(p_organization_id)) then
    raise insufficient_privilege using message = 'Organization administrator access required';
  end if;

  select organization.name
  into previous_name
  from public.organizations as organization
  where organization.id = p_organization_id
  for update;

  if previous_name is null then
    raise no_data_found using message = 'Organization not found';
  end if;

  update public.organizations
  set name = btrim(p_name)
  where id = p_organization_id;

  insert into public.audit_events (
    organization_id,
    request_id,
    source,
    actor_user_id,
    entity_type,
    entity_id,
    action,
    before_data,
    after_data
  ) values (
    p_organization_id,
    gen_random_uuid(),
    'application',
    actor_id,
    'organization',
    p_organization_id,
    'organization.renamed',
    jsonb_build_object('name', previous_name),
    jsonb_build_object('name', btrim(p_name))
  );
end;
$function$;

-- SECURITY INVOKER wrappers are the only functions exposed by PostgREST.
create function public.get_organization_members(p_organization_id uuid)
returns table (
  membership_id uuid,
  user_id uuid,
  email text,
  full_name text,
  status text,
  roles text[],
  joined_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $function$
  select *
  from private.phase_0b2_get_organization_members(p_organization_id);
$function$;

create function public.create_organization(
  p_name text,
  p_slug text,
  p_organization_type text
)
returns uuid
language sql
security invoker
set search_path = ''
as $function$
  select private.phase_0b2_create_organization(p_name, p_slug, p_organization_type);
$function$;

create function public.manage_organization_member(
  p_organization_id uuid,
  p_email text,
  p_status text,
  p_roles text[]
)
returns uuid
language sql
security invoker
set search_path = ''
as $function$
  select private.phase_0b2_manage_organization_member(
    p_organization_id,
    p_email,
    p_status,
    p_roles
  );
$function$;

create function public.update_organization_name(
  p_organization_id uuid,
  p_name text
)
returns void
language sql
security invoker
set search_path = ''
as $function$
  select private.phase_0b2_update_organization_name(p_organization_id, p_name);
$function$;

revoke all on function private.phase_0b2_is_organization_manager(uuid)
  from public, anon, authenticated, service_role;
revoke all on function private.phase_0b2_get_organization_members(uuid)
  from public, anon, authenticated, service_role;
revoke all on function private.phase_0b2_create_organization(text, text, text)
  from public, anon, authenticated, service_role;
revoke all on function private.phase_0b2_manage_organization_member(uuid, text, text, text[])
  from public, anon, authenticated, service_role;
revoke all on function private.phase_0b2_update_organization_name(uuid, text)
  from public, anon, authenticated, service_role;

grant execute on function private.phase_0b2_is_organization_manager(uuid) to authenticated;
grant execute on function private.phase_0b2_get_organization_members(uuid) to authenticated;
grant execute on function private.phase_0b2_create_organization(text, text, text) to authenticated;
grant execute on function private.phase_0b2_manage_organization_member(uuid, text, text, text[]) to authenticated;
grant execute on function private.phase_0b2_update_organization_name(uuid, text) to authenticated;

revoke all on function public.get_organization_members(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.create_organization(text, text, text)
  from public, anon, authenticated, service_role;
revoke all on function public.manage_organization_member(uuid, text, text, text[])
  from public, anon, authenticated, service_role;
revoke all on function public.update_organization_name(uuid, text)
  from public, anon, authenticated, service_role;

grant execute on function public.get_organization_members(uuid) to authenticated;
grant execute on function public.create_organization(text, text, text) to authenticated;
grant execute on function public.manage_organization_member(uuid, text, text, text[]) to authenticated;
grant execute on function public.update_organization_name(uuid, text) to authenticated;

notify pgrst, 'reload schema';

commit;
