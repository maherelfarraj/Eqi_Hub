-- Batch 5: Horse Welfare & Stable Operations.
-- Additive, default-off, organization-scoped staff welfare records.
-- No rider/guardian access, automatic medical advice, or production activation.
begin;

create table public.horse_welfare_feature_flags (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.horse_welfare_feature_flags (organization_id)
select organization_id
from public.organization_memberships
where organization_id is not null
on conflict (organization_id) do nothing;

create table public.horse_welfare_profiles (
  horse_id uuid primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  welfare_status text not null default 'monitoring',
  rider_suitability text not null default 'restricted',
  daily_workload_limit_minutes integer not null default 360,
  body_condition_score numeric(2,1),
  suitability_note_en text,
  suitability_note_ar text,
  private_welfare_note text,
  approved boolean not null default false,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint horse_welfare_profiles_horse_organization_fkey
    foreign key (horse_id, organization_id)
    references public.horses(id, organization_id) on delete cascade,
  constraint horse_welfare_profiles_status_check
    check (welfare_status in ('well', 'monitoring', 'restricted', 'urgent')),
  constraint horse_welfare_profiles_suitability_check
    check (rider_suitability in ('suitable', 'restricted', 'not_suitable')),
  constraint horse_welfare_profiles_workload_check
    check (daily_workload_limit_minutes between 30 and 480),
  constraint horse_welfare_profiles_body_condition_check
    check (body_condition_score is null or body_condition_score between 1.0 and 9.0),
  constraint horse_welfare_profiles_notes_check
    check (
      (suitability_note_en is null or char_length(btrim(suitability_note_en)) <= 2000)
      and (suitability_note_ar is null or char_length(btrim(suitability_note_ar)) <= 2000)
      and (private_welfare_note is null or char_length(btrim(private_welfare_note)) <= 4000)
    ),
  constraint horse_welfare_profiles_approval_check
    check (
      (approved = false and approved_by is null and approved_at is null)
      or (approved = true and approved_by is not null and approved_at is not null)
    )
);

create table public.horse_feeding_plans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  horse_id uuid not null,
  status text not null default 'active',
  feed_name_en text not null,
  feed_name_ar text not null,
  instructions_en text not null,
  instructions_ar text not null,
  meals_per_day smallint not null default 2,
  amount_description_en text not null,
  amount_description_ar text not null,
  starts_on date not null default current_date,
  ends_on date,
  private_note text,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint horse_feeding_plans_horse_organization_fkey
    foreign key (horse_id, organization_id)
    references public.horses(id, organization_id) on delete cascade,
  constraint horse_feeding_plans_status_check
    check (status in ('active', 'paused', 'completed')),
  constraint horse_feeding_plans_meals_check
    check (meals_per_day between 1 and 8),
  constraint horse_feeding_plans_dates_check
    check (ends_on is null or ends_on >= starts_on),
  constraint horse_feeding_plans_bilingual_check
    check (
      char_length(btrim(feed_name_en)) between 2 and 240
      and char_length(btrim(feed_name_ar)) between 2 and 240
      and char_length(btrim(instructions_en)) between 3 and 4000
      and char_length(btrim(instructions_ar)) between 3 and 4000
      and char_length(btrim(amount_description_en)) between 1 and 500
      and char_length(btrim(amount_description_ar)) between 1 and 500
    ),
  constraint horse_feeding_plans_private_note_check
    check (private_note is null or char_length(btrim(private_note)) <= 4000)
);

create table public.horse_daily_care_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  horse_id uuid not null,
  care_date date not null default current_date,
  feed_checked boolean not null default false,
  water_checked boolean not null default false,
  turnout_checked boolean not null default false,
  grooming_checked boolean not null default false,
  tack_checked boolean not null default false,
  observation_en text,
  observation_ar text,
  private_note text,
  recorded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint horse_daily_care_logs_horse_organization_fkey
    foreign key (horse_id, organization_id)
    references public.horses(id, organization_id) on delete cascade,
  constraint horse_daily_care_logs_observation_check
    check (
      (observation_en is null or char_length(btrim(observation_en)) <= 4000)
      and (observation_ar is null or char_length(btrim(observation_ar)) <= 4000)
      and (private_note is null or char_length(btrim(private_note)) <= 4000)
    ),
  constraint horse_daily_care_logs_unique_day unique (organization_id, horse_id, care_date)
);

create table public.horse_clinical_schedules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  horse_id uuid not null,
  schedule_type text not null,
  status text not null default 'scheduled',
  title_en text not null,
  title_ar text not null,
  provider_en text,
  provider_ar text,
  instructions_en text not null,
  instructions_ar text not null,
  due_at timestamptz not null,
  completed_at timestamptz,
  medication_name_en text,
  medication_name_ar text,
  dosage_en text,
  dosage_ar text,
  private_note text,
  created_by uuid references public.profiles(id) on delete set null,
  completed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint horse_clinical_schedules_horse_organization_fkey
    foreign key (horse_id, organization_id)
    references public.horses(id, organization_id) on delete cascade,
  constraint horse_clinical_schedules_type_check
    check (schedule_type in ('veterinary', 'farrier', 'vaccination', 'medication', 'treatment', 'appointment')),
  constraint horse_clinical_schedules_status_check
    check (status in ('scheduled', 'completed', 'cancelled')),
  constraint horse_clinical_schedules_completion_check
    check (
      (status = 'completed' and completed_at is not null and completed_by is not null)
      or (status <> 'completed' and completed_at is null and completed_by is null)
    ),
  constraint horse_clinical_schedules_bilingual_check
    check (
      char_length(btrim(title_en)) between 2 and 240
      and char_length(btrim(title_ar)) between 2 and 240
      and char_length(btrim(instructions_en)) between 3 and 4000
      and char_length(btrim(instructions_ar)) between 3 and 4000
      and (provider_en is null or char_length(btrim(provider_en)) <= 240)
      and (provider_ar is null or char_length(btrim(provider_ar)) <= 240)
      and (medication_name_en is null or char_length(btrim(medication_name_en)) <= 240)
      and (medication_name_ar is null or char_length(btrim(medication_name_ar)) <= 240)
      and (dosage_en is null or char_length(btrim(dosage_en)) <= 500)
      and (dosage_ar is null or char_length(btrim(dosage_ar)) <= 500)
    ),
  constraint horse_clinical_schedules_private_note_check
    check (private_note is null or char_length(btrim(private_note)) <= 4000)
);

