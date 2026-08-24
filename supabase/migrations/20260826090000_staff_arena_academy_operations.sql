-- Batch 6: Staff, Arena & Academy Operations.
-- Additive, default-off, organization-scoped operations and approval-only compensation foundations.
-- No payment processing, disbursement, tax calculation, or Rider/Guardian access.
begin;

create table public.academy_operations_feature_flags (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.academy_operations_feature_flags (organization_id)
select organization_id from public.organization_memberships
where organization_id is not null
on conflict (organization_id) do nothing;

create table public.academy_staff_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  staff_type text not null,
  display_name_en text not null,
  display_name_ar text not null,
  active boolean not null default true,
  private_note text,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  unique (organization_id, user_id),
  check (staff_type in ('coach', 'instructor', 'yard_staff', 'facility_staff', 'administrator')),
  check (char_length(btrim(display_name_en)) between 2 and 240),
  check (char_length(btrim(display_name_ar)) between 2 and 240),
  check (private_note is null or char_length(btrim(private_note)) <= 4000)
);

create table public.academy_staff_availability (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  staff_profile_id uuid not null,
  availability_state text not null default 'available',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  note_en text,
  note_ar text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (staff_profile_id, organization_id)
    references public.academy_staff_profiles(id, organization_id) on delete cascade,
  check (availability_state in ('available', 'limited', 'unavailable')),
  check (ends_at > starts_at),
  check ((note_en is null or char_length(btrim(note_en)) <= 1000) and (note_ar is null or char_length(btrim(note_ar)) <= 1000))
);

create table public.academy_staff_shifts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  staff_profile_id uuid not null,
  status text not null default 'scheduled',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  duties_en text not null,
  duties_ar text not null,
  private_note text,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (staff_profile_id, organization_id)
    references public.academy_staff_profiles(id, organization_id) on delete cascade,
  check (status in ('scheduled', 'confirmed', 'completed', 'cancelled')),
  check (ends_at > starts_at),
  check (char_length(btrim(duties_en)) between 3 and 4000),
  check (char_length(btrim(duties_ar)) between 3 and 4000),
  check (private_note is null or char_length(btrim(private_note)) <= 4000)
);

create table public.academy_staff_leave (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  staff_profile_id uuid not null,
  status text not null default 'requested',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason_en text not null,
  reason_ar text not null,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (staff_profile_id, organization_id)
    references public.academy_staff_profiles(id, organization_id) on delete cascade,
  check (status in ('requested', 'approved', 'declined', 'cancelled')),
  check (ends_at > starts_at),
  check (char_length(btrim(reason_en)) between 3 and 2000),
  check (char_length(btrim(reason_ar)) between 3 and 2000),
  check ((status = 'requested' and reviewed_by is null and reviewed_at is null) or (status <> 'requested' and reviewed_by is not null and reviewed_at is not null))
);

create table public.academy_coach_allocations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  coach_staff_profile_id uuid not null,
  rider_id uuid not null references public.profiles(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz,
  status text not null default 'active',
  allocation_note_en text not null,
  allocation_note_ar text not null,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (coach_staff_profile_id, organization_id)
    references public.academy_staff_profiles(id, organization_id) on delete cascade,
  check (status in ('active', 'paused', 'ended')),
  check (ends_at is null or ends_at > starts_at),
  check (char_length(btrim(allocation_note_en)) between 3 and 2000),
  check (char_length(btrim(allocation_note_ar)) between 3 and 2000)
);

create table public.academy_resources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  resource_type text not null,
  name_en text not null,
  name_ar text not null,
  capacity integer not null default 1,
  active boolean not null default true,
  details_en text,
  details_ar text,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  unique (organization_id, resource_type, name_en),
  check (resource_type in ('arena', 'equipment')),
  check (capacity between 1 and 500),
  check ((details_en is null or char_length(btrim(details_en)) <= 2000) and (details_ar is null or char_length(btrim(details_ar)) <= 2000)),
  check (char_length(btrim(name_en)) between 2 and 240),
  check (char_length(btrim(name_ar)) between 2 and 240)
);

create table public.academy_resource_bookings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  resource_id uuid not null,
  staff_profile_id uuid,
  lesson_id uuid,
  status text not null default 'confirmed',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  purpose_en text not null,
  purpose_ar text not null,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (resource_id, organization_id)
    references public.academy_resources(id, organization_id) on delete cascade,
  foreign key (staff_profile_id, organization_id)
    references public.academy_staff_profiles(id, organization_id) on delete set null (staff_profile_id),
  check (status in ('tentative', 'confirmed', 'cancelled')),
  check (ends_at > starts_at),
  check (char_length(btrim(purpose_en)) between 3 and 2000),
  check (char_length(btrim(purpose_ar)) between 3 and 2000)
);

create table public.academy_lesson_capacity_controls (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lesson_id uuid not null,
  capacity integer not null,
  confirmed_count integer not null default 0,
  waitlist_count integer not null default 0,
  status text not null default 'open',
  note_en text,
  note_ar text,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, lesson_id),
  check (capacity between 1 and 200),
  check (confirmed_count between 0 and capacity),
  check (waitlist_count >= 0),
  check (status in ('open', 'waitlist', 'closed', 'cancelled')),
  check ((note_en is null or char_length(btrim(note_en)) <= 1000) and (note_ar is null or char_length(btrim(note_ar)) <= 1000))
);

create table public.academy_facility_inspections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  resource_id uuid,
  inspection_type text not null,
  inspected_at timestamptz not null default now(),
  result text not null default 'attention',
  findings_en text not null,
  findings_ar text not null,
  corrective_action_en text not null,
  corrective_action_ar text not null,
  next_due_at timestamptz,
  private_note text,
  inspected_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  foreign key (resource_id, organization_id)
    references public.academy_resources(id, organization_id) on delete set null (resource_id),
  check (inspection_type in ('arena', 'equipment', 'facility')),
  check (result in ('safe', 'attention', 'unsafe')),
  check (char_length(btrim(findings_en)) between 3 and 4000),
  check (char_length(btrim(findings_ar)) between 3 and 4000),
  check (char_length(btrim(corrective_action_en)) between 3 and 4000),
  check (char_length(btrim(corrective_action_ar)) between 3 and 4000),
  check (private_note is null or char_length(btrim(private_note)) <= 4000)
);

