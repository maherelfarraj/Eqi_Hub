-- Phase 0B.4 production acceptance for active-organization data scoping.
--
-- The suite resolves the adopted EquiVista identities at runtime, simulates
-- authenticated JWT subjects, exercises RLS plus the frontend's explicit
-- organization filters, verifies fail-closed writes, and leaves no rows behind.

begin;

set local statement_timeout = '30s';
set local lock_timeout = '5s';

do $phase_0b4_context$
declare
  target_org_id uuid;
  admin_id uuid;
  coach_id uuid;
  outsider_id uuid;
  horse_id uuid;
  analysis_id uuid;
  lesson_id uuid;
  plan_id uuid;
  membership_id uuid;
  invoice_id uuid;
  baseline jsonb;
begin
  if (
    select count(*)
    from public.organizations
    where slug = 'equivista' and active
  ) <> 1 then
    raise exception 'expected exactly one active EquiVista organization';
  end if;

  select id into strict target_org_id
  from public.organizations
  where slug = 'equivista' and active;

  if (
    select count(*)
    from public.profiles
    where lower(email) = 'admin@equivista.net'
  ) <> 1 then
    raise exception 'expected exactly one EquiVista administrator profile';
  end if;

  select id into strict admin_id
  from public.profiles
  where lower(email) = 'admin@equivista.net';

  if not exists (
    select 1
    from public.platform_role_assignments
    where user_id = admin_id and role = 'platform_admin'
  ) then
    raise exception 'EquiVista administrator is not platform_admin';
  end if;

  if not exists (
    select 1
    from public.organization_memberships as membership
    join public.organization_member_roles as member_role
      on member_role.membership_id = membership.id
    where membership.organization_id = target_org_id
      and membership.user_id = admin_id
      and membership.status = 'active'
      and member_role.role = 'academy_admin'
  ) then
    raise exception 'EquiVista administrator is not an active academy_admin';
  end if;

  if (
    select count(*)
    from public.profiles
    where lower(email) = 'trainer@demo.equivista.net'
  ) <> 1 then
    raise exception 'expected exactly one EquiVista coach profile';
  end if;

  select id into strict coach_id
  from public.profiles
  where lower(email) = 'trainer@demo.equivista.net';

  if not exists (
    select 1
    from public.organization_memberships as membership
    join public.organization_member_roles as member_role
      on member_role.membership_id = membership.id
    where membership.organization_id = target_org_id
      and membership.user_id = coach_id
      and membership.status = 'active'
      and member_role.role = 'coach'
  ) then
    raise exception 'EquiVista coach is not an active coach member';
  end if;

  select profile.id into outsider_id
  from public.profiles as profile
  where not exists (
      select 1
      from public.organization_memberships as membership
      where membership.user_id = profile.id
        and membership.status = 'active'
    )
    and not exists (
      select 1
      from public.platform_role_assignments as assignment
      where assignment.user_id = profile.id
    )
  order by profile.created_at, profile.id
  limit 1;

  if outsider_id is null then
    raise exception 'no non-member outsider profile is available';
  end if;

  select id into strict horse_id
  from public.horses
  where organization_id = target_org_id
  order by id
  limit 1;

  select id into strict analysis_id
  from public.video_analyses
  where organization_id = target_org_id
  order by id
  limit 1;

  select id into strict lesson_id
  from public.lessons
  where organization_id = target_org_id
  order by id
  limit 1;

  select id into strict plan_id
  from public.membership_plans
  where organization_id = target_org_id
  order by id
  limit 1;

  select id into strict membership_id
  from public.memberships
  where organization_id = target_org_id
  order by id
  limit 1;

  select id into strict invoice_id
  from public.invoices
  where organization_id = target_org_id
  order by id
  limit 1;

  select jsonb_build_object(
    'horses', (select count(*) from public.horses),
    'analyses', (select count(*) from public.video_analyses),
    'lessons', (select count(*) from public.lessons),
    'plans', (select count(*) from public.membership_plans),
    'memberships', (select count(*) from public.memberships),
    'invoices', (select count(*) from public.invoices)
  ) into baseline;

  if baseline <> jsonb_build_object(
    'horses', 1,
    'analyses', 10,
    'lessons', 4,
    'plans', 3,
    'memberships', 1,
    'invoices', 2
  ) then
    raise exception 'unexpected Phase 0B.4 production baseline: %', baseline;
  end if;

  perform set_config('phase_0b4.organization_id', target_org_id::text, true);
  perform set_config('phase_0b4.admin_id', admin_id::text, true);
  perform set_config('phase_0b4.coach_id', coach_id::text, true);
  perform set_config('phase_0b4.outsider_id', outsider_id::text, true);
  perform set_config('phase_0b4.horse_id', horse_id::text, true);
  perform set_config('phase_0b4.analysis_id', analysis_id::text, true);
  perform set_config('phase_0b4.lesson_id', lesson_id::text, true);
  perform set_config('phase_0b4.plan_id', plan_id::text, true);
  perform set_config('phase_0b4.membership_id', membership_id::text, true);
  perform set_config('phase_0b4.invoice_id', invoice_id::text, true);
  perform set_config('phase_0b4.baseline', baseline::text, true);
