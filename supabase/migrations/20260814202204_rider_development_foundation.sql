-- Batch 1: organization-scoped rider development records, competency evidence,
-- coach approval, rider reflection, and guardian read-only visibility.
begin;

create table public.rider_competency_catalog (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  code text not null,
  name text not null,
  category text not null,
  description text,
  version integer not null default 1,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rider_competency_catalog_code_format
    check (code ~ '^[a-z][a-z0-9_]{2,63}$'),
  constraint rider_competency_catalog_name_length
    check (char_length(btrim(name)) between 3 and 120),
  constraint rider_competency_catalog_category_length
    check (char_length(btrim(category)) between 3 and 80),
  constraint rider_competency_catalog_version_positive check (version > 0)
);

create unique index rider_competency_catalog_scope_code_version_uidx
  on public.rider_competency_catalog (
    coalesce(organization_id, '00000000-0000-0000-0000-000000000000'::uuid),
    code,
    version
  );
create index rider_competency_catalog_scope_active_idx
  on public.rider_competency_catalog (organization_id, active, sort_order);

create table public.lesson_development_reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lesson_id uuid not null,
  rider_id uuid not null references auth.users(id) on delete restrict,
  coach_id uuid not null references auth.users(id) on delete restrict,
  status text not null default 'draft',
  objectives text[] not null default '{}',
  summary text not null default '',
  strengths text[] not null default '{}',
  focus_areas text[] not null default '{}',
  horse_observations text,
  interaction_observations text,
  homework text,
  homework_due_at timestamptz,
  next_focus text not null default '',
  effort_score smallint,
  rider_confidence_score smallint,
  lesson_difficulty_score smallint,
  revision integer not null default 1,
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  approved_by uuid references auth.users(id) on delete restrict,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lesson_development_reports_lesson_id_fkey
    foreign key (lesson_id) references public.lessons(id) on delete restrict,
  constraint lesson_development_reports_one_per_lesson unique (lesson_id),
  constraint lesson_development_reports_status
    check (status in ('draft', 'approved')),
  constraint lesson_development_reports_revision_positive check (revision > 0),
  constraint lesson_development_reports_summary_length
    check (char_length(summary) <= 4000),
  constraint lesson_development_reports_next_focus_length
    check (char_length(next_focus) <= 2000),
  constraint lesson_development_reports_scores
    check (
      (effort_score is null or effort_score between 1 and 5)
      and (rider_confidence_score is null or rider_confidence_score between 1 and 5)
      and (lesson_difficulty_score is null or lesson_difficulty_score between 1 and 5)
    ),
  constraint lesson_development_reports_approval_complete
    check (
      (
        status = 'draft'
        and approved_by is null
        and approved_at is null
      )
      or (
        status = 'approved'
        and approved_by is not null
        and approved_at is not null
        and char_length(btrim(summary)) between 10 and 4000
        and char_length(btrim(next_focus)) between 3 and 2000
        and effort_score is not null
      )
    )
);

create index lesson_development_reports_rider_created_idx
  on public.lesson_development_reports (
    organization_id,
    rider_id,
    created_at desc
  );
create index lesson_development_reports_coach_status_idx
  on public.lesson_development_reports (
    organization_id,
    coach_id,
    status,
    updated_at desc
  );
create index lesson_development_reports_rider_id_idx
  on public.lesson_development_reports (rider_id);
create index lesson_development_reports_coach_id_idx
  on public.lesson_development_reports (coach_id);
create index lesson_development_reports_created_by_idx
  on public.lesson_development_reports (created_by);
create index lesson_development_reports_updated_by_idx
  on public.lesson_development_reports (updated_by);
create index lesson_development_reports_approved_by_idx
  on public.lesson_development_reports (approved_by);

