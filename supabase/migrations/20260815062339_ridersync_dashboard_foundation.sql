-- Batch 2: private, evidence-backed RiderSync score, journey titles, and
-- coach-approved achievement badges. Scores compare a rider with their own
-- approved development record; they are not a ranking or diagnostic.
begin;

create table public.rider_journey_title_catalog (
  code text primary key,
  ordinal smallint not null unique,
  name text not null,
  name_ar text not null,
  description text not null,
  description_ar text not null,
  min_score smallint not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint rider_journey_title_code_format check (code ~ '^[a-z][a-z0-9_]{2,63}$'),
  constraint rider_journey_title_ordinal_positive check (ordinal > 0),
  constraint rider_journey_title_min_score check (min_score between 0 and 100)
);

create table public.rider_badge_catalog (
  code text primary key,
  name text not null,
  name_ar text not null,
  description text not null,
  description_ar text not null,
  tier text not null default 'bronze',
  icon_name text not null default 'award',
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint rider_badge_code_format check (code ~ '^[a-z][a-z0-9_]{2,63}$'),
  constraint rider_badge_tier check (tier in ('ivory', 'bronze', 'silver', 'gold', 'burgundy'))
);

create table public.rider_sync_score_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  rider_id uuid not null references auth.users(id) on delete restrict,
  source_event_key text not null,
  source_type text not null,
  source_id uuid,
  source_report_id uuid references public.lesson_development_reports(id) on delete set null,
  safety_welfare_score smallint not null,
  rhythm_control_score smallint not null,
  balance_position_score smallint not null,
  partnership_score smallint not null,
  training_consistency_score smallint not null,
  reflection_feedback_score smallint not null,
  overall_score smallint not null,
  evidence_count integer not null default 0,
  calculation_version integer not null default 1,
  calculated_at timestamptz not null default now(),
  constraint rider_sync_snapshot_event_unique unique (organization_id, rider_id, source_event_key),
  constraint rider_sync_snapshot_source_type check (source_type in ('report_approval', 'reflection', 'backfill')),
  constraint rider_sync_snapshot_components check (
    safety_welfare_score between 0 and 100
    and rhythm_control_score between 0 and 100
    and balance_position_score between 0 and 100
    and partnership_score between 0 and 100
    and training_consistency_score between 0 and 100
    and reflection_feedback_score between 0 and 100
    and overall_score between 0 and 100
    and evidence_count >= 0
    and calculation_version > 0
  ),
  constraint rider_sync_snapshot_weighted_score check (
    overall_score = round((
      safety_welfare_score * 25
      + rhythm_control_score * 20
      + balance_position_score * 20
      + partnership_score * 20
      + training_consistency_score * 10
      + reflection_feedback_score * 5
    )::numeric / 100)::smallint
  )
);

create index rider_sync_snapshots_latest_idx
  on public.rider_sync_score_snapshots (organization_id, rider_id, calculated_at desc, id desc);
create index rider_sync_snapshots_rider_id_idx on public.rider_sync_score_snapshots (rider_id);
create index rider_sync_snapshots_source_report_id_idx on public.rider_sync_score_snapshots (source_report_id);

create table public.rider_journey_title_unlocks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  rider_id uuid not null references auth.users(id) on delete restrict,
  title_code text not null references public.rider_journey_title_catalog(code) on delete restrict,
  source_snapshot_id uuid not null references public.rider_sync_score_snapshots(id) on delete restrict,
  unlocked_at timestamptz not null default now(),
  constraint rider_journey_title_unlock_unique unique (organization_id, rider_id, title_code)
);

create index rider_journey_unlocks_rider_idx
  on public.rider_journey_title_unlocks (organization_id, rider_id, unlocked_at desc);
create index rider_journey_unlocks_rider_id_idx on public.rider_journey_title_unlocks (rider_id);
create index rider_journey_unlocks_title_code_idx on public.rider_journey_title_unlocks (title_code);
create index rider_journey_unlocks_snapshot_id_idx on public.rider_journey_title_unlocks (source_snapshot_id);

