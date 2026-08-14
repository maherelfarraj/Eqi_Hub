-- Phase 1 Stage 5: let active coaches read records for their actively
-- assigned riders. Existing read paths and every write policy remain intact.
begin;

create or replace function private.can_read_rider(
  p_organization_id uuid,
  p_rider_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    p_rider_id = (select auth.uid())
    or exists (
      select 1
      from public.guardian_riders as link
      where link.organization_id = p_organization_id
        and link.guardian_id = (select auth.uid())
        and link.rider_id = p_rider_id
        and link.active
    )
    or exists (
      select 1
      from public.coach_rider_assignments as assignment
      where assignment.organization_id = p_organization_id
        and assignment.coach_id = (select auth.uid())
        and assignment.rider_id = p_rider_id
        and assignment.active
        and private.has_organization_role(
          assignment.organization_id,
          array['coach']
        )
    )
    or private.is_platform_admin()
    or private.has_organization_role(
      p_organization_id,
      array['academy_admin', 'stable_manager']
    );
$$;

revoke all on function private.can_read_rider(uuid, uuid) from public, anon;
grant execute on function private.can_read_rider(uuid, uuid) to authenticated;

commit;
