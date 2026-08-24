-- Batch 4: non-production competition calendar and annual rider development.
-- Additive only. The module is default-off and never changes earlier releases.
begin;

create table public.competition_development_feature_flags (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  module_code text not null default 'competition_annual_rider_development',
  enabled boolean not null default false,
  enabled_by uuid references public.profiles(id) on delete set null,
  enabled_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint competition_development_feature_module_check
    check (module_code = 'competition_annual_rider_development'),
  constraint competition_development_feature_activation_check
    check ((enabled and enabled_by is not null and enabled_at is not null)
      or (not enabled))
);

create table public.competition_annual_plans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  rider_id uuid not null,
  coach_id uuid not null,
  plan_year integer not null,
  title text not null,
  goals_en text not null,
  goals_ar text not null,
  status text not null default 'draft',
  coach_signed_off boolean not null default false,
  coach_signed_off_by uuid references public.profiles(id) on delete restrict,
  coach_signed_off_at timestamptz,
  portal_visible boolean not null default false,
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, rider_id, plan_year),
  foreign key (organization_id, rider_id)
    references public.organization_memberships(organization_id, user_id) on delete restrict,
  foreign key (organization_id, coach_id)
    references public.organization_memberships(organization_id, user_id) on delete restrict,
  constraint competition_annual_plan_year_check check (plan_year between 2000 and 2100),
  constraint competition_annual_plan_title_check check (char_length(btrim(title)) between 3 and 160),
  constraint competition_annual_plan_goals_check check (
    char_length(btrim(goals_en)) between 10 and 4000
    and char_length(btrim(goals_ar)) between 10 and 4000
  ),
  constraint competition_annual_plan_status_check
    check (status in ('draft', 'active', 'completed', 'archived')),
  constraint competition_annual_plan_signoff_check check (
    (not coach_signed_off and coach_signed_off_by is null and coach_signed_off_at is null)
    or (coach_signed_off and coach_signed_off_by is not null and coach_signed_off_at is not null)
  ),
  constraint competition_annual_plan_visibility_check
    check (not portal_visible or (status in ('active', 'completed') and coach_signed_off))
);

create table public.competition_development_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  discipline text not null,
  venue text not null,
  starts_on date not null,
  ends_on date not null,
  entry_deadline date,
  status text not null default 'planned',
  portal_visible boolean not null default false,
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  constraint competition_event_name_check check (char_length(btrim(name)) between 3 and 180),
  constraint competition_event_discipline_check check (discipline in ('flatwork', 'show_jumping', 'dressage', 'eventing', 'other')),
  constraint competition_event_venue_check check (char_length(btrim(venue)) between 2 and 240),
  constraint competition_event_dates_check check (ends_on >= starts_on),
  constraint competition_event_deadline_check check (entry_deadline is null or entry_deadline <= starts_on),
  constraint competition_event_status_check check (status in ('planned', 'confirmed', 'completed', 'cancelled')),
  constraint competition_event_visibility_check check (not portal_visible or status <> 'cancelled')
);

create table public.competition_development_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  competition_id uuid not null,
  plan_id uuid,
  rider_id uuid not null,
  coach_id uuid not null,
  horse_id uuid,
  class_name text not null,
  target_family text not null,
  target_level smallint not null,
  status text not null default 'draft',
  coach_signed_off boolean not null default false,
  coach_signed_off_by uuid references public.profiles(id) on delete restrict,
  coach_signed_off_at timestamptz,
  portal_visible boolean not null default false,
  entry_reference text,
  notes text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, competition_id)
    references public.competition_development_events(organization_id, id) on delete restrict,
  foreign key (organization_id, plan_id)
    references public.competition_annual_plans(organization_id, id) on delete set null,
  foreign key (organization_id, rider_id)
    references public.organization_memberships(organization_id, user_id) on delete restrict,
  foreign key (organization_id, coach_id)
    references public.organization_memberships(organization_id, user_id) on delete restrict,
  foreign key (horse_id, organization_id)
    references public.horses(id, organization_id) on delete set null,
  constraint competition_entry_class_check check (char_length(btrim(class_name)) between 2 and 160),
  constraint competition_entry_target_family_check check (target_family in ('foundation', 'show_jumping')),
  constraint competition_entry_target_level_check check (
    (target_family = 'foundation' and target_level between 1 and 10)
    or (target_family = 'show_jumping' and target_level between 1 and 5)
  ),
  constraint competition_entry_status_check
    check (status in ('draft', 'requested', 'approved', 'entered', 'withdrawn', 'completed')),
  constraint competition_entry_signoff_check check (
    (not coach_signed_off and coach_signed_off_by is null and coach_signed_off_at is null)
    or (coach_signed_off and coach_signed_off_by is not null and coach_signed_off_at is not null)
  ),
  constraint competition_entry_visibility_check check (
    not portal_visible or (coach_signed_off and status in ('approved', 'entered', 'completed'))
  ),
  constraint competition_entry_reference_check
    check (entry_reference is null or char_length(btrim(entry_reference)) between 1 and 120),
  constraint competition_entry_notes_check
    check (notes is null or char_length(notes) <= 3000)
);

create table public.competition_entry_logistics (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  entry_id uuid not null,
  transport_provider text,
  outbound_details text,
  return_details text,
  cost_cents integer,
  currency text not null default 'USD',
  confirmed boolean not null default false,
  private_note text,
  updated_by uuid not null references public.profiles(id) on delete restrict,
  updated_at timestamptz not null default now(),
  primary key (organization_id, entry_id),
  foreign key (organization_id, entry_id)
    references public.competition_development_entries(organization_id, id) on delete cascade,
  constraint competition_logistics_provider_check
    check (transport_provider is null or char_length(btrim(transport_provider)) between 2 and 160),
  constraint competition_logistics_details_check check (
    outbound_details is null or char_length(outbound_details) <= 2000
  ),
  constraint competition_logistics_return_check check (
    return_details is null or char_length(return_details) <= 2000
  ),
  constraint competition_logistics_cost_check check (cost_cents is null or cost_cents >= 0),
  constraint competition_logistics_currency_check check (currency ~ '^[A-Z]{3}$'),
  constraint competition_logistics_note_check
    check (private_note is null or char_length(private_note) <= 2000)
);

create table public.competition_entry_results (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  entry_id uuid not null,
  placing integer,
  score numeric(7,3),
  outcome text not null,
  coach_note text,
  portal_visible boolean not null default false,
  recorded_by uuid not null references public.profiles(id) on delete restrict,
  recorded_at timestamptz not null default now(),
  primary key (organization_id, entry_id),
  foreign key (organization_id, entry_id)
    references public.competition_development_entries(organization_id, id) on delete cascade,
  constraint competition_result_placing_check check (placing is null or placing > 0),
  constraint competition_result_score_check check (score is null or score between 0 and 100),
  constraint competition_result_outcome_check check (char_length(btrim(outcome)) between 2 and 800),
  constraint competition_result_note_check check (coach_note is null or char_length(coach_note) <= 3000)
);