create table public.rider_badge_awards (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  rider_id uuid not null references auth.users(id) on delete restrict,
  badge_code text not null references public.rider_badge_catalog(code) on delete restrict,
  source text not null default 'coach_approved',
  status text not null default 'approved',
  award_message text,
  evidence_report_id uuid references public.lesson_development_reports(id) on delete set null,
  proposed_by uuid references auth.users(id) on delete restrict,
  approved_by uuid references auth.users(id) on delete restrict,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  constraint rider_badge_award_unique unique (organization_id, rider_id, badge_code),
  constraint rider_badge_award_source check (source in ('ai_observed', 'coach_approved', 'journey')),
  constraint rider_badge_award_status check (status in ('proposed', 'approved', 'rejected')),
  constraint rider_badge_award_message_length check (award_message is null or char_length(btrim(award_message)) between 1 and 500),
  constraint rider_badge_award_approval_complete check (
    (status = 'approved' and approved_by is not null and approved_at is not null)
    or (status <> 'approved' and approved_at is null)
  )
);

create index rider_badge_awards_rider_idx
  on public.rider_badge_awards (organization_id, rider_id, status, created_at desc);
create index rider_badge_awards_rider_id_idx on public.rider_badge_awards (rider_id);
create index rider_badge_awards_badge_code_idx on public.rider_badge_awards (badge_code);
create index rider_badge_awards_evidence_report_id_idx on public.rider_badge_awards (evidence_report_id);
create index rider_badge_awards_proposed_by_idx on public.rider_badge_awards (proposed_by);
create index rider_badge_awards_approved_by_idx on public.rider_badge_awards (approved_by);

comment on table public.rider_sync_score_snapshots is
  'Append-only self-baseline RiderSync scores calculated from approved development evidence; never a leaderboard or diagnosis.';
comment on table public.rider_badge_awards is
  'Achievement badges become rider-visible only after explicit coach or authorized staff approval.';

insert into public.rider_journey_title_catalog
  (code, ordinal, name, name_ar, description, description_ar, min_score)
values
  ('arena_explorer', 1, 'Arena Explorer', 'مستكشف الميدان', 'Building safe, curious foundations.', 'يبني أسساً آمنة وفضولية.', 0),
  ('rhythm_rider', 2, 'Rhythm Rider', 'فارس الإيقاع', 'Finding a repeatable rhythm and control.', 'يطوّر إيقاعاً وتحكماً ثابتين.', 15),
  ('balanced_rider', 3, 'Balanced Rider', 'الفارس المتوازن', 'Growing an independent, balanced position.', 'يطوّر وضعية مستقلة ومتوازنة.', 25),
  ('precision_rider', 4, 'Precision Rider', 'فارس الدقة', 'Using clear lines and well-timed aids.', 'يستخدم خطوطاً واضحة ومساعدات في توقيتها.', 35),
  ('confident_canter', 5, 'Confident Canter', 'فارس الكانتر الواثق', 'Riding forward with calm confidence.', 'يركب بتقدم وثقة هادئة.', 45),
  ('course_navigator', 6, 'Course Navigator', 'ملاح المسار', 'Connecting rhythm, line, and decisions.', 'يربط الإيقاع والخط والقرارات.', 55),
  ('harmony_rider', 7, 'Harmony Rider', 'فارس الانسجام', 'Listening and adapting to the horse.', 'ينصت للحصان ويتكيف معه.', 65),
  ('performance_rider', 8, 'Performance Rider', 'فارس الأداء', 'Delivering consistent evidence across sessions.', 'يحقق أداءً ثابتاً عبر الجلسات.', 75),
  ('equivista_champion', 9, 'EquiVista Champion', 'بطل EquiVista', 'Showing mature horsemanship and reflection.', 'يظهر فروسية ناضجة وتأملاً مستمراً.', 85),
  ('equestrian_elite', 10, 'Equestrian Elite', 'نخبة الفروسية', 'Sustaining excellence with horse-first choices.', 'يحافظ على التميز مع تقديم مصلحة الحصان.', 95);

insert into public.rider_badge_catalog
  (code, name, name_ar, description, description_ar, tier, icon_name, sort_order)
