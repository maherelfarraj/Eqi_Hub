-- Video Release 3: approved-only development intelligence for the adult-rider pilot.
-- Additive to Video Releases 1 and 2. This migration never enables the pilot.
begin;

create table public.video_release_3_feature_flags (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  pilot_code text not null default 'adult_rider_development_intelligence',
  enabled boolean not null default false,
  enabled_by uuid references public.profiles(id) on delete set null,
  enabled_at timestamptz,
  updated_at timestamptz not null default now(),
  check (pilot_code = 'adult_rider_development_intelligence')
);

create table public.video_release_3_training_plans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  rider_id uuid not null,
  horse_id uuid,
  title text not null,
  cycle_type text not null,
  period_start date not null,
  period_end date not null,
  target_text text not null,
  status text not null default 'draft',
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  foreign key (organization_id, rider_id)
    references public.organization_memberships(organization_id, user_id) on delete restrict,
  foreign key (horse_id, organization_id)
    references public.horses(id, organization_id) on delete set null,
  check (length(btrim(title)) between 2 and 160),
  check (cycle_type in ('monthly', 'term', 'yearly')),
  check (period_end >= period_start),
  check (length(btrim(target_text)) between 2 and 2000),
  check (status in ('draft', 'active', 'completed', 'archived'))
);

create table public.video_release_3_plan_evidence (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  plan_id uuid not null,
  session_id uuid not null references public.video_release_2_sessions(id) on delete cascade,
  evidence_note text,
  linked_by uuid not null references public.profiles(id) on delete restrict,
  linked_at timestamptz not null default now(),
  primary key (plan_id, session_id),
  foreign key (organization_id, plan_id)
    references public.video_release_3_training_plans(organization_id, id) on delete cascade,
  check (evidence_note is null or length(evidence_note) <= 1000)
);

create table public.video_release_3_benchmarks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  rider_id uuid not null,
  horse_id uuid,
  benchmark_family text not null,
  level smallint not null,
  evidence_revision_id uuid not null references public.video_release_2_review_revisions(id) on delete restrict,
  coach_note text,
  confirmed_by uuid not null references public.profiles(id) on delete restrict,
  confirmed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  foreign key (organization_id, rider_id)
    references public.organization_memberships(organization_id, user_id) on delete restrict,
  foreign key (horse_id, organization_id)
    references public.horses(id, organization_id) on delete set null,
  check (benchmark_family in ('foundation', 'show_jumping')),
  check (
    (benchmark_family = 'foundation' and level between 1 and 10)
    or (benchmark_family = 'show_jumping' and level between 1 and 5)
  ),
  check (coach_note is null or length(coach_note) <= 2000)
);

create table public.video_release_3_milestones (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  rider_id uuid not null,
  horse_id uuid,
  title text not null,
  milestone_date date not null,
  detail text,
  evidence_revision_id uuid references public.video_release_2_review_revisions(id) on delete restrict,
  confirmed_by uuid not null references public.profiles(id) on delete restrict,
  confirmed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  foreign key (organization_id, rider_id)
    references public.organization_memberships(organization_id, user_id) on delete restrict,
  foreign key (horse_id, organization_id)
    references public.horses(id, organization_id) on delete set null,
  check (length(btrim(title)) between 2 and 160),
  check (detail is null or length(detail) <= 2000)
);

create table public.video_release_3_comparisons (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  rider_id uuid not null,
  horse_id uuid,
  first_session_id uuid not null references public.video_release_2_sessions(id) on delete restrict,
  second_session_id uuid not null references public.video_release_2_sessions(id) on delete restrict,
  summary text not null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  foreign key (organization_id, rider_id)
    references public.organization_memberships(organization_id, user_id) on delete restrict,
  foreign key (horse_id, organization_id)
    references public.horses(id, organization_id) on delete set null,
  check (first_session_id <> second_session_id),
  check (length(btrim(summary)) between 2 and 4000)
);

create table public.video_release_3_reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  rider_id uuid not null,
  horse_id uuid,
  period_start date not null,
  period_end date not null,
  title_en text not null,
  title_ar text not null,
  content_en text not null,
  content_ar text not null,
  status text not null default 'draft',
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid not null references public.profiles(id) on delete restrict,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, rider_id)
    references public.organization_memberships(organization_id, user_id) on delete restrict,
  foreign key (horse_id, organization_id)
    references public.horses(id, organization_id) on delete set null,
  check (period_end >= period_start),
  check (length(btrim(title_en)) between 2 and 200),
  check (length(btrim(title_ar)) between 2 and 200),
  check (length(btrim(content_en)) between 2 and 12000),
  check (length(btrim(content_ar)) between 2 and 12000),
  check (status in ('draft', 'approved')),
  check (
    (status = 'approved' and approved_by is not null and approved_at is not null)
    or (status = 'draft' and approved_by is null and approved_at is null)
  )
);

