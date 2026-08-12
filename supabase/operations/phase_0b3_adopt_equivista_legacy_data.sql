-- Phase 0B.3 operational data adoption for the existing EquiVista tenant.
--
-- This is intentionally an operator-run, idempotent transaction rather than a
-- schema migration. It resolves environment identities by stable slug/email,
-- rejects an unexpected legacy graph, preserves v1 profile roles, and records
-- only aggregate, non-sensitive audit metadata.

begin;

do $adopt$
declare
  target_org_id uuid;
  actor_id uuid;
  actor_membership_id uuid;
  expected_trainer_id uuid;
  trainer_membership_id uuid;
  affected integer;
  changed integer := 0;
  horses_changed integer := 0;
  analyses_changed integer := 0;
  lessons_changed integer := 0;
  plans_changed integer := 0;
  memberships_changed integer := 0;
  invoices_changed integer := 0;
begin
  if (select count(*) from public.organizations where slug = 'equivista' and active) <> 1 then
    raise exception 'Adoption requires exactly one active EquiVista organization';
  end if;
  select id into target_org_id
  from public.organizations
  where slug = 'equivista' and active;

  if (select count(*) from public.profiles where lower(email) = 'admin@equivista.net') <> 1 then
    raise exception 'Adoption requires exactly one admin@equivista.net profile';
  end if;
  select id into actor_id
  from public.profiles
  where lower(email) = 'admin@equivista.net';

  if not exists (
    select 1
    from public.platform_role_assignments
    where user_id = actor_id and role = 'platform_admin'
  ) then
    raise exception 'admin@equivista.net must be platform_admin';
  end if;

  select membership.id into actor_membership_id
  from public.organization_memberships as membership
  join public.organization_member_roles as member_role
    on member_role.membership_id = membership.id
  where membership.organization_id = target_org_id
    and membership.user_id = actor_id
    and membership.status = 'active'
    and member_role.role = 'academy_admin';

  if actor_membership_id is null then
    raise exception 'admin@equivista.net must be the active academy administrator';
  end if;

  if (select count(*) from public.profiles where lower(email) = 'trainer@demo.equivista.net') <> 1 then
    raise exception 'Adoption requires exactly one demo trainer profile';
  end if;
  select id into expected_trainer_id
  from public.profiles
  where lower(email) = 'trainer@demo.equivista.net';

  if exists (
       select 1 from public.horses as horse
       where horse.organization_id is null and horse.owner_id <> actor_id
     )
     or exists (
       select 1 from public.video_analyses as analysis
       where analysis.organization_id is null and analysis.rider_id <> actor_id
     )
     or exists (
       select 1 from public.lessons as lesson
       where lesson.organization_id is null
         and (
           lesson.rider_id <> actor_id
           or lesson.trainer_id is distinct from expected_trainer_id
         )
     )
     or exists (
       select 1 from public.memberships as membership
       where membership.organization_id is null and membership.user_id <> actor_id
     )
     or exists (
       select 1 from public.invoices as invoice
       where invoice.organization_id is null and invoice.user_id <> actor_id
     ) then
    raise exception 'Legacy graph contains identities outside the approved EquiVista adoption set';
  end if;

  insert into public.organization_memberships (
    organization_id, user_id, status, invited_by, joined_at
  ) values (
    target_org_id, expected_trainer_id, 'active', actor_id, now()
  )
  on conflict (organization_id, user_id) do nothing
  returning id into trainer_membership_id;
  get diagnostics affected = row_count;
  changed := changed + affected;

  if trainer_membership_id is null then
    select id into trainer_membership_id
    from public.organization_memberships
    where organization_id = target_org_id
      and user_id = expected_trainer_id
      and status = 'active';
  end if;
  if trainer_membership_id is null then
    raise exception 'Existing demo trainer membership is not active';
  end if;

  insert into public.organization_member_roles (membership_id, role, assigned_by)
  values
    (actor_membership_id, 'rider', actor_id),
    (actor_membership_id, 'horse_owner', actor_id),
    (trainer_membership_id, 'coach', actor_id)
  on conflict (membership_id, role) do nothing;
  get diagnostics affected = row_count;
  changed := changed + affected;

  update public.membership_plans
  set organization_id = target_org_id
  where organization_id is null;
  get diagnostics plans_changed = row_count;
  changed := changed + plans_changed;

  update public.horses
  set organization_id = target_org_id
  where organization_id is null;
  get diagnostics horses_changed = row_count;
  changed := changed + horses_changed;

  update public.video_analyses
  set organization_id = target_org_id
  where organization_id is null;
  get diagnostics analyses_changed = row_count;
  changed := changed + analyses_changed;

  update public.lessons
  set organization_id = target_org_id
  where organization_id is null;
  get diagnostics lessons_changed = row_count;
  changed := changed + lessons_changed;

  update public.memberships
  set organization_id = target_org_id
  where organization_id is null;
  get diagnostics memberships_changed = row_count;
  changed := changed + memberships_changed;

  update public.invoices
  set organization_id = target_org_id
  where organization_id is null;
  get diagnostics invoices_changed = row_count;
  changed := changed + invoices_changed;

  insert into public.coach_rider_assignments (
    organization_id, coach_id, rider_id, active, starts_on, created_by
  )
  select distinct
    target_org_id, lesson.trainer_id, lesson.rider_id, true, current_date, actor_id
  from public.lessons as lesson
  where lesson.organization_id = target_org_id
    and lesson.trainer_id is not null
  on conflict (organization_id, coach_id, rider_id) do nothing;
  get diagnostics affected = row_count;
  changed := changed + affected;

  insert into public.horse_access_assignments (
    organization_id, horse_id, profile_id, access_type, active, created_by
  )
  select target_org_id, horse.id, horse.owner_id, 'owner', true, actor_id
  from public.horses as horse
  where horse.organization_id = target_org_id
  on conflict (organization_id, horse_id, profile_id, access_type) do nothing;
  get diagnostics affected = row_count;
  changed := changed + affected;

  insert into public.horse_access_assignments (
    organization_id, horse_id, profile_id, access_type, active, created_by
  )
  select distinct
    target_org_id, horse_rider.horse_id, horse_rider.rider_id, 'rider', true, actor_id
  from public.horse_riders as horse_rider
  join public.horses as horse on horse.id = horse_rider.horse_id
  join public.organization_memberships as membership
    on membership.organization_id = target_org_id
   and membership.user_id = horse_rider.rider_id
   and membership.status = 'active'
  where horse.organization_id = target_org_id
  on conflict (organization_id, horse_id, profile_id, access_type) do nothing;
  get diagnostics affected = row_count;
  changed := changed + affected;

  insert into public.horse_access_assignments (
    organization_id, horse_id, profile_id, access_type, active, created_by
  )
  select distinct
    target_org_id, lesson.horse_id, lesson.trainer_id, 'coach', true, actor_id
  from public.lessons as lesson
  where lesson.organization_id = target_org_id
    and lesson.horse_id is not null
    and lesson.trainer_id is not null
  on conflict (organization_id, horse_id, profile_id, access_type) do nothing;
  get diagnostics affected = row_count;
  changed := changed + affected;

  if changed > 0 then
    insert into public.audit_events (
      organization_id, request_id, source, actor_user_id,
      entity_type, entity_id, action, after_data
    ) values (
      target_org_id, gen_random_uuid(), 'platform', actor_id,
      'organization', target_org_id, 'organization.legacy_data_adopted',
      jsonb_build_object(
        'horses', horses_changed,
        'video_analyses', analyses_changed,
        'lessons', lessons_changed,
        'membership_plans', plans_changed,
        'memberships', memberships_changed,
        'invoices', invoices_changed
      )
    );
  end if;
end
$adopt$;

commit;