create table public.competition_readiness_evidence (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  plan_id uuid,
  rider_id uuid not null,
  horse_id uuid,
  evidence_type text not null,
  source_id uuid,
  evidence_note text not null,
  status text not null default 'draft',
  portal_visible boolean not null default false,
  signed_off_by uuid references public.profiles(id) on delete restrict,
  signed_off_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, plan_id)
    references public.competition_annual_plans(organization_id, id) on delete set null,
  foreign key (organization_id, rider_id)
    references public.organization_memberships(organization_id, user_id) on delete restrict,
  foreign key (horse_id, organization_id)
    references public.horses(id, organization_id) on delete set null,
  constraint competition_readiness_type_check
    check (evidence_type in ('coach_observation', 'lesson_report', 'video_review', 'competition_result')),
  constraint competition_readiness_note_check
    check (char_length(btrim(evidence_note)) between 5 and 3000),
  constraint competition_readiness_status_check check (status in ('draft', 'signed_off')),
  constraint competition_readiness_signoff_check check (
    (status = 'draft' and signed_off_by is null and signed_off_at is null)
    or (status = 'signed_off' and signed_off_by is not null and signed_off_at is not null)
  ),
  constraint competition_readiness_visibility_check
    check (not portal_visible or status = 'signed_off')
);

create table public.competition_jumping_ladder_catalog (
  level smallint primary key,
  name_en text not null,
  name_ar text not null,
  criteria_en text not null,
  criteria_ar text not null,
  prerequisite_level smallint,
  active boolean not null default true,
  constraint competition_ladder_level_check check (level between 1 and 5),
  constraint competition_ladder_prerequisite_check
    check (prerequisite_level is null or prerequisite_level = level - 1),
  constraint competition_ladder_text_check check (
    char_length(btrim(name_en)) between 2 and 120
    and char_length(btrim(name_ar)) between 2 and 120
    and char_length(btrim(criteria_en)) between 10 and 2000
    and char_length(btrim(criteria_ar)) between 10 and 2000
  )
);

create table public.competition_jumping_ladder_progress (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  plan_id uuid,
  rider_id uuid not null,
  horse_id uuid,
  level smallint not null,
  status text not null default 'planned',
  evidence_id uuid,
  coach_confirmed_by uuid references public.profiles(id) on delete restrict,
  coach_confirmed_at timestamptz,
  portal_visible boolean not null default false,
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, plan_id)
    references public.competition_annual_plans(organization_id, id) on delete set null,
  foreign key (organization_id, rider_id)
    references public.organization_memberships(organization_id, user_id) on delete restrict,
  foreign key (horse_id, organization_id)
    references public.horses(id, organization_id) on delete set null,
  foreign key (organization_id, evidence_id)
    references public.competition_readiness_evidence(organization_id, id) on delete set null,
  constraint competition_ladder_progress_level_check check (level between 1 and 5),
  constraint competition_ladder_progress_status_check
    check (status in ('planned', 'in_progress', 'coach_confirmed', 'archived')),
  constraint competition_ladder_progress_confirmation_check check (
    (status <> 'coach_confirmed' and coach_confirmed_by is null and coach_confirmed_at is null)
    or (status = 'coach_confirmed' and coach_confirmed_by is not null and coach_confirmed_at is not null)
  ),
  constraint competition_ladder_progress_visibility_check
    check (not portal_visible or status = 'coach_confirmed')
);

create unique index competition_ladder_progress_scope_level_uidx
  on public.competition_jumping_ladder_progress (
    organization_id, rider_id, coalesce(horse_id, '00000000-0000-0000-0000-000000000000'::uuid), level
  );

create table public.competition_development_reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  plan_id uuid not null,
  rider_id uuid not null,
  title_en text not null,
  title_ar text not null,
  content_en text not null,
  content_ar text not null,
  status text not null default 'draft',
  approved_by uuid references public.profiles(id) on delete restrict,
  approved_at timestamptz,
  published_by uuid references public.profiles(id) on delete restrict,
  published_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, plan_id)
    references public.competition_annual_plans(organization_id, id) on delete restrict,
  foreign key (organization_id, rider_id)
    references public.organization_memberships(organization_id, user_id) on delete restrict,
  constraint competition_report_title_check check (
    char_length(btrim(title_en)) between 3 and 200
    and char_length(btrim(title_ar)) between 3 and 200
  ),
  constraint competition_report_content_check check (
    char_length(btrim(content_en)) between 20 and 12000
    and char_length(btrim(content_ar)) between 20 and 12000
  ),
  constraint competition_report_status_check check (status in ('draft', 'approved', 'published')),
  constraint competition_report_approval_check check (
    (status = 'draft' and approved_by is null and approved_at is null and published_by is null and published_at is null)
    or (status = 'approved' and approved_by is not null and approved_at is not null and published_by is null and published_at is null)
    or (status = 'published' and approved_by is not null and approved_at is not null
      and published_by is not null and published_at is not null)
  )
);

create table public.competition_development_audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  rider_id uuid,
  actor_user_id uuid references public.profiles(id) on delete set null,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  constraint competition_audit_entity_type_check check (
    entity_type in ('plan', 'competition', 'entry', 'logistics', 'result', 'readiness', 'ladder', 'report')
  ),
  constraint competition_audit_action_check check (
    action in ('read', 'created', 'updated', 'signed_off', 'approved', 'published')
  ),
  constraint competition_audit_metadata_check check (jsonb_typeof(metadata) = 'object')
);

create index competition_annual_plans_rider_idx
  on public.competition_annual_plans (organization_id, rider_id, plan_year desc);
create index competition_events_calendar_idx
  on public.competition_development_events (organization_id, starts_on, status);
create index competition_entries_rider_idx
  on public.competition_development_entries (organization_id, rider_id, status, created_at desc);
create index competition_entries_event_idx
  on public.competition_development_entries (organization_id, competition_id);
create index competition_entries_horse_idx
  on public.competition_development_entries (organization_id, horse_id, status);
create index competition_readiness_rider_idx
  on public.competition_readiness_evidence (organization_id, rider_id, status, created_at desc);
create index competition_ladder_progress_rider_idx
  on public.competition_jumping_ladder_progress (organization_id, rider_id, level);
create index competition_reports_rider_idx
  on public.competition_development_reports (organization_id, rider_id, status, updated_at desc);
create index competition_audit_scope_idx
  on public.competition_development_audit_events (organization_id, rider_id, occurred_at desc);

insert into public.competition_jumping_ladder_catalog
  (level, name_en, name_ar, criteria_en, criteria_ar, prerequisite_level)
values
  (1, 'Ground poles & rhythm', 'عصي أرضية وإيقاع', 'Maintains rhythm, steering, and a balanced position through poles and small invitations.', 'يحافظ على الإيقاع والتوجيه والوضعية المتوازنة عبر العصي الأرضية والقفزات التمهيدية الصغيرة.', null),
  (2, 'Gymnastics foundation', 'أساسيات تمارين الجمباز', 'Rides a simple gymnastic line with a consistent approach, release, and recovery.', 'يركب خطاً بسيطاً من تمارين الجمباز مع اقتراب وتحرير واستعادة توازن ثابتة.', 1),
  (3, 'Connected lines', 'الخطوط المترابطة', 'Rides connected lines with planned turns, suitable pace, and horse-first adjustments.', 'يركب الخطوط المترابطة مع منعطفات مخططة وسرعة مناسبة وتعديلات تراعي الحصان أولاً.', 2),
  (4, 'Course decisions', 'قرارات المسار', 'Plans and rides a full course with independent decisions, accuracy, and calm recovery.', 'يخطط ويركب مساراً كاملاً بقرارات مستقلة ودقة واستعادة هادئة للتوازن.', 3),
  (5, 'Show readiness', 'الاستعداد للعروض', 'Sustains a repeatable, considered round at Show Jumping Level 5 with clear welfare boundaries.', 'يحافظ على جولة ثابتة ومدروسة حتى المستوى الخامس في قفز الحواجز مع حدود واضحة لرفاهية الحصان.', 4);

