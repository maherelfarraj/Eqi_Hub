-- Run after Phase 0A.2, Phase 0B.1, and Phase 0B.2 on a disposable branch.
-- The complete suite is transactional and leaves no fixture rows behind.

begin;

insert into public.profiles (id, email, full_name, role) values
  ('91000000-0000-0000-0000-000000000001', 'rider-0b2@example.test', 'Rider 0B2', 'rider'),
  ('91000000-0000-0000-0000-000000000002', 'admin-0b2@example.test', 'Academy Admin 0B2', 'admin'),
  ('91000000-0000-0000-0000-000000000003', 'platform-0b2@example.test', 'Platform Admin 0B2', 'admin'),
  ('91000000-0000-0000-0000-000000000004', 'outsider-0b2@example.test', 'Other Admin 0B2', 'admin');

insert into public.organizations (id, name, slug, organization_type, created_by) values
  ('a1000000-0000-0000-0000-000000000001', 'Academy 0B2', 'academy-0b2', 'academy', '91000000-0000-0000-0000-000000000002'),
  ('a1000000-0000-0000-0000-000000000002', 'Other Academy 0B2', 'other-academy-0b2', 'academy', '91000000-0000-0000-0000-000000000004');

insert into public.organization_memberships (
  id, organization_id, user_id, status, joined_at
) values
  ('b1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000002', 'active', now()),
  ('b1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000002', '91000000-0000-0000-0000-000000000004', 'active', now());

insert into public.organization_member_roles (membership_id, role) values
  ('b1000000-0000-0000-0000-000000000001', 'academy_admin'),
  ('b1000000-0000-0000-0000-000000000002', 'academy_admin');

insert into public.platform_role_assignments (user_id, role)
values ('91000000-0000-0000-0000-000000000003', 'platform_admin');

-- A rider cannot call any administrative RPC.
select set_config('request.jwt.claim.sub', '91000000-0000-0000-0000-000000000001', true);
set local role authenticated;
do $rider$
begin
  begin
    perform public.get_organization_members('a1000000-0000-0000-0000-000000000001');
    raise exception 'rider listed organization members';
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.manage_organization_member(
      'a1000000-0000-0000-0000-000000000001',
      'rider-0b2@example.test',
      'active',
      array['rider']::text[]
    );
    raise exception 'rider managed organization membership';
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.create_organization('Forbidden', 'forbidden-0b2', 'academy');
    raise exception 'rider created an organization';
  exception when insufficient_privilege then null;
  end;
end
$rider$;

-- Academy admins may manage non-admin roles in their own organization only.
reset role;
select set_config('request.jwt.claim.sub', '91000000-0000-0000-0000-000000000002', true);
set local role authenticated;

select public.manage_organization_member(
  'a1000000-0000-0000-0000-000000000001',
  'rider-0b2@example.test',
  'active',
  array['rider', 'horse_owner']::text[]
);

do $academy_admin$
begin
  if (select count(*) from public.get_organization_members(
    'a1000000-0000-0000-0000-000000000001'
  )) <> 2 then
    raise exception 'academy admin member listing failed';
  end if;

  if not exists (
    select 1
    from public.get_organization_members('a1000000-0000-0000-0000-000000000001')
    where email = 'rider-0b2@example.test'
      and roles = array['horse_owner', 'rider']::text[]
  ) then
    raise exception 'academy admin role assignment failed';
  end if;

  begin
    perform public.manage_organization_member(
      'a1000000-0000-0000-0000-000000000001',
      'rider-0b2@example.test',
      'active',
      array['academy_admin']::text[]
    );
    raise exception 'academy admin assigned academy_admin';
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.manage_organization_member(
      'a1000000-0000-0000-0000-000000000002',
      'rider-0b2@example.test',
      'active',
      array['rider']::text[]
    );
    raise exception 'academy admin crossed tenant boundary';
  exception when insufficient_privilege then null;
  end;

  begin
    update public.organization_memberships
    set status = 'suspended';
    raise exception 'academy admin received direct table write access';
  exception when insufficient_privilege then null;
  end;
end
$academy_admin$;

-- Platform administrators may create organizations and assign academy admins.
reset role;
select set_config('request.jwt.claim.sub', '91000000-0000-0000-0000-000000000003', true);
set local role authenticated;

select public.manage_organization_member(
  'a1000000-0000-0000-0000-000000000001',
  'rider-0b2@example.test',
  'active',
  array['academy_admin', 'rider']::text[]
);

select public.create_organization(
  'Created by Platform Admin',
  'created-platform-0b2',
  'stable'
);

do $platform_admin$
begin
  if not exists (
    select 1
    from public.get_organization_members('a1000000-0000-0000-0000-000000000001')
    where email = 'rider-0b2@example.test'
      and 'academy_admin' = any(roles)
  ) then
    raise exception 'platform admin could not assign academy_admin';
  end if;

  if not exists (
    select 1 from public.organizations where slug = 'created-platform-0b2'
  ) then
    raise exception 'platform admin organization creation failed';
  end if;

  if (
    select count(*)
    from public.audit_events
    where action in (
      'organization.created',
      'organization_member.created',
      'organization_member.updated'
    )
  ) < 3 then
    raise exception 'organization audit events were not written';
  end if;
end
$platform_admin$;

-- Public wrappers are invoker functions; privileged implementations remain private.
reset role;
do $security_shape$
begin
  if exists (
    select 1
    from pg_proc as procedure
    join pg_namespace as namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.proname in (
        'get_organization_members',
        'create_organization',
        'manage_organization_member',
        'update_organization_name'
      )
      and procedure.prosecdef
  ) then
    raise exception 'a public Phase 0B.2 RPC is SECURITY DEFINER';
  end if;

  if exists (
    select 1
    from pg_proc as procedure
    join pg_namespace as namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'private'
      and procedure.proname like 'phase_0b2_%'
      and (
        not procedure.prosecdef
        or procedure.proconfig is null
        or not (procedure.proconfig @> array['search_path=""']::text[])
      )
  ) then
    raise exception 'a private Phase 0B.2 implementation is not hardened';
  end if;
end
$security_shape$;

rollback;