create table public.lesson_development_report_history (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.lesson_development_reports(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  rider_id uuid not null references auth.users(id) on delete restrict,
  revision integer not null,
  snapshot jsonb not null,
  changed_by uuid not null references auth.users(id) on delete restrict,
  changed_at timestamptz not null default now(),
  constraint lesson_development_report_history_revision_positive
    check (revision > 0)
);

create index lesson_development_report_history_report_idx
  on public.lesson_development_report_history (report_id, revision desc);
create index lesson_development_report_history_organization_id_idx
  on public.lesson_development_report_history (organization_id);
create index lesson_development_report_history_rider_id_idx
  on public.lesson_development_report_history (rider_id);
create index lesson_development_report_history_changed_by_idx
  on public.lesson_development_report_history (changed_by);

create table public.lesson_development_private_notes (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.lesson_development_reports(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete restrict,
  note text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lesson_development_private_notes_length
    check (char_length(btrim(note)) between 1 and 4000)
);

create index lesson_development_private_notes_report_idx
  on public.lesson_development_private_notes (report_id, created_at desc);
create index lesson_development_private_notes_organization_id_idx
  on public.lesson_development_private_notes (organization_id);
create index lesson_development_private_notes_author_id_idx
  on public.lesson_development_private_notes (author_id);

create table public.lesson_development_reflections (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.lesson_development_reports(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  rider_id uuid not null references auth.users(id) on delete restrict,
  reflection text,
  question text,
  visible_to_guardian boolean not null default true,
  acknowledged_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lesson_development_reflections_one_per_rider
    unique (report_id, rider_id),
  constraint lesson_development_reflections_content
    check (
      nullif(btrim(coalesce(reflection, '')), '') is not null
      or nullif(btrim(coalesce(question, '')), '') is not null
    ),
  constraint lesson_development_reflections_reflection_length
    check (reflection is null or char_length(btrim(reflection)) between 1 and 3000),
  constraint lesson_development_reflections_question_length
    check (question is null or char_length(btrim(question)) between 1 and 1500)
);

create index lesson_development_reflections_report_idx
  on public.lesson_development_reflections (report_id, created_at desc);
create index lesson_development_reflections_organization_id_idx
  on public.lesson_development_reflections (organization_id);
create index lesson_development_reflections_rider_id_idx
  on public.lesson_development_reflections (rider_id);

create table public.rider_competency_evidence (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.lesson_development_reports(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  rider_id uuid not null references auth.users(id) on delete restrict,
  competency_id uuid not null references public.rider_competency_catalog(id) on delete restrict,
  stage text not null,
  evidence_note text,
  created_by uuid not null references auth.users(id) on delete restrict,
  approved_by uuid references auth.users(id) on delete restrict,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  constraint rider_competency_evidence_one_per_report
    unique (report_id, competency_id),
  constraint rider_competency_evidence_stage
    check (stage in ('introduced', 'practising', 'demonstrated', 'achieved')),
  constraint rider_competency_evidence_note_length
    check (evidence_note is null or char_length(btrim(evidence_note)) between 1 and 2000),
  constraint rider_competency_evidence_approval_complete
    check (
      (approved_by is null and approved_at is null)
      or (approved_by is not null and approved_at is not null)
    )
);

create index rider_competency_evidence_rider_idx
  on public.rider_competency_evidence (
    organization_id,
    rider_id,
    created_at desc
  );
create index rider_competency_evidence_rider_id_idx
  on public.rider_competency_evidence (rider_id);
create index rider_competency_evidence_competency_id_idx
  on public.rider_competency_evidence (competency_id);
create index rider_competency_evidence_created_by_idx
  on public.rider_competency_evidence (created_by);
create index rider_competency_evidence_approved_by_idx
  on public.rider_competency_evidence (approved_by);

create table public.rider_competency_progress (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  rider_id uuid not null references auth.users(id) on delete restrict,
  competency_id uuid not null references public.rider_competency_catalog(id) on delete restrict,
  stage text not null default 'not_started',
  evidence_count integer not null default 0,
  last_evidence_at timestamptz,
  confirmed_by uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rider_competency_progress_one_per_rider
    unique (organization_id, rider_id, competency_id),
  constraint rider_competency_progress_stage
    check (stage in ('not_started', 'introduced', 'practising', 'demonstrated', 'achieved')),
  constraint rider_competency_progress_evidence_count
    check (evidence_count >= 0)
);

create index rider_competency_progress_rider_stage_idx
  on public.rider_competency_progress (
    organization_id,
    rider_id,
    stage,
    updated_at desc
  );
create index rider_competency_progress_rider_id_idx
  on public.rider_competency_progress (rider_id);
create index rider_competency_progress_competency_id_idx
  on public.rider_competency_progress (competency_id);
create index rider_competency_progress_confirmed_by_idx
  on public.rider_competency_progress (confirmed_by);

comment on table public.lesson_development_reports is
  'Coach-authored lesson closeout; draft rows are staff-only and approved rows are rider/guardian visible.';
comment on table public.lesson_development_private_notes is
  'Private staff notes that are never included in rider or guardian report payloads.';
comment on table public.lesson_development_reflections is
  'Rider-owned acknowledgement, reflection, and question attached to an approved report.';
comment on table public.rider_competency_progress is
  'Coach-approved longitudinal rider competency stage; draft evidence cannot change this table.';

insert into public.rider_competency_catalog (
  id,
  code,
  name,
  category,
  description,
  sort_order
)
values
  ('c1000000-0000-4000-8000-000000000001', 'safety_readiness', 'Safety & Readiness', 'Safety', 'Pre-ride checks, arena awareness, and safe decisions.', 10),
  ('c1000000-0000-4000-8000-000000000002', 'mount_dismount', 'Mount & Dismount', 'Safety', 'Controlled mounting and dismounting with correct checks.', 20),
  ('c1000000-0000-4000-8000-000000000003', 'walk_control', 'Walk Control', 'Flatwork', 'Direction, tempo, halt, and transitions at walk.', 30),
  ('c1000000-0000-4000-8000-000000000004', 'trot_control', 'Trot Control', 'Flatwork', 'Rhythm, steering, and transitions at trot.', 40),
  ('c1000000-0000-4000-8000-000000000005', 'canter_control', 'Canter Control', 'Flatwork', 'Balanced rhythm, leads, steering, and transitions at canter.', 50),
  ('c1000000-0000-4000-8000-000000000006', 'independent_seat', 'Independent Seat', 'Position', 'Stable balance independent of rein support.', 60),
  ('c1000000-0000-4000-8000-000000000007', 'effective_aids', 'Effective Aids', 'Position', 'Clear, proportionate, and well-timed aids.', 70),
  ('c1000000-0000-4000-8000-000000000008', 'polework_rhythm', 'Polework Rhythm', 'Polework', 'Maintains rhythm, line, and balance through poles.', 80),
  ('c1000000-0000-4000-8000-000000000009', 'jumping_position', 'Jumping Position', 'Jumping', 'Balanced lower leg and upper-body position over fences.', 90),
  ('c1000000-0000-4000-8000-000000000010', 'approach_rhythm', 'Approach Rhythm', 'Jumping', 'Maintains a controlled rhythm and line to the fence.', 100),
  ('c1000000-0000-4000-8000-000000000011', 'release_timing', 'Release Timing', 'Jumping', 'Uses a proportionate release aligned with the horse.', 110),
  ('c1000000-0000-4000-8000-000000000012', 'landing_recovery', 'Landing Recovery', 'Jumping', 'Recovers balance, line, and rhythm after landing.', 120),
  ('c1000000-0000-4000-8000-000000000013', 'course_riding', 'Course Riding', 'Jumping', 'Plans and rides connected lines, turns, and approaches.', 130),
  ('c1000000-0000-4000-8000-000000000014', 'horse_partnership', 'Horse Partnership', 'Partnership', 'Adapts aids and decisions to the horse while protecting welfare.', 140);

create function private.can_manage_rider_development(
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
    private.is_platform_admin()
    or private.has_organization_role(
      p_organization_id,
      array['academy_admin', 'stable_manager']
    )
    or (
      private.has_organization_role(p_organization_id, array['coach'])
      and exists (
        select 1
        from public.coach_rider_assignments as assignment
        where assignment.organization_id = p_organization_id
          and assignment.coach_id = (select auth.uid())
          and assignment.rider_id = p_rider_id
          and assignment.active
          and assignment.starts_on <= current_date
          and (assignment.ends_on is null or assignment.ends_on >= current_date)
      )
    );
$$;

create function private.can_manage_lesson_development(
  p_lesson_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.lessons as lesson
    where lesson.id = p_lesson_id
      and lesson.organization_id is not null
      and lesson.trainer_id is not null
      and lesson.status in ('confirmed', 'completed')
      and (
        private.is_platform_admin()
        or private.has_organization_role(
          lesson.organization_id,
          array['academy_admin', 'stable_manager']
        )
        or (
          lesson.trainer_id = (select auth.uid())
          and private.can_manage_rider_development(
            lesson.organization_id,
            lesson.rider_id
          )
        )
      )
  );
$$;

create function private.rider_competency_stage_rank(p_stage text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case p_stage
    when 'not_started' then 0
    when 'introduced' then 1
    when 'practising' then 2
    when 'demonstrated' then 3
    when 'achieved' then 4
    else -1
  end;
$$;

create function private.prepare_lesson_development_report()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  scoped_lesson public.lessons%rowtype;
  actor uuid := (select auth.uid());
begin
  if actor is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  select * into scoped_lesson
  from public.lessons
  where id = new.lesson_id;

  if scoped_lesson.id is null
    or scoped_lesson.organization_id is null
    or scoped_lesson.trainer_id is null
    or scoped_lesson.organization_id <> new.organization_id
    or scoped_lesson.rider_id <> new.rider_id
    or scoped_lesson.trainer_id <> new.coach_id
  then
    raise exception 'Report scope must match the organization lesson, rider, and coach'
      using errcode = '23514';
  end if;

  if not private.can_manage_lesson_development(new.lesson_id) then
    raise exception 'Only assigned coaches or authorized academy staff may manage this report'
      using errcode = '42501';
  end if;

  -- This guarded trigger owns the only non-participant transition needed by
  -- academy staff. The existing lessons UPDATE policy stays participant-only.
  if scoped_lesson.status = 'confirmed' then
    update public.lessons
    set status = 'completed', updated_at = now()
    where id = scoped_lesson.id
      and status = 'confirmed';
  end if;

  if tg_op = 'INSERT' then
    if new.status <> 'draft' or new.created_by <> actor or new.updated_by <> actor then
      raise exception 'New reports must begin as an actor-owned draft'
        using errcode = '23514';
    end if;
  else
    if old.status = 'approved' then
      raise exception 'Approved reports are immutable; use a future superseding-report workflow'
        using errcode = '55000';
    end if;
    if new.id <> old.id
      or new.organization_id <> old.organization_id
      or new.lesson_id <> old.lesson_id
      or new.rider_id <> old.rider_id
      or new.coach_id <> old.coach_id
      or new.created_by <> old.created_by
      or new.created_at <> old.created_at
    then
      raise exception 'Report identity and scope cannot be changed'
        using errcode = '23514';
    end if;

    insert into public.lesson_development_report_history (
      report_id,
      organization_id,
      rider_id,
      revision,
      snapshot,
      changed_by
    ) values (
      old.id,
      old.organization_id,
      old.rider_id,
      old.revision,
      to_jsonb(old),
      actor
    );

    new.revision := old.revision + 1;
    new.updated_by := actor;
    new.updated_at := now();
  end if;

  if new.status = 'approved' then
    if scoped_lesson.status <> 'completed'
      or new.approved_by <> actor
      or new.approved_at is null
    then
      raise exception 'Approval requires a completed lesson and the approving actor'
        using errcode = '23514';
    end if;
  elsif new.approved_by is not null or new.approved_at is not null then
    raise exception 'Draft reports cannot carry approval metadata'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger lesson_development_reports_prepare
before insert or update on public.lesson_development_reports
for each row execute function private.prepare_lesson_development_report();

create function private.finalize_lesson_development_report()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
begin
  if old.status = 'draft' and new.status = 'approved' then
    update public.rider_competency_evidence
    set approved_by = actor,
        approved_at = new.approved_at
    where report_id = new.id
      and approved_at is null;

    insert into public.rider_competency_progress (
      organization_id,
      rider_id,
      competency_id,
      stage,
      evidence_count,
      last_evidence_at,
      confirmed_by
    )
    select
      evidence.organization_id,
      evidence.rider_id,
      evidence.competency_id,
      evidence.stage,
      1,
      evidence.approved_at,
      actor
    from public.rider_competency_evidence as evidence
    where evidence.report_id = new.id
      and evidence.approved_at is not null
    on conflict (organization_id, rider_id, competency_id)
    do update set
      stage = case
        when private.rider_competency_stage_rank(excluded.stage)
          > private.rider_competency_stage_rank(public.rider_competency_progress.stage)
        then excluded.stage
        else public.rider_competency_progress.stage
      end,
      evidence_count = public.rider_competency_progress.evidence_count + 1,
      last_evidence_at = excluded.last_evidence_at,
      confirmed_by = excluded.confirmed_by,
      updated_at = now();
  end if;

  return new;
end;
$$;

create trigger lesson_development_reports_finalize
after update on public.lesson_development_reports
for each row execute function private.finalize_lesson_development_report();

create function private.prepare_lesson_development_reflection()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  scoped_report public.lesson_development_reports%rowtype;
  actor uuid := (select auth.uid());
begin
  select * into scoped_report
  from public.lesson_development_reports
  where id = new.report_id;

  if actor is null
    or scoped_report.id is null
    or scoped_report.status <> 'approved'
    or scoped_report.organization_id <> new.organization_id
    or scoped_report.rider_id <> new.rider_id
    or new.rider_id <> actor
  then
    raise exception 'Only the rider may reflect on their approved report'
      using errcode = '42501';
  end if;

  if tg_op = 'UPDATE' then
    if new.report_id <> old.report_id
      or new.organization_id <> old.organization_id
      or new.rider_id <> old.rider_id
      or new.created_at <> old.created_at
    then
      raise exception 'Reflection identity and scope cannot be changed'
        using errcode = '23514';
    end if;
    new.updated_at := now();
    new.acknowledged_at := now();
  end if;

  return new;
end;
$$;

create trigger lesson_development_reflections_prepare
before insert or update on public.lesson_development_reflections
for each row execute function private.prepare_lesson_development_reflection();

create function private.prepare_lesson_development_private_note()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  scoped_report public.lesson_development_reports%rowtype;
  actor uuid := (select auth.uid());
begin
  select * into scoped_report
  from public.lesson_development_reports
  where id = new.report_id;

  if actor is null
    or scoped_report.id is null
    or scoped_report.organization_id <> new.organization_id
    or not private.can_manage_rider_development(
      scoped_report.organization_id,
      scoped_report.rider_id
    )
  then
    raise exception 'Private notes require authorized rider-development staff'
      using errcode = '42501';
  end if;

  if tg_op = 'INSERT' and new.author_id <> actor then
    raise exception 'Private note author must be the authenticated actor'
      using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' then
    if new.report_id <> old.report_id
      or new.organization_id <> old.organization_id
      or new.author_id <> old.author_id
      or new.created_at <> old.created_at
      or (old.author_id <> actor and not private.has_organization_role(
        old.organization_id,
        array['academy_admin', 'stable_manager']
      ))
    then
      raise exception 'Private note identity or authorship cannot be changed'
        using errcode = '42501';
    end if;
    new.updated_at := now();
  end if;

  return new;
end;
$$;

create trigger lesson_development_private_notes_prepare
before insert or update on public.lesson_development_private_notes
for each row execute function private.prepare_lesson_development_private_note();

create function private.prepare_rider_competency_evidence()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  scoped_report public.lesson_development_reports%rowtype;
  scoped_catalog public.rider_competency_catalog%rowtype;
  actor uuid := (select auth.uid());
begin
  if tg_op = 'DELETE' then
    if old.approved_at is not null then
      raise exception 'Approved competency evidence is immutable'
        using errcode = '55000';
    end if;
    return old;
  end if;

  select * into scoped_report
  from public.lesson_development_reports
  where id = new.report_id;

  select * into scoped_catalog
  from public.rider_competency_catalog
  where id = new.competency_id;

  if actor is null
    or scoped_report.id is null
    or scoped_catalog.id is null
    or not scoped_catalog.active
    or scoped_report.organization_id <> new.organization_id
    or scoped_report.rider_id <> new.rider_id
    or (
      scoped_catalog.organization_id is not null
      and scoped_catalog.organization_id <> new.organization_id
    )
  then
    raise exception 'Competency evidence must match an active catalog item and report scope'
      using errcode = '23514';
  end if;

  if tg_op = 'INSERT' then
    if scoped_report.status <> 'draft'
      or new.created_by <> actor
      or new.approved_by is not null
      or new.approved_at is not null
    then
      raise exception 'New competency evidence must be an actor-owned draft'
        using errcode = '23514';
    end if;
  else
    if old.approved_at is not null then
      raise exception 'Approved competency evidence is immutable'
        using errcode = '55000';
    end if;
    if new.id <> old.id
      or new.report_id <> old.report_id
      or new.organization_id <> old.organization_id
      or new.rider_id <> old.rider_id
      or new.competency_id <> old.competency_id
      or new.created_by <> old.created_by
      or new.created_at <> old.created_at
    then
      raise exception 'Competency evidence identity and scope cannot be changed'
        using errcode = '23514';
    end if;
    if new.approved_at is not null and (
      scoped_report.status <> 'approved'
      or new.approved_by <> actor
    ) then
      raise exception 'Evidence approval must follow the report approval transition'
        using errcode = '23514';
    elsif new.approved_at is null and scoped_report.status <> 'draft' then
      raise exception 'Draft evidence requires a draft report'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

create trigger rider_competency_evidence_prepare
before insert or update or delete on public.rider_competency_evidence
for each row execute function private.prepare_rider_competency_evidence();

alter table public.rider_competency_catalog enable row level security;
alter table public.lesson_development_reports enable row level security;
alter table public.lesson_development_report_history enable row level security;
alter table public.lesson_development_private_notes enable row level security;
alter table public.lesson_development_reflections enable row level security;
alter table public.rider_competency_evidence enable row level security;
alter table public.rider_competency_progress enable row level security;

create policy rider_competency_catalog_select_scoped
on public.rider_competency_catalog for select to authenticated
using (
  active
  and (
    organization_id is null
    or private.is_organization_member(organization_id)
    or private.is_platform_admin()
  )
);

create policy lesson_development_reports_select_scoped
on public.lesson_development_reports for select to authenticated
using (
  private.can_manage_rider_development(organization_id, rider_id)
  or (
    status = 'approved'
    and private.can_read_rider(organization_id, rider_id)
  )
);

create policy lesson_development_reports_insert_staff
on public.lesson_development_reports for insert to authenticated
with check (
  created_by = (select auth.uid())
  and updated_by = (select auth.uid())
  and private.can_manage_lesson_development(lesson_id)
);

create policy lesson_development_reports_update_staff
on public.lesson_development_reports for update to authenticated
using (private.can_manage_lesson_development(lesson_id))
with check (private.can_manage_lesson_development(lesson_id));

create policy lesson_development_report_history_select_staff
on public.lesson_development_report_history for select to authenticated
using (private.can_manage_rider_development(organization_id, rider_id));

create policy lesson_development_private_notes_select_staff
on public.lesson_development_private_notes for select to authenticated
using (
  author_id = (select auth.uid())
  or private.has_organization_role(
    organization_id,
    array['academy_admin', 'stable_manager']
  )
  or private.is_platform_admin()
  or exists (
    select 1
    from public.lesson_development_reports as report
    where report.id = report_id
      and report.organization_id = organization_id
      and private.can_manage_rider_development(
        report.organization_id,
        report.rider_id
      )
  )
);

create policy lesson_development_private_notes_insert_staff
on public.lesson_development_private_notes for insert to authenticated
with check (
  author_id = (select auth.uid())
  and exists (
    select 1
    from public.lesson_development_reports as report
    where report.id = report_id
      and report.organization_id = organization_id
      and private.can_manage_rider_development(
        report.organization_id,
        report.rider_id
      )
  )
);

create policy lesson_development_private_notes_update_author_or_admin
on public.lesson_development_private_notes for update to authenticated
using (
  author_id = (select auth.uid())
  or private.has_organization_role(
    organization_id,
    array['academy_admin', 'stable_manager']
  )
  or private.is_platform_admin()
)
with check (
  author_id = (select auth.uid())
  or private.has_organization_role(
    organization_id,
    array['academy_admin', 'stable_manager']
  )
  or private.is_platform_admin()
);

create policy lesson_development_reflections_select_scoped
on public.lesson_development_reflections for select to authenticated
using (
  rider_id = (select auth.uid())
  or private.can_manage_rider_development(organization_id, rider_id)
  or (
    visible_to_guardian
    and exists (
      select 1
      from public.guardian_riders as link
      where link.organization_id = organization_id
        and link.guardian_id = (select auth.uid())
        and link.rider_id = rider_id
        and link.active
    )
  )
);

create policy lesson_development_reflections_insert_rider
on public.lesson_development_reflections for insert to authenticated
with check (rider_id = (select auth.uid()));

create policy lesson_development_reflections_update_rider
on public.lesson_development_reflections for update to authenticated
using (rider_id = (select auth.uid()))
with check (rider_id = (select auth.uid()));

create policy rider_competency_evidence_select_scoped
on public.rider_competency_evidence for select to authenticated
using (
  private.can_manage_rider_development(organization_id, rider_id)
  or (
    approved_at is not null
    and private.can_read_rider(organization_id, rider_id)
  )
);

create policy rider_competency_evidence_insert_staff
on public.rider_competency_evidence for insert to authenticated
with check (
  created_by = (select auth.uid())
  and private.can_manage_rider_development(organization_id, rider_id)
  and exists (
    select 1
    from public.lesson_development_reports as report
    where report.id = report_id
      and report.organization_id = organization_id
      and report.rider_id = rider_id
      and report.status = 'draft'
  )
);

create policy rider_competency_evidence_update_staff
on public.rider_competency_evidence for update to authenticated
using (private.can_manage_rider_development(organization_id, rider_id))
with check (private.can_manage_rider_development(organization_id, rider_id));

create policy rider_competency_evidence_delete_draft_staff
on public.rider_competency_evidence for delete to authenticated
using (
  private.can_manage_rider_development(organization_id, rider_id)
  and approved_at is null
  and exists (
    select 1
    from public.lesson_development_reports as report
    where report.id = report_id
      and report.status = 'draft'
  )
);

create policy rider_competency_progress_select_scoped
on public.rider_competency_progress for select to authenticated
using (private.can_read_rider(organization_id, rider_id));

create policy rider_competency_progress_insert_staff
on public.rider_competency_progress for insert to authenticated
with check (private.can_manage_rider_development(organization_id, rider_id));

create policy rider_competency_progress_update_staff
on public.rider_competency_progress for update to authenticated
using (private.can_manage_rider_development(organization_id, rider_id))
with check (private.can_manage_rider_development(organization_id, rider_id));

create function public.save_lesson_development_report(
  p_lesson_id uuid,
  p_objectives text[],
  p_summary text,
  p_strengths text[],
  p_focus_areas text[],
  p_horse_observations text,
  p_interaction_observations text,
  p_homework text,
  p_homework_due_at timestamptz,
  p_next_focus text,
  p_effort_score smallint,
  p_rider_confidence_score smallint,
  p_lesson_difficulty_score smallint,
  p_competencies jsonb default '[]'::jsonb,
  p_private_note text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  scoped_lesson public.lessons%rowtype;
  v_report_id uuid;
  report_status text;
  actor uuid := (select auth.uid());
begin
  if actor is null or not private.can_manage_lesson_development(p_lesson_id) then
    raise exception 'Only assigned coaches or authorized academy staff may close this lesson'
      using errcode = '42501';
  end if;

  if jsonb_typeof(coalesce(p_competencies, '[]'::jsonb)) <> 'array' then
    raise exception 'Competencies must be a JSON array' using errcode = '22023';
  end if;

  select * into strict scoped_lesson
  from public.lessons
  where id = p_lesson_id;

  select id, status into v_report_id, report_status
  from public.lesson_development_reports
  where lesson_id = p_lesson_id;

  if report_status = 'approved' then
    raise exception 'Approved reports are immutable'
      using errcode = '55000';
  end if;

  if v_report_id is null then
    insert into public.lesson_development_reports (
      organization_id,
      lesson_id,
      rider_id,
      coach_id,
      objectives,
      summary,
      strengths,
      focus_areas,
      horse_observations,
      interaction_observations,
      homework,
      homework_due_at,
      next_focus,
      effort_score,
      rider_confidence_score,
      lesson_difficulty_score,
      created_by,
      updated_by
    ) values (
      scoped_lesson.organization_id,
      scoped_lesson.id,
      scoped_lesson.rider_id,
      scoped_lesson.trainer_id,
      coalesce(p_objectives, '{}'),
      coalesce(p_summary, ''),
      coalesce(p_strengths, '{}'),
      coalesce(p_focus_areas, '{}'),
      nullif(btrim(p_horse_observations), ''),
      nullif(btrim(p_interaction_observations), ''),
      nullif(btrim(p_homework), ''),
      p_homework_due_at,
      coalesce(p_next_focus, ''),
      p_effort_score,
      p_rider_confidence_score,
      p_lesson_difficulty_score,
      actor,
      actor
    ) returning id into v_report_id;
  else
    update public.lesson_development_reports
    set objectives = coalesce(p_objectives, '{}'),
        summary = coalesce(p_summary, ''),
        strengths = coalesce(p_strengths, '{}'),
        focus_areas = coalesce(p_focus_areas, '{}'),
        horse_observations = nullif(btrim(p_horse_observations), ''),
        interaction_observations = nullif(btrim(p_interaction_observations), ''),
        homework = nullif(btrim(p_homework), ''),
        homework_due_at = p_homework_due_at,
        next_focus = coalesce(p_next_focus, ''),
        effort_score = p_effort_score,
        rider_confidence_score = p_rider_confidence_score,
        lesson_difficulty_score = p_lesson_difficulty_score,
        updated_by = actor
    where id = v_report_id;
  end if;

  delete from public.rider_competency_evidence
  where rider_competency_evidence.report_id = v_report_id
    and approved_at is null;

  insert into public.rider_competency_evidence (
    report_id,
    organization_id,
    rider_id,
    competency_id,
    stage,
    evidence_note,
    created_by
  )
  select
    v_report_id,
    scoped_lesson.organization_id,
    scoped_lesson.rider_id,
    catalog.id,
    item->>'stage',
    nullif(btrim(item->>'evidence_note'), ''),
    actor
  from jsonb_array_elements(coalesce(p_competencies, '[]'::jsonb)) as item
  join public.rider_competency_catalog as catalog
    on catalog.id = (item->>'competency_id')::uuid
   and catalog.active
   and (
     catalog.organization_id is null
     or catalog.organization_id = scoped_lesson.organization_id
   );

  if nullif(btrim(p_private_note), '') is not null then
    insert into public.lesson_development_private_notes (
      report_id,
      organization_id,
      author_id,
      note
    ) values (
      v_report_id,
      scoped_lesson.organization_id,
      actor,
      btrim(p_private_note)
    );
  end if;

  return v_report_id;
end;
$$;

create function public.approve_lesson_development_report(p_report_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  scoped_report public.lesson_development_reports%rowtype;
  actor uuid := (select auth.uid());
begin
  select * into strict scoped_report
  from public.lesson_development_reports
  where id = p_report_id
  for update;

  if actor is null
    or scoped_report.status <> 'draft'
    or not private.can_manage_lesson_development(scoped_report.lesson_id)
  then
    raise exception 'Only authorized staff may approve a draft lesson report'
      using errcode = '42501';
  end if;

  update public.lesson_development_reports
  set status = 'approved',
      approved_by = actor,
      approved_at = now(),
      updated_by = actor
  where id = scoped_report.id;

  return scoped_report.id;
end;
$$;

revoke all on public.rider_competency_catalog from anon, authenticated;
grant select on public.rider_competency_catalog to authenticated;

revoke all on public.lesson_development_reports from anon, authenticated;
grant select, insert, update on public.lesson_development_reports to authenticated;

revoke all on public.lesson_development_report_history from anon, authenticated;
grant select on public.lesson_development_report_history to authenticated;

revoke all on public.lesson_development_private_notes from anon, authenticated;
grant select, insert, update on public.lesson_development_private_notes to authenticated;

revoke all on public.lesson_development_reflections from anon, authenticated;
grant select, insert, update on public.lesson_development_reflections to authenticated;

revoke all on public.rider_competency_evidence from anon, authenticated;
grant select, insert, update, delete on public.rider_competency_evidence to authenticated;

revoke all on public.rider_competency_progress from anon, authenticated;
grant select, insert, update on public.rider_competency_progress to authenticated;

revoke all on function private.can_manage_rider_development(uuid, uuid)
  from public, anon;
grant execute on function private.can_manage_rider_development(uuid, uuid)
  to authenticated;
revoke all on function private.can_manage_lesson_development(uuid)
  from public, anon;
grant execute on function private.can_manage_lesson_development(uuid)
  to authenticated;
revoke all on function private.rider_competency_stage_rank(text)
  from public, anon;
grant execute on function private.rider_competency_stage_rank(text)
  to authenticated;
revoke all on function private.prepare_lesson_development_report()
  from public, anon, authenticated;
revoke all on function private.finalize_lesson_development_report()
  from public, anon, authenticated;
revoke all on function private.prepare_lesson_development_reflection()
  from public, anon, authenticated;
revoke all on function private.prepare_lesson_development_private_note()
  from public, anon, authenticated;
revoke all on function private.prepare_rider_competency_evidence()
  from public, anon, authenticated;

revoke all on function public.save_lesson_development_report(
  uuid, text[], text, text[], text[], text, text, text, timestamptz,
  text, smallint, smallint, smallint, jsonb, text
) from public, anon;
grant execute on function public.save_lesson_development_report(
  uuid, text[], text, text[], text[], text, text, text, timestamptz,
  text, smallint, smallint, smallint, jsonb, text
) to authenticated;
revoke all on function public.approve_lesson_development_report(uuid)
  from public, anon;
grant execute on function public.approve_lesson_development_report(uuid)
  to authenticated;

commit;