comment on table public.competition_development_feature_flags is
  'Default-off, non-production Batch 4 gate for competition and annual rider development.';
comment on table public.competition_entry_logistics is
  'Staff and permitted financial-guardian logistics; riders never receive cost fields.';
comment on table public.competition_development_reports is
  'Bilingual Coach-authored report. Only published rows enter Rider or Guardian portal payloads.';

create or replace function private.competition_development_enabled(p_organization_id uuid)
returns boolean
language sql stable security definer
set search_path = public, private
as $$
  select exists (
    select 1 from public.competition_development_feature_flags flag
    where flag.organization_id = p_organization_id
      and flag.module_code = 'competition_annual_rider_development'
      and flag.enabled
  );
$$;

create or replace function private.can_manage_competition_calendar(
  p_organization_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql stable security definer
set search_path = public, private
as $$
  select private.competition_development_enabled(p_organization_id)
    and (
      private.is_platform_admin()
      or private.has_organization_role(p_organization_id, array['academy_admin', 'stable_manager', 'competition_manager'])
    );
$$;

create or replace function private.can_manage_competition_development(
  p_organization_id uuid,
  p_rider_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql stable security definer
set search_path = public, private
as $$
  select private.competition_development_enabled(p_organization_id)
    and (
      private.is_platform_admin()
      or private.has_organization_role(p_organization_id, array['academy_admin', 'stable_manager', 'competition_manager'])
      or (
        private.has_organization_role(p_organization_id, array['coach'])
        and exists (
          select 1 from public.coach_rider_assignments assignment
          where assignment.organization_id = p_organization_id
            and assignment.coach_id = p_user_id
            and assignment.rider_id = p_rider_id
            and assignment.active
            and assignment.starts_on <= current_date
            and (assignment.ends_on is null or assignment.ends_on >= current_date)
        )
      )
    );
$$;

create or replace function private.can_view_competition_rider(
  p_organization_id uuid,
  p_rider_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql stable security definer
set search_path = public, private
as $$
  select private.competition_development_enabled(p_organization_id)
    and (
      private.can_manage_competition_development(p_organization_id, p_rider_id, p_user_id)
      or p_rider_id = p_user_id
      or private.can_guardian_access_rider(p_organization_id, p_user_id, p_rider_id)
    );
$$;

create or replace function private.can_view_competition_costs(
  p_organization_id uuid,
  p_rider_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql stable security definer
set search_path = public, private
as $$
  select private.can_manage_competition_development(p_organization_id, p_rider_id, p_user_id)
    or private.has_organization_role(p_organization_id, array['accountant'])
    or exists (
      select 1 from public.guardian_riders link
      where link.organization_id = p_organization_id
        and link.guardian_id = p_user_id
        and link.rider_id = p_rider_id
        and link.active
        and link.verification_status = 'verified'
        and link.can_view_financials
        and private.can_guardian_access_rider(p_organization_id, p_user_id, p_rider_id)
    );
$$;

create or replace function private.competition_readiness_source_valid(
  p_organization_id uuid,
  p_rider_id uuid,
  p_horse_id uuid,
  p_evidence_type text,
  p_source_id uuid
)
returns boolean
language plpgsql stable security definer
set search_path = public, private
as $$
begin
  if p_evidence_type = 'coach_observation' then
    return true;
  elsif p_source_id is null then
    return false;
  elsif p_evidence_type = 'lesson_report' then
    return exists (
      select 1 from public.lesson_development_reports report
      where report.id = p_source_id
        and report.organization_id = p_organization_id
        and report.rider_id = p_rider_id
        and report.status = 'approved'
    );
  elsif p_evidence_type = 'video_review' then
    return private.video_release_3_approved_revision(
      p_organization_id, p_rider_id, p_source_id, p_horse_id
    );
  elsif p_evidence_type = 'competition_result' then
    return exists (
      select 1
      from public.competition_entry_results result
      join public.competition_development_entries entry
        on entry.organization_id = result.organization_id
       and entry.id = result.entry_id
      where result.organization_id = p_organization_id
        and result.entry_id = p_source_id
        and entry.rider_id = p_rider_id
        and entry.coach_signed_off
    );
  end if;
  return false;
end;
$$;

create or replace function private.competition_audit(
  p_organization_id uuid,
  p_rider_id uuid,
  p_entity_type text,
  p_entity_id uuid,
  p_action text,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql security definer
set search_path = public, private
as $$
begin
  insert into public.competition_development_audit_events (
    organization_id, rider_id, actor_user_id, entity_type, entity_id, action, metadata
  ) values (
    p_organization_id, p_rider_id, auth.uid(), p_entity_type, p_entity_id, p_action, coalesce(p_metadata, '{}'::jsonb)
  );
end;
$$;

alter table public.competition_development_feature_flags enable row level security;
alter table public.competition_annual_plans enable row level security;
alter table public.competition_development_events enable row level security;
alter table public.competition_development_entries enable row level security;
alter table public.competition_entry_logistics enable row level security;
alter table public.competition_entry_results enable row level security;
alter table public.competition_readiness_evidence enable row level security;
alter table public.competition_jumping_ladder_catalog enable row level security;
alter table public.competition_jumping_ladder_progress enable row level security;
alter table public.competition_development_reports enable row level security;
alter table public.competition_development_audit_events enable row level security;

revoke all on table public.competition_development_feature_flags from anon, authenticated;
revoke all on table public.competition_annual_plans from anon, authenticated;
revoke all on table public.competition_development_events from anon, authenticated;
revoke all on table public.competition_development_entries from anon, authenticated;
revoke all on table public.competition_entry_logistics from anon, authenticated;
revoke all on table public.competition_entry_results from anon, authenticated;
revoke all on table public.competition_readiness_evidence from anon, authenticated;
revoke all on table public.competition_jumping_ladder_catalog from anon, authenticated;
revoke all on table public.competition_jumping_ladder_progress from anon, authenticated;
revoke all on table public.competition_development_reports from anon, authenticated;
revoke all on table public.competition_development_audit_events from anon, authenticated;

create policy competition_ladder_catalog_select_active
  on public.competition_jumping_ladder_catalog for select to authenticated using (active);

create or replace function public.get_competition_development_access(
  p_organization_id uuid,
  p_rider_id uuid default null
)
returns table (
  enabled boolean,
  can_manage boolean,
  can_publish boolean,
  can_view boolean,
  can_view_financials boolean,
  pilot_scope text
)
language plpgsql security definer
set search_path = public, private
as $$
declare
  v_rider_id uuid := coalesce(p_rider_id, auth.uid());
  v_manage boolean := false;
  v_view boolean := false;
begin
  v_manage := private.can_manage_competition_calendar(p_organization_id)
    or (v_rider_id is not null and private.can_manage_competition_development(p_organization_id, v_rider_id));
  v_view := v_manage
    or (v_rider_id is not null and private.can_view_competition_rider(p_organization_id, v_rider_id));
  return query select
    private.competition_development_enabled(p_organization_id),
    v_manage,
    v_manage,
    v_view,
    case when v_rider_id is null then false
      else private.can_view_competition_costs(p_organization_id, v_rider_id)
    end,
    case when v_manage then 'staff'
      when v_view then 'approved_portal'
      else 'not_enrolled'
    end;
end;
$$;

create or replace function public.get_competition_development_riders(p_organization_id uuid)
returns table (rider_id uuid, rider_name text)
language plpgsql security definer
set search_path = public, private
as $$
begin
  if not private.competition_development_enabled(p_organization_id) then
    return;
  end if;
  if private.can_manage_competition_calendar(p_organization_id) then
    return query
      select membership.user_id, coalesce(profile.full_name, 'Rider')
      from public.organization_memberships membership
      join public.organization_member_roles member_role on member_role.membership_id = membership.id
      join public.profiles profile on profile.id = membership.user_id
      where membership.organization_id = p_organization_id
        and membership.status = 'active' and member_role.role = 'rider'
      order by profile.full_name;
    return;
  end if;
  return query
    select distinct assignment.rider_id, coalesce(profile.full_name, 'Rider')
    from public.coach_rider_assignments assignment
    join public.profiles profile on profile.id = assignment.rider_id
    where assignment.organization_id = p_organization_id
      and assignment.coach_id = auth.uid() and assignment.active
      and assignment.starts_on <= current_date
      and (assignment.ends_on is null or assignment.ends_on >= current_date)
    union
    select membership.user_id, coalesce(profile.full_name, 'Rider')
    from public.organization_memberships membership
    join public.organization_member_roles member_role on member_role.membership_id = membership.id
    join public.profiles profile on profile.id = membership.user_id
    where membership.organization_id = p_organization_id
      and membership.user_id = auth.uid()
      and membership.status = 'active'
      and member_role.role = 'rider'
    union
    select link.rider_id, coalesce(profile.full_name, 'Rider')
    from public.guardian_riders link
    join public.profiles profile on profile.id = link.rider_id
    where link.organization_id = p_organization_id and link.guardian_id = auth.uid()
      and private.can_guardian_access_rider(link.organization_id, link.guardian_id, link.rider_id)
    order by rider_name;
end;
$$;

create or replace function public.get_competition_development_coaches(
  p_organization_id uuid,
  p_rider_id uuid
)
returns table (coach_id uuid, coach_name text)
language plpgsql security definer
set search_path = public, private
as $$
begin
  if not private.can_view_competition_rider(p_organization_id, p_rider_id) then
    raise exception 'Competition development is not available for this rider' using errcode = '42501';
  end if;
  return query
    select distinct assignment.coach_id, coalesce(profile.full_name, 'Coach')
    from public.coach_rider_assignments assignment
    join public.profiles profile on profile.id = assignment.coach_id
    where assignment.organization_id = p_organization_id
      and assignment.rider_id = p_rider_id and assignment.active
      and assignment.starts_on <= current_date
      and (assignment.ends_on is null or assignment.ends_on >= current_date)
    order by coach_name;
end;
$$;

create or replace function public.get_competition_development_workspace(
  p_organization_id uuid,
  p_rider_id uuid
)
returns jsonb
language plpgsql security definer
set search_path = public, private
as $$
declare
  v_manage boolean := private.can_manage_competition_calendar(p_organization_id)
    or private.can_manage_competition_development(p_organization_id, p_rider_id);
  v_view boolean := v_manage or private.can_view_competition_rider(p_organization_id, p_rider_id);
  v_costs boolean := private.can_view_competition_costs(p_organization_id, p_rider_id);
  v_result jsonb;
begin
  if not v_view then
    raise exception 'Competition development is not available for this rider' using errcode = '42501';
  end if;

  if v_manage then
    select jsonb_build_object(
      'access', jsonb_build_object('enabled', private.competition_development_enabled(p_organization_id),
        'canManage', true, 'canPublish', true, 'canView', true, 'canViewFinancials', v_costs, 'pilotScope', 'staff'),
      'annualPlans', coalesce((select jsonb_agg(to_jsonb(plan) - 'created_by' - 'updated_by' order by plan.plan_year desc)
        from public.competition_annual_plans plan
        where plan.organization_id = p_organization_id and plan.rider_id = p_rider_id), '[]'::jsonb),
      'competitions', coalesce((select jsonb_agg(to_jsonb(event) - 'created_by' - 'updated_by' order by event.starts_on)
        from public.competition_development_events event
        where event.organization_id = p_organization_id), '[]'::jsonb),
      'entries', coalesce((select jsonb_agg(to_jsonb(entry) - 'created_by' - 'updated_by' order by entry.created_at desc)
        from public.competition_development_entries entry
        where entry.organization_id = p_organization_id and entry.rider_id = p_rider_id), '[]'::jsonb),
      'logistics', case when v_costs then coalesce((select jsonb_agg(to_jsonb(logistics)
        order by logistics.updated_at desc) from public.competition_entry_logistics logistics
        join public.competition_development_entries entry
          on entry.organization_id = logistics.organization_id and entry.id = logistics.entry_id
        where logistics.organization_id = p_organization_id and entry.rider_id = p_rider_id), '[]'::jsonb) else '[]'::jsonb end,
      'results', coalesce((select jsonb_agg(to_jsonb(result) order by result.recorded_at desc)
        from public.competition_entry_results result
        join public.competition_development_entries entry
          on entry.organization_id = result.organization_id and entry.id = result.entry_id
        where result.organization_id = p_organization_id and entry.rider_id = p_rider_id), '[]'::jsonb),
      'readiness', coalesce((select jsonb_agg(to_jsonb(evidence) - 'created_by' order by evidence.created_at desc)
        from public.competition_readiness_evidence evidence
        where evidence.organization_id = p_organization_id and evidence.rider_id = p_rider_id), '[]'::jsonb),
      'ladder', coalesce((select jsonb_agg(to_jsonb(progress) - 'created_by' order by progress.level)
        from public.competition_jumping_ladder_progress progress
        where progress.organization_id = p_organization_id and progress.rider_id = p_rider_id), '[]'::jsonb),
      'ladderCatalog', coalesce((select jsonb_agg(to_jsonb(catalog) order by catalog.level)
        from public.competition_jumping_ladder_catalog catalog where catalog.active), '[]'::jsonb),
      'reports', coalesce((select jsonb_agg(to_jsonb(report) - 'created_by' - 'updated_by' order by report.updated_at desc)
        from public.competition_development_reports report
        where report.organization_id = p_organization_id and report.rider_id = p_rider_id), '[]'::jsonb)
    ) into v_result;
  else
    select jsonb_build_object(
      'access', jsonb_build_object('enabled', true, 'canManage', false, 'canPublish', false,
        'canView', true, 'canViewFinancials', v_costs, 'pilotScope', 'approved_portal'),
      'annualPlans', coalesce((select jsonb_agg(jsonb_build_object(
        'id', plan.id, 'plan_year', plan.plan_year, 'title', plan.title,
        'goals_en', plan.goals_en, 'goals_ar', plan.goals_ar, 'status', plan.status)
        order by plan.plan_year desc)
        from public.competition_annual_plans plan
        where plan.organization_id = p_organization_id and plan.rider_id = p_rider_id
          and plan.status in ('active', 'completed') and plan.coach_signed_off and plan.portal_visible), '[]'::jsonb),
      'competitions', coalesce((select jsonb_agg(jsonb_build_object(
        'id', event.id, 'name', event.name, 'discipline', event.discipline, 'venue', event.venue,
        'starts_on', event.starts_on, 'ends_on', event.ends_on, 'entry_deadline', event.entry_deadline,
        'status', event.status) order by event.starts_on)
        from public.competition_development_events event
        where event.organization_id = p_organization_id and event.portal_visible and event.status <> 'cancelled'), '[]'::jsonb),
      'entries', coalesce((select jsonb_agg(jsonb_build_object(
        'id', entry.id, 'competition_id', entry.competition_id, 'plan_id', entry.plan_id,
        'class_name', entry.class_name, 'target_family', entry.target_family, 'target_level', entry.target_level,
        'status', entry.status, 'horse_id', entry.horse_id, 'entry_reference', entry.entry_reference)
        order by entry.created_at desc)
        from public.competition_development_entries entry
        where entry.organization_id = p_organization_id and entry.rider_id = p_rider_id
          and entry.portal_visible and entry.coach_signed_off
          and entry.status in ('approved', 'entered', 'completed')), '[]'::jsonb),
      'logistics', case when v_costs then coalesce((select jsonb_agg(jsonb_build_object(
        'entry_id', logistics.entry_id, 'transport_provider', logistics.transport_provider,
        'outbound_details', logistics.outbound_details, 'return_details', logistics.return_details,
        'cost_cents', logistics.cost_cents, 'currency', logistics.currency, 'confirmed', logistics.confirmed)
        order by logistics.updated_at desc)
        from public.competition_entry_logistics logistics
        join public.competition_development_entries entry
          on entry.organization_id = logistics.organization_id and entry.id = logistics.entry_id
        where logistics.organization_id = p_organization_id and entry.rider_id = p_rider_id
          and entry.portal_visible), '[]'::jsonb) else '[]'::jsonb end,
      'results', coalesce((select jsonb_agg(jsonb_build_object(
        'entry_id', result.entry_id, 'placing', result.placing, 'score', result.score,
        'outcome', result.outcome, 'recorded_at', result.recorded_at)
        order by result.recorded_at desc)
        from public.competition_entry_results result
        join public.competition_development_entries entry
          on entry.organization_id = result.organization_id and entry.id = result.entry_id
        where result.organization_id = p_organization_id and entry.rider_id = p_rider_id
          and result.portal_visible and entry.portal_visible), '[]'::jsonb),
      'readiness', coalesce((select jsonb_agg(jsonb_build_object(
        'id', evidence.id, 'plan_id', evidence.plan_id, 'evidence_type', evidence.evidence_type,
        'evidence_note', evidence.evidence_note, 'status', evidence.status, 'signed_off_at', evidence.signed_off_at)
        order by evidence.created_at desc)
        from public.competition_readiness_evidence evidence
        where evidence.organization_id = p_organization_id and evidence.rider_id = p_rider_id
          and evidence.status = 'signed_off' and evidence.portal_visible
          and private.competition_readiness_source_valid(
            evidence.organization_id, evidence.rider_id, evidence.horse_id,
            evidence.evidence_type, evidence.source_id)), '[]'::jsonb),
      'ladder', coalesce((select jsonb_agg(jsonb_build_object(
        'id', progress.id, 'plan_id', progress.plan_id, 'level', progress.level,
        'status', progress.status, 'coach_confirmed_at', progress.coach_confirmed_at)
        order by progress.level)
        from public.competition_jumping_ladder_progress progress
        left join public.competition_readiness_evidence evidence
          on evidence.organization_id = progress.organization_id and evidence.id = progress.evidence_id
        where progress.organization_id = p_organization_id and progress.rider_id = p_rider_id
          and progress.status = 'coach_confirmed' and progress.portal_visible
          and (progress.evidence_id is null or private.competition_readiness_source_valid(
            evidence.organization_id, evidence.rider_id, evidence.horse_id,
            evidence.evidence_type, evidence.source_id))), '[]'::jsonb),
      'ladderCatalog', coalesce((select jsonb_agg(to_jsonb(catalog) order by catalog.level)
        from public.competition_jumping_ladder_catalog catalog where catalog.active), '[]'::jsonb),
      'reports', coalesce((select jsonb_agg(jsonb_build_object(
        'id', report.id, 'plan_id', report.plan_id, 'title_en', report.title_en,
        'title_ar', report.title_ar, 'content_en', report.content_en, 'content_ar', report.content_ar,
        'status', report.status, 'published_at', report.published_at)
        order by report.published_at desc)
        from public.competition_development_reports report
        where report.organization_id = p_organization_id and report.rider_id = p_rider_id
          and report.status = 'published'
          and exists (
            select 1 from public.competition_readiness_evidence evidence
            where evidence.organization_id = report.organization_id
              and evidence.rider_id = report.rider_id
              and evidence.status = 'signed_off'
              and private.competition_readiness_source_valid(
                evidence.organization_id, evidence.rider_id, evidence.horse_id,
                evidence.evidence_type, evidence.source_id
              )
          )), '[]'::jsonb)
    ) into v_result;
  end if;

  perform private.competition_audit(p_organization_id, p_rider_id, 'plan', null, 'read');
  return v_result;
end;
$$;

create or replace function public.save_competition_annual_plan(
  p_organization_id uuid,
  p_rider_id uuid,
  p_plan_year integer,
  p_title text,
  p_goals_en text,
  p_goals_ar text,
  p_status text default 'draft',
  p_coach_id uuid default null,
  p_plan_id uuid default null,
  p_coach_signed_off boolean default false,
  p_portal_visible boolean default false
)
returns uuid
language plpgsql security definer
set search_path = public, private
as $$
declare
  v_id uuid := p_plan_id;
  v_coach_id uuid := coalesce(p_coach_id, auth.uid());
begin
  if not private.can_manage_competition_development(p_organization_id, p_rider_id)
    or v_coach_id is null then
    raise exception 'Only authorized competition staff or the assigned coach may manage this plan'
      using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.coach_rider_assignments assignment
    where assignment.organization_id = p_organization_id
      and assignment.coach_id = v_coach_id
      and assignment.rider_id = p_rider_id
      and assignment.active
      and assignment.starts_on <= current_date
      and (assignment.ends_on is null or assignment.ends_on >= current_date)
  ) then
    raise exception 'Annual plans require a current Coach–Rider assignment'
      using errcode = '42501';
  end if;
  if p_coach_signed_off and not private.can_manage_competition_development(p_organization_id, p_rider_id) then
    raise exception 'Plan sign-off is not authorized' using errcode = '42501';
  end if;
  if p_coach_signed_off and v_coach_id <> auth.uid()
    and not private.can_manage_competition_calendar(p_organization_id) then
    raise exception 'Plan sign-off must be performed by the acting coach' using errcode = '42501';
  end if;
  if p_plan_id is null then
    insert into public.competition_annual_plans (
      organization_id, rider_id, coach_id, plan_year, title, goals_en, goals_ar,
      status, coach_signed_off, coach_signed_off_by, coach_signed_off_at,
      portal_visible, created_by, updated_by
    ) values (
      p_organization_id, p_rider_id, v_coach_id, p_plan_year, btrim(p_title), btrim(p_goals_en), btrim(p_goals_ar),
      p_status, p_coach_signed_off, case when p_coach_signed_off then auth.uid() end,
      case when p_coach_signed_off then now() end, p_portal_visible, auth.uid(), auth.uid()
    ) returning id into v_id;
    perform private.competition_audit(p_organization_id, p_rider_id, 'plan', v_id, 'created');
  else
    if not exists (
      select 1 from public.competition_annual_plans plan
      where plan.id = p_plan_id and plan.organization_id = p_organization_id and plan.rider_id = p_rider_id
    ) then
      raise exception 'Annual plan is not available' using errcode = '42501';
    end if;
    update public.competition_annual_plans
    set coach_id = v_coach_id, plan_year = p_plan_year, title = btrim(p_title),
      goals_en = btrim(p_goals_en), goals_ar = btrim(p_goals_ar), status = p_status,
      coach_signed_off = p_coach_signed_off,
      coach_signed_off_by = case when p_coach_signed_off then auth.uid() end,
      coach_signed_off_at = case when p_coach_signed_off then coalesce(coach_signed_off_at, now()) end,
      portal_visible = p_portal_visible, updated_by = auth.uid(), updated_at = now()
    where id = p_plan_id and organization_id = p_organization_id and rider_id = p_rider_id
    returning id into v_id;
    perform private.competition_audit(p_organization_id, p_rider_id, 'plan', v_id, 'updated');
  end if;
  return v_id;
end;
$$;

create or replace function public.save_competition_event(
  p_organization_id uuid,
  p_name text,
  p_discipline text,
  p_venue text,
  p_starts_on date,
  p_ends_on date,
  p_entry_deadline date default null,
  p_status text default 'planned',
  p_portal_visible boolean default false,
  p_event_id uuid default null
)
returns uuid
language plpgsql security definer
set search_path = public, private
as $$
declare v_id uuid := p_event_id;
begin
  if not private.can_manage_competition_calendar(p_organization_id) then
    raise exception 'Only authorized competition staff may manage the calendar' using errcode = '42501';
  end if;
  if p_event_id is null then
    insert into public.competition_development_events (
      organization_id, name, discipline, venue, starts_on, ends_on, entry_deadline,
      status, portal_visible, created_by, updated_by
    ) values (
      p_organization_id, btrim(p_name), p_discipline, btrim(p_venue), p_starts_on, p_ends_on,
      p_entry_deadline, p_status, p_portal_visible, auth.uid(), auth.uid()
    ) returning id into v_id;
    perform private.competition_audit(p_organization_id, null, 'competition', v_id, 'created');
  else
    update public.competition_development_events
    set name = btrim(p_name), discipline = p_discipline, venue = btrim(p_venue),
      starts_on = p_starts_on, ends_on = p_ends_on, entry_deadline = p_entry_deadline,
      status = p_status, portal_visible = p_portal_visible, updated_by = auth.uid(), updated_at = now()
    where id = p_event_id and organization_id = p_organization_id
    returning id into v_id;
    if v_id is null then raise exception 'Competition is not available' using errcode = '42501'; end if;
    perform private.competition_audit(p_organization_id, null, 'competition', v_id, 'updated');
  end if;
  return v_id;
end;
$$;

create or replace function public.save_competition_entry(
  p_organization_id uuid,
  p_rider_id uuid,
  p_competition_id uuid,
  p_class_name text,
  p_target_family text,
  p_target_level smallint,
  p_coach_id uuid,
  p_plan_id uuid default null,
  p_horse_id uuid default null,
  p_status text default 'draft',
  p_entry_reference text default null,
  p_notes text default null,
  p_entry_id uuid default null,
  p_coach_signed_off boolean default false,
  p_portal_visible boolean default false
)
returns uuid
language plpgsql security definer
set search_path = public, private
as $$
declare v_id uuid := p_entry_id;
begin
  if not private.can_manage_competition_development(p_organization_id, p_rider_id)
    or not exists (
      select 1 from public.coach_rider_assignments assignment
      where assignment.organization_id = p_organization_id
        and assignment.coach_id = p_coach_id and assignment.rider_id = p_rider_id
        and assignment.active and assignment.starts_on <= current_date
        and (assignment.ends_on is null or assignment.ends_on >= current_date)
    )
  then
    raise exception 'Entry requires an active coach assignment' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.competition_development_events event
    where event.id = p_competition_id and event.organization_id = p_organization_id
      and event.status <> 'cancelled'
  ) then
    raise exception 'Competition is not available' using errcode = '23514';
  end if;
  if p_plan_id is not null and not exists (
    select 1 from public.competition_annual_plans plan
    where plan.id = p_plan_id and plan.organization_id = p_organization_id
      and plan.rider_id = p_rider_id and plan.status <> 'archived'
  ) then
    raise exception 'Annual plan does not match the rider' using errcode = '23514';
  end if;
  if p_horse_id is not null then
    perform private.lock_horse_operation(p_organization_id, p_horse_id);
    if not exists (
      select 1 from public.horses horse
      where horse.id = p_horse_id and horse.organization_id = p_organization_id and horse.status = 'active'
    ) then
      raise exception 'Only an active horse in this organization may be entered' using errcode = '23514';
    end if;
  end if;
  if p_entry_id is null then
    insert into public.competition_development_entries (
      organization_id, competition_id, plan_id, rider_id, coach_id, horse_id, class_name,
      target_family, target_level, status, coach_signed_off, coach_signed_off_by,
      coach_signed_off_at, portal_visible, entry_reference, notes, created_by, updated_by
    ) values (
      p_organization_id, p_competition_id, p_plan_id, p_rider_id, p_coach_id, p_horse_id,
      btrim(p_class_name), p_target_family, p_target_level, p_status, p_coach_signed_off,
      case when p_coach_signed_off then auth.uid() end, case when p_coach_signed_off then now() end,
      p_portal_visible, nullif(btrim(p_entry_reference), ''), nullif(btrim(p_notes), ''), auth.uid(), auth.uid()
    ) returning id into v_id;
    perform private.competition_audit(p_organization_id, p_rider_id, 'entry', v_id, 'created');
  else
    update public.competition_development_entries
    set competition_id = p_competition_id, plan_id = p_plan_id, coach_id = p_coach_id,
      horse_id = p_horse_id, class_name = btrim(p_class_name), target_family = p_target_family,
      target_level = p_target_level, status = p_status, coach_signed_off = p_coach_signed_off,
      coach_signed_off_by = case when p_coach_signed_off then auth.uid() end,
      coach_signed_off_at = case when p_coach_signed_off then coalesce(coach_signed_off_at, now()) end,
      portal_visible = p_portal_visible, entry_reference = nullif(btrim(p_entry_reference), ''),
      notes = nullif(btrim(p_notes), ''), updated_by = auth.uid(), updated_at = now()
    where id = p_entry_id and organization_id = p_organization_id and rider_id = p_rider_id
    returning id into v_id;
    if v_id is null then raise exception 'Competition entry is not available' using errcode = '42501'; end if;
    perform private.competition_audit(p_organization_id, p_rider_id, 'entry', v_id, 'updated');
  end if;
  return v_id;
end;
$$;

create or replace function public.save_competition_logistics(
  p_entry_id uuid,
  p_transport_provider text,
  p_outbound_details text,
  p_return_details text,
  p_cost_cents integer,
  p_currency text default 'USD',
  p_confirmed boolean default false,
  p_private_note text default null
)
returns void
language plpgsql security definer
set search_path = public, private
as $$
declare v_entry public.competition_development_entries%rowtype;
begin
  select * into v_entry from public.competition_development_entries where id = p_entry_id;
  if v_entry.id is null or not private.can_manage_competition_development(v_entry.organization_id, v_entry.rider_id) then
    raise exception 'Logistics are not available' using errcode = '42501';
  end if;
  insert into public.competition_entry_logistics (
    organization_id, entry_id, transport_provider, outbound_details, return_details,
    cost_cents, currency, confirmed, private_note, updated_by
  ) values (
    v_entry.organization_id, p_entry_id, nullif(btrim(p_transport_provider), ''),
    nullif(btrim(p_outbound_details), ''), nullif(btrim(p_return_details), ''),
    p_cost_cents, upper(p_currency), p_confirmed, nullif(btrim(p_private_note), ''), auth.uid()
  )
  on conflict (organization_id, entry_id) do update set
    transport_provider = excluded.transport_provider, outbound_details = excluded.outbound_details,
    return_details = excluded.return_details, cost_cents = excluded.cost_cents,
    currency = excluded.currency, confirmed = excluded.confirmed, private_note = excluded.private_note,
    updated_by = auth.uid(), updated_at = now();
  perform private.competition_audit(v_entry.organization_id, v_entry.rider_id, 'logistics', p_entry_id, 'updated');
end;
$$;

create or replace function public.save_competition_result(
  p_entry_id uuid,
  p_placing integer,
  p_score numeric,
  p_outcome text,
  p_coach_note text default null,
  p_portal_visible boolean default false
)
returns void
language plpgsql security definer
set search_path = public, private
as $$
declare v_entry public.competition_development_entries%rowtype;
begin
  select * into v_entry from public.competition_development_entries where id = p_entry_id;
  if v_entry.id is null or not private.can_manage_competition_development(v_entry.organization_id, v_entry.rider_id) then
    raise exception 'Results are not available' using errcode = '42501';
  end if;
  if not v_entry.coach_signed_off then
    raise exception 'A signed-off entry is required before recording a result' using errcode = '23514';
  end if;
  insert into public.competition_entry_results (
    organization_id, entry_id, placing, score, outcome, coach_note, portal_visible, recorded_by
  ) values (
    v_entry.organization_id, p_entry_id, p_placing, p_score, btrim(p_outcome), nullif(btrim(p_coach_note), ''),
    p_portal_visible, auth.uid()
  )
  on conflict (organization_id, entry_id) do update set
    placing = excluded.placing, score = excluded.score, outcome = excluded.outcome,
    coach_note = excluded.coach_note, portal_visible = excluded.portal_visible,
    recorded_by = auth.uid(), recorded_at = now();
  update public.competition_development_entries
  set status = 'completed', updated_by = auth.uid(), updated_at = now()
  where id = p_entry_id and organization_id = v_entry.organization_id;
  perform private.competition_audit(v_entry.organization_id, v_entry.rider_id, 'result', p_entry_id, 'updated');
end;
$$;

create or replace function public.save_competition_readiness(
  p_organization_id uuid,
  p_rider_id uuid,
  p_evidence_type text,
  p_source_id uuid,
  p_evidence_note text,
  p_plan_id uuid default null,
  p_horse_id uuid default null,
  p_evidence_id uuid default null,
  p_portal_visible boolean default false
)
returns uuid
language plpgsql security definer
set search_path = public, private
as $$
declare v_id uuid := p_evidence_id;
begin
  if not private.can_manage_competition_development(p_organization_id, p_rider_id)
    or not private.competition_readiness_source_valid(
      p_organization_id, p_rider_id, p_horse_id, p_evidence_type, p_source_id
    ) then
    raise exception 'Readiness evidence is not authorized or no longer valid' using errcode = '42501';
  end if;
  if p_plan_id is not null and not exists (
    select 1 from public.competition_annual_plans plan
    where plan.id = p_plan_id and plan.organization_id = p_organization_id
      and plan.rider_id = p_rider_id and plan.status <> 'archived'
  ) then
    raise exception 'Readiness evidence must use a current annual plan for this rider' using errcode = '23514';
  end if;
  if p_evidence_id is null then
    insert into public.competition_readiness_evidence (
      organization_id, plan_id, rider_id, horse_id, evidence_type, source_id,
      evidence_note, created_by, portal_visible
    ) values (
      p_organization_id, p_plan_id, p_rider_id, p_horse_id, p_evidence_type, p_source_id,
      btrim(p_evidence_note), auth.uid(), p_portal_visible
    ) returning id into v_id;
    perform private.competition_audit(p_organization_id, p_rider_id, 'readiness', v_id, 'created');
  else
    update public.competition_readiness_evidence
    set plan_id = p_plan_id, horse_id = p_horse_id, evidence_type = p_evidence_type,
      source_id = p_source_id, evidence_note = btrim(p_evidence_note), portal_visible = p_portal_visible
    where id = p_evidence_id and organization_id = p_organization_id and rider_id = p_rider_id
      and status = 'draft'
    returning id into v_id;
    if v_id is null then raise exception 'Readiness evidence is not editable' using errcode = '42501'; end if;
    perform private.competition_audit(p_organization_id, p_rider_id, 'readiness', v_id, 'updated');
  end if;
  return v_id;
end;
$$;

create or replace function public.confirm_competition_readiness(p_evidence_id uuid)
returns void
language plpgsql security definer
set search_path = public, private
as $$
declare v_evidence public.competition_readiness_evidence%rowtype;
begin
  select * into v_evidence from public.competition_readiness_evidence where id = p_evidence_id;
  if v_evidence.id is null
    or not private.can_manage_competition_development(v_evidence.organization_id, v_evidence.rider_id)
    or not private.competition_readiness_source_valid(
      v_evidence.organization_id, v_evidence.rider_id, v_evidence.horse_id,
      v_evidence.evidence_type, v_evidence.source_id
    ) then
    raise exception 'Readiness evidence cannot be signed off' using errcode = '42501';
  end if;
  update public.competition_readiness_evidence
  set status = 'signed_off', signed_off_by = auth.uid(), signed_off_at = now()
  where id = p_evidence_id;
  perform private.competition_audit(v_evidence.organization_id, v_evidence.rider_id, 'readiness', p_evidence_id, 'signed_off');
end;
$$;

create or replace function public.save_competition_jumping_progress(
  p_organization_id uuid,
  p_rider_id uuid,
  p_level smallint,
  p_status text,
  p_plan_id uuid default null,
  p_horse_id uuid default null,
  p_evidence_id uuid default null,
  p_progress_id uuid default null,
  p_portal_visible boolean default false
)
returns uuid
language plpgsql security definer
set search_path = public, private
as $$
declare v_id uuid := p_progress_id;
begin
  if not private.can_manage_competition_development(p_organization_id, p_rider_id) then
    raise exception 'Only authorized competition staff may manage ladder progression' using errcode = '42501';
  end if;
  if not exists (select 1 from public.competition_jumping_ladder_catalog where level = p_level and active) then
    raise exception 'Jumping ladder level is not available' using errcode = '23514';
  end if;
  if p_evidence_id is not null and not exists (
    select 1 from public.competition_readiness_evidence evidence
    where evidence.id = p_evidence_id and evidence.organization_id = p_organization_id
      and evidence.rider_id = p_rider_id and evidence.status = 'signed_off'
      and private.competition_readiness_source_valid(
        evidence.organization_id, evidence.rider_id, evidence.horse_id,
        evidence.evidence_type, evidence.source_id
      )
  ) then
    raise exception 'Ladder evidence must be signed off for this rider' using errcode = '23514';
  end if;
  if p_plan_id is not null and not exists (
    select 1 from public.competition_annual_plans plan
    where plan.id = p_plan_id and plan.organization_id = p_organization_id
      and plan.rider_id = p_rider_id and plan.status <> 'archived'
  ) then
    raise exception 'Jumping progression must use a current annual plan for this rider' using errcode = '23514';
  end if;
  if p_status = 'coach_confirmed' and p_level > 1 and not exists (
    select 1 from public.competition_jumping_ladder_progress previous
    where previous.organization_id = p_organization_id and previous.rider_id = p_rider_id
      and previous.level = p_level - 1 and previous.status = 'coach_confirmed'
      and (previous.horse_id is not distinct from p_horse_id)
  ) then
    raise exception 'The previous jumping ladder level must be coach-confirmed first' using errcode = '23514';
  end if;
  if p_progress_id is null then
    insert into public.competition_jumping_ladder_progress (
      organization_id, plan_id, rider_id, horse_id, level, status, evidence_id,
      coach_confirmed_by, coach_confirmed_at, portal_visible, created_by
    ) values (
      p_organization_id, p_plan_id, p_rider_id, p_horse_id, p_level, p_status, p_evidence_id,
      case when p_status = 'coach_confirmed' then auth.uid() end,
      case when p_status = 'coach_confirmed' then now() end,
      p_portal_visible, auth.uid()
    ) returning id into v_id;
    perform private.competition_audit(p_organization_id, p_rider_id, 'ladder', v_id,
      case when p_status = 'coach_confirmed' then 'signed_off' else 'created' end);
  else
    update public.competition_jumping_ladder_progress
    set plan_id = p_plan_id, horse_id = p_horse_id, level = p_level, status = p_status,
      evidence_id = p_evidence_id,
      coach_confirmed_by = case when p_status = 'coach_confirmed' then auth.uid() end,
      coach_confirmed_at = case when p_status = 'coach_confirmed' then coalesce(coach_confirmed_at, now()) end,
      portal_visible = p_portal_visible, updated_at = now()
    where id = p_progress_id and organization_id = p_organization_id and rider_id = p_rider_id
    returning id into v_id;
    if v_id is null then raise exception 'Ladder progress is not available' using errcode = '42501'; end if;
    perform private.competition_audit(p_organization_id, p_rider_id, 'ladder', v_id, 'updated');
  end if;
  return v_id;
end;
$$;

create or replace function public.save_competition_development_report(
  p_organization_id uuid,
  p_rider_id uuid,
  p_plan_id uuid,
  p_title_en text,
  p_title_ar text,
  p_content_en text,
  p_content_ar text,
  p_report_id uuid default null
)
returns uuid
language plpgsql security definer
set search_path = public, private
as $$
declare v_id uuid := p_report_id;
begin
  if not private.can_manage_competition_development(p_organization_id, p_rider_id)
    or not exists (
      select 1 from public.competition_annual_plans plan
      where plan.id = p_plan_id and plan.organization_id = p_organization_id and plan.rider_id = p_rider_id
    ) then
    raise exception 'Report is not authorized for this rider' using errcode = '42501';
  end if;
  if p_report_id is null then
    insert into public.competition_development_reports (
      organization_id, plan_id, rider_id, title_en, title_ar, content_en, content_ar, created_by, updated_by
    ) values (
      p_organization_id, p_plan_id, p_rider_id, btrim(p_title_en), btrim(p_title_ar),
      btrim(p_content_en), btrim(p_content_ar), auth.uid(), auth.uid()
    ) returning id into v_id;
    perform private.competition_audit(p_organization_id, p_rider_id, 'report', v_id, 'created');
  else
    update public.competition_development_reports
    set title_en = btrim(p_title_en), title_ar = btrim(p_title_ar),
      content_en = btrim(p_content_en), content_ar = btrim(p_content_ar),
      updated_by = auth.uid(), updated_at = now()
    where id = p_report_id and organization_id = p_organization_id and rider_id = p_rider_id
      and status = 'draft'
    returning id into v_id;
    if v_id is null then raise exception 'Only draft reports can be edited' using errcode = '42501'; end if;
    perform private.competition_audit(p_organization_id, p_rider_id, 'report', v_id, 'updated');
  end if;
  return v_id;
end;
$$;

create or replace function public.approve_competition_development_report(p_report_id uuid)
returns void
language plpgsql security definer
set search_path = public, private
as $$
declare v_report public.competition_development_reports%rowtype;
begin
  select * into v_report from public.competition_development_reports where id = p_report_id;
  if v_report.id is null
    or v_report.status <> 'draft'
    or not private.can_manage_competition_development(v_report.organization_id, v_report.rider_id)
    or not exists (
      select 1 from public.competition_readiness_evidence evidence
      where evidence.organization_id = v_report.organization_id and evidence.rider_id = v_report.rider_id
        and evidence.status = 'signed_off'
        and private.competition_readiness_source_valid(
          evidence.organization_id, evidence.rider_id, evidence.horse_id,
          evidence.evidence_type, evidence.source_id
        )
    ) then
    raise exception 'Report approval requires current signed-off readiness evidence' using errcode = '42501';
  end if;
  update public.competition_development_reports
  set status = 'approved', approved_by = auth.uid(), approved_at = now(), updated_by = auth.uid(), updated_at = now()
  where id = p_report_id;
  perform private.competition_audit(v_report.organization_id, v_report.rider_id, 'report', p_report_id, 'approved');
end;
$$;

create or replace function public.publish_competition_development_report(p_report_id uuid)
returns void
language plpgsql security definer
set search_path = public, private
as $$
declare v_report public.competition_development_reports%rowtype;
begin
  select * into v_report from public.competition_development_reports where id = p_report_id;
  if v_report.id is null or v_report.status <> 'approved'
    or not private.can_manage_competition_development(v_report.organization_id, v_report.rider_id) then
    raise exception 'Only an approved report may be published' using errcode = '42501';
  end if;
  update public.competition_development_reports
  set status = 'published', published_by = auth.uid(), published_at = now(),
    updated_by = auth.uid(), updated_at = now()
  where id = p_report_id;
  perform private.competition_audit(v_report.organization_id, v_report.rider_id, 'report', p_report_id, 'published');
end;
$$;

revoke all on function private.competition_development_enabled(uuid) from public, anon, authenticated;
revoke all on function private.can_manage_competition_calendar(uuid, uuid) from public, anon, authenticated;
revoke all on function private.can_manage_competition_development(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function private.can_view_competition_rider(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function private.can_view_competition_costs(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function private.competition_readiness_source_valid(uuid, uuid, uuid, text, uuid) from public, anon, authenticated;
revoke all on function private.competition_audit(uuid, uuid, text, uuid, text, jsonb) from public, anon, authenticated;

grant execute on function public.get_competition_development_access(uuid, uuid) to authenticated;
grant execute on function public.get_competition_development_riders(uuid) to authenticated;
grant execute on function public.get_competition_development_coaches(uuid, uuid) to authenticated;
grant execute on function public.get_competition_development_workspace(uuid, uuid) to authenticated;
grant execute on function public.save_competition_annual_plan(uuid, uuid, integer, text, text, text, text, uuid, uuid, boolean, boolean) to authenticated;
grant execute on function public.save_competition_event(uuid, text, text, text, date, date, date, text, boolean, uuid) to authenticated;
grant execute on function public.save_competition_entry(uuid, uuid, uuid, text, text, smallint, uuid, uuid, uuid, text, text, text, uuid, boolean, boolean) to authenticated;
grant execute on function public.save_competition_logistics(uuid, text, text, text, integer, text, boolean, text) to authenticated;
grant execute on function public.save_competition_result(uuid, integer, numeric, text, text, boolean) to authenticated;
grant execute on function public.save_competition_readiness(uuid, uuid, text, uuid, text, uuid, uuid, uuid, boolean) to authenticated;
grant execute on function public.confirm_competition_readiness(uuid) to authenticated;
grant execute on function public.save_competition_jumping_progress(uuid, uuid, smallint, text, uuid, uuid, uuid, uuid, boolean) to authenticated;
grant execute on function public.save_competition_development_report(uuid, uuid, uuid, text, text, text, text, uuid) to authenticated;
grant execute on function public.approve_competition_development_report(uuid) to authenticated;
grant execute on function public.publish_competition_development_report(uuid) to authenticated;

commit;