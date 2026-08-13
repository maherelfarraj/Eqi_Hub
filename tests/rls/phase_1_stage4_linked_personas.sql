-- Phase 1 Stage 4 post-migration acceptance. Read-only and PII-minimized.
-- Resolves the uniquely active guardian-rider link at runtime and rolls back
-- session state after impersonating both personas.
begin;

set local statement_timeout = '30s';
set local lock_timeout = '5s';

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
