-- Phase 1 Stage 5: allow organization administrators and assigned coaches to
-- read only the profile rows needed by their controlled-pilot journeys.
-- Profile write policies are intentionally unchanged.
begin;

drop policy if exists profiles_select_authorized on public.profiles;
create policy profiles_select_authorized
on public.profiles for select to authenticated
using (
  id = (select auth.uid())
  or role = 'trainer'
  or exists (
    select 1
    from public.guardian_riders as link
    where link.rider_id = profiles.id
      and link.guardian_id = (select auth.uid())
      and link.active
      and private.can_read_rider(link.organization_id, profiles.id)
  )
  or exists (
    select 1
    from public.coach_rider_assignments as assignment
    where assignment.rider_id = profiles.id
      and assignment.coach_id = (select auth.uid())
      and assignment.active
      and private.has_organization_role(
        assignment.organization_id,
        array['coach']
      )
  )
  or exists (
    select 1
    from public.organization_memberships as membership
    where membership.user_id = profiles.id
      and membership.status = 'active'
      and private.has_organization_role(
        membership.organization_id,
        array['academy_admin', 'stable_manager']
      )
  )
);

commit;