create table public.horse_welfare_observations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  horse_id uuid not null,
  observed_at timestamptz not null default now(),
  category text not null,
  severity text not null default 'attention',
  status text not null default 'open',
  summary_en text not null,
  summary_ar text not null,
  action_taken_en text not null,
  action_taken_ar text not null,
  private_note text,
  observed_by uuid references public.profiles(id) on delete set null,
  resolved_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint horse_welfare_observations_horse_organization_fkey
    foreign key (horse_id, organization_id)
    references public.horses(id, organization_id) on delete cascade,
  constraint horse_welfare_observations_category_check
    check (category in ('demeanour', 'appetite', 'movement', 'condition', 'environment', 'other')),
  constraint horse_welfare_observations_severity_check
    check (severity in ('routine', 'attention', 'urgent', 'emergency')),
  constraint horse_welfare_observations_status_check
    check (status in ('open', 'acknowledged', 'resolved')),
  constraint horse_welfare_observations_resolution_check
    check (
      (status <> 'resolved' and resolved_by is null and resolved_at is null)
      or (status = 'resolved' and resolved_by is not null and resolved_at is not null)
    ),
  constraint horse_welfare_observations_bilingual_check
    check (
      char_length(btrim(summary_en)) between 3 and 4000
      and char_length(btrim(summary_ar)) between 3 and 4000
      and char_length(btrim(action_taken_en)) between 3 and 4000
      and char_length(btrim(action_taken_ar)) between 3 and 4000
    ),
  constraint horse_welfare_observations_private_note_check
    check (private_note is null or char_length(btrim(private_note)) <= 4000)
);

create table public.horse_emergency_protocols (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title_en text not null,
  title_ar text not null,
  trigger_en text not null,
  trigger_ar text not null,
  response_steps_en text not null,
  response_steps_ar text not null,
  contact_name_en text,
  contact_name_ar text,
  contact_phone text,
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint horse_emergency_protocols_bilingual_check
    check (
      char_length(btrim(title_en)) between 3 and 240
      and char_length(btrim(title_ar)) between 3 and 240
      and char_length(btrim(trigger_en)) between 3 and 2000
      and char_length(btrim(trigger_ar)) between 3 and 2000
      and char_length(btrim(response_steps_en)) between 3 and 8000
      and char_length(btrim(response_steps_ar)) between 3 and 8000
    ),
  constraint horse_emergency_protocols_contact_check
    check (contact_phone is null or char_length(btrim(contact_phone)) between 3 and 80),
  constraint horse_emergency_protocols_organization_id_unique
    unique (id, organization_id)
);

create table public.horse_welfare_incidents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  horse_id uuid not null,
  emergency_protocol_id uuid,
  occurred_at timestamptz not null default now(),
  incident_type text not null,
  severity text not null default 'attention',
  status text not null default 'open',
  summary_en text not null,
  summary_ar text not null,
  response_en text not null,
  response_ar text not null,
  private_note text,
  reported_by uuid references public.profiles(id) on delete set null,
  closed_by uuid references public.profiles(id) on delete set null,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint horse_welfare_incidents_horse_organization_fkey
    foreign key (horse_id, organization_id)
    references public.horses(id, organization_id) on delete cascade,
  constraint horse_welfare_incidents_protocol_organization_fkey
    foreign key (emergency_protocol_id, organization_id)
    references public.horse_emergency_protocols(id, organization_id)
    on delete set null (emergency_protocol_id),
  constraint horse_welfare_incidents_type_check
    check (incident_type in ('injury', 'illness', 'escape', 'fall', 'equipment', 'environment', 'other')),
  constraint horse_welfare_incidents_severity_check
    check (severity in ('attention', 'urgent', 'emergency')),
  constraint horse_welfare_incidents_status_check
    check (status in ('open', 'investigating', 'closed')),
  constraint horse_welfare_incidents_closure_check
    check (
      (status <> 'closed' and closed_by is null and closed_at is null)
      or (status = 'closed' and closed_by is not null and closed_at is not null)
    ),
  constraint horse_welfare_incidents_bilingual_check
    check (
      char_length(btrim(summary_en)) between 3 and 5000
      and char_length(btrim(summary_ar)) between 3 and 5000
      and char_length(btrim(response_en)) between 3 and 5000
      and char_length(btrim(response_ar)) between 3 and 5000
    ),
  constraint horse_welfare_incidents_private_note_check
    check (private_note is null or char_length(btrim(private_note)) <= 5000)
);

create table public.stable_safety_inspections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  facility_type text not null,
  asset_name_en text not null,
  asset_name_ar text not null,
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
  constraint stable_safety_inspections_type_check
    check (facility_type in ('arena', 'equipment')),
  constraint stable_safety_inspections_result_check
    check (result in ('safe', 'attention', 'unsafe')),
  constraint stable_safety_inspections_bilingual_check
    check (
      char_length(btrim(asset_name_en)) between 2 and 240
      and char_length(btrim(asset_name_ar)) between 2 and 240
      and char_length(btrim(findings_en)) between 3 and 4000
      and char_length(btrim(findings_ar)) between 3 and 4000
      and char_length(btrim(corrective_action_en)) between 3 and 4000
      and char_length(btrim(corrective_action_ar)) between 3 and 4000
    ),
  constraint stable_safety_inspections_private_note_check
    check (private_note is null or char_length(btrim(private_note)) <= 4000),
  constraint stable_safety_inspections_organization_id_unique
    unique (id, organization_id)
);

create table public.stable_maintenance_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  inspection_id uuid,
  facility_type text not null,
  asset_name_en text not null,
  asset_name_ar text not null,
  maintenance_type_en text not null,
  maintenance_type_ar text not null,
  status text not null default 'scheduled',
  due_at timestamptz not null,
  completed_at timestamptz,
  details_en text not null,
  details_ar text not null,
  private_note text,
  created_by uuid references public.profiles(id) on delete set null,
  completed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stable_maintenance_inspection_organization_fkey
    foreign key (inspection_id, organization_id)
    references public.stable_safety_inspections(id, organization_id)
    on delete set null (inspection_id),
  constraint stable_maintenance_type_check
    check (facility_type in ('arena', 'equipment')),
  constraint stable_maintenance_status_check
    check (status in ('scheduled', 'in_progress', 'completed', 'cancelled')),
  constraint stable_maintenance_completion_check
    check (
      (status = 'completed' and completed_at is not null and completed_by is not null)
      or (status <> 'completed' and completed_at is null and completed_by is null)
    ),
  constraint stable_maintenance_bilingual_check
    check (
      char_length(btrim(asset_name_en)) between 2 and 240
      and char_length(btrim(asset_name_ar)) between 2 and 240
      and char_length(btrim(maintenance_type_en)) between 2 and 240
      and char_length(btrim(maintenance_type_ar)) between 2 and 240
      and char_length(btrim(details_en)) between 3 and 4000
      and char_length(btrim(details_ar)) between 3 and 4000
    ),
  constraint stable_maintenance_private_note_check
    check (private_note is null or char_length(btrim(private_note)) <= 4000)
);