create table public.video_release_3_report_evidence (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  report_id uuid not null references public.video_release_3_reports(id) on delete cascade,
  session_id uuid not null references public.video_release_2_sessions(id) on delete restrict,
  linked_by uuid not null references public.profiles(id) on delete restrict,
  linked_at timestamptz not null default now(),
  primary key (report_id, session_id)
);

create table public.video_release_3_audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  rider_id uuid,
  actor_user_id uuid references public.profiles(id) on delete set null,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  check (entity_type in ('timeline', 'plan', 'plan_evidence', 'benchmark', 'milestone', 'comparison', 'report')),
  check (action in ('read', 'created', 'updated', 'linked', 'approved'))
);

create index video_release_3_plans_scope_idx
  on public.video_release_3_training_plans (organization_id, rider_id, period_start desc);
create index video_release_3_plan_evidence_session_idx
  on public.video_release_3_plan_evidence (organization_id, session_id);
create index video_release_3_benchmarks_scope_idx
  on public.video_release_3_benchmarks (organization_id, rider_id, confirmed_at desc);
create index video_release_3_milestones_scope_idx
  on public.video_release_3_milestones (organization_id, rider_id, milestone_date desc);
create index video_release_3_comparisons_scope_idx
  on public.video_release_3_comparisons (organization_id, rider_id, created_at desc);
create index video_release_3_reports_scope_idx
  on public.video_release_3_reports (organization_id, rider_id, updated_at desc);
create index video_release_3_report_evidence_session_idx
  on public.video_release_3_report_evidence (organization_id, session_id);
create index video_release_3_audit_scope_idx
  on public.video_release_3_audit_events (organization_id, rider_id, occurred_at desc);

create or replace function private.video_release_3_enabled(p_organization_id uuid)
returns boolean
language sql stable security definer
set search_path = public, private
as $$
  select private.video_release_2_enabled(p_organization_id)
    and exists (
      select 1 from public.video_release_3_feature_flags flag
      where flag.organization_id = p_organization_id
        and flag.pilot_code = 'adult_rider_development_intelligence'
        and flag.enabled
    );
$$;

