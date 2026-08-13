-- Phase 1 controlled-pilot production preflight.
-- Read-only: returns one JSON snapshot and does not expose names or email addresses.
with active_members as (
  select id, organization_id, user_id
  from public.organization_memberships
  where status = 'active'
),
role_counts as (
  select
    am.organization_id,
    omr.role,
    count(distinct am.user_id)::integer as users
  from active_members am
  join public.organization_member_roles omr on omr.membership_id = am.id
  where omr.role in ('rider', 'guardian', 'coach', 'academy_admin')
  group by am.organization_id, omr.role
),
organization_snapshots as (
  select jsonb_build_object(
    'organization_ref', o.id::text,
    'active_members', (
      select count(*)::integer
      from active_members am
      where am.organization_id = o.id
    ),
    'distinct_required_role_users', (
      select count(distinct am.user_id)::integer
      from active_members am
      join public.organization_member_roles omr on omr.membership_id = am.id
      where am.organization_id = o.id
        and omr.role in ('rider', 'guardian', 'coach', 'academy_admin')
    ),
    'roles', jsonb_build_object(
      'rider', coalesce((select users from role_counts where organization_id = o.id and role = 'rider'), 0),
      'guardian', coalesce((select users from role_counts where organization_id = o.id and role = 'guardian'), 0),
      'coach', coalesce((select users from role_counts where organization_id = o.id and role = 'coach'), 0),
      'academy_admin', coalesce((select users from role_counts where organization_id = o.id and role = 'academy_admin'), 0)
    ),
    'relationships', jsonb_build_object(
      'active_guardian_rider_links', (
        select count(*)::integer
        from public.guardian_riders gr
        where gr.organization_id = o.id and gr.active
      ),
      'active_coach_rider_links', (
        select count(*)::integer
        from public.coach_rider_assignments cra
        where cra.organization_id = o.id and cra.active
      ),
      'active_horse_access_assignments', (
        select count(*)::integer
        from public.horse_access_assignments haa
        where haa.organization_id = o.id and haa.active
      )
    )
  ) as snapshot
  from public.organizations o
)
select jsonb_build_object(
  'version', 1,
  'observed_at', to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  'environment', 'production-controlled-pilot',
  'totals', jsonb_build_object(
    'auth_users', (select count(*)::integer from auth.users),
    'confirmed_auth_users', (
      select count(*)::integer
      from auth.users
      where email_confirmed_at is not null
    ),
    'profiles', (select count(*)::integer from public.profiles),
    'active_memberships', (select count(*)::integer from active_members)
  ),
  'organizations', coalesce(
    (select jsonb_agg(snapshot) from organization_snapshots),
    '[]'::jsonb
  )
) as phase1_production_preflight;
