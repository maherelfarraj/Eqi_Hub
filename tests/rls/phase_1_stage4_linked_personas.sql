-- Phase 1 Stage 4 post-migration acceptance. Read-only and PII-minimized.
-- Resolves the uniquely active guardian-rider link at runtime and rolls back
-- session state after impersonating both personas.
begin;

set local statement_timeout = '30s';
set local lock_timeout = '5s';

-- Preview branches do not copy production data. Seed one disposable relationship
-- graph only when no active guardian link exists; the outer transaction always
-- rolls it back. Production verification continues to use the real pilot link.
do $fixture$
begin
  if not exists (select 1 from public.guardian_riders where active) then
    insert into auth.users (id, email, raw_user_meta_data)
    values
      ('10000000-0000-4000-8000-000000000001', 'stage4-guardian@example.invalid', '{"full_name":"Stage 4 Guardian"}'::jsonb),
      ('10000000-0000-4000-8000-000000000002', 'stage4-rider@example.invalid', '{"full_name":"Stage 4 Rider"}'::jsonb),
      ('10000000-0000-4000-8000-000000000003', 'stage4-owner@example.invalid', '{"full_name":"Stage 4 Owner"}'::jsonb);

    update public.profiles
    set role = 'owner'
    where id in (
      '10000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000003'
    );

    insert into public.organizations (id, name, slug, organization_type)
    values (
      '20000000-0000-4000-8000-000000000001',
      'Stage 4 Preview Academy',
      'stage-4-preview-academy',
      'academy'
    );

    insert into public.organization_memberships (id, organization_id, user_id, status)
    values
      ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'active'),
      ('30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'active'),
      ('30000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', 'active');

    insert into public.organization_member_roles (membership_id, role)
    values
      ('30000000-0000-4000-8000-000000000001', 'guardian'),
      ('30000000-0000-4000-8000-000000000002', 'rider'),
      ('30000000-0000-4000-8000-000000000003', 'horse_owner');

    insert into public.guardian_riders (
      organization_id,
      guardian_id,
      rider_id,
      active
    ) values (
      '20000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000002',
      true
    );

    insert into public.horses (id, organization_id, owner_id, name)
    values (
      '40000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000003',
      'Stage 4 Preview Horse'
    );

    insert into public.horse_access_assignments (
      organization_id,
      horse_id,
      profile_id,
      access_type,
      active
    ) values (
      '20000000-0000-4000-8000-000000000001',
      '40000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000002',
      'rider',
      true
    );

    insert into public.video_analyses (
      id,
      organization_id,
      rider_id,
      horse_id,
      title,
      discipline,
      status
    ) values (
      '50000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000002',
      '40000000-0000-4000-8000-000000000001',
      'Stage 4 Preview Analysis',
      'Flatwork',
      'analyzed'
    );

    insert into public.lessons (
      id,
      organization_id,
      rider_id,
      horse_id,
      analysis_id,
      date_time,
      lesson_type,
      status
    ) values (
      '60000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000001',
      '10000000-0000-4000-8000-000000000002',
      '40000000-0000-4000-8000-000000000001',
      '50000000-0000-4000-8000-000000000001',
      now(),
      'Flatwork',
      'completed'
    );
  end if;
end
$fixture$;

do $context$
declare
  v_organization_id uuid;
  v_guardian_id uuid;
  v_rider_id uuid;
  v_horses integer;
  v_lessons integer;
  v_analyses integer;
begin
  if (
    select count(*) from public.guardian_riders where active
  ) <> 1 then
    raise exception 'expected exactly one active guardian-rider pilot link';
  end if;

  select organization_id, guardian_id, rider_id
  into strict v_organization_id, v_guardian_id, v_rider_id
  from public.guardian_riders
  where active;

  if cardinality(array[v_guardian_id, v_rider_id]) <> 2
     or v_guardian_id = v_rider_id then
    raise exception 'guardian and rider must be distinct';
  end if;

  if not exists (
    select 1
    from public.organization_memberships as membership
    join public.organization_member_roles as member_role
      on member_role.membership_id = membership.id
    where membership.organization_id = v_organization_id
      and membership.user_id = v_guardian_id
      and membership.status = 'active'
      and member_role.role = 'guardian'
  ) then raise exception 'guardian role is not active'; end if;

  if not exists (
    select 1
    from public.organization_memberships as membership
    join public.organization_member_roles as member_role
      on member_role.membership_id = membership.id
    where membership.organization_id = v_organization_id
      and membership.user_id = v_rider_id
      and membership.status = 'active'
      and member_role.role = 'rider'
  ) then raise exception 'rider role is not active'; end if;

  select count(distinct horse_id) into v_horses
  from public.horse_access_assignments
  where organization_id = v_organization_id
    and profile_id = v_rider_id
    and active;
  select count(*) into v_lessons
  from public.lessons
  where organization_id = v_organization_id and rider_id = v_rider_id;
  select count(*) into v_analyses
  from public.video_analyses
  where organization_id = v_organization_id and rider_id = v_rider_id;

  if v_horses < 1 then raise exception 'pilot rider has no active horse access'; end if;

  perform set_config('phase_1_stage4.organization_id', v_organization_id::text, true);
  perform set_config('phase_1_stage4.guardian_id', v_guardian_id::text, true);
  perform set_config('phase_1_stage4.rider_id', v_rider_id::text, true);
  perform set_config('phase_1_stage4.horses', v_horses::text, true);
  perform set_config('phase_1_stage4.lessons', v_lessons::text, true);
  perform set_config('phase_1_stage4.analyses', v_analyses::text, true);
end
$context$;

select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', current_setting('phase_1_stage4.guardian_id'),
    'role', 'authenticated'
  )::text,
  true
);
set local role authenticated;

do $guardian$
declare
  v_org uuid := current_setting('phase_1_stage4.organization_id')::uuid;
  v_rider uuid := current_setting('phase_1_stage4.rider_id')::uuid;
begin
  if (select count(*) from public.profiles where id = v_rider) <> 1 then
    raise exception 'guardian cannot read the linked rider profile';
  end if;
  if (select count(*) from public.horses where organization_id = v_org)
     <> current_setting('phase_1_stage4.horses')::integer then
    raise exception 'guardian horse visibility does not match active rider access';
  end if;
  if (select count(*) from public.lessons where organization_id = v_org and rider_id = v_rider)
     <> current_setting('phase_1_stage4.lessons')::integer then
    raise exception 'guardian lesson visibility does not match the linked rider';
  end if;
  if (select count(*) from public.video_analyses where organization_id = v_org and rider_id = v_rider)
     <> current_setting('phase_1_stage4.analyses')::integer then
    raise exception 'guardian analysis visibility does not match the linked rider';
  end if;
  if exists (
    select 1 from public.guardian_riders
    where guardian_id <> (select auth.uid())
  ) then raise exception 'guardian can read another guardian link'; end if;
end
$guardian$;

reset role;
select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', current_setting('phase_1_stage4.rider_id'),
    'role', 'authenticated'
  )::text,
  true
);
set local role authenticated;

do $rider$
declare
  v_org uuid := current_setting('phase_1_stage4.organization_id')::uuid;
begin
  if (select count(*) from public.horses where organization_id = v_org)
     <> current_setting('phase_1_stage4.horses')::integer then
    raise exception 'rider horse visibility does not use canonical assignments';
  end if;
  if (select count(*) from public.video_analyses where organization_id = v_org)
     <> current_setting('phase_1_stage4.analyses')::integer then
    raise exception 'rider analysis visibility failed';
  end if;
end
$rider$;

rollback;