create table public.academy_maintenance_work_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  inspection_id uuid,
  resource_id uuid,
  priority text not null default 'normal',
  status text not null default 'open',
  title_en text not null,
  title_ar text not null,
  details_en text not null,
  details_ar text not null,
  due_at timestamptz,
  completed_at timestamptz,
  completed_by uuid references public.profiles(id) on delete set null,
  private_note text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (inspection_id, organization_id)
    references public.academy_facility_inspections(id, organization_id) on delete set null (inspection_id),
  foreign key (resource_id, organization_id)
    references public.academy_resources(id, organization_id) on delete set null (resource_id),
  check (priority in ('low', 'normal', 'high', 'urgent')),
  check (status in ('open', 'in_progress', 'completed', 'cancelled')),
  check ((status = 'completed' and completed_at is not null and completed_by is not null) or (status <> 'completed' and completed_at is null and completed_by is null)),
  check (char_length(btrim(title_en)) between 3 and 240),
  check (char_length(btrim(title_ar)) between 3 and 240),
  check (char_length(btrim(details_en)) between 3 and 4000),
  check (char_length(btrim(details_ar)) between 3 and 4000),
  check (private_note is null or char_length(btrim(private_note)) <= 4000)
);

create table public.academy_operations_alerts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  alert_type text not null,
  severity text not null default 'attention',
  status text not null default 'open',
  title_en text not null,
  title_ar text not null,
  body_en text not null,
  body_ar text not null,
  source_type text,
  source_id uuid,
  due_at timestamptz,
  acknowledged_by uuid references public.profiles(id) on delete set null,
  acknowledged_at timestamptz,
  resolved_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (alert_type in ('staffing', 'booking', 'capacity', 'inspection', 'maintenance', 'payroll', 'commission')),
  check (severity in ('attention', 'urgent', 'critical')),
  check (status in ('open', 'acknowledged', 'resolved')),
  check (char_length(btrim(title_en)) between 3 and 240),
  check (char_length(btrim(title_ar)) between 3 and 240),
  check (char_length(btrim(body_en)) between 3 and 4000),
  check (char_length(btrim(body_ar)) between 3 and 4000)
);

create table public.academy_payroll_calculations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  staff_profile_id uuid not null,
  period_start date not null,
  period_end date not null,
  currency text not null default 'USD',
  gross_amount numeric(12,2) not null default 0,
  adjustment_amount numeric(12,2) not null default 0,
  calculated_amount numeric(12,2) not null default 0,
  approval_status text not null default 'draft',
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  calculation_note_en text not null,
  calculation_note_ar text not null,
  private_note text,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (staff_profile_id, organization_id)
    references public.academy_staff_profiles(id, organization_id) on delete cascade,
  check (period_end >= period_start),
  check (currency ~ '^[A-Z]{3}$'),
  check (approval_status in ('draft', 'submitted', 'approved', 'rejected')),
  check ((approval_status = 'approved' and approved_by is not null and approved_at is not null) or (approval_status <> 'approved' and approved_by is null and approved_at is null)),
  check (char_length(btrim(calculation_note_en)) between 3 and 4000),
  check (char_length(btrim(calculation_note_ar)) between 3 and 4000),
  check (private_note is null or char_length(btrim(private_note)) <= 4000)
);

create table public.academy_commission_calculations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  staff_profile_id uuid not null,
  period_start date not null,
  period_end date not null,
  currency text not null default 'USD',
  basis_amount numeric(12,2) not null default 0,
  commission_rate numeric(5,2) not null default 0,
  calculated_amount numeric(12,2) not null default 0,
  approval_status text not null default 'draft',
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  calculation_note_en text not null,
  calculation_note_ar text not null,
  private_note text,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (staff_profile_id, organization_id)
    references public.academy_staff_profiles(id, organization_id) on delete cascade,
  check (period_end >= period_start),
  check (currency ~ '^[A-Z]{3}$'),
  check (commission_rate between 0 and 100),
  check (approval_status in ('draft', 'submitted', 'approved', 'rejected')),
  check ((approval_status = 'approved' and approved_by is not null and approved_at is not null) or (approval_status <> 'approved' and approved_by is null and approved_at is null)),
  check (char_length(btrim(calculation_note_en)) between 3 and 4000),
  check (char_length(btrim(calculation_note_ar)) between 3 and 4000),
  check (private_note is null or char_length(btrim(private_note)) <= 4000)
);

create table public.academy_operations_audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  actor_user_id uuid references public.profiles(id) on delete set null,
  before_data jsonb,
  after_data jsonb,
  occurred_at timestamptz not null default now(),
  check (entity_type in ('staff_profile', 'availability', 'shift', 'leave', 'coach_allocation', 'resource', 'booking', 'lesson_capacity', 'inspection', 'work_order', 'alert', 'payroll_calculation', 'commission_calculation')),
  check (action in ('created', 'updated', 'approved', 'acknowledged', 'resolved', 'completed'))
);

create index academy_staff_profiles_org_active_idx on public.academy_staff_profiles (organization_id, active, staff_type);
create index academy_staff_shifts_conflict_idx on public.academy_staff_shifts (organization_id, staff_profile_id, starts_at, ends_at) where status <> 'cancelled';
create index academy_resource_bookings_conflict_idx on public.academy_resource_bookings (organization_id, resource_id, starts_at, ends_at) where status <> 'cancelled';
create index academy_maintenance_work_orders_queue_idx on public.academy_maintenance_work_orders (organization_id, status, priority, due_at);
create index academy_operations_alerts_open_idx on public.academy_operations_alerts (organization_id, status, severity, due_at);
create index academy_operations_audit_idx on public.academy_operations_audit_events (organization_id, occurred_at desc);

