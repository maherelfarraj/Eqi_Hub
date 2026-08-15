-- Roll back Batch 3 guardian view foundation without changing prior rider data.
begin;

drop function if exists public.get_guardian_portal(uuid, uuid);
drop function if exists public.respond_guardian_approval(uuid, text, text);

drop trigger if exists guardian_approval_audit on public.guardian_approval_requests;
drop trigger if exists guardian_relationship_audit on public.guardian_riders;
drop trigger if exists guardian_approval_response_prepare on public.guardian_approval_requests;
drop trigger if exists guardian_approval_request_prepare on public.guardian_approval_requests;

drop function if exists private.log_guardian_portal_access(uuid, uuid);
drop function if exists private.audit_guardian_approval();
drop function if exists private.audit_guardian_relationship();
drop function if exists private.prepare_guardian_approval_response();
drop function if exists private.prepare_guardian_approval_request();
drop function if exists private.guardian_can_approve(uuid, uuid, uuid, text);
drop function if exists private.guardian_permission_allows(public.guardian_riders, text);

drop table if exists public.guardian_access_events;
drop table if exists public.guardian_approval_requests;

drop policy if exists invoices_select_own_or_financial_guardian on public.invoices;
create policy invoices_select_own
on public.invoices for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists guardian_riders_select_authorized on public.guardian_riders;
create policy guardian_riders_select_authorized
on public.guardian_riders for select to authenticated
using (
  guardian_id = (select auth.uid())
  or rider_id = (select auth.uid())
  or private.is_platform_admin()
  or private.has_organization_role(
    organization_id, array['academy_admin', 'stable_manager']
  )
);

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
          assignment.organization_id, array['coach']
        )
    )
    or private.is_platform_admin()
    or private.has_organization_role(
      p_organization_id, array['academy_admin', 'stable_manager']
    );
$$;

drop function if exists private.can_guardian_access_rider(uuid, uuid, uuid);

alter table public.guardian_riders
  drop constraint if exists guardian_riders_revocation_reason_length,
  drop constraint if exists guardian_riders_supporter_permissions_check,
  drop constraint if exists guardian_riders_access_state_check,
  drop constraint if exists guardian_riders_verification_status_check,
  drop constraint if exists guardian_riders_relationship_type_check,
  drop column if exists revocation_reason,
  drop column if exists revoked_at,
  drop column if exists revoked_by,
  drop column if exists verified_at,
  drop column if exists verified_by,
  drop column if exists adulthood_review_on,
  drop column if exists access_expires_at,
  drop column if exists can_approve_supervised_jumping,
  drop column if exists can_approve_video_ai,
  drop column if exists can_approve_horse_registration,
  drop column if exists can_approve_purchases,
  drop column if exists can_view_financials,
  drop column if exists verification_status,
  drop column if exists legal_authority,
  drop column if exists relationship_type;

revoke all on function private.can_read_rider(uuid, uuid) from public, anon;
grant execute on function private.can_read_rider(uuid, uuid) to authenticated;

commit;