create table public.horse_welfare_alerts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  horse_id uuid,
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
  constraint horse_welfare_alerts_horse_organization_fkey
    foreign key (horse_id, organization_id)
    references public.horses(id, organization_id)
    on delete set null (horse_id),
  constraint horse_welfare_alerts_type_check
    check (alert_type in ('welfare', 'clinical', 'safety', 'maintenance', 'workload', 'care')),
  constraint horse_welfare_alerts_severity_check
    check (severity in ('attention', 'urgent', 'emergency')),
  constraint horse_welfare_alerts_status_check
    check (status in ('open', 'acknowledged', 'resolved')),
  constraint horse_welfare_alerts_ack_check
    check (
      (status = 'open' and acknowledged_by is null and acknowledged_at is null and resolved_by is null and resolved_at is null)
      or (status = 'acknowledged' and acknowledged_by is not null and acknowledged_at is not null and resolved_by is null and resolved_at is null)
      or (status = 'resolved' and resolved_by is not null and resolved_at is not null)
    ),
  constraint horse_welfare_alerts_bilingual_check
    check (
      char_length(btrim(title_en)) between 3 and 240
      and char_length(btrim(title_ar)) between 3 and 240
      and char_length(btrim(body_en)) between 3 and 4000
      and char_length(btrim(body_ar)) between 3 and 4000
    )
);

create table public.horse_welfare_audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  horse_id uuid references public.horses(id) on delete set null,
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  actor_user_id uuid references public.profiles(id) on delete set null,
  before_data jsonb,
  after_data jsonb,
  occurred_at timestamptz not null default now(),
  constraint horse_welfare_audit_entity_check
    check (entity_type in (
      'welfare_profile', 'feeding_plan', 'daily_care_log', 'clinical_schedule',
      'welfare_observation', 'emergency_protocol', 'welfare_incident',
      'safety_inspection', 'maintenance_record', 'welfare_alert'
    )),
  constraint horse_welfare_audit_action_check
    check (action in ('created', 'updated', 'acknowledged', 'resolved', 'completed'))
);

create index horse_welfare_profiles_org_status_idx
  on public.horse_welfare_profiles (organization_id, welfare_status, rider_suitability);
create index horse_feeding_plans_org_horse_status_idx
  on public.horse_feeding_plans (organization_id, horse_id, status, starts_on);
create index horse_daily_care_logs_org_date_idx
  on public.horse_daily_care_logs (organization_id, care_date desc);
create index horse_clinical_schedules_due_idx
  on public.horse_clinical_schedules (organization_id, status, due_at);
create index horse_welfare_observations_attention_idx
  on public.horse_welfare_observations (organization_id, status, severity, observed_at desc);
create index horse_welfare_incidents_open_idx
  on public.horse_welfare_incidents (organization_id, status, severity, occurred_at desc);
create unique index horse_emergency_protocols_org_title_idx
  on public.horse_emergency_protocols (organization_id, title_en);
create index stable_safety_inspections_due_idx
  on public.stable_safety_inspections (organization_id, result, next_due_at);
create index stable_maintenance_due_idx
  on public.stable_maintenance_records (organization_id, status, due_at);
create index horse_welfare_alerts_open_idx
  on public.horse_welfare_alerts (organization_id, status, severity, due_at);
create index horse_welfare_audit_history_idx
  on public.horse_welfare_audit_events (organization_id, horse_id, occurred_at desc);

comment on table public.horse_welfare_profiles is
  'Private welfare and suitability profile; never available to Riders or Guardians.';
comment on table public.horse_clinical_schedules is
  'Private clinical schedule records; this module stores operational records only and gives no medical advice.';
comment on table public.horse_welfare_audit_events is
  'Private staff-only audit history for horse welfare operations.';

create function private.horse_welfare_enabled(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select enabled
    from public.horse_welfare_feature_flags
    where organization_id = p_organization_id
  ), false);
$$;