values
  ('horse_first', 'Horse First', 'الحصان أولاً', 'Consistently protects horse welfare and readiness.', 'يحمي رفاهية الحصان واستعداده باستمرار.', 'gold', 'heart-handshake', 10),
  ('quiet_hands', 'Quiet Hands', 'يدان هادئتان', 'Uses steady, considerate rein contact.', 'يستخدم تواصلاً ثابتاً ومراعياً باللجام.', 'bronze', 'hand', 20),
  ('balanced_seat', 'Balanced Seat', 'مقعد متوازن', 'Shows an increasingly independent seat.', 'يظهر مقعداً أكثر استقلالية.', 'silver', 'scale', 30),
  ('rhythm_keeper', 'Rhythm Keeper', 'حافظ الإيقاع', 'Maintains a repeatable tempo through the exercise.', 'يحافظ على إيقاع ثابت خلال التمرين.', 'silver', 'audio-waveform', 40),
  ('straight_and_true', 'Straight & True', 'مستقيم وواثق', 'Rides accurate, committed lines.', 'يركب خطوطاً دقيقة وواثقة.', 'bronze', 'move-right', 50),
  ('grid_graduate', 'Grid Graduate', 'خريج الجمباز', 'Completes progressive gridwork with control.', 'يكمل تمارين الجمباز المتدرجة بتحكم.', 'silver', 'layout-grid', 60),
  ('course_clever', 'Course Clever', 'ذكي المسار', 'Makes thoughtful decisions around a course.', 'يتخذ قرارات مدروسة في المسار.', 'gold', 'route', 70),
  ('reflection_rider', 'Reflection Rider', 'فارس التأمل', 'Uses reflection to turn feedback into action.', 'يحوّل الملاحظات إلى عمل من خلال التأمل.', 'bronze', 'message-circle-heart', 80),
  ('training_streak', 'Training Streak', 'سلسلة التدريب', 'Builds a consistent, sustainable practice habit.', 'يبني عادة تدريب ثابتة ومستدامة.', 'silver', 'flame', 90),
  ('comeback_rider', 'Comeback Rider', 'فارس العودة', 'Returns with patience and progressive confidence.', 'يعود بصبر وثقة متدرجة.', 'burgundy', 'refresh-cw', 100),
  ('perfect_partner', 'Perfect Partner', 'الشريك المثالي', 'Shows an exceptional horse-rider partnership.', 'يظهر شراكة استثنائية بين الحصان والفارس.', 'gold', 'sparkles', 110),
  ('coachs_choice', 'Coach''s Choice', 'اختيار المدرب', 'Recognized by the coach for meaningful progress.', 'يكرمه المدرب لتقدم ملموس.', 'burgundy', 'medal', 120);

create function private.rider_sync_stage_score(p_stage text)
returns smallint
language sql
immutable
set search_path = ''
as $$
  select case p_stage
    when 'introduced' then 25
    when 'practising' then 50
    when 'demonstrated' then 75
    when 'achieved' then 100
    else 0
  end::smallint;
$$;