end
$phase_0b4_context$;

select set_config(
  'request.jwt.claim.sub',
  current_setting('phase_0b4.admin_id'),
  true
);
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', current_setting('phase_0b4.admin_id'),
    'role', 'authenticated'
  )::text,
  true
);
set local role authenticated;

do $phase_0b4_admin$
declare
  target_org_id uuid := current_setting('phase_0b4.organization_id')::uuid;
begin
  if (select count(*) from public.organizations where id = target_org_id) <> 1 then
    raise exception 'administrator organization visibility failed';
  end if;
  if (select count(*) from public.horses where organization_id = target_org_id) <> 1 then
    raise exception 'administrator horse scoping failed';
  end if;
  if (select count(*) from public.video_analyses where organization_id = target_org_id) <> 10 then
    raise exception 'administrator analysis scoping failed';
  end if;
  if (select count(*) from public.lessons where organization_id = target_org_id) <> 4 then
    raise exception 'administrator lesson scoping failed';
  end if;
  if (select count(*) from public.membership_plans where organization_id = target_org_id) <> 3 then
    raise exception 'administrator plan scoping failed';
  end if;
  if (select count(*) from public.memberships where organization_id = target_org_id) <> 1 then
    raise exception 'administrator membership scoping failed';
  end if;
  if (select count(*) from public.invoices where organization_id = target_org_id) <> 2 then
    raise exception 'administrator invoice scoping failed';
  end if;
end
$phase_0b4_admin$;

reset role;
select set_config(
  'request.jwt.claim.sub',
  current_setting('phase_0b4.coach_id'),
  true
);
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', current_setting('phase_0b4.coach_id'),
    'role', 'authenticated'
  )::text,
  true
);
set local role authenticated;

do $phase_0b4_coach$
declare
  target_org_id uuid := current_setting('phase_0b4.organization_id')::uuid;
begin
  if (select count(*) from public.organizations where id = target_org_id) <> 1 then
    raise exception 'coach organization visibility failed';
  end if;
  if (select count(*) from public.organization_memberships) <> 1 then
    raise exception 'coach own membership visibility failed';
  end if;
  if (select count(*) from public.horses where organization_id = target_org_id) <> 0 then
    raise exception 'coach horse boundary failed';
  end if;
  if (select count(*) from public.video_analyses where organization_id = target_org_id) <> 1 then
    raise exception 'coach analysis boundary failed';
  end if;
  if (select count(*) from public.lessons where organization_id = target_org_id) <> 4 then
    raise exception 'coach lesson visibility failed';
  end if;
  if exists (
    select 1
    from public.lessons
    where organization_id = target_org_id
      and trainer_id is distinct from (select auth.uid())
  ) then
    raise exception 'coach saw an unassigned lesson';
  end if;
  if (select count(*) from public.membership_plans where organization_id = target_org_id) <> 3 then
    raise exception 'coach plan scoping failed';
  end if;
  if (select count(*) from public.memberships where organization_id = target_org_id) <> 0 then
    raise exception 'coach saw rider memberships';
  end if;
  if (select count(*) from public.invoices where organization_id = target_org_id) <> 0 then
    raise exception 'coach saw rider invoices';
  end if;