create function private.can_manage_horse_welfare(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.horse_welfare_enabled(p_organization_id)
    and (
      private.is_platform_admin()
      or private.has_organization_role(
        p_organization_id, array['academy_admin', 'stable_manager', 'coach']
      )
    );
$$;

create function private.assert_horse_welfare_access(p_organization_id uuid, p_horse_id uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.can_manage_horse_welfare(p_organization_id) then
    raise exception 'horse welfare access is restricted to authorized academy roles'
      using errcode = '42501';
  end if;
  if p_horse_id is not null then
    perform private.lock_horse_operation(p_organization_id, p_horse_id);
    if not exists (
      select 1 from public.horses
      where id = p_horse_id and organization_id = p_organization_id
    ) then
      raise exception 'horse does not belong to this organization' using errcode = '23514';
    end if;
  end if;
end;
$$;

create function private.audit_horse_welfare(
  p_organization_id uuid,
  p_horse_id uuid,
  p_entity_type text,
  p_entity_id uuid,
  p_action text,
  p_before jsonb default null,
  p_after jsonb default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.horse_welfare_audit_events (
    organization_id, horse_id, entity_type, entity_id, action,
    actor_user_id, before_data, after_data
  )
  values (
    p_organization_id, p_horse_id, p_entity_type, p_entity_id, p_action,
    auth.uid(), p_before, p_after
  );
end;
$$;

create function public.get_horse_welfare_access(p_organization_id uuid)
returns table (
  enabled boolean,
  can_manage boolean,
  medical_role boolean,
  reason text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.horse_welfare_enabled(p_organization_id),
    private.can_manage_horse_welfare(p_organization_id),
    private.has_organization_role(
      p_organization_id, array['academy_admin', 'stable_manager', 'coach']
    ) or private.is_platform_admin(),
    case
      when not private.horse_welfare_enabled(p_organization_id) then 'feature_disabled'
      when not private.can_manage_horse_welfare(p_organization_id) then 'staff_role_required'
      else 'authorized'
    end;
$$;

create function public.get_horse_welfare_workspace(p_organization_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  perform private.assert_horse_welfare_access(p_organization_id);
  select jsonb_build_object(
    'horses', coalesce((
      select jsonb_agg(jsonb_build_object(
        'horse_id', horse.id, 'name', horse.name, 'breed', horse.breed, 'status', horse.status
      ) order by horse.name)
      from public.horses horse
      where horse.organization_id = p_organization_id
    ), '[]'::jsonb),
    'profiles', coalesce((
      select jsonb_agg(to_jsonb(profile) order by profile.updated_at desc)
      from public.horse_welfare_profiles profile
      where profile.organization_id = p_organization_id
    ), '[]'::jsonb),
    'feedingPlans', coalesce((
      select jsonb_agg(to_jsonb(plan) order by plan.starts_on desc)
      from public.horse_feeding_plans plan
      where plan.organization_id = p_organization_id
    ), '[]'::jsonb),
    'dailyCareLogs', coalesce((
      select jsonb_agg(to_jsonb(log) order by log.care_date desc)
      from public.horse_daily_care_logs log
      where log.organization_id = p_organization_id
        and log.care_date >= current_date - 30
    ), '[]'::jsonb),
    'clinicalSchedules', coalesce((
      select jsonb_agg(to_jsonb(schedule) order by schedule.due_at asc)
      from public.horse_clinical_schedules schedule
      where schedule.organization_id = p_organization_id
        and schedule.status <> 'cancelled'
    ), '[]'::jsonb),
    'observations', coalesce((
      select jsonb_agg(to_jsonb(observation) order by observation.observed_at desc)
      from public.horse_welfare_observations observation
      where observation.organization_id = p_organization_id
    ), '[]'::jsonb),
    'incidents', coalesce((
      select jsonb_agg(to_jsonb(incident) order by incident.occurred_at desc)
      from public.horse_welfare_incidents incident
      where incident.organization_id = p_organization_id
    ), '[]'::jsonb),
    'protocols', coalesce((
      select jsonb_agg(to_jsonb(protocol) order by protocol.title_en)
      from public.horse_emergency_protocols protocol
      where protocol.organization_id = p_organization_id
    ), '[]'::jsonb),
    'inspections', coalesce((
      select jsonb_agg(to_jsonb(inspection) order by inspection.inspected_at desc)
      from public.stable_safety_inspections inspection
      where inspection.organization_id = p_organization_id
    ), '[]'::jsonb),
    'maintenance', coalesce((
      select jsonb_agg(to_jsonb(record) order by record.due_at asc)
      from public.stable_maintenance_records record
      where record.organization_id = p_organization_id
    ), '[]'::jsonb),
    'alerts', coalesce((
      select jsonb_agg(to_jsonb(alert) order by alert.due_at nulls last, alert.created_at desc)
      from public.horse_welfare_alerts alert
      where alert.organization_id = p_organization_id
        and alert.status <> 'resolved'
    ), '[]'::jsonb),
    'auditEvents', coalesce((
      select jsonb_agg(to_jsonb(event) order by event.occurred_at desc)
      from (
        select *
        from public.horse_welfare_audit_events
        where organization_id = p_organization_id
        order by occurred_at desc
        limit 100
      ) event
    ), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;

create function public.upsert_horse_welfare_profile(
  p_organization_id uuid,
  p_horse_id uuid,
  p_welfare_status text,
  p_rider_suitability text,
  p_daily_workload_limit_minutes integer,
  p_body_condition_score numeric default null,
  p_suitability_note_en text default null,
  p_suitability_note_ar text default null,
  p_private_welfare_note text default null,
  p_approved boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform private.assert_horse_welfare_access(p_organization_id, p_horse_id);
  insert into public.horse_welfare_profiles (
    horse_id, organization_id, welfare_status, rider_suitability,
    daily_workload_limit_minutes, body_condition_score,
    suitability_note_en, suitability_note_ar, private_welfare_note,
    approved, approved_by, approved_at, created_by, updated_by, updated_at
  )
  values (
    p_horse_id, p_organization_id, p_welfare_status, p_rider_suitability,
    p_daily_workload_limit_minutes, p_body_condition_score,
    nullif(btrim(p_suitability_note_en), ''), nullif(btrim(p_suitability_note_ar), ''),
    nullif(btrim(p_private_welfare_note), ''), p_approved,
    case when p_approved then auth.uid() end, case when p_approved then now() end,
    auth.uid(), auth.uid(), now()
  )
  on conflict (horse_id) do update set
    welfare_status = excluded.welfare_status,
    rider_suitability = excluded.rider_suitability,
    daily_workload_limit_minutes = excluded.daily_workload_limit_minutes,
    body_condition_score = excluded.body_condition_score,
    suitability_note_en = excluded.suitability_note_en,
    suitability_note_ar = excluded.suitability_note_ar,
    private_welfare_note = excluded.private_welfare_note,
    approved = excluded.approved,
    approved_by = excluded.approved_by,
    approved_at = excluded.approved_at,
    updated_by = auth.uid(),
    updated_at = now()
  returning horse_id into v_id;
  perform private.audit_horse_welfare(
    p_organization_id, p_horse_id, 'welfare_profile', v_id, 'updated'
  );
  return v_id;
end;
$$;

create function public.upsert_horse_feeding_plan(
  p_organization_id uuid,
  p_horse_id uuid,
  p_plan_id uuid,
  p_status text,
  p_feed_name_en text,
  p_feed_name_ar text,
  p_instructions_en text,
  p_instructions_ar text,
  p_meals_per_day smallint,
  p_amount_description_en text,
  p_amount_description_ar text,
  p_starts_on date,
  p_ends_on date default null,
  p_private_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_id uuid;
begin
  perform private.assert_horse_welfare_access(p_organization_id, p_horse_id);
  if p_plan_id is not null and not exists (
    select 1 from public.horse_feeding_plans
    where id = p_plan_id and organization_id = p_organization_id and horse_id = p_horse_id
  ) then
    raise exception 'feeding plan is not in this organization' using errcode = '42501';
  end if;
  insert into public.horse_feeding_plans (
    id, organization_id, horse_id, status, feed_name_en, feed_name_ar,
    instructions_en, instructions_ar, meals_per_day, amount_description_en,
    amount_description_ar, starts_on, ends_on, private_note, created_by, updated_by, updated_at
  )
  values (
    coalesce(p_plan_id, gen_random_uuid()), p_organization_id, p_horse_id, p_status,
    btrim(p_feed_name_en), btrim(p_feed_name_ar), btrim(p_instructions_en), btrim(p_instructions_ar),
    p_meals_per_day, btrim(p_amount_description_en), btrim(p_amount_description_ar),
    p_starts_on, p_ends_on, nullif(btrim(p_private_note), ''), auth.uid(), auth.uid(), now()
  )
  on conflict (id) do update set
    status = excluded.status, feed_name_en = excluded.feed_name_en, feed_name_ar = excluded.feed_name_ar,
    instructions_en = excluded.instructions_en, instructions_ar = excluded.instructions_ar,
    meals_per_day = excluded.meals_per_day, amount_description_en = excluded.amount_description_en,
    amount_description_ar = excluded.amount_description_ar, starts_on = excluded.starts_on,
    ends_on = excluded.ends_on, private_note = excluded.private_note,
    updated_by = auth.uid(), updated_at = now()
  returning id into v_id;
  perform private.audit_horse_welfare(p_organization_id, p_horse_id, 'feeding_plan', v_id, 'updated');
  return v_id;
end;
$$;

create function public.upsert_horse_daily_care_log(
  p_organization_id uuid,
  p_horse_id uuid,
  p_care_date date,
  p_feed_checked boolean,
  p_water_checked boolean,
  p_turnout_checked boolean,
  p_grooming_checked boolean,
  p_tack_checked boolean,
  p_observation_en text default null,
  p_observation_ar text default null,
  p_private_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_id uuid;
begin
  perform private.assert_horse_welfare_access(p_organization_id, p_horse_id);
  insert into public.horse_daily_care_logs (
    organization_id, horse_id, care_date, feed_checked, water_checked,
    turnout_checked, grooming_checked, tack_checked, observation_en,
    observation_ar, private_note, recorded_by, updated_at
  )
  values (
    p_organization_id, p_horse_id, p_care_date, p_feed_checked, p_water_checked,
    p_turnout_checked, p_grooming_checked, p_tack_checked,
    nullif(btrim(p_observation_en), ''), nullif(btrim(p_observation_ar), ''),
    nullif(btrim(p_private_note), ''), auth.uid(), now()
  )
  on conflict (organization_id, horse_id, care_date) do update set
    feed_checked = excluded.feed_checked, water_checked = excluded.water_checked,
    turnout_checked = excluded.turnout_checked, grooming_checked = excluded.grooming_checked,
    tack_checked = excluded.tack_checked, observation_en = excluded.observation_en,
    observation_ar = excluded.observation_ar, private_note = excluded.private_note,
    recorded_by = auth.uid(), updated_at = now()
  returning id into v_id;
  perform private.audit_horse_welfare(p_organization_id, p_horse_id, 'daily_care_log', v_id, 'updated');
  return v_id;
end;
$$;

create function public.upsert_horse_clinical_schedule(
  p_organization_id uuid,
  p_horse_id uuid,
  p_schedule_id uuid,
  p_schedule_type text,
  p_status text,
  p_title_en text,
  p_title_ar text,
  p_provider_en text,
  p_provider_ar text,
  p_instructions_en text,
  p_instructions_ar text,
  p_due_at timestamptz,
  p_medication_name_en text default null,
  p_medication_name_ar text default null,
  p_dosage_en text default null,
  p_dosage_ar text default null,
  p_private_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_id uuid;
begin
  perform private.assert_horse_welfare_access(p_organization_id, p_horse_id);
  if p_schedule_id is not null and not exists (
    select 1 from public.horse_clinical_schedules
    where id = p_schedule_id and organization_id = p_organization_id and horse_id = p_horse_id
  ) then
    raise exception 'clinical schedule is not in this organization' using errcode = '42501';
  end if;
  insert into public.horse_clinical_schedules (
    id, organization_id, horse_id, schedule_type, status, title_en, title_ar,
    provider_en, provider_ar, instructions_en, instructions_ar, due_at,
    medication_name_en, medication_name_ar, dosage_en, dosage_ar, private_note,
    created_by, completed_by, completed_at, updated_at
  )
  values (
    coalesce(p_schedule_id, gen_random_uuid()), p_organization_id, p_horse_id, p_schedule_type, p_status,
    btrim(p_title_en), btrim(p_title_ar), nullif(btrim(p_provider_en), ''), nullif(btrim(p_provider_ar), ''),
    btrim(p_instructions_en), btrim(p_instructions_ar), p_due_at,
    nullif(btrim(p_medication_name_en), ''), nullif(btrim(p_medication_name_ar), ''),
    nullif(btrim(p_dosage_en), ''), nullif(btrim(p_dosage_ar), ''),
    nullif(btrim(p_private_note), ''), auth.uid(),
    case when p_status = 'completed' then auth.uid() end,
    case when p_status = 'completed' then now() end, now()
  )
  on conflict (id) do update set
    schedule_type = excluded.schedule_type, status = excluded.status, title_en = excluded.title_en,
    title_ar = excluded.title_ar, provider_en = excluded.provider_en, provider_ar = excluded.provider_ar,
    instructions_en = excluded.instructions_en, instructions_ar = excluded.instructions_ar,
    due_at = excluded.due_at, medication_name_en = excluded.medication_name_en,
    medication_name_ar = excluded.medication_name_ar, dosage_en = excluded.dosage_en,
    dosage_ar = excluded.dosage_ar, private_note = excluded.private_note,
    completed_by = case when excluded.status = 'completed' then coalesce(horse_clinical_schedules.completed_by, auth.uid()) else null end,
    completed_at = case when excluded.status = 'completed' then coalesce(horse_clinical_schedules.completed_at, now()) else null end,
    updated_at = now()
  returning id into v_id;
  perform private.audit_horse_welfare(p_organization_id, p_horse_id, 'clinical_schedule', v_id, 'updated');
  return v_id;
end;
$$;

create function public.record_horse_welfare_observation(
  p_organization_id uuid,
  p_horse_id uuid,
  p_category text,
  p_severity text,
  p_summary_en text,
  p_summary_ar text,
  p_action_taken_en text,
  p_action_taken_ar text,
  p_observed_at timestamptz default now(),
  p_private_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_id uuid;
begin
  perform private.assert_horse_welfare_access(p_organization_id, p_horse_id);
  insert into public.horse_welfare_observations (
    organization_id, horse_id, category, severity, summary_en, summary_ar,
    action_taken_en, action_taken_ar, observed_at, private_note, observed_by
  )
  values (
    p_organization_id, p_horse_id, p_category, p_severity, btrim(p_summary_en), btrim(p_summary_ar),
    btrim(p_action_taken_en), btrim(p_action_taken_ar), p_observed_at,
    nullif(btrim(p_private_note), ''), auth.uid()
  )
  returning id into v_id;
  perform private.audit_horse_welfare(p_organization_id, p_horse_id, 'welfare_observation', v_id, 'created');
  return v_id;
end;
$$;

create function public.resolve_horse_welfare_observation(
  p_organization_id uuid,
  p_observation_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_observation public.horse_welfare_observations;
begin
  select * into v_observation from public.horse_welfare_observations
  where id = p_observation_id and organization_id = p_organization_id;
  if v_observation.id is null then
    raise exception 'welfare observation was not found' using errcode = 'P0002';
  end if;
  perform private.assert_horse_welfare_access(p_organization_id, v_observation.horse_id);
  update public.horse_welfare_observations
  set status = p_status,
      resolved_by = case when p_status = 'resolved' then auth.uid() else null end,
      resolved_at = case when p_status = 'resolved' then now() else null end,
      updated_at = now()
  where id = p_observation_id;
  perform private.audit_horse_welfare(
    p_organization_id, v_observation.horse_id, 'welfare_observation', p_observation_id,
    case when p_status = 'resolved' then 'resolved' else 'acknowledged' end
  );
end;
$$;

create function public.upsert_horse_emergency_protocol(
  p_organization_id uuid,
  p_protocol_id uuid,
  p_title_en text,
  p_title_ar text,
  p_trigger_en text,
  p_trigger_ar text,
  p_response_steps_en text,
  p_response_steps_ar text,
  p_contact_name_en text default null,
  p_contact_name_ar text default null,
  p_contact_phone text default null,
  p_active boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_id uuid;
begin
  perform private.assert_horse_welfare_access(p_organization_id);
  if p_protocol_id is not null and not exists (
    select 1 from public.horse_emergency_protocols
    where id = p_protocol_id and organization_id = p_organization_id
  ) then
    raise exception 'emergency protocol is not in this organization' using errcode = '42501';
  end if;
  insert into public.horse_emergency_protocols (
    id, organization_id, title_en, title_ar, trigger_en, trigger_ar,
    response_steps_en, response_steps_ar, contact_name_en, contact_name_ar,
    contact_phone, active, created_by, updated_by, updated_at
  )
  values (
    coalesce(p_protocol_id, gen_random_uuid()), p_organization_id,
    btrim(p_title_en), btrim(p_title_ar), btrim(p_trigger_en), btrim(p_trigger_ar),
    btrim(p_response_steps_en), btrim(p_response_steps_ar), nullif(btrim(p_contact_name_en), ''),
    nullif(btrim(p_contact_name_ar), ''), nullif(btrim(p_contact_phone), ''), p_active,
    auth.uid(), auth.uid(), now()
  )
  on conflict (id) do update set
    title_en = excluded.title_en, title_ar = excluded.title_ar, trigger_en = excluded.trigger_en,
    trigger_ar = excluded.trigger_ar, response_steps_en = excluded.response_steps_en,
    response_steps_ar = excluded.response_steps_ar, contact_name_en = excluded.contact_name_en,
    contact_name_ar = excluded.contact_name_ar, contact_phone = excluded.contact_phone,
    active = excluded.active, updated_by = auth.uid(), updated_at = now()
  returning id into v_id;
  perform private.audit_horse_welfare(p_organization_id, null, 'emergency_protocol', v_id, 'updated');
  return v_id;
end;
$$;

create function public.record_horse_welfare_incident(
  p_organization_id uuid,
  p_horse_id uuid,
  p_emergency_protocol_id uuid,
  p_incident_type text,
  p_severity text,
  p_summary_en text,
  p_summary_ar text,
  p_response_en text,
  p_response_ar text,
  p_occurred_at timestamptz default now(),
  p_private_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_id uuid;
begin
  perform private.assert_horse_welfare_access(p_organization_id, p_horse_id);
  if p_emergency_protocol_id is not null and not exists (
    select 1 from public.horse_emergency_protocols
    where id = p_emergency_protocol_id and organization_id = p_organization_id
  ) then
    raise exception 'emergency protocol is not in this organization' using errcode = '42501';
  end if;
  insert into public.horse_welfare_incidents (
    organization_id, horse_id, emergency_protocol_id, incident_type, severity,
    summary_en, summary_ar, response_en, response_ar, occurred_at, private_note, reported_by
  )
  values (
    p_organization_id, p_horse_id, p_emergency_protocol_id, p_incident_type, p_severity,
    btrim(p_summary_en), btrim(p_summary_ar), btrim(p_response_en), btrim(p_response_ar),
    p_occurred_at, nullif(btrim(p_private_note), ''), auth.uid()
  )
  returning id into v_id;
  perform private.audit_horse_welfare(p_organization_id, p_horse_id, 'welfare_incident', v_id, 'created');
  return v_id;
end;
$$;

create function public.close_horse_welfare_incident(
  p_organization_id uuid,
  p_incident_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_incident public.horse_welfare_incidents;
begin
  select * into v_incident from public.horse_welfare_incidents
  where id = p_incident_id and organization_id = p_organization_id;
  if v_incident.id is null then
    raise exception 'welfare incident was not found' using errcode = 'P0002';
  end if;
  perform private.assert_horse_welfare_access(p_organization_id, v_incident.horse_id);
  update public.horse_welfare_incidents
  set status = p_status,
      closed_by = case when p_status = 'closed' then auth.uid() else null end,
      closed_at = case when p_status = 'closed' then now() else null end,
      updated_at = now()
  where id = p_incident_id;
  perform private.audit_horse_welfare(
    p_organization_id, v_incident.horse_id, 'welfare_incident', p_incident_id,
    case when p_status = 'closed' then 'resolved' else 'updated' end
  );
end;
$$;

create function public.upsert_stable_safety_inspection(
  p_organization_id uuid,
  p_inspection_id uuid,
  p_facility_type text,
  p_asset_name_en text,
  p_asset_name_ar text,
  p_result text,
  p_findings_en text,
  p_findings_ar text,
  p_corrective_action_en text,
  p_corrective_action_ar text,
  p_inspected_at timestamptz default now(),
  p_next_due_at timestamptz default null,
  p_private_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_id uuid;
begin
  perform private.assert_horse_welfare_access(p_organization_id);
  if p_inspection_id is not null and not exists (
    select 1 from public.stable_safety_inspections
    where id = p_inspection_id and organization_id = p_organization_id
  ) then
    raise exception 'safety inspection is not in this organization' using errcode = '42501';
  end if;
  insert into public.stable_safety_inspections (
    id, organization_id, facility_type, asset_name_en, asset_name_ar, result,
    findings_en, findings_ar, corrective_action_en, corrective_action_ar,
    inspected_at, next_due_at, private_note, inspected_by, updated_at
  )
  values (
    coalesce(p_inspection_id, gen_random_uuid()), p_organization_id, p_facility_type,
    btrim(p_asset_name_en), btrim(p_asset_name_ar), p_result, btrim(p_findings_en), btrim(p_findings_ar),
    btrim(p_corrective_action_en), btrim(p_corrective_action_ar), p_inspected_at, p_next_due_at,
    nullif(btrim(p_private_note), ''), auth.uid(), now()
  )
  on conflict (id) do update set
    facility_type = excluded.facility_type, asset_name_en = excluded.asset_name_en,
    asset_name_ar = excluded.asset_name_ar, result = excluded.result, findings_en = excluded.findings_en,
    findings_ar = excluded.findings_ar, corrective_action_en = excluded.corrective_action_en,
    corrective_action_ar = excluded.corrective_action_ar, inspected_at = excluded.inspected_at,
    next_due_at = excluded.next_due_at, private_note = excluded.private_note,
    inspected_by = auth.uid(), updated_at = now()
  returning id into v_id;
  perform private.audit_horse_welfare(p_organization_id, null, 'safety_inspection', v_id, 'updated');
  return v_id;
end;
$$;

create function public.upsert_stable_maintenance_record(
  p_organization_id uuid,
  p_record_id uuid,
  p_inspection_id uuid,
  p_facility_type text,
  p_asset_name_en text,
  p_asset_name_ar text,
  p_maintenance_type_en text,
  p_maintenance_type_ar text,
  p_status text,
  p_due_at timestamptz,
  p_details_en text,
  p_details_ar text,
  p_private_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_id uuid;
begin
  perform private.assert_horse_welfare_access(p_organization_id);
  if p_record_id is not null and not exists (
    select 1 from public.stable_maintenance_records
    where id = p_record_id and organization_id = p_organization_id
  ) then
    raise exception 'maintenance record is not in this organization' using errcode = '42501';
  end if;
  if p_inspection_id is not null and not exists (
    select 1 from public.stable_safety_inspections
    where id = p_inspection_id and organization_id = p_organization_id
  ) then
    raise exception 'safety inspection is not in this organization' using errcode = '42501';
  end if;
  insert into public.stable_maintenance_records (
    id, organization_id, inspection_id, facility_type, asset_name_en, asset_name_ar,
    maintenance_type_en, maintenance_type_ar, status, due_at, details_en, details_ar, private_note,
    created_by, completed_by, completed_at, updated_at
  )
  values (
    coalesce(p_record_id, gen_random_uuid()), p_organization_id, p_inspection_id, p_facility_type,
    btrim(p_asset_name_en), btrim(p_asset_name_ar), btrim(p_maintenance_type_en), btrim(p_maintenance_type_ar), p_status, p_due_at,
    btrim(p_details_en), btrim(p_details_ar), nullif(btrim(p_private_note), ''), auth.uid(),
    case when p_status = 'completed' then auth.uid() end,
    case when p_status = 'completed' then now() end, now()
  )
  on conflict (id) do update set
    inspection_id = excluded.inspection_id, facility_type = excluded.facility_type,
    asset_name_en = excluded.asset_name_en, asset_name_ar = excluded.asset_name_ar,
    maintenance_type_en = excluded.maintenance_type_en, maintenance_type_ar = excluded.maintenance_type_ar,
    status = excluded.status, due_at = excluded.due_at,
    details_en = excluded.details_en, details_ar = excluded.details_ar, private_note = excluded.private_note,
    completed_by = case when excluded.status = 'completed' then coalesce(stable_maintenance_records.completed_by, auth.uid()) else null end,
    completed_at = case when excluded.status = 'completed' then coalesce(stable_maintenance_records.completed_at, now()) else null end,
    updated_at = now()
  returning id into v_id;
  perform private.audit_horse_welfare(p_organization_id, null, 'maintenance_record', v_id, 'updated');
  return v_id;
end;
$$;

create function public.create_horse_welfare_alert(
  p_organization_id uuid,
  p_horse_id uuid,
  p_alert_type text,
  p_severity text,
  p_title_en text,
  p_title_ar text,
  p_body_en text,
  p_body_ar text,
  p_source_type text default null,
  p_source_id uuid default null,
  p_due_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_id uuid;
begin
  perform private.assert_horse_welfare_access(p_organization_id, p_horse_id);
  insert into public.horse_welfare_alerts (
    organization_id, horse_id, alert_type, severity, title_en, title_ar,
    body_en, body_ar, source_type, source_id, due_at, created_by
  )
  values (
    p_organization_id, p_horse_id, p_alert_type, p_severity, btrim(p_title_en), btrim(p_title_ar),
    btrim(p_body_en), btrim(p_body_ar), nullif(btrim(p_source_type), ''), p_source_id, p_due_at, auth.uid()
  )
  returning id into v_id;
  perform private.audit_horse_welfare(p_organization_id, p_horse_id, 'welfare_alert', v_id, 'created');
  return v_id;
end;
$$;

create function public.update_horse_welfare_alert(
  p_organization_id uuid,
  p_alert_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_alert public.horse_welfare_alerts;
begin
  select * into v_alert from public.horse_welfare_alerts
  where id = p_alert_id and organization_id = p_organization_id;
  if v_alert.id is null then
    raise exception 'welfare alert was not found' using errcode = 'P0002';
  end if;
  perform private.assert_horse_welfare_access(p_organization_id, v_alert.horse_id);
  update public.horse_welfare_alerts
  set status = p_status,
      acknowledged_by = case when p_status in ('acknowledged', 'resolved') then coalesce(acknowledged_by, auth.uid()) else null end,
      acknowledged_at = case when p_status in ('acknowledged', 'resolved') then coalesce(acknowledged_at, now()) else null end,
      resolved_by = case when p_status = 'resolved' then auth.uid() else null end,
      resolved_at = case when p_status = 'resolved' then now() else null end,
      updated_at = now()
  where id = p_alert_id;
  perform private.audit_horse_welfare(
    p_organization_id, v_alert.horse_id, 'welfare_alert', p_alert_id,
    case when p_status = 'resolved' then 'resolved' else 'acknowledged' end
  );
end;
$$;

alter table public.horse_welfare_feature_flags enable row level security;
alter table public.horse_welfare_profiles enable row level security;
alter table public.horse_feeding_plans enable row level security;
alter table public.horse_daily_care_logs enable row level security;
alter table public.horse_clinical_schedules enable row level security;
alter table public.horse_welfare_observations enable row level security;
alter table public.horse_emergency_protocols enable row level security;
alter table public.horse_welfare_incidents enable row level security;
alter table public.stable_safety_inspections enable row level security;
alter table public.stable_maintenance_records enable row level security;
alter table public.horse_welfare_alerts enable row level security;
alter table public.horse_welfare_audit_events enable row level security;

revoke all on table public.horse_welfare_feature_flags from anon, authenticated;
revoke all on table public.horse_welfare_profiles from anon, authenticated;
revoke all on table public.horse_feeding_plans from anon, authenticated;
revoke all on table public.horse_daily_care_logs from anon, authenticated;
revoke all on table public.horse_clinical_schedules from anon, authenticated;
revoke all on table public.horse_welfare_observations from anon, authenticated;
revoke all on table public.horse_emergency_protocols from anon, authenticated;
revoke all on table public.horse_welfare_incidents from anon, authenticated;
revoke all on table public.stable_safety_inspections from anon, authenticated;
revoke all on table public.stable_maintenance_records from anon, authenticated;
revoke all on table public.horse_welfare_alerts from anon, authenticated;
revoke all on table public.horse_welfare_audit_events from anon, authenticated;

revoke all on function public.get_horse_welfare_access(uuid) from public, anon;
revoke all on function public.get_horse_welfare_workspace(uuid) from public, anon;
revoke all on function public.upsert_horse_welfare_profile(uuid, uuid, text, text, integer, numeric, text, text, text, boolean) from public, anon;
revoke all on function public.upsert_horse_feeding_plan(uuid, uuid, uuid, text, text, text, text, text, smallint, text, text, date, date, text) from public, anon;
revoke all on function public.upsert_horse_daily_care_log(uuid, uuid, date, boolean, boolean, boolean, boolean, boolean, text, text, text) from public, anon;
revoke all on function public.upsert_horse_clinical_schedule(uuid, uuid, uuid, text, text, text, text, text, text, text, text, timestamptz, text, text, text, text, text) from public, anon;
revoke all on function public.record_horse_welfare_observation(uuid, uuid, text, text, text, text, text, text, timestamptz, text) from public, anon;
revoke all on function public.resolve_horse_welfare_observation(uuid, uuid, text) from public, anon;
revoke all on function public.upsert_horse_emergency_protocol(uuid, uuid, text, text, text, text, text, text, text, text, text, boolean) from public, anon;
revoke all on function public.record_horse_welfare_incident(uuid, uuid, uuid, text, text, text, text, text, text, timestamptz, text) from public, anon;
revoke all on function public.close_horse_welfare_incident(uuid, uuid, text) from public, anon;
revoke all on function public.upsert_stable_safety_inspection(uuid, uuid, text, text, text, text, text, text, text, text, timestamptz, timestamptz, text) from public, anon;
revoke all on function public.upsert_stable_maintenance_record(uuid, uuid, uuid, text, text, text, text, text, text, timestamptz, text, text, text) from public, anon;
revoke all on function public.create_horse_welfare_alert(uuid, uuid, text, text, text, text, text, text, text, uuid, timestamptz) from public, anon;
revoke all on function public.update_horse_welfare_alert(uuid, uuid, text) from public, anon;

grant execute on function public.get_horse_welfare_access(uuid) to authenticated;
grant execute on function public.get_horse_welfare_workspace(uuid) to authenticated;
grant execute on function public.upsert_horse_welfare_profile(uuid, uuid, text, text, integer, numeric, text, text, text, boolean) to authenticated;
grant execute on function public.upsert_horse_feeding_plan(uuid, uuid, uuid, text, text, text, text, text, smallint, text, text, date, date, text) to authenticated;
grant execute on function public.upsert_horse_daily_care_log(uuid, uuid, date, boolean, boolean, boolean, boolean, boolean, text, text, text) to authenticated;
grant execute on function public.upsert_horse_clinical_schedule(uuid, uuid, uuid, text, text, text, text, text, text, text, text, timestamptz, text, text, text, text, text) to authenticated;
grant execute on function public.record_horse_welfare_observation(uuid, uuid, text, text, text, text, text, text, timestamptz, text) to authenticated;
grant execute on function public.resolve_horse_welfare_observation(uuid, uuid, text) to authenticated;
grant execute on function public.upsert_horse_emergency_protocol(uuid, uuid, text, text, text, text, text, text, text, text, text, boolean) to authenticated;
grant execute on function public.record_horse_welfare_incident(uuid, uuid, uuid, text, text, text, text, text, text, timestamptz, text) to authenticated;
grant execute on function public.close_horse_welfare_incident(uuid, uuid, text) to authenticated;
grant execute on function public.upsert_stable_safety_inspection(uuid, uuid, text, text, text, text, text, text, text, text, timestamptz, timestamptz, text) to authenticated;
grant execute on function public.upsert_stable_maintenance_record(uuid, uuid, uuid, text, text, text, text, text, text, timestamptz, text, text, text) to authenticated;
grant execute on function public.create_horse_welfare_alert(uuid, uuid, text, text, text, text, text, text, text, uuid, timestamptz) to authenticated;
grant execute on function public.update_horse_welfare_alert(uuid, uuid, text) to authenticated;

commit;