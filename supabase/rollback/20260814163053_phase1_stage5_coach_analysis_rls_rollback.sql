-- Restore the pre-Stage 5 linked-persona helper without coach assignments.
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
    or private.is_platform_admin()
    or private.has_organization_role(
      p_organization_id,
      array['academy_admin', 'stable_manager']
    );
$$;

revoke all on function private.can_read_rider(uuid, uuid) from public, anon;
grant execute on function private.can_read_rider(uuid, uuid) to authenticated;

commit;
