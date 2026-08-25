-- Forward-only review hardening for databases where Batch 3, 4, or 6 has already been applied.
-- This migration changes authorization and response shaping only; it does not enable a feature or mutate records.
begin;

create or replace function public.get_academy_operations_workspace(p_organization_id uuid)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
begin
  perform private.assert_academy_operations_access(p_organization_id);
  return jsonb_build_object(
    'staffProfiles', coalesce((select jsonb_agg((to_jsonb(v) - 'private_note') order by v.display_name_en) from public.academy_staff_profiles v where v.organization_id = p_organization_id), '[]'::jsonb),
    'availability', coalesce((select jsonb_agg(to_jsonb(v) order by v.starts_at) from public.academy_staff_availability v where v.organization_id = p_organization_id), '[]'::jsonb),
    'shifts', coalesce((select jsonb_agg((to_jsonb(v) - 'private_note') order by v.starts_at) from public.academy_staff_shifts v where v.organization_id = p_organization_id), '[]'::jsonb),
    'leave', coalesce((select jsonb_agg(to_jsonb(v) order by v.starts_at) from public.academy_staff_leave v where v.organization_id = p_organization_id), '[]'::jsonb),
    'coachAllocations', coalesce((select jsonb_agg(to_jsonb(v) order by v.starts_at) from public.academy_coach_allocations v where v.organization_id = p_organization_id), '[]'::jsonb),
    'resources', coalesce((select jsonb_agg(to_jsonb(v) order by v.name_en) from public.academy_resources v where v.organization_id = p_organization_id), '[]'::jsonb),
    'bookings', coalesce((select jsonb_agg(to_jsonb(v) order by v.starts_at) from public.academy_resource_bookings v where v.organization_id = p_organization_id), '[]'::jsonb),
    'lessonCapacity', coalesce((select jsonb_agg(to_jsonb(v)) from public.academy_lesson_capacity_controls v where v.organization_id = p_organization_id), '[]'::jsonb),
    'inspections', coalesce((select jsonb_agg((to_jsonb(v) - 'private_note') order by v.inspected_at desc) from public.academy_facility_inspections v where v.organization_id = p_organization_id), '[]'::jsonb),
    'workOrders', coalesce((select jsonb_agg((to_jsonb(v) - 'private_note') order by v.due_at nulls last) from public.academy_maintenance_work_orders v where v.organization_id = p_organization_id), '[]'::jsonb),
    'alerts', coalesce((select jsonb_agg(to_jsonb(v) order by v.created_at desc) from public.academy_operations_alerts v where v.organization_id = p_organization_id), '[]'::jsonb),
    'payroll', case when private.can_view_academy_compensation(p_organization_id) then coalesce((select jsonb_agg((to_jsonb(v) - 'private_note') order by v.period_end desc) from public.academy_payroll_calculations v where v.organization_id = p_organization_id), '[]'::jsonb) else '[]'::jsonb end,
    'commissions', case when private.can_view_academy_compensation(p_organization_id) then coalesce((select jsonb_agg((to_jsonb(v) - 'private_note') order by v.period_end desc) from public.academy_commission_calculations v where v.organization_id = p_organization_id), '[]'::jsonb) else '[]'::jsonb end
  );
end;
$$;

create or replace function private.can_manage_competition_calendar(p_organization_id uuid)
returns boolean language sql stable security definer set search_path = public, private
as $$ select private.competition_development_enabled(p_organization_id)
  and (private.is_platform_admin() or private.has_organization_role(p_organization_id, array['academy_admin', 'stable_manager', 'competition_manager'])); $$;

create or replace function private.can_manage_competition_development(p_organization_id uuid, p_rider_id uuid)
returns boolean language sql stable security definer set search_path = public, private
as $$ select private.competition_development_enabled(p_organization_id)
  and (private.is_platform_admin()
    or private.has_organization_role(p_organization_id, array['academy_admin', 'stable_manager', 'competition_manager'])
    or (private.has_organization_role(p_organization_id, array['coach'])
      and exists (select 1 from public.coach_rider_assignments assignment where assignment.organization_id = p_organization_id and assignment.coach_id = auth.uid() and assignment.rider_id = p_rider_id and assignment.active and assignment.starts_on <= current_date and (assignment.ends_on is null or assignment.ends_on >= current_date)))); $$;

create or replace function private.can_view_competition_rider(p_organization_id uuid, p_rider_id uuid)
returns boolean language sql stable security definer set search_path = public, private
as $$ select private.competition_development_enabled(p_organization_id)
  and (private.can_manage_competition_development(p_organization_id, p_rider_id)
    or p_rider_id = auth.uid()
    or private.can_guardian_access_rider(p_organization_id, auth.uid(), p_rider_id)); $$;

create or replace function private.can_view_competition_costs(p_organization_id uuid, p_rider_id uuid)
returns boolean language sql stable security definer set search_path = public, private
as $$ select private.can_manage_competition_development(p_organization_id, p_rider_id)
  or private.has_organization_role(p_organization_id, array['accountant'])
  or exists (select 1 from public.guardian_riders link where link.organization_id = p_organization_id and link.guardian_id = auth.uid() and link.rider_id = p_rider_id and link.active and link.verification_status = 'verified' and link.can_view_financials and private.can_guardian_access_rider(p_organization_id, auth.uid(), p_rider_id)); $$;

revoke all on function private.can_manage_competition_calendar(uuid) from public, anon, authenticated;
revoke all on function private.can_manage_competition_development(uuid, uuid) from public, anon, authenticated;
revoke all on function private.can_view_competition_rider(uuid, uuid) from public, anon, authenticated;
revoke all on function private.can_view_competition_costs(uuid, uuid) from public, anon, authenticated;

revoke all on function private.video_release_3_enabled(uuid) from public, anon, authenticated;
revoke all on function private.can_manage_video_release_3(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function private.video_release_3_approved_session(uuid, uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function private.video_release_3_approved_revision(uuid, uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function private.video_release_3_audit(uuid, uuid, text, uuid, text, jsonb) from public, anon, authenticated;
revoke all on function private.video_release_3_plan_visible(public.video_release_3_training_plans) from public, anon, authenticated;

commit;