create function private.academy_operations_enabled(p_organization_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select coalesce((select enabled from public.academy_operations_feature_flags where organization_id = p_organization_id), false);
$$;

create function private.can_manage_academy_operations(p_organization_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select private.academy_operations_enabled(p_organization_id)
    and (private.is_platform_admin() or private.has_organization_role(p_organization_id, array['academy_admin', 'stable_manager', 'coach']));
$$;

create function private.can_view_academy_compensation(p_organization_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select private.academy_operations_enabled(p_organization_id)
    and (private.is_platform_admin() or private.has_organization_role(p_organization_id, array['academy_admin', 'accountant']));
$$;

create function private.assert_academy_operations_access(p_organization_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not private.can_manage_academy_operations(p_organization_id) then
    raise exception 'academy operations access is restricted to authorized staff roles' using errcode = '42501';
  end if;
end;
$$;

create function private.assert_academy_compensation_access(p_organization_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not private.can_view_academy_compensation(p_organization_id) then
    raise exception 'academy compensation access is restricted to authorized financial roles' using errcode = '42501';
  end if;
end;
$$;

create function private.audit_academy_operations(p_organization_id uuid, p_entity_type text, p_entity_id uuid, p_action text, p_before jsonb default null, p_after jsonb default null)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.academy_operations_audit_events (organization_id, entity_type, entity_id, action, actor_user_id, before_data, after_data)
  values (p_organization_id, p_entity_type, p_entity_id, p_action, auth.uid(), p_before, p_after);
end;
$$;

create function private.assert_academy_operation_record_organization(p_organization_id uuid, p_entity_type text, p_entity_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_organization_id uuid;
begin
  if p_entity_id is null then return; end if;
  case p_entity_type
    when 'staff_profile' then select organization_id into v_organization_id from public.academy_staff_profiles where id = p_entity_id;
    when 'availability' then select organization_id into v_organization_id from public.academy_staff_availability where id = p_entity_id;
    when 'shift' then select organization_id into v_organization_id from public.academy_staff_shifts where id = p_entity_id;
    when 'leave' then select organization_id into v_organization_id from public.academy_staff_leave where id = p_entity_id;
    when 'coach_allocation' then select organization_id into v_organization_id from public.academy_coach_allocations where id = p_entity_id;
    when 'resource' then select organization_id into v_organization_id from public.academy_resources where id = p_entity_id;
    when 'booking' then select organization_id into v_organization_id from public.academy_resource_bookings where id = p_entity_id;
    when 'inspection' then select organization_id into v_organization_id from public.academy_facility_inspections where id = p_entity_id;
    when 'work_order' then select organization_id into v_organization_id from public.academy_maintenance_work_orders where id = p_entity_id;
    when 'payroll_calculation' then select organization_id into v_organization_id from public.academy_payroll_calculations where id = p_entity_id;
    when 'commission_calculation' then select organization_id into v_organization_id from public.academy_commission_calculations where id = p_entity_id;
    else raise exception 'unsupported academy operations entity type' using errcode = '22023';
  end case;
  if v_organization_id is not null and v_organization_id <> p_organization_id then
    raise exception 'academy operations record belongs to a different organization' using errcode = '42501';
  end if;
end;
$$;

create function public.get_academy_operations_access(p_organization_id uuid)
returns table (enabled boolean, can_manage boolean, can_view_compensation boolean, reason text)
language sql stable security definer set search_path = ''
as $$
  select private.academy_operations_enabled(p_organization_id),
    private.can_manage_academy_operations(p_organization_id),
    private.can_view_academy_compensation(p_organization_id),
    case when not private.academy_operations_enabled(p_organization_id) then 'feature_disabled'
         when not private.can_manage_academy_operations(p_organization_id) then 'staff_role_required'
         else 'authorized' end;
$$;

create function public.get_academy_operations_workspace(p_organization_id uuid)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
begin
  perform private.assert_academy_operations_access(p_organization_id);
  return jsonb_build_object(
    'staffProfiles', coalesce((select jsonb_agg(to_jsonb(v) order by v.display_name_en) from public.academy_staff_profiles v where v.organization_id = p_organization_id), '[]'::jsonb),
    'availability', coalesce((select jsonb_agg(to_jsonb(v) order by v.starts_at) from public.academy_staff_availability v where v.organization_id = p_organization_id), '[]'::jsonb),
    'shifts', coalesce((select jsonb_agg(to_jsonb(v) order by v.starts_at) from public.academy_staff_shifts v where v.organization_id = p_organization_id), '[]'::jsonb),
    'leave', coalesce((select jsonb_agg(to_jsonb(v) order by v.starts_at) from public.academy_staff_leave v where v.organization_id = p_organization_id), '[]'::jsonb),
    'coachAllocations', coalesce((select jsonb_agg(to_jsonb(v) order by v.starts_at) from public.academy_coach_allocations v where v.organization_id = p_organization_id), '[]'::jsonb),
    'resources', coalesce((select jsonb_agg(to_jsonb(v) order by v.name_en) from public.academy_resources v where v.organization_id = p_organization_id), '[]'::jsonb),
    'bookings', coalesce((select jsonb_agg(to_jsonb(v) order by v.starts_at) from public.academy_resource_bookings v where v.organization_id = p_organization_id), '[]'::jsonb),
    'lessonCapacity', coalesce((select jsonb_agg(to_jsonb(v)) from public.academy_lesson_capacity_controls v where v.organization_id = p_organization_id), '[]'::jsonb),
    'inspections', coalesce((select jsonb_agg(to_jsonb(v) order by v.inspected_at desc) from public.academy_facility_inspections v where v.organization_id = p_organization_id), '[]'::jsonb),
    'workOrders', coalesce((select jsonb_agg(to_jsonb(v) order by v.due_at nulls last) from public.academy_maintenance_work_orders v where v.organization_id = p_organization_id), '[]'::jsonb),
    'alerts', coalesce((select jsonb_agg(to_jsonb(v) order by v.created_at desc) from public.academy_operations_alerts v where v.organization_id = p_organization_id), '[]'::jsonb),
    'payroll', case when private.can_view_academy_compensation(p_organization_id) then coalesce((select jsonb_agg(to_jsonb(v) order by v.period_end desc) from public.academy_payroll_calculations v where v.organization_id = p_organization_id), '[]'::jsonb) else '[]'::jsonb end,
    'commissions', case when private.can_view_academy_compensation(p_organization_id) then coalesce((select jsonb_agg(to_jsonb(v) order by v.period_end desc) from public.academy_commission_calculations v where v.organization_id = p_organization_id), '[]'::jsonb) else '[]'::jsonb end
  );
end;
$$;

create function public.upsert_academy_staff_profile(p_organization_id uuid, p_staff_profile_id uuid, p_user_id uuid, p_staff_type text, p_display_name_en text, p_display_name_ar text, p_active boolean, p_private_note text default null)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_id uuid := coalesce(p_staff_profile_id, gen_random_uuid());
begin
  perform private.assert_academy_operations_access(p_organization_id);
  perform private.assert_academy_operation_record_organization(p_organization_id, 'staff_profile', p_staff_profile_id);
  insert into public.academy_staff_profiles (id, organization_id, user_id, staff_type, display_name_en, display_name_ar, active, private_note, created_by, updated_by)
  values (v_id, p_organization_id, p_user_id, p_staff_type, btrim(p_display_name_en), btrim(p_display_name_ar), p_active, nullif(btrim(p_private_note), ''), auth.uid(), auth.uid())
  on conflict (id) do update set staff_type = excluded.staff_type, display_name_en = excluded.display_name_en, display_name_ar = excluded.display_name_ar, active = excluded.active, private_note = excluded.private_note, updated_by = auth.uid(), updated_at = now()
  returning id into v_id;
  perform private.audit_academy_operations(p_organization_id, 'staff_profile', v_id, 'updated');
  return v_id;
end;
$$;

create function public.upsert_academy_staff_shift(p_organization_id uuid, p_shift_id uuid, p_staff_profile_id uuid, p_status text, p_starts_at timestamptz, p_ends_at timestamptz, p_duties_en text, p_duties_ar text, p_private_note text default null)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_id uuid := coalesce(p_shift_id, gen_random_uuid());
begin
  perform private.assert_academy_operations_access(p_organization_id);
  perform private.assert_academy_operation_record_organization(p_organization_id, 'shift', p_shift_id);
  if p_ends_at <= p_starts_at then raise exception 'shift end must be after start' using errcode = '22023'; end if;
  if exists (select 1 from public.academy_staff_shifts s where s.organization_id = p_organization_id and s.staff_profile_id = p_staff_profile_id and s.id <> v_id and s.status <> 'cancelled' and tstzrange(s.starts_at, s.ends_at, '[)') && tstzrange(p_starts_at, p_ends_at, '[)')) then raise exception 'staff shift conflicts with an existing shift' using errcode = '23P01'; end if;
  if exists (select 1 from public.academy_staff_leave l where l.organization_id = p_organization_id and l.staff_profile_id = p_staff_profile_id and l.status = 'approved' and tstzrange(l.starts_at, l.ends_at, '[)') && tstzrange(p_starts_at, p_ends_at, '[)')) then raise exception 'staff shift conflicts with approved leave' using errcode = '23P01'; end if;
  insert into public.academy_staff_shifts (id, organization_id, staff_profile_id, status, starts_at, ends_at, duties_en, duties_ar, private_note, created_by, updated_by)
  values (v_id, p_organization_id, p_staff_profile_id, p_status, p_starts_at, p_ends_at, btrim(p_duties_en), btrim(p_duties_ar), nullif(btrim(p_private_note), ''), auth.uid(), auth.uid())
  on conflict (id) do update set status = excluded.status, starts_at = excluded.starts_at, ends_at = excluded.ends_at, duties_en = excluded.duties_en, duties_ar = excluded.duties_ar, private_note = excluded.private_note, updated_by = auth.uid(), updated_at = now()
  returning id into v_id;
  perform private.audit_academy_operations(p_organization_id, 'shift', v_id, 'updated');
  return v_id;
end;
$$;

create function public.upsert_academy_staff_availability(p_organization_id uuid, p_availability_id uuid, p_staff_profile_id uuid, p_availability_state text, p_starts_at timestamptz, p_ends_at timestamptz, p_note_en text default null, p_note_ar text default null)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_id uuid := coalesce(p_availability_id, gen_random_uuid());
begin
  perform private.assert_academy_operations_access(p_organization_id);
  perform private.assert_academy_operation_record_organization(p_organization_id, 'availability', p_availability_id);
  if p_ends_at <= p_starts_at then raise exception 'availability end must be after start' using errcode = '22023'; end if;
  insert into public.academy_staff_availability (id, organization_id, staff_profile_id, availability_state, starts_at, ends_at, note_en, note_ar, created_by)
  values (v_id, p_organization_id, p_staff_profile_id, p_availability_state, p_starts_at, p_ends_at, nullif(btrim(p_note_en), ''), nullif(btrim(p_note_ar), ''), auth.uid())
  on conflict (id) do update set availability_state = excluded.availability_state, starts_at = excluded.starts_at, ends_at = excluded.ends_at, note_en = excluded.note_en, note_ar = excluded.note_ar, updated_at = now()
  returning id into v_id;
  perform private.audit_academy_operations(p_organization_id, 'availability', v_id, 'updated');
  return v_id;
end;
$$;

create function public.upsert_academy_staff_leave(p_organization_id uuid, p_leave_id uuid, p_staff_profile_id uuid, p_status text, p_starts_at timestamptz, p_ends_at timestamptz, p_reason_en text, p_reason_ar text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_id uuid := coalesce(p_leave_id, gen_random_uuid());
begin
  perform private.assert_academy_operations_access(p_organization_id);
  perform private.assert_academy_operation_record_organization(p_organization_id, 'leave', p_leave_id);
  if p_ends_at <= p_starts_at then raise exception 'leave end must be after start' using errcode = '22023'; end if;
  if p_status = 'approved' and exists (select 1 from public.academy_staff_shifts s where s.organization_id = p_organization_id and s.staff_profile_id = p_staff_profile_id and s.status <> 'cancelled' and tstzrange(s.starts_at, s.ends_at, '[)') && tstzrange(p_starts_at, p_ends_at, '[)')) then raise exception 'approved leave conflicts with an existing shift' using errcode = '23P01'; end if;
  insert into public.academy_staff_leave (id, organization_id, staff_profile_id, status, starts_at, ends_at, reason_en, reason_ar, reviewed_by, reviewed_at, created_by)
  values (v_id, p_organization_id, p_staff_profile_id, p_status, p_starts_at, p_ends_at, btrim(p_reason_en), btrim(p_reason_ar), case when p_status = 'requested' then null else auth.uid() end, case when p_status = 'requested' then null else now() end, auth.uid())
  on conflict (id) do update set status = excluded.status, starts_at = excluded.starts_at, ends_at = excluded.ends_at, reason_en = excluded.reason_en, reason_ar = excluded.reason_ar, reviewed_by = excluded.reviewed_by, reviewed_at = excluded.reviewed_at, updated_at = now()
  returning id into v_id;
  perform private.audit_academy_operations(p_organization_id, 'leave', v_id, case when p_status = 'approved' then 'approved' else 'updated' end);
  return v_id;
end;
$$;

create function public.upsert_academy_coach_allocation(p_organization_id uuid, p_allocation_id uuid, p_coach_staff_profile_id uuid, p_rider_id uuid, p_starts_at timestamptz, p_ends_at timestamptz, p_status text, p_allocation_note_en text, p_allocation_note_ar text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_id uuid := coalesce(p_allocation_id, gen_random_uuid());
begin
  perform private.assert_academy_operations_access(p_organization_id);
  perform private.assert_academy_operation_record_organization(p_organization_id, 'coach_allocation', p_allocation_id);
  if p_ends_at is not null and p_ends_at <= p_starts_at then raise exception 'allocation end must be after start' using errcode = '22023'; end if;
  if not exists (select 1 from public.academy_staff_profiles s where s.id = p_coach_staff_profile_id and s.organization_id = p_organization_id and s.active and s.staff_type in ('coach', 'instructor')) then raise exception 'an active coach or instructor profile is required' using errcode = '22023'; end if;
  insert into public.academy_coach_allocations (id, organization_id, coach_staff_profile_id, rider_id, starts_at, ends_at, status, allocation_note_en, allocation_note_ar, created_by, updated_by)
  values (v_id, p_organization_id, p_coach_staff_profile_id, p_rider_id, p_starts_at, p_ends_at, p_status, btrim(p_allocation_note_en), btrim(p_allocation_note_ar), auth.uid(), auth.uid())
  on conflict (id) do update set coach_staff_profile_id = excluded.coach_staff_profile_id, rider_id = excluded.rider_id, starts_at = excluded.starts_at, ends_at = excluded.ends_at, status = excluded.status, allocation_note_en = excluded.allocation_note_en, allocation_note_ar = excluded.allocation_note_ar, updated_by = auth.uid(), updated_at = now()
  returning id into v_id;
  perform private.audit_academy_operations(p_organization_id, 'coach_allocation', v_id, 'updated');
  return v_id;
end;
$$;

create function public.upsert_academy_resource(p_organization_id uuid, p_resource_id uuid, p_resource_type text, p_name_en text, p_name_ar text, p_capacity integer, p_active boolean, p_details_en text default null, p_details_ar text default null)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_id uuid := coalesce(p_resource_id, gen_random_uuid());
begin
  perform private.assert_academy_operations_access(p_organization_id);
  perform private.assert_academy_operation_record_organization(p_organization_id, 'resource', p_resource_id);
  insert into public.academy_resources (id, organization_id, resource_type, name_en, name_ar, capacity, active, details_en, details_ar, created_by, updated_by)
  values (v_id, p_organization_id, p_resource_type, btrim(p_name_en), btrim(p_name_ar), p_capacity, p_active, nullif(btrim(p_details_en), ''), nullif(btrim(p_details_ar), ''), auth.uid(), auth.uid())
  on conflict (id) do update set resource_type = excluded.resource_type, name_en = excluded.name_en, name_ar = excluded.name_ar, capacity = excluded.capacity, active = excluded.active, details_en = excluded.details_en, details_ar = excluded.details_ar, updated_by = auth.uid(), updated_at = now()
  returning id into v_id;
  perform private.audit_academy_operations(p_organization_id, 'resource', v_id, 'updated');
  return v_id;
end;
$$;

create function public.upsert_academy_resource_booking(p_organization_id uuid, p_booking_id uuid, p_resource_id uuid, p_staff_profile_id uuid, p_lesson_id uuid, p_status text, p_starts_at timestamptz, p_ends_at timestamptz, p_purpose_en text, p_purpose_ar text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_id uuid := coalesce(p_booking_id, gen_random_uuid());
begin
  perform private.assert_academy_operations_access(p_organization_id);
  perform private.assert_academy_operation_record_organization(p_organization_id, 'booking', p_booking_id);
  if p_ends_at <= p_starts_at then raise exception 'booking end must be after start' using errcode = '22023'; end if;
  if not exists (select 1 from public.academy_resources r where r.id = p_resource_id and r.organization_id = p_organization_id and r.active) then raise exception 'active resource was not found' using errcode = 'P0002'; end if;
  if exists (select 1 from public.academy_resource_bookings b where b.organization_id = p_organization_id and b.resource_id = p_resource_id and b.id <> v_id and b.status <> 'cancelled' and tstzrange(b.starts_at, b.ends_at, '[)') && tstzrange(p_starts_at, p_ends_at, '[)')) then raise exception 'resource booking conflicts with an existing booking' using errcode = '23P01'; end if;
  insert into public.academy_resource_bookings (id, organization_id, resource_id, staff_profile_id, lesson_id, status, starts_at, ends_at, purpose_en, purpose_ar, created_by, updated_by)
  values (v_id, p_organization_id, p_resource_id, p_staff_profile_id, p_lesson_id, p_status, p_starts_at, p_ends_at, btrim(p_purpose_en), btrim(p_purpose_ar), auth.uid(), auth.uid())
  on conflict (id) do update set resource_id = excluded.resource_id, staff_profile_id = excluded.staff_profile_id, lesson_id = excluded.lesson_id, status = excluded.status, starts_at = excluded.starts_at, ends_at = excluded.ends_at, purpose_en = excluded.purpose_en, purpose_ar = excluded.purpose_ar, updated_by = auth.uid(), updated_at = now()
  returning id into v_id;
  perform private.audit_academy_operations(p_organization_id, 'booking', v_id, 'updated');
  return v_id;
end;
$$;

create function public.upsert_academy_lesson_capacity(p_organization_id uuid, p_lesson_id uuid, p_capacity integer, p_confirmed_count integer, p_waitlist_count integer, p_status text, p_note_en text default null, p_note_ar text default null)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_id uuid;
begin
  perform private.assert_academy_operations_access(p_organization_id);
  if p_confirmed_count > p_capacity then raise exception 'confirmed lesson count exceeds capacity' using errcode = '23514'; end if;
  insert into public.academy_lesson_capacity_controls (organization_id, lesson_id, capacity, confirmed_count, waitlist_count, status, note_en, note_ar, created_by, updated_by)
  values (p_organization_id, p_lesson_id, p_capacity, p_confirmed_count, p_waitlist_count, p_status, nullif(btrim(p_note_en), ''), nullif(btrim(p_note_ar), ''), auth.uid(), auth.uid())
  on conflict (organization_id, lesson_id) do update set capacity = excluded.capacity, confirmed_count = excluded.confirmed_count, waitlist_count = excluded.waitlist_count, status = excluded.status, note_en = excluded.note_en, note_ar = excluded.note_ar, updated_by = auth.uid(), updated_at = now()
  returning id into v_id;
  perform private.audit_academy_operations(p_organization_id, 'lesson_capacity', v_id, 'updated');
  return v_id;
end;
$$;

create function public.upsert_academy_facility_inspection(p_organization_id uuid, p_inspection_id uuid, p_resource_id uuid, p_inspection_type text, p_inspected_at timestamptz, p_result text, p_findings_en text, p_findings_ar text, p_corrective_action_en text, p_corrective_action_ar text, p_next_due_at timestamptz default null, p_private_note text default null)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_id uuid := coalesce(p_inspection_id, gen_random_uuid());
begin
  perform private.assert_academy_operations_access(p_organization_id);
  perform private.assert_academy_operation_record_organization(p_organization_id, 'inspection', p_inspection_id);
  insert into public.academy_facility_inspections (id, organization_id, resource_id, inspection_type, inspected_at, result, findings_en, findings_ar, corrective_action_en, corrective_action_ar, next_due_at, private_note, inspected_by)
  values (v_id, p_organization_id, p_resource_id, p_inspection_type, p_inspected_at, p_result, btrim(p_findings_en), btrim(p_findings_ar), btrim(p_corrective_action_en), btrim(p_corrective_action_ar), p_next_due_at, nullif(btrim(p_private_note), ''), auth.uid())
  on conflict (id) do update set resource_id = excluded.resource_id, inspection_type = excluded.inspection_type, inspected_at = excluded.inspected_at, result = excluded.result, findings_en = excluded.findings_en, findings_ar = excluded.findings_ar, corrective_action_en = excluded.corrective_action_en, corrective_action_ar = excluded.corrective_action_ar, next_due_at = excluded.next_due_at, private_note = excluded.private_note, inspected_by = auth.uid(), updated_at = now()
  returning id into v_id;
  perform private.audit_academy_operations(p_organization_id, 'inspection', v_id, 'updated');
  return v_id;
end;
$$;

create function public.upsert_academy_maintenance_work_order(p_organization_id uuid, p_work_order_id uuid, p_inspection_id uuid, p_resource_id uuid, p_priority text, p_status text, p_title_en text, p_title_ar text, p_details_en text, p_details_ar text, p_due_at timestamptz default null, p_private_note text default null)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_id uuid := coalesce(p_work_order_id, gen_random_uuid());
begin
  perform private.assert_academy_operations_access(p_organization_id);
  perform private.assert_academy_operation_record_organization(p_organization_id, 'work_order', p_work_order_id);
  insert into public.academy_maintenance_work_orders (id, organization_id, inspection_id, resource_id, priority, status, title_en, title_ar, details_en, details_ar, due_at, completed_at, completed_by, private_note, created_by)
  values (v_id, p_organization_id, p_inspection_id, p_resource_id, p_priority, p_status, btrim(p_title_en), btrim(p_title_ar), btrim(p_details_en), btrim(p_details_ar), p_due_at, case when p_status = 'completed' then now() else null end, case when p_status = 'completed' then auth.uid() else null end, nullif(btrim(p_private_note), ''), auth.uid())
  on conflict (id) do update set inspection_id = excluded.inspection_id, resource_id = excluded.resource_id, priority = excluded.priority, status = excluded.status, title_en = excluded.title_en, title_ar = excluded.title_ar, details_en = excluded.details_en, details_ar = excluded.details_ar, due_at = excluded.due_at, completed_at = excluded.completed_at, completed_by = excluded.completed_by, private_note = excluded.private_note, updated_at = now()
  returning id into v_id;
  perform private.audit_academy_operations(p_organization_id, 'work_order', v_id, case when p_status = 'completed' then 'completed' else 'updated' end);
  return v_id;
end;
$$;

create function public.create_academy_operations_alert(p_organization_id uuid, p_alert_type text, p_severity text, p_title_en text, p_title_ar text, p_body_en text, p_body_ar text, p_source_type text default null, p_source_id uuid default null, p_due_at timestamptz default null)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_id uuid;
begin
  perform private.assert_academy_operations_access(p_organization_id);
  insert into public.academy_operations_alerts (organization_id, alert_type, severity, title_en, title_ar, body_en, body_ar, source_type, source_id, due_at, created_by)
  values (p_organization_id, p_alert_type, p_severity, btrim(p_title_en), btrim(p_title_ar), btrim(p_body_en), btrim(p_body_ar), nullif(btrim(p_source_type), ''), p_source_id, p_due_at, auth.uid())
  returning id into v_id;
  perform private.audit_academy_operations(p_organization_id, 'alert', v_id, 'created');
  return v_id;
end;
$$;

create function public.upsert_academy_payroll_calculation(p_organization_id uuid, p_calculation_id uuid, p_staff_profile_id uuid, p_period_start date, p_period_end date, p_currency text, p_gross_amount numeric, p_adjustment_amount numeric, p_calculated_amount numeric, p_approval_status text, p_calculation_note_en text, p_calculation_note_ar text, p_private_note text default null)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_id uuid := coalesce(p_calculation_id, gen_random_uuid()); v_existing_status text;
begin
  perform private.assert_academy_compensation_access(p_organization_id);
  perform private.assert_academy_operation_record_organization(p_organization_id, 'payroll_calculation', p_calculation_id);
  select approval_status into v_existing_status from public.academy_payroll_calculations where id = v_id and organization_id = p_organization_id for update;
  if v_existing_status = 'approved' then raise exception 'approved payroll calculations are immutable' using errcode = '42501'; end if;
  if p_approval_status = 'approved' then raise exception 'use the protected payroll approval action' using errcode = '42501'; end if;
  insert into public.academy_payroll_calculations (id, organization_id, staff_profile_id, period_start, period_end, currency, gross_amount, adjustment_amount, calculated_amount, approval_status, approved_by, approved_at, calculation_note_en, calculation_note_ar, private_note, created_by, updated_by)
  values (v_id, p_organization_id, p_staff_profile_id, p_period_start, p_period_end, upper(btrim(p_currency)), p_gross_amount, p_adjustment_amount, p_calculated_amount, p_approval_status, null, null, btrim(p_calculation_note_en), btrim(p_calculation_note_ar), nullif(btrim(p_private_note), ''), auth.uid(), auth.uid())
  on conflict (id) do update set gross_amount = excluded.gross_amount, adjustment_amount = excluded.adjustment_amount, calculated_amount = excluded.calculated_amount, approval_status = excluded.approval_status, approved_by = excluded.approved_by, approved_at = excluded.approved_at, calculation_note_en = excluded.calculation_note_en, calculation_note_ar = excluded.calculation_note_ar, private_note = excluded.private_note, updated_by = auth.uid(), updated_at = now()
  returning id into v_id;
  perform private.audit_academy_operations(p_organization_id, 'payroll_calculation', v_id, 'updated');
  return v_id;
end;
$$;

create function public.upsert_academy_commission_calculation(p_organization_id uuid, p_calculation_id uuid, p_staff_profile_id uuid, p_period_start date, p_period_end date, p_currency text, p_basis_amount numeric, p_commission_rate numeric, p_calculated_amount numeric, p_approval_status text, p_calculation_note_en text, p_calculation_note_ar text, p_private_note text default null)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_id uuid := coalesce(p_calculation_id, gen_random_uuid()); v_existing_status text;
begin
  perform private.assert_academy_compensation_access(p_organization_id);
  perform private.assert_academy_operation_record_organization(p_organization_id, 'commission_calculation', p_calculation_id);
  select approval_status into v_existing_status from public.academy_commission_calculations where id = v_id and organization_id = p_organization_id for update;
  if v_existing_status = 'approved' then raise exception 'approved commission calculations are immutable' using errcode = '42501'; end if;
  if p_approval_status = 'approved' then raise exception 'use the protected commission approval action' using errcode = '42501'; end if;
  insert into public.academy_commission_calculations (id, organization_id, staff_profile_id, period_start, period_end, currency, basis_amount, commission_rate, calculated_amount, approval_status, approved_by, approved_at, calculation_note_en, calculation_note_ar, private_note, created_by, updated_by)
  values (v_id, p_organization_id, p_staff_profile_id, p_period_start, p_period_end, upper(btrim(p_currency)), p_basis_amount, p_commission_rate, p_calculated_amount, p_approval_status, null, null, btrim(p_calculation_note_en), btrim(p_calculation_note_ar), nullif(btrim(p_private_note), ''), auth.uid(), auth.uid())
  on conflict (id) do update set basis_amount = excluded.basis_amount, commission_rate = excluded.commission_rate, calculated_amount = excluded.calculated_amount, approval_status = excluded.approval_status, approved_by = excluded.approved_by, approved_at = excluded.approved_at, calculation_note_en = excluded.calculation_note_en, calculation_note_ar = excluded.calculation_note_ar, private_note = excluded.private_note, updated_by = auth.uid(), updated_at = now()
  returning id into v_id;
  perform private.audit_academy_operations(p_organization_id, 'commission_calculation', v_id, 'updated');
  return v_id;
end;
$$;

create function public.approve_academy_payroll_calculation(p_organization_id uuid, p_calculation_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  perform private.assert_academy_compensation_access(p_organization_id);
  if not (private.is_platform_admin() or private.has_organization_role(p_organization_id, array['academy_admin'])) then raise exception 'only academy administrators may approve payroll calculations' using errcode = '42501'; end if;
  update public.academy_payroll_calculations set approval_status = 'approved', approved_by = auth.uid(), approved_at = now(), updated_by = auth.uid(), updated_at = now()
  where id = p_calculation_id and organization_id = p_organization_id and approval_status = 'submitted';
  if not found then raise exception 'only submitted payroll calculations may be approved' using errcode = 'P0002'; end if;
  perform private.audit_academy_operations(p_organization_id, 'payroll_calculation', p_calculation_id, 'approved');
end;
$$;

create function public.approve_academy_commission_calculation(p_organization_id uuid, p_calculation_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  perform private.assert_academy_compensation_access(p_organization_id);
  if not (private.is_platform_admin() or private.has_organization_role(p_organization_id, array['academy_admin'])) then raise exception 'only academy administrators may approve commission calculations' using errcode = '42501'; end if;
  update public.academy_commission_calculations set approval_status = 'approved', approved_by = auth.uid(), approved_at = now(), updated_by = auth.uid(), updated_at = now()
  where id = p_calculation_id and organization_id = p_organization_id and approval_status = 'submitted';
  if not found then raise exception 'only submitted commission calculations may be approved' using errcode = 'P0002'; end if;
  perform private.audit_academy_operations(p_organization_id, 'commission_calculation', p_calculation_id, 'approved');
end;
$$;

alter table public.academy_operations_feature_flags enable row level security;
alter table public.academy_staff_profiles enable row level security;
alter table public.academy_staff_availability enable row level security;
alter table public.academy_staff_shifts enable row level security;
alter table public.academy_staff_leave enable row level security;
alter table public.academy_coach_allocations enable row level security;
alter table public.academy_resources enable row level security;
alter table public.academy_resource_bookings enable row level security;
alter table public.academy_lesson_capacity_controls enable row level security;
alter table public.academy_facility_inspections enable row level security;
alter table public.academy_maintenance_work_orders enable row level security;
alter table public.academy_operations_alerts enable row level security;
alter table public.academy_payroll_calculations enable row level security;
alter table public.academy_commission_calculations enable row level security;
alter table public.academy_operations_audit_events enable row level security;

revoke all on table public.academy_operations_feature_flags from anon, authenticated;
revoke all on table public.academy_staff_profiles from anon, authenticated;
revoke all on table public.academy_staff_availability from anon, authenticated;
revoke all on table public.academy_staff_shifts from anon, authenticated;
revoke all on table public.academy_staff_leave from anon, authenticated;
revoke all on table public.academy_coach_allocations from anon, authenticated;
revoke all on table public.academy_resources from anon, authenticated;
revoke all on table public.academy_resource_bookings from anon, authenticated;
revoke all on table public.academy_lesson_capacity_controls from anon, authenticated;
revoke all on table public.academy_facility_inspections from anon, authenticated;
revoke all on table public.academy_maintenance_work_orders from anon, authenticated;
revoke all on table public.academy_operations_alerts from anon, authenticated;
revoke all on table public.academy_payroll_calculations from anon, authenticated;
revoke all on table public.academy_commission_calculations from anon, authenticated;
revoke all on table public.academy_operations_audit_events from anon, authenticated;
revoke all on function public.get_academy_operations_access(uuid) from public, anon;
revoke all on function public.get_academy_operations_workspace(uuid) from public, anon;
revoke all on function public.upsert_academy_staff_profile(uuid, uuid, uuid, text, text, text, boolean, text) from public, anon;
revoke all on function public.upsert_academy_staff_shift(uuid, uuid, uuid, text, timestamptz, timestamptz, text, text, text) from public, anon;
revoke all on function public.upsert_academy_staff_availability(uuid, uuid, uuid, text, timestamptz, timestamptz, text, text) from public, anon;
revoke all on function public.upsert_academy_staff_leave(uuid, uuid, uuid, text, timestamptz, timestamptz, text, text) from public, anon;
revoke all on function public.upsert_academy_coach_allocation(uuid, uuid, uuid, uuid, timestamptz, timestamptz, text, text, text) from public, anon;
revoke all on function public.upsert_academy_resource(uuid, uuid, text, text, text, integer, boolean, text, text) from public, anon;
revoke all on function public.upsert_academy_resource_booking(uuid, uuid, uuid, uuid, uuid, text, timestamptz, timestamptz, text, text) from public, anon;
revoke all on function public.upsert_academy_lesson_capacity(uuid, uuid, integer, integer, integer, text, text, text) from public, anon;
revoke all on function public.upsert_academy_facility_inspection(uuid, uuid, uuid, text, timestamptz, text, text, text, text, text, timestamptz, text) from public, anon;
revoke all on function public.upsert_academy_maintenance_work_order(uuid, uuid, uuid, uuid, text, text, text, text, text, text, timestamptz, text) from public, anon;
revoke all on function public.create_academy_operations_alert(uuid, text, text, text, text, text, text, text, uuid, timestamptz) from public, anon;
revoke all on function public.upsert_academy_payroll_calculation(uuid, uuid, uuid, date, date, text, numeric, numeric, numeric, text, text, text, text) from public, anon;
revoke all on function public.upsert_academy_commission_calculation(uuid, uuid, uuid, date, date, text, numeric, numeric, numeric, text, text, text, text) from public, anon;
revoke all on function public.approve_academy_payroll_calculation(uuid, uuid) from public, anon;
revoke all on function public.approve_academy_commission_calculation(uuid, uuid) from public, anon;
grant execute on function public.get_academy_operations_access(uuid) to authenticated;
grant execute on function public.get_academy_operations_workspace(uuid) to authenticated;
grant execute on function public.upsert_academy_staff_profile(uuid, uuid, uuid, text, text, text, boolean, text) to authenticated;
grant execute on function public.upsert_academy_staff_shift(uuid, uuid, uuid, text, timestamptz, timestamptz, text, text, text) to authenticated;
grant execute on function public.upsert_academy_staff_availability(uuid, uuid, uuid, text, timestamptz, timestamptz, text, text) to authenticated;
grant execute on function public.upsert_academy_staff_leave(uuid, uuid, uuid, text, timestamptz, timestamptz, text, text) to authenticated;
grant execute on function public.upsert_academy_coach_allocation(uuid, uuid, uuid, uuid, timestamptz, timestamptz, text, text, text) to authenticated;
grant execute on function public.upsert_academy_resource(uuid, uuid, text, text, text, integer, boolean, text, text) to authenticated;
grant execute on function public.upsert_academy_resource_booking(uuid, uuid, uuid, uuid, uuid, text, timestamptz, timestamptz, text, text) to authenticated;
grant execute on function public.upsert_academy_lesson_capacity(uuid, uuid, integer, integer, integer, text, text, text) to authenticated;
grant execute on function public.upsert_academy_facility_inspection(uuid, uuid, uuid, text, timestamptz, text, text, text, text, text, timestamptz, text) to authenticated;
grant execute on function public.upsert_academy_maintenance_work_order(uuid, uuid, uuid, uuid, text, text, text, text, text, text, timestamptz, text) to authenticated;
grant execute on function public.create_academy_operations_alert(uuid, text, text, text, text, text, text, text, uuid, timestamptz) to authenticated;
grant execute on function public.upsert_academy_payroll_calculation(uuid, uuid, uuid, date, date, text, numeric, numeric, numeric, text, text, text, text) to authenticated;
grant execute on function public.upsert_academy_commission_calculation(uuid, uuid, uuid, date, date, text, numeric, numeric, numeric, text, text, text, text) to authenticated;
grant execute on function public.approve_academy_payroll_calculation(uuid, uuid) to authenticated;
grant execute on function public.approve_academy_commission_calculation(uuid, uuid) to authenticated;

commit;