create function private.refresh_rider_sync_score(
  p_organization_id uuid,
  p_rider_id uuid,
  p_source_type text,
  p_source_id uuid,
  p_source_event_key text,
  p_source_report_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_safety smallint;
  v_rhythm smallint;
  v_balance smallint;
  v_partnership smallint;
  v_consistency smallint;
  v_reflection smallint;
  v_evidence_count integer;
  v_overall smallint;
  v_snapshot_id uuid;
begin
  if p_source_type not in ('report_approval', 'reflection', 'backfill') then
    raise exception 'Unsupported RiderSync source type' using errcode = '22023';
  end if;

  select
    coalesce(round(avg(private.rider_sync_stage_score(progress.stage)) filter (where catalog.category = 'Safety')), 0),
    coalesce(round(avg(private.rider_sync_stage_score(progress.stage)) filter (where catalog.category in ('Flatwork', 'Polework'))), 0),
    coalesce(round(avg(private.rider_sync_stage_score(progress.stage)) filter (where catalog.category in ('Position', 'Jumping'))), 0),
    coalesce(round(avg(private.rider_sync_stage_score(progress.stage)) filter (where catalog.category = 'Partnership')), 0),
    coalesce(sum(progress.evidence_count), 0)
  into v_safety, v_rhythm, v_balance, v_partnership, v_evidence_count
  from public.rider_competency_progress as progress
  join public.rider_competency_catalog as catalog on catalog.id = progress.competency_id
  where progress.organization_id = p_organization_id
    and progress.rider_id = p_rider_id
    and catalog.active;

  select least(100, count(*) * 20)::smallint
  into v_consistency
  from public.lesson_development_reports
  where organization_id = p_organization_id
    and rider_id = p_rider_id
    and status = 'approved'
    and approved_at >= now() - interval '90 days';

  select case when count(*) = 0 then 0 else least(100, round(
    count(reflection.id)::numeric * 100 / count(*)
  )) end::smallint
  into v_reflection
  from public.lesson_development_reports as report
  left join public.lesson_development_reflections as reflection
    on reflection.report_id = report.id and reflection.rider_id = report.rider_id
  where report.organization_id = p_organization_id
    and report.rider_id = p_rider_id
    and report.status = 'approved'
    and report.approved_at >= now() - interval '90 days';

  v_overall := round((
    v_safety * 25 + v_rhythm * 20 + v_balance * 20
    + v_partnership * 20 + v_consistency * 10 + v_reflection * 5
  )::numeric / 100)::smallint;

  insert into public.rider_sync_score_snapshots (
    organization_id, rider_id, source_event_key, source_type, source_id,
    source_report_id, safety_welfare_score, rhythm_control_score,
    balance_position_score, partnership_score, training_consistency_score,
    reflection_feedback_score, overall_score, evidence_count, calculated_at
  ) values (
    p_organization_id, p_rider_id, p_source_event_key, p_source_type, p_source_id,
    p_source_report_id, v_safety, v_rhythm, v_balance, v_partnership,
    v_consistency, v_reflection, v_overall, v_evidence_count, clock_timestamp()
  )
  on conflict (organization_id, rider_id, source_event_key) do nothing
  returning id into v_snapshot_id;

  if v_snapshot_id is null then
    select id into v_snapshot_id
    from public.rider_sync_score_snapshots
    where organization_id = p_organization_id
      and rider_id = p_rider_id
      and source_event_key = p_source_event_key;
  end if;

  insert into public.rider_journey_title_unlocks
    (organization_id, rider_id, title_code, source_snapshot_id)
  select p_organization_id, p_rider_id, title.code, v_snapshot_id
  from public.rider_journey_title_catalog as title
  where title.active and title.min_score <= v_overall
  on conflict (organization_id, rider_id, title_code) do nothing;

  return v_snapshot_id;
end;
$$;

create function private.refresh_rider_sync_after_report()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'draft' and new.status = 'approved' then
    perform private.refresh_rider_sync_score(
      new.organization_id, new.rider_id, 'report_approval', new.id,
      'report:' || new.id::text || ':approved', new.id
    );
  end if;
  return new;
end;
$$;

create trigger rider_sync_refresh_report
after update on public.lesson_development_reports
for each row execute function private.refresh_rider_sync_after_report();

create function private.refresh_rider_sync_after_reflection()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.refresh_rider_sync_score(
    new.organization_id, new.rider_id, 'reflection', new.id,
    'reflection:' || new.id::text || ':' || extract(epoch from new.updated_at)::bigint::text,
    new.report_id
  );
  return new;
end;
$$;

create trigger rider_sync_refresh_reflection
after insert or update on public.lesson_development_reflections
for each row execute function private.refresh_rider_sync_after_reflection();

create function private.prepare_rider_badge_award()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
begin
  if actor is null
    or not private.can_manage_rider_development(new.organization_id, new.rider_id)
    or not exists (select 1 from public.rider_badge_catalog where code = new.badge_code and active)
    or (new.evidence_report_id is not null and not exists (
      select 1 from public.lesson_development_reports as report
      where report.id = new.evidence_report_id
        and report.organization_id = new.organization_id
        and report.rider_id = new.rider_id
        and report.status = 'approved'
    ))
  then
    raise exception 'Only authorized staff may approve an evidence-backed rider badge'
      using errcode = '42501';
  end if;

  new.source := 'coach_approved';
  new.status := 'approved';
  new.proposed_by := actor;
  new.approved_by := actor;
  new.approved_at := now();
  return new;
end;
$$;

create trigger rider_badge_awards_prepare
before insert on public.rider_badge_awards
for each row execute function private.prepare_rider_badge_award();

alter table public.rider_journey_title_catalog enable row level security;
alter table public.rider_badge_catalog enable row level security;
alter table public.rider_sync_score_snapshots enable row level security;
alter table public.rider_journey_title_unlocks enable row level security;
alter table public.rider_badge_awards enable row level security;

create policy rider_journey_title_catalog_select_active
on public.rider_journey_title_catalog for select to authenticated using (active);
create policy rider_badge_catalog_select_active
on public.rider_badge_catalog for select to authenticated using (active);
create policy rider_sync_snapshots_select_scoped
on public.rider_sync_score_snapshots for select to authenticated
using (private.can_read_rider(organization_id, rider_id));
create policy rider_journey_unlocks_select_scoped
on public.rider_journey_title_unlocks for select to authenticated
using (private.can_read_rider(organization_id, rider_id));
create policy rider_badge_awards_select_scoped
on public.rider_badge_awards for select to authenticated
using (
  private.can_manage_rider_development(organization_id, rider_id)
  or (status = 'approved' and private.can_read_rider(organization_id, rider_id))
);
create policy rider_badge_awards_insert_staff
on public.rider_badge_awards for insert to authenticated
with check (
  source = 'coach_approved'
  and status = 'approved'
  and approved_by = (select auth.uid())
  and private.can_manage_rider_development(organization_id, rider_id)
);

create function public.award_rider_badge(
  p_organization_id uuid,
  p_rider_id uuid,
  p_badge_code text,
  p_award_message text default null,
  p_evidence_report_id uuid default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_award_id uuid;
begin
  insert into public.rider_badge_awards (
    organization_id, rider_id, badge_code, award_message, evidence_report_id,
    proposed_by, approved_by, approved_at
  ) values (
    p_organization_id, p_rider_id, p_badge_code,
    nullif(btrim(p_award_message), ''), p_evidence_report_id,
    (select auth.uid()), (select auth.uid()), now()
  ) returning id into v_award_id;
  return v_award_id;
end;
$$;

create function public.get_rider_sync_dashboard(
  p_organization_id uuid,
  p_rider_id uuid
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if not private.can_read_rider(p_organization_id, p_rider_id) then
    raise exception 'RiderSync dashboard is not available for this rider'
      using errcode = '42501';
  end if;

  select jsonb_build_object(
    'snapshot', (select to_jsonb(snapshot) from (
      select id, "organizationId", "riderId", "safetyWelfareScore",
        "rhythmControlScore", "balancePositionScore", "partnershipScore",
        "trainingConsistencyScore", "reflectionFeedbackScore", "overallScore",
        "evidenceCount", "calculatedAt"
      from (
        select id, organization_id as "organizationId", rider_id as "riderId",
          safety_welfare_score as "safetyWelfareScore", rhythm_control_score as "rhythmControlScore",
          balance_position_score as "balancePositionScore", partnership_score as "partnershipScore",
          training_consistency_score as "trainingConsistencyScore", reflection_feedback_score as "reflectionFeedbackScore",
          overall_score as "overallScore", evidence_count as "evidenceCount", calculated_at as "calculatedAt"
        from public.rider_sync_score_snapshots
        where organization_id = p_organization_id and rider_id = p_rider_id
        order by calculated_at desc, id desc limit 1
      ) latest
    ) snapshot),
    'titles', coalesce((select jsonb_agg(jsonb_build_object(
      'code', title.code, 'ordinal', title.ordinal, 'name', title.name,
      'nameAr', title.name_ar, 'description', title.description,
      'descriptionAr', title.description_ar, 'minScore', title.min_score,
      'unlockedAt', unlock.unlocked_at
    ) order by title.ordinal)
    from public.rider_journey_title_catalog title
    left join public.rider_journey_title_unlocks unlock
      on unlock.title_code = title.code
      and unlock.organization_id = p_organization_id and unlock.rider_id = p_rider_id
    where title.active), '[]'::jsonb),
    'badges', coalesce((select jsonb_agg(jsonb_build_object(
      'id', award.id, 'code', badge.code, 'name', badge.name, 'nameAr', badge.name_ar,
      'description', badge.description, 'descriptionAr', badge.description_ar,
      'tier', badge.tier, 'iconName', badge.icon_name,
      'awardMessage', award.award_message, 'approvedAt', award.approved_at
    ) order by award.approved_at desc)
    from public.rider_badge_awards award
    join public.rider_badge_catalog badge on badge.code = award.badge_code
    where award.organization_id = p_organization_id and award.rider_id = p_rider_id
      and award.status = 'approved'), '[]'::jsonb),
    'competencies', coalesce((select jsonb_agg(jsonb_build_object(
      'code', catalog.code, 'name', catalog.name, 'category', catalog.category,
      'stage', progress.stage, 'evidenceCount', progress.evidence_count,
      'lastEvidenceAt', progress.last_evidence_at
    ) order by catalog.sort_order)
    from public.rider_competency_progress progress
    join public.rider_competency_catalog catalog on catalog.id = progress.competency_id
    where progress.organization_id = p_organization_id and progress.rider_id = p_rider_id), '[]'::jsonb),
    'latestReport', (select jsonb_build_object(
      'id', report.id, 'summary', report.summary, 'strengths', report.strengths,
      'focusAreas', report.focus_areas, 'homework', report.homework,
      'nextFocus', report.next_focus, 'approvedAt', report.approved_at
    ) from public.lesson_development_reports report
    where report.organization_id = p_organization_id and report.rider_id = p_rider_id
      and report.status = 'approved'
    order by report.approved_at desc limit 1)
  ) into v_result;
  return v_result;
end;
$$;

revoke all on public.rider_journey_title_catalog from anon, authenticated;
grant select on public.rider_journey_title_catalog to authenticated;
revoke all on public.rider_badge_catalog from anon, authenticated;
grant select on public.rider_badge_catalog to authenticated;
revoke all on public.rider_sync_score_snapshots from anon, authenticated;
grant select on public.rider_sync_score_snapshots to authenticated;
revoke all on public.rider_journey_title_unlocks from anon, authenticated;
grant select on public.rider_journey_title_unlocks to authenticated;
revoke all on public.rider_badge_awards from anon, authenticated;
grant select, insert on public.rider_badge_awards to authenticated;

revoke all on function private.rider_sync_stage_score(text) from public, anon, authenticated;
revoke all on function private.refresh_rider_sync_score(uuid, uuid, text, uuid, text, uuid) from public, anon, authenticated;
revoke all on function private.refresh_rider_sync_after_report() from public, anon, authenticated;
revoke all on function private.refresh_rider_sync_after_reflection() from public, anon, authenticated;
revoke all on function private.prepare_rider_badge_award() from public, anon, authenticated;
revoke all on function public.award_rider_badge(uuid, uuid, text, text, uuid) from public, anon;
grant execute on function public.award_rider_badge(uuid, uuid, text, text, uuid) to authenticated;
revoke all on function public.get_rider_sync_dashboard(uuid, uuid) from public, anon;
grant execute on function public.get_rider_sync_dashboard(uuid, uuid) to authenticated;

-- One stable baseline per rider with approved Batch 1 evidence.
do $$
declare
  scoped record;
begin
  for scoped in
    select distinct on (organization_id, rider_id)
      organization_id, rider_id, id
    from public.lesson_development_reports
    where status = 'approved'
    order by organization_id, rider_id, approved_at desc
  loop
    perform private.refresh_rider_sync_score(
      scoped.organization_id, scoped.rider_id, 'backfill', scoped.id,
      'backfill:' || scoped.id::text, scoped.id
    );
  end loop;
end;
$$;

commit;