end
$phase_0b4_coach$;

reset role;
select set_config(
  'request.jwt.claim.sub',
  current_setting('phase_0b4.outsider_id'),
  true
);
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', current_setting('phase_0b4.outsider_id'),
    'role', 'authenticated'
  )::text,
  true
);
set local role authenticated;

do $phase_0b4_outsider$
declare
  affected integer;
begin
  if (select count(*) from public.organizations) <> 0 then
    raise exception 'outsider saw an organization';
  end if;
  if (select count(*) from public.organization_memberships) <> 0 then
    raise exception 'outsider saw an organization membership';
  end if;
  if (select count(*) from public.horses where organization_id is null) <> 0 then
    raise exception 'outsider legacy horse scoping failed';
  end if;
  if (select count(*) from public.video_analyses where organization_id is null) <> 0 then
    raise exception 'outsider legacy analysis scoping failed';
  end if;
  if (select count(*) from public.lessons where organization_id is null) <> 0 then
    raise exception 'outsider legacy lesson scoping failed';
  end if;
  if (select count(*) from public.membership_plans where organization_id is null) <> 0 then
    raise exception 'outsider legacy plan scoping failed';
  end if;
  if (select count(*) from public.memberships where organization_id is null) <> 0 then
    raise exception 'outsider legacy membership scoping failed';
  end if;
  if (select count(*) from public.invoices where organization_id is null) <> 0 then
    raise exception 'outsider legacy invoice scoping failed';
  end if;

  begin
    update public.horses
    set organization_id = organization_id
    where id = current_setting('phase_0b4.horse_id')::uuid;
    get diagnostics affected = row_count;
    if affected <> 0 then raise exception 'outsider updated a horse'; end if;
  exception when insufficient_privilege then null;
  end;

  begin
    update public.video_analyses
    set organization_id = organization_id
    where id = current_setting('phase_0b4.analysis_id')::uuid;
    get diagnostics affected = row_count;
    if affected <> 0 then raise exception 'outsider updated an analysis'; end if;
  exception when insufficient_privilege then null;
  end;

  begin
    update public.lessons
    set organization_id = organization_id
    where id = current_setting('phase_0b4.lesson_id')::uuid;
    get diagnostics affected = row_count;
    if affected <> 0 then raise exception 'outsider updated a lesson'; end if;
  exception when insufficient_privilege then null;
  end;

  begin
    update public.membership_plans
    set organization_id = organization_id
    where id = current_setting('phase_0b4.plan_id')::uuid;
    get diagnostics affected = row_count;
    if affected <> 0 then raise exception 'outsider updated a plan'; end if;
  exception when insufficient_privilege then null;
  end;

  begin
    update public.memberships
    set organization_id = organization_id
    where id = current_setting('phase_0b4.membership_id')::uuid;
    get diagnostics affected = row_count;
    if affected <> 0 then raise exception 'outsider updated a membership'; end if;
  exception when insufficient_privilege then null;
  end;

  begin
    update public.invoices
    set organization_id = organization_id
    where id = current_setting('phase_0b4.invoice_id')::uuid;
    get diagnostics affected = row_count;
    if affected <> 0 then raise exception 'outsider updated an invoice'; end if;
  exception when insufficient_privilege then null;
  end;
end
$phase_0b4_outsider$;

reset role;

do $phase_0b4_unchanged$
declare
  after_counts jsonb;
begin
  select jsonb_build_object(
    'horses', (select count(*) from public.horses),
    'analyses', (select count(*) from public.video_analyses),
    'lessons', (select count(*) from public.lessons),
    'plans', (select count(*) from public.membership_plans),
    'memberships', (select count(*) from public.memberships),
    'invoices', (select count(*) from public.invoices)
  ) into after_counts;

  if after_counts <> current_setting('phase_0b4.baseline')::jsonb then
    raise exception 'row counts changed during Phase 0B.4 acceptance';
  end if;
end
$phase_0b4_unchanged$;

rollback;