create or replace function private.can_manage_video_release_3(
  p_organization_id uuid,
  p_rider_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql stable security definer
set search_path = public, private
as $$
  select private.video_release_3_enabled(p_organization_id)
    and private.can_coach_video_release_2_rider(p_organization_id, p_user_id, p_rider_id);
$$;

create or replace function private.video_release_3_approved_session(
  p_organization_id uuid,
  p_rider_id uuid,
  p_session_id uuid,
  p_horse_id uuid default null
)
returns boolean
language sql stable security definer
set search_path = public, private
as $$
  select exists (
    select 1
    from public.video_release_2_sessions session
    join public.video_release_2_review_revisions revision
      on revision.id = session.approved_revision_id
     and revision.status = 'approved'
    where session.id = p_session_id
      and session.organization_id = p_organization_id
      and session.rider_id = p_rider_id
      and (p_horse_id is null or session.horse_id = p_horse_id)
      and session.review_status = 'approved'
      and session.consent_status = 'granted'
      and session.retention_state = 'active'
      and session.approved_revision_id is not null
  );
$$;

create or replace function private.video_release_3_approved_revision(
  p_organization_id uuid,
  p_rider_id uuid,
  p_revision_id uuid,
  p_horse_id uuid default null
)
returns boolean
language sql stable security definer
set search_path = public, private
as $$
  select exists (
    select 1
    from public.video_release_2_sessions session
    where session.approved_revision_id = p_revision_id
      and private.video_release_3_approved_session(
        p_organization_id, p_rider_id, session.id, p_horse_id
      )
  );
$$;

create or replace function private.video_release_3_audit(
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
  insert into public.video_release_3_audit_events (
    organization_id, rider_id, actor_user_id, entity_type, entity_id, action, metadata
  ) values (
    p_organization_id, p_rider_id, auth.uid(), p_entity_type, p_entity_id, p_action, p_metadata
  );
end;
$$;

create or replace function private.video_release_3_plan_visible(
  p_plan public.video_release_3_training_plans
)
returns boolean
language sql stable security definer
set search_path = public, private
as $$
  select private.can_manage_video_release_3(p_plan.organization_id, p_plan.rider_id);
$$;

revoke all on function private.video_release_3_enabled(uuid) from public, anon, authenticated;
revoke all on function private.can_manage_video_release_3(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function private.video_release_3_approved_session(uuid, uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function private.video_release_3_approved_revision(uuid, uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function private.video_release_3_audit(uuid, uuid, text, uuid, text, jsonb) from public, anon, authenticated;
revoke all on function private.video_release_3_plan_visible(public.video_release_3_training_plans) from public, anon, authenticated;

alter table public.video_release_3_feature_flags enable row level security;
alter table public.video_release_3_training_plans enable row level security;
alter table public.video_release_3_plan_evidence enable row level security;
alter table public.video_release_3_benchmarks enable row level security;
alter table public.video_release_3_milestones enable row level security;
alter table public.video_release_3_comparisons enable row level security;
alter table public.video_release_3_reports enable row level security;
alter table public.video_release_3_report_evidence enable row level security;
alter table public.video_release_3_audit_events enable row level security;

create policy video_release_3_plans_assigned_coach_select on public.video_release_3_training_plans
  for select to authenticated using (private.video_release_3_plan_visible(video_release_3_training_plans));
create policy video_release_3_plan_evidence_assigned_coach_select on public.video_release_3_plan_evidence
  for select to authenticated using (
    exists (
      select 1 from public.video_release_3_training_plans plan
      where plan.id = video_release_3_plan_evidence.plan_id
        and private.video_release_3_plan_visible(plan)
    )
  );
create policy video_release_3_benchmarks_assigned_coach_select on public.video_release_3_benchmarks
  for select to authenticated using (
    private.can_manage_video_release_3(organization_id, rider_id)
  );
create policy video_release_3_milestones_assigned_coach_select on public.video_release_3_milestones
  for select to authenticated using (
    private.can_manage_video_release_3(organization_id, rider_id)
  );
create policy video_release_3_comparisons_assigned_coach_select on public.video_release_3_comparisons
  for select to authenticated using (
    private.can_manage_video_release_3(organization_id, rider_id)
  );
create policy video_release_3_reports_assigned_coach_select on public.video_release_3_reports
  for select to authenticated using (
    private.can_manage_video_release_3(organization_id, rider_id)
  );
create policy video_release_3_report_evidence_assigned_coach_select on public.video_release_3_report_evidence
  for select to authenticated using (
    exists (
      select 1 from public.video_release_3_reports report
      where report.id = video_release_3_report_evidence.report_id
        and private.can_manage_video_release_3(report.organization_id, report.rider_id)
    )
  );
create policy video_release_3_audit_assigned_coach_select on public.video_release_3_audit_events
  for select to authenticated using (
    rider_id is not null and private.can_manage_video_release_3(organization_id, rider_id)
  );

revoke all on table public.video_release_3_feature_flags from anon, authenticated;
revoke all on table public.video_release_3_training_plans from anon, authenticated;
revoke all on table public.video_release_3_plan_evidence from anon, authenticated;
revoke all on table public.video_release_3_benchmarks from anon, authenticated;
revoke all on table public.video_release_3_milestones from anon, authenticated;
revoke all on table public.video_release_3_comparisons from anon, authenticated;
revoke all on table public.video_release_3_reports from anon, authenticated;
revoke all on table public.video_release_3_report_evidence from anon, authenticated;
revoke all on table public.video_release_3_audit_events from anon, authenticated;

create or replace function public.get_video_release_3_access(p_organization_id uuid)
returns table (enabled boolean, can_manage boolean, pilot_scope text)
language plpgsql security definer
set search_path = public, private
as $$
declare
  v_can_manage boolean := false;
begin
  v_can_manage := private.can_manage_video_release_2(p_organization_id, auth.uid())
    and private.video_release_3_enabled(p_organization_id);
  return query select
    private.video_release_3_enabled(p_organization_id),
    v_can_manage,
    case when v_can_manage then 'coach' else 'not_enrolled' end;
end;
$$;

create or replace function public.get_video_release_3_timeline(
  p_organization_id uuid,
  p_rider_id uuid,
  p_horse_id uuid default null
)
returns table (
  session_id uuid,
  approved_at timestamptz,
  title text,
  exercise_context text,
  horse_id uuid,
  category text,
  score smallint
)
language plpgsql security definer
set search_path = public, private
as $$
begin
  if not private.can_manage_video_release_3(p_organization_id, p_rider_id) then
    raise exception 'Only the assigned coach can view approved development timelines' using errcode = '42501';
  end if;
  perform private.video_release_3_audit(p_organization_id, p_rider_id, 'timeline', null, 'read',
    jsonb_build_object('horse_id', p_horse_id));
  return query
  select session.id, session.approved_at, session.title, session.exercise_context,
    session.horse_id, scorecard.category, scorecard.score
  from public.video_release_2_sessions session
  join public.video_release_2_scorecards scorecard
    on scorecard.revision_id = session.approved_revision_id
  where session.organization_id = p_organization_id
    and session.rider_id = p_rider_id
    and (p_horse_id is null or session.horse_id = p_horse_id)
    and session.review_status = 'approved'
    and session.consent_status = 'granted'
    and session.retention_state = 'active'
  order by session.approved_at, scorecard.category;
end;
$$;

create or replace function public.get_video_release_3_plans(
  p_organization_id uuid, p_rider_id uuid
)
returns table (
  id uuid, horse_id uuid, title text, cycle_type text, period_start date,
  period_end date, target_text text, status text, evidence_count bigint,
  created_at timestamptz, updated_at timestamptz
)
language plpgsql security definer
set search_path = public, private
as $$
begin
  if not private.can_manage_video_release_3(p_organization_id, p_rider_id) then
    raise exception 'Only the assigned coach can view training plans' using errcode = '42501';
  end if;
  perform private.video_release_3_audit(p_organization_id, p_rider_id, 'plan', null, 'read');
  return query
  select plan.id, plan.horse_id, plan.title, plan.cycle_type, plan.period_start,
    plan.period_end, plan.target_text, plan.status,
    (
      select count(*)
      from public.video_release_3_plan_evidence evidence
      where evidence.plan_id = plan.id
        and private.video_release_3_approved_session(
          plan.organization_id, plan.rider_id, evidence.session_id, plan.horse_id
        )
    ),
    plan.created_at, plan.updated_at
  from public.video_release_3_training_plans plan
  where plan.organization_id = p_organization_id and plan.rider_id = p_rider_id
    and not exists (
      select 1
      from public.video_release_3_plan_evidence evidence
      where evidence.plan_id = plan.id
        and not private.video_release_3_approved_session(
          plan.organization_id, plan.rider_id, evidence.session_id, plan.horse_id
        )
    )
  order by plan.period_start desc, plan.created_at desc;
end;
$$;

create or replace function public.save_video_release_3_training_plan(
  p_organization_id uuid,
  p_rider_id uuid,
  p_title text,
  p_cycle_type text,
  p_period_start date,
  p_period_end date,
  p_target_text text,
  p_horse_id uuid default null,
  p_plan_id uuid default null,
  p_status text default 'draft'
)
returns uuid
language plpgsql security definer
set search_path = public, private
as $$
declare v_plan_id uuid := p_plan_id;
begin
  if not private.can_manage_video_release_3(p_organization_id, p_rider_id) then
    raise exception 'Only the assigned coach can manage training plans' using errcode = '42501';
  end if;
  if p_plan_id is not null and not exists (
    select 1 from public.video_release_3_training_plans plan
    where plan.id = p_plan_id and plan.organization_id = p_organization_id and plan.rider_id = p_rider_id
      and not exists (
        select 1
        from public.video_release_3_plan_evidence evidence
        where evidence.plan_id = plan.id
          and not private.video_release_3_approved_session(
            plan.organization_id, plan.rider_id, evidence.session_id, plan.horse_id
          )
      )
  ) then
    raise exception 'Training plan is not available' using errcode = '42501';
  end if;
  if p_plan_id is null then
    insert into public.video_release_3_training_plans (
      organization_id, rider_id, horse_id, title, cycle_type, period_start, period_end,
      target_text, status, created_by, updated_by
    ) values (
      p_organization_id, p_rider_id, p_horse_id, btrim(p_title), p_cycle_type, p_period_start,
      p_period_end, btrim(p_target_text), p_status, auth.uid(), auth.uid()
    ) returning id into v_plan_id;
    perform private.video_release_3_audit(p_organization_id, p_rider_id, 'plan', v_plan_id, 'created');
  else
    update public.video_release_3_training_plans
    set horse_id = p_horse_id, title = btrim(p_title), cycle_type = p_cycle_type,
      period_start = p_period_start, period_end = p_period_end, target_text = btrim(p_target_text),
      status = p_status, updated_by = auth.uid(), updated_at = now()
    where id = p_plan_id;
    perform private.video_release_3_audit(p_organization_id, p_rider_id, 'plan', v_plan_id, 'updated');
  end if;
  return v_plan_id;
end;
$$;

create or replace function public.link_video_release_3_plan_evidence(
  p_plan_id uuid, p_session_id uuid, p_evidence_note text default null
)
returns void
language plpgsql security definer
set search_path = public, private
as $$
declare v_plan public.video_release_3_training_plans;
begin
  select * into v_plan from public.video_release_3_training_plans where id = p_plan_id;
  if not found or not private.can_manage_video_release_3(v_plan.organization_id, v_plan.rider_id)
    or not private.video_release_3_approved_session(v_plan.organization_id, v_plan.rider_id, p_session_id, v_plan.horse_id) then
    raise exception 'Only approved evidence for this assigned rider and horse pair can be linked' using errcode = '42501';
  end if;
  insert into public.video_release_3_plan_evidence (
    organization_id, plan_id, session_id, evidence_note, linked_by
  ) values (
    v_plan.organization_id, p_plan_id, p_session_id, nullif(btrim(p_evidence_note), ''), auth.uid()
  ) on conflict (plan_id, session_id) do update set
    evidence_note = excluded.evidence_note, linked_by = auth.uid(), linked_at = now();
  perform private.video_release_3_audit(v_plan.organization_id, v_plan.rider_id, 'plan_evidence', p_plan_id, 'linked',
    jsonb_build_object('session_id', p_session_id));
end;
$$;

create or replace function public.get_video_release_3_benchmarks(
  p_organization_id uuid, p_rider_id uuid
)
returns table (
  id uuid, horse_id uuid, benchmark_family text, level smallint, evidence_revision_id uuid,
  coach_note text, confirmed_at timestamptz
)
language plpgsql security definer
set search_path = public, private
as $$
begin
  if not private.can_manage_video_release_3(p_organization_id, p_rider_id) then
    raise exception 'Only the assigned coach can view benchmark evidence' using errcode = '42501';
  end if;
  perform private.video_release_3_audit(p_organization_id, p_rider_id, 'benchmark', null, 'read');
  return query
  select benchmark.id, benchmark.horse_id, benchmark.benchmark_family, benchmark.level,
    benchmark.evidence_revision_id, benchmark.coach_note, benchmark.confirmed_at
  from public.video_release_3_benchmarks benchmark
  where benchmark.organization_id = p_organization_id and benchmark.rider_id = p_rider_id
    and private.video_release_3_approved_revision(
      p_organization_id, p_rider_id, benchmark.evidence_revision_id, benchmark.horse_id
    )
  order by benchmark.confirmed_at desc;
end;
$$;

create or replace function public.confirm_video_release_3_benchmark(
  p_organization_id uuid, p_rider_id uuid, p_benchmark_family text, p_level smallint,
  p_evidence_session_id uuid, p_horse_id uuid default null, p_coach_note text default null
)
returns uuid
language plpgsql security definer
set search_path = public, private
as $$
declare v_id uuid; v_evidence_revision_id uuid;
begin
  if not private.can_manage_video_release_3(p_organization_id, p_rider_id)
    or not exists (
      select 1
      from public.video_release_2_sessions session
      where session.id = p_evidence_session_id
        and private.video_release_3_approved_session(p_organization_id, p_rider_id, session.id, p_horse_id)
    ) then
    raise exception 'Benchmark evidence must be an approved review for the assigned rider' using errcode = '42501';
  end if;
  select approved_revision_id into v_evidence_revision_id
  from public.video_release_2_sessions where id = p_evidence_session_id;
  insert into public.video_release_3_benchmarks (
    organization_id, rider_id, horse_id, benchmark_family, level, evidence_revision_id, coach_note, confirmed_by
  ) values (
    p_organization_id, p_rider_id, p_horse_id, p_benchmark_family, p_level, v_evidence_revision_id,
    nullif(btrim(p_coach_note), ''), auth.uid()
  ) returning id into v_id;
  perform private.video_release_3_audit(p_organization_id, p_rider_id, 'benchmark', v_id, 'created');
  return v_id;
end;
$$;

create or replace function public.get_video_release_3_milestones(
  p_organization_id uuid, p_rider_id uuid
)
returns table (
  id uuid, horse_id uuid, title text, milestone_date date, detail text,
  evidence_revision_id uuid, confirmed_at timestamptz
)
language plpgsql security definer
set search_path = public, private
as $$
begin
  if not private.can_manage_video_release_3(p_organization_id, p_rider_id) then
    raise exception 'Only the assigned coach can view milestones' using errcode = '42501';
  end if;
  perform private.video_release_3_audit(p_organization_id, p_rider_id, 'milestone', null, 'read');
  return query
  select milestone.id, milestone.horse_id, milestone.title, milestone.milestone_date,
    milestone.detail, milestone.evidence_revision_id, milestone.confirmed_at
  from public.video_release_3_milestones milestone
  where milestone.organization_id = p_organization_id and milestone.rider_id = p_rider_id
    and (
      milestone.evidence_revision_id is null
      or private.video_release_3_approved_revision(
        p_organization_id, p_rider_id, milestone.evidence_revision_id, milestone.horse_id
      )
    )
  order by milestone.milestone_date desc, milestone.confirmed_at desc;
end;
$$;

create or replace function public.create_video_release_3_milestone(
  p_organization_id uuid, p_rider_id uuid, p_title text, p_milestone_date date,
  p_detail text default null, p_horse_id uuid default null, p_evidence_session_id uuid default null
)
returns uuid
language plpgsql security definer
set search_path = public, private
as $$
declare v_id uuid; v_evidence_revision_id uuid;
begin
  if not private.can_manage_video_release_3(p_organization_id, p_rider_id)
    or (p_evidence_session_id is not null and not exists (
      select 1
      from public.video_release_2_sessions session
      where session.id = p_evidence_session_id
        and private.video_release_3_approved_session(p_organization_id, p_rider_id, session.id, p_horse_id)
    )) then
    raise exception 'Milestones must be confirmed by the assigned coach and use approved evidence' using errcode = '42501';
  end if;
  if p_evidence_session_id is not null then
    select approved_revision_id into v_evidence_revision_id
    from public.video_release_2_sessions where id = p_evidence_session_id;
  end if;
  insert into public.video_release_3_milestones (
    organization_id, rider_id, horse_id, title, milestone_date, detail, evidence_revision_id, confirmed_by
  ) values (
    p_organization_id, p_rider_id, p_horse_id, btrim(p_title), p_milestone_date,
    nullif(btrim(p_detail), ''), v_evidence_revision_id, auth.uid()
  ) returning id into v_id;
  perform private.video_release_3_audit(p_organization_id, p_rider_id, 'milestone', v_id, 'created');
  return v_id;
end;
$$;

create or replace function public.get_video_release_3_comparisons(
  p_organization_id uuid, p_rider_id uuid
)
returns table (
  id uuid, horse_id uuid, first_session_id uuid, second_session_id uuid,
  summary text, created_at timestamptz
)
language plpgsql security definer
set search_path = public, private
as $$
begin
  if not private.can_manage_video_release_3(p_organization_id, p_rider_id) then
    raise exception 'Only the assigned coach can view comparison history' using errcode = '42501';
  end if;
  perform private.video_release_3_audit(p_organization_id, p_rider_id, 'comparison', null, 'read');
  return query
  select comparison.id, comparison.horse_id, comparison.first_session_id,
    comparison.second_session_id, comparison.summary, comparison.created_at
  from public.video_release_3_comparisons comparison
  where comparison.organization_id = p_organization_id and comparison.rider_id = p_rider_id
    and private.video_release_3_approved_session(
      p_organization_id, p_rider_id, comparison.first_session_id, comparison.horse_id
    )
    and private.video_release_3_approved_session(
      p_organization_id, p_rider_id, comparison.second_session_id, comparison.horse_id
    )
  order by comparison.created_at desc;
end;
$$;

create or replace function public.create_video_release_3_comparison(
  p_organization_id uuid, p_rider_id uuid, p_first_session_id uuid,
  p_second_session_id uuid, p_summary text, p_horse_id uuid default null
)
returns uuid
language plpgsql security definer
set search_path = public, private
as $$
declare v_id uuid;
begin
  if not private.can_manage_video_release_3(p_organization_id, p_rider_id)
    or not private.video_release_3_approved_session(p_organization_id, p_rider_id, p_first_session_id, p_horse_id)
    or not private.video_release_3_approved_session(p_organization_id, p_rider_id, p_second_session_id, p_horse_id) then
    raise exception 'Comparison history requires two approved reviews for the assigned rider and horse pair' using errcode = '42501';
  end if;
  insert into public.video_release_3_comparisons (
    organization_id, rider_id, horse_id, first_session_id, second_session_id, summary, created_by
  ) values (
    p_organization_id, p_rider_id, p_horse_id, p_first_session_id, p_second_session_id, btrim(p_summary), auth.uid()
  ) returning id into v_id;
  perform private.video_release_3_audit(p_organization_id, p_rider_id, 'comparison', v_id, 'created');
  return v_id;
end;
$$;

create or replace function public.get_video_release_3_reports(
  p_organization_id uuid, p_rider_id uuid
)
returns table (
  id uuid, horse_id uuid, period_start date, period_end date, title_en text, title_ar text,
  content_en text, content_ar text, status text, approved_at timestamptz,
  source_count bigint, updated_at timestamptz
)
language plpgsql security definer
set search_path = public, private
as $$
begin
  if not private.can_manage_video_release_3(p_organization_id, p_rider_id) then
    raise exception 'Only the assigned coach can view Coach reports' using errcode = '42501';
  end if;
  perform private.video_release_3_audit(p_organization_id, p_rider_id, 'report', null, 'read');
  return query
  select report.id, report.horse_id, report.period_start, report.period_end, report.title_en,
    report.title_ar, report.content_en, report.content_ar, report.status, report.approved_at,
    (select count(*) from public.video_release_3_report_evidence evidence where evidence.report_id = report.id),
    report.updated_at
  from public.video_release_3_reports report
  where report.organization_id = p_organization_id and report.rider_id = p_rider_id
    and not exists (
      select 1
      from public.video_release_3_report_evidence evidence
      where evidence.report_id = report.id
        and not private.video_release_3_approved_session(
          report.organization_id, report.rider_id, evidence.session_id, report.horse_id
        )
    )
  order by report.updated_at desc;
end;
$$;

create or replace function public.save_video_release_3_report(
  p_organization_id uuid, p_rider_id uuid, p_period_start date, p_period_end date,
  p_title_en text, p_title_ar text, p_content_en text, p_content_ar text,
  p_source_session_ids uuid[], p_report_id uuid default null
)
returns uuid
language plpgsql security definer
set search_path = public, private
as $$
declare v_report_id uuid := p_report_id;
begin
  if not private.can_manage_video_release_3(p_organization_id, p_rider_id) then
    raise exception 'Only the assigned coach can manage Coach reports' using errcode = '42501';
  end if;
  if p_report_id is not null and not exists (
    select 1 from public.video_release_3_reports report
    where report.id = p_report_id and report.organization_id = p_organization_id and report.rider_id = p_rider_id
  ) then
    raise exception 'Report is not available' using errcode = '42501';
  end if;
  if coalesce(array_length(p_source_session_ids, 1), 0) = 0
    or exists (
      select 1 from unnest(p_source_session_ids) session_id
      where not private.video_release_3_approved_session(p_organization_id, p_rider_id, session_id)
    ) then
    raise exception 'Reports must cite at least one approved review' using errcode = '23514';
  end if;
  if v_report_id is null then
    insert into public.video_release_3_reports (
      organization_id, rider_id, period_start, period_end, title_en, title_ar,
      content_en, content_ar, created_by, updated_by
    ) values (
      p_organization_id, p_rider_id, p_period_start, p_period_end, btrim(p_title_en), btrim(p_title_ar),
      btrim(p_content_en), btrim(p_content_ar), auth.uid(), auth.uid()
    ) returning id into v_report_id;
    perform private.video_release_3_audit(p_organization_id, p_rider_id, 'report', v_report_id, 'created');
  else
    update public.video_release_3_reports
    set period_start = p_period_start, period_end = p_period_end,
      title_en = btrim(p_title_en), title_ar = btrim(p_title_ar),
      content_en = btrim(p_content_en), content_ar = btrim(p_content_ar),
      status = 'draft', approved_by = null, approved_at = null,
      updated_by = auth.uid(), updated_at = now()
    where id = v_report_id;
    perform private.video_release_3_audit(p_organization_id, p_rider_id, 'report', v_report_id, 'updated');
  end if;
  delete from public.video_release_3_report_evidence where report_id = v_report_id;
  insert into public.video_release_3_report_evidence (
    organization_id, report_id, session_id, linked_by
  )
  select p_organization_id, v_report_id, session_id, auth.uid()
  from unnest(p_source_session_ids) session_id
  on conflict (report_id, session_id) do nothing;
  return v_report_id;
end;
$$;

create or replace function public.approve_video_release_3_report(
  p_report_id uuid
)
returns void
language plpgsql security definer
set search_path = public, private
as $$
declare v_report public.video_release_3_reports;
begin
  select * into v_report from public.video_release_3_reports where id = p_report_id;
  if not found or not private.can_manage_video_release_3(v_report.organization_id, v_report.rider_id) then
    raise exception 'Only the assigned coach can approve this report' using errcode = '42501';
  end if;
  if length(btrim(v_report.title_en)) < 2 or length(btrim(v_report.title_ar)) < 2
    or length(btrim(v_report.content_en)) < 2 or length(btrim(v_report.content_ar)) < 2
    or not exists (select 1 from public.video_release_3_report_evidence where report_id = p_report_id)
    or exists (
      select 1
      from public.video_release_3_report_evidence evidence
      where evidence.report_id = p_report_id
        and not private.video_release_3_approved_session(
          v_report.organization_id, v_report.rider_id, evidence.session_id, v_report.horse_id
        )
    ) then
    raise exception 'Bilingual content and approved evidence are required before approval' using errcode = '23514';
  end if;
  update public.video_release_3_reports
  set status = 'approved', approved_by = auth.uid(), approved_at = now(), updated_by = auth.uid(), updated_at = now()
  where id = p_report_id;
  perform private.video_release_3_audit(v_report.organization_id, v_report.rider_id, 'report', p_report_id, 'approved');
end;
$$;

revoke all on function public.get_video_release_3_access(uuid) from public;
revoke all on function public.get_video_release_3_timeline(uuid, uuid, uuid) from public;
revoke all on function public.get_video_release_3_plans(uuid, uuid) from public;
revoke all on function public.save_video_release_3_training_plan(uuid, uuid, text, text, date, date, text, uuid, uuid, text) from public;
revoke all on function public.link_video_release_3_plan_evidence(uuid, uuid, text) from public;
revoke all on function public.get_video_release_3_benchmarks(uuid, uuid) from public;
revoke all on function public.confirm_video_release_3_benchmark(uuid, uuid, text, smallint, uuid, uuid, text) from public;
revoke all on function public.get_video_release_3_milestones(uuid, uuid) from public;
revoke all on function public.create_video_release_3_milestone(uuid, uuid, text, date, text, uuid, uuid) from public;
revoke all on function public.get_video_release_3_comparisons(uuid, uuid) from public;
revoke all on function public.create_video_release_3_comparison(uuid, uuid, uuid, uuid, text, uuid) from public;
revoke all on function public.get_video_release_3_reports(uuid, uuid) from public;
revoke all on function public.save_video_release_3_report(uuid, uuid, date, date, text, text, text, text, uuid[], uuid) from public;
revoke all on function public.approve_video_release_3_report(uuid) from public;

grant execute on function public.get_video_release_3_access(uuid) to authenticated;
grant execute on function public.get_video_release_3_timeline(uuid, uuid, uuid) to authenticated;
grant execute on function public.get_video_release_3_plans(uuid, uuid) to authenticated;
grant execute on function public.save_video_release_3_training_plan(uuid, uuid, text, text, date, date, text, uuid, uuid, text) to authenticated;
grant execute on function public.link_video_release_3_plan_evidence(uuid, uuid, text) to authenticated;
grant execute on function public.get_video_release_3_benchmarks(uuid, uuid) to authenticated;
grant execute on function public.confirm_video_release_3_benchmark(uuid, uuid, text, smallint, uuid, uuid, text) to authenticated;
grant execute on function public.get_video_release_3_milestones(uuid, uuid) to authenticated;
grant execute on function public.create_video_release_3_milestone(uuid, uuid, text, date, text, uuid, uuid) to authenticated;
grant execute on function public.get_video_release_3_comparisons(uuid, uuid) to authenticated;
grant execute on function public.create_video_release_3_comparison(uuid, uuid, uuid, uuid, text, uuid) to authenticated;
grant execute on function public.get_video_release_3_reports(uuid, uuid) to authenticated;
grant execute on function public.save_video_release_3_report(uuid, uuid, date, date, text, text, text, text, uuid[], uuid) to authenticated;
grant execute on function public.approve_video_release_3_report(uuid) to authenticated;

commit;