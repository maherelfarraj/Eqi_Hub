-- Video Release 2: coach-approved intelligence for the adult-rider pilot.
-- This is intentionally separate from Release 1's guardian-capable review model.
begin;

create table public.video_release_2_feature_flags (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  pilot_code text not null default 'adult_rider_coach_intelligence',
  enabled boolean not null default false,
  enabled_by uuid references public.profiles(id) on delete set null,
  enabled_at timestamptz,
  updated_at timestamptz not null default now(),
  check (pilot_code = 'adult_rider_coach_intelligence')
);

create table public.video_release_2_pilot_participants (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null,
  participant_role text not null,
  adult_verified boolean not null default false,
  enrolled_by uuid references public.profiles(id) on delete set null,
  enrolled_at timestamptz not null default now(),
  revoked_at timestamptz,
  primary key (organization_id, user_id),
  foreign key (organization_id, user_id)
    references public.organization_memberships(organization_id, user_id) on delete cascade,
  check (participant_role in ('rider', 'coach')),
  check (
    (participant_role = 'rider' and adult_verified)
    or (participant_role = 'coach' and not adult_verified)
  )
);

create table public.video_release_2_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  rider_id uuid not null,
  coach_id uuid not null,
  horse_id uuid,
  lesson_id uuid,
  title text not null,
  exercise_context text,
  consent_status text not null default 'pending',
  consent_recorded_at timestamptz,
  consent_recorded_by uuid references public.profiles(id) on delete set null,
  review_status text not null default 'draft',
  approved_revision_id uuid,
  approved_at timestamptz,
  approved_by uuid references public.profiles(id) on delete set null,
  retention_state text not null default 'active',
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, rider_id)
    references public.organization_memberships(organization_id, user_id) on delete restrict,
  foreign key (organization_id, coach_id)
    references public.organization_memberships(organization_id, user_id) on delete restrict,
  foreign key (horse_id, organization_id)
    references public.horses(id, organization_id) on delete set null,
  foreign key (lesson_id, organization_id)
    references public.lessons(id, organization_id) on delete set null,
  check (length(btrim(title)) between 2 and 160),
  check (exercise_context is null or length(btrim(exercise_context)) <= 800),
  check (consent_status in ('pending', 'granted', 'withdrawn')),
  check (review_status in ('draft', 'approved', 'archived')),
  check (retention_state in ('active', 'deletion_requested', 'deleted'))
);

create table public.video_release_2_clips (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  session_id uuid not null references public.video_release_2_sessions(id) on delete cascade,
  original_storage_path text not null unique,
  checksum_sha256 text not null,
  mime_type text not null,
  byte_size bigint not null,
  duration_ms integer not null,
  upload_state text not null default 'registered',
  uploaded_by uuid not null references public.profiles(id) on delete restrict,
  uploaded_at timestamptz,
  created_at timestamptz not null default now(),
  check (checksum_sha256 ~ '^[a-f0-9]{64}$'),
  check (mime_type in ('video/mp4', 'video/quicktime', 'video/webm')),
  check (byte_size > 0 and byte_size <= 524288000),
  check (duration_ms > 0 and duration_ms <= 28800000),
  check (upload_state in ('registered', 'uploaded', 'failed', 'deleted')),
  unique (organization_id, checksum_sha256)
);

create table public.video_release_2_review_revisions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  session_id uuid not null references public.video_release_2_sessions(id) on delete cascade,
  revision_number integer not null,
  source_kind text not null default 'manual',
  status text not null default 'draft',
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  superseded_at timestamptz,
  unique (session_id, revision_number),
  check (revision_number > 0),
  check (source_kind in ('manual', 'metric', 'ai')),
  check (status in ('draft', 'approved', 'superseded')),
  check (
    (status = 'approved' and approved_by is not null and approved_at is not null)
    or (status <> 'approved' and approved_by is null and approved_at is null)
  )
);

alter table public.video_release_2_sessions
  add constraint video_release_2_sessions_approved_revision_fk
  foreign key (approved_revision_id)
  references public.video_release_2_review_revisions(id)
  on delete set null;

create table public.video_release_2_course_tags (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  revision_id uuid not null references public.video_release_2_review_revisions(id) on delete cascade,
  clip_id uuid references public.video_release_2_clips(id) on delete set null,
  sequence_number integer not null,
  fence_label text not null,
  tag_code text not null,
  position_ms integer,
  notes text,
  created_at timestamptz not null default now(),
  check (sequence_number > 0 and sequence_number <= 100),
  check (length(btrim(fence_label)) between 1 and 100),
  check (tag_code in ('approach', 'takeoff', 'jump', 'landing', 'between_fences', 'course_note')),
  check (position_ms is null or position_ms >= 0),
  check (notes is null or length(notes) <= 1000)
);

create table public.video_release_2_stride_observations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  revision_id uuid not null references public.video_release_2_review_revisions(id) on delete cascade,
  clip_id uuid references public.video_release_2_clips(id) on delete set null,
  start_ms integer not null,
  end_ms integer not null,
  rhythm_state text not null,
  stride_count integer,
  notes text,
  created_at timestamptz not null default now(),
  check (start_ms >= 0 and end_ms > start_ms),
  check (rhythm_state in ('steady', 'variable', 'recovered', 'not_observed')),
  check (stride_count is null or stride_count between 1 and 99),
  check (notes is null or length(notes) <= 1000)
);

create table public.video_release_2_scorecards (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  revision_id uuid not null references public.video_release_2_review_revisions(id) on delete cascade,
  category text not null,
  score smallint not null,
  coach_note text,
  created_at timestamptz not null default now(),
  unique (revision_id, category),
  check (category in ('approach', 'takeoff', 'jump', 'landing', 'between_fences')),
  check (score between 1 and 5),
  check (coach_note is null or length(coach_note) <= 1000)
);

create table public.video_release_2_consent_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  session_id uuid not null references public.video_release_2_sessions(id) on delete cascade,
  previous_status text,
  new_status text not null,
  actor_user_id uuid references public.profiles(id) on delete set null,
  occurred_at timestamptz not null default now(),
  check (previous_status is null or previous_status in ('pending', 'granted', 'withdrawn')),
  check (new_status in ('pending', 'granted', 'withdrawn'))
);

create table public.video_release_2_audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  session_id uuid references public.video_release_2_sessions(id) on delete cascade,
  revision_id uuid references public.video_release_2_review_revisions(id) on delete set null,
  actor_user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  check (action in ('session_created', 'clip_registered', 'clip_uploaded', 'consent_changed', 'revision_created', 'observation_saved', 'revision_approved', 'approved_feedback_read', 'comparison_read', 'trend_read'))
);

create index video_release_2_sessions_org_rider_idx
  on public.video_release_2_sessions (organization_id, rider_id, created_at desc);
create index video_release_2_sessions_org_coach_idx
  on public.video_release_2_sessions (organization_id, coach_id, created_at desc);
create index video_release_2_clips_session_idx
  on public.video_release_2_clips (session_id, created_at);
create index video_release_2_revisions_session_status_idx
  on public.video_release_2_review_revisions (session_id, status, revision_number desc);
create index video_release_2_audit_session_idx
  on public.video_release_2_audit_events (session_id, occurred_at desc);

create or replace function private.video_release_2_enabled(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select exists (
    select 1
    from public.video_release_2_feature_flags flag
    where flag.organization_id = p_organization_id
      and flag.pilot_code = 'adult_rider_coach_intelligence'
      and flag.enabled
  );
$$;

create or replace function private.video_release_2_adult_rider(p_organization_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select private.video_release_2_enabled(p_organization_id)
    and exists (
      select 1
      from public.video_release_2_pilot_participants participant
      join public.organization_memberships membership
        on membership.organization_id = participant.organization_id
       and membership.user_id = participant.user_id
       and membership.status = 'active'
      join public.organization_member_roles member_role
        on member_role.membership_id = membership.id
       and member_role.role = 'rider'
      where participant.organization_id = p_organization_id
        and participant.user_id = p_user_id
        and participant.participant_role = 'rider'
        and participant.adult_verified
        and participant.revoked_at is null
    );
$$;

create or replace function private.can_manage_video_release_2(p_organization_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select private.video_release_2_enabled(p_organization_id)
    and exists (
      select 1
      from public.video_release_2_pilot_participants participant
      join public.organization_memberships membership
        on membership.organization_id = participant.organization_id
       and membership.user_id = participant.user_id
       and membership.status = 'active'
      join public.organization_member_roles member_role
        on member_role.membership_id = membership.id
       and member_role.role = 'coach'
      where participant.organization_id = p_organization_id
        and participant.user_id = p_user_id
        and participant.participant_role = 'coach'
        and participant.revoked_at is null
    );
$$;

create or replace function private.can_coach_video_release_2_rider(
  p_organization_id uuid, p_coach_id uuid, p_rider_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select private.video_release_2_enabled(p_organization_id)
    and private.can_manage_video_release_2(p_organization_id, p_coach_id)
    and exists (
      select 1
      from public.coach_rider_assignments assignment
      where assignment.organization_id = p_organization_id
        and assignment.coach_id = p_coach_id
        and assignment.rider_id = p_rider_id
        and assignment.active
        and assignment.starts_on <= current_date
        and (assignment.ends_on is null or assignment.ends_on >= current_date)
    );
$$;

create or replace function private.can_manage_video_release_2_session(
  p_session public.video_release_2_sessions, p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select p_session.coach_id = p_user_id
    and private.can_coach_video_release_2_rider(
      p_session.organization_id, p_user_id, p_session.rider_id
    );
$$;

create or replace function private.can_upload_video_release_2_session(
  p_session public.video_release_2_sessions, p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select private.can_manage_video_release_2_session(p_session, p_user_id)
    or (
      p_session.rider_id = p_user_id
      and private.video_release_2_adult_rider(p_session.organization_id, p_user_id)
    );
$$;

create or replace function private.can_read_approved_video_release_2(p_organization_id uuid, p_rider_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select p_user_id = p_rider_id
    and private.video_release_2_adult_rider(p_organization_id, p_user_id);
$$;

create or replace function private.video_release_2_session_visible(p_session public.video_release_2_sessions)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select private.can_manage_video_release_2_session(p_session)
    or (
      p_session.review_status = 'approved'
      and p_session.consent_status = 'granted'
      and p_session.retention_state = 'active'
      and private.can_read_approved_video_release_2(p_session.organization_id, p_session.rider_id)
    );
$$;

create or replace function private.video_release_2_revision_visible(
  p_revision public.video_release_2_review_revisions
)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select exists (
      select 1 from public.video_release_2_sessions session
      where session.id = p_revision.session_id
        and private.can_manage_video_release_2_session(session)
        and session.consent_status = 'granted'
        and session.retention_state = 'active'
    )
    or exists (
      select 1
      from public.video_release_2_sessions session
      where session.id = p_revision.session_id
        and p_revision.status = 'approved'
        and private.video_release_2_session_visible(session)
    );
$$;

create or replace function private.video_release_2_storage_session_path(p_name text)
returns uuid
language plpgsql
stable
security definer
set search_path = public, private
as $$
declare
  parts text[];
begin
  if p_name !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/original\.(mp4|mov|webm)$' then
    return null;
  end if;
  parts := regexp_split_to_array(p_name, '/');
  return parts[2]::uuid;
end;
$$;

create or replace function private.can_manage_video_release_2_storage_path(p_name text)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select exists (
    select 1
    from public.video_release_2_sessions session
    where session.id = private.video_release_2_storage_session_path(p_name)
      and split_part(p_name, '/', 1) = session.organization_id::text
      and private.can_manage_video_release_2_session(session)
      and session.consent_status = 'granted'
      and session.retention_state = 'active'
  );
$$;

create or replace function private.can_upload_video_release_2_storage_path(p_name text)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select exists (
    select 1
    from public.video_release_2_clips clip
    join public.video_release_2_sessions session on session.id = clip.session_id
    where clip.original_storage_path = p_name
      and clip.upload_state = 'registered'
      and clip.uploaded_by = auth.uid()
      and session.id = private.video_release_2_storage_session_path(p_name)
      and split_part(p_name, '/', 1) = session.organization_id::text
      and private.can_upload_video_release_2_session(session)
      and session.consent_status = 'granted'
      and session.retention_state = 'active'
  );
$$;

create or replace function private.audit_video_release_2(
  p_organization_id uuid,
  p_session_id uuid,
  p_revision_id uuid,
  p_action text,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
begin
  insert into public.video_release_2_audit_events (
    organization_id, session_id, revision_id, actor_user_id, action, metadata
  ) values (
    p_organization_id, p_session_id, p_revision_id, auth.uid(), p_action, coalesce(p_metadata, '{}'::jsonb)
  );
end;
$$;

create or replace function private.prepare_video_release_2_session()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  new.updated_at := now();
  if new.approved_revision_id is not null and not exists (
    select 1
    from public.video_release_2_review_revisions revision
    where revision.id = new.approved_revision_id
      and revision.session_id = new.id
      and revision.organization_id = new.organization_id
      and revision.status = 'approved'
  ) then
    raise exception 'Approved revision must belong to this session and be coach approved'
      using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' and old.consent_status is distinct from new.consent_status then
    new.consent_recorded_at := now();
    new.consent_recorded_by := auth.uid();
    insert into public.video_release_2_consent_events (
      organization_id, session_id, previous_status, new_status, actor_user_id
    ) values (
      new.organization_id, new.id, old.consent_status, new.consent_status, auth.uid()
    );
    perform private.audit_video_release_2(
      new.organization_id, new.id, null, 'consent_changed',
      jsonb_build_object('from', old.consent_status, 'to', new.consent_status)
    );
  end if;
  return new;
end;
$$;

create trigger video_release_2_session_prepare
before update on public.video_release_2_sessions
for each row execute function private.prepare_video_release_2_session();

alter table public.video_release_2_feature_flags enable row level security;
alter table public.video_release_2_pilot_participants enable row level security;
alter table public.video_release_2_sessions enable row level security;
alter table public.video_release_2_clips enable row level security;
alter table public.video_release_2_review_revisions enable row level security;
alter table public.video_release_2_course_tags enable row level security;
alter table public.video_release_2_stride_observations enable row level security;
alter table public.video_release_2_scorecards enable row level security;
alter table public.video_release_2_consent_events enable row level security;
alter table public.video_release_2_audit_events enable row level security;

create policy video_release_2_flags_admin_only on public.video_release_2_feature_flags
  for all to authenticated
  using (private.is_platform_admin() or private.has_organization_role(organization_id, array['academy_admin']::text[]))
  with check (private.is_platform_admin() or private.has_organization_role(organization_id, array['academy_admin']::text[]));

create policy video_release_2_participants_admin_or_self on public.video_release_2_pilot_participants
  for select to authenticated
  using (
    user_id = auth.uid()
    or private.is_platform_admin()
    or private.has_organization_role(organization_id, array['academy_admin']::text[])
  );
create policy video_release_2_participants_admin_write on public.video_release_2_pilot_participants
  for all to authenticated
  using (private.is_platform_admin() or private.has_organization_role(organization_id, array['academy_admin']::text[]))
  with check (private.is_platform_admin() or private.has_organization_role(organization_id, array['academy_admin']::text[]));

create policy video_release_2_sessions_read_authorized on public.video_release_2_sessions
  for select to authenticated using (private.video_release_2_session_visible(video_release_2_sessions.*));

create policy video_release_2_clips_read_staff_only on public.video_release_2_clips
  for select to authenticated
  using (exists (
    select 1 from public.video_release_2_sessions session
    where session.id = session_id
      and private.can_manage_video_release_2_session(session)
      and session.consent_status = 'granted'
      and session.retention_state = 'active'
  ));

create policy video_release_2_revisions_read_authorized on public.video_release_2_review_revisions
  for select to authenticated using (private.video_release_2_revision_visible(video_release_2_review_revisions.*));

create policy video_release_2_course_tags_read_authorized on public.video_release_2_course_tags
  for select to authenticated
  using (exists (
    select 1 from public.video_release_2_review_revisions revision
    where revision.id = revision_id and private.video_release_2_revision_visible(revision.*)
  ));

create policy video_release_2_stride_read_authorized on public.video_release_2_stride_observations
  for select to authenticated
  using (exists (
    select 1 from public.video_release_2_review_revisions revision
    where revision.id = revision_id and private.video_release_2_revision_visible(revision.*)
  ));

create policy video_release_2_scorecards_read_authorized on public.video_release_2_scorecards
  for select to authenticated
  using (exists (
    select 1 from public.video_release_2_review_revisions revision
    where revision.id = revision_id and private.video_release_2_revision_visible(revision.*)
  ));

create policy video_release_2_consent_events_read_authorized on public.video_release_2_consent_events
  for select to authenticated
  using (exists (
    select 1 from public.video_release_2_sessions session
    where session.id = session_id and private.video_release_2_session_visible(session.*)
  ));
create policy video_release_2_audit_events_staff_only on public.video_release_2_audit_events
  for select to authenticated using (exists (
    select 1 from public.video_release_2_sessions session
    where session.id = session_id
      and private.can_manage_video_release_2_session(session)
  ));

create or replace function public.get_video_release_2_access(p_organization_id uuid)
returns table (
  enabled boolean,
  can_manage boolean,
  can_upload boolean,
  can_view_approved boolean,
  pilot_scope text
)
language sql
stable
security definer
set search_path = public, private
as $$
  select
    private.video_release_2_enabled(p_organization_id),
    private.can_manage_video_release_2(p_organization_id),
    private.can_manage_video_release_2(p_organization_id)
      or private.video_release_2_adult_rider(p_organization_id, auth.uid()),
    private.video_release_2_adult_rider(p_organization_id, auth.uid()),
    case
      when private.can_manage_video_release_2(p_organization_id) then 'coach'
      when private.video_release_2_adult_rider(p_organization_id, auth.uid()) then 'adult_rider'
      else 'not_enrolled'
    end;
$$;

create or replace function public.create_video_release_2_session(
  p_organization_id uuid,
  p_rider_id uuid,
  p_coach_id uuid,
  p_horse_id uuid default null,
  p_lesson_id uuid default null,
  p_title text default 'Private video review',
  p_exercise_context text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_session_id uuid;
begin
  if not (
    (auth.uid() = p_rider_id and private.video_release_2_adult_rider(p_organization_id, auth.uid()))
    or (
      auth.uid() = p_coach_id
      and private.can_coach_video_release_2_rider(p_organization_id, p_coach_id, p_rider_id)
    )
  ) then
    raise exception 'Video Release 2 is not enabled for this adult-rider pilot account'
      using errcode = '42501';
  end if;
  if not private.video_release_2_adult_rider(p_organization_id, p_rider_id) then
    raise exception 'Release 2 rider must be an enrolled adult pilot rider'
      using errcode = '42501';
  end if;
  if not private.can_coach_video_release_2_rider(p_organization_id, p_coach_id, p_rider_id) then
    raise exception 'Coach must have an active assignment to this rider'
      using errcode = '42501';
  end if;

  insert into public.video_release_2_sessions (
    organization_id, rider_id, coach_id, horse_id, lesson_id, title, exercise_context, created_by
  ) values (
    p_organization_id, p_rider_id, p_coach_id, p_horse_id, p_lesson_id,
    p_title, p_exercise_context, auth.uid()
  ) returning id into v_session_id;

  perform private.audit_video_release_2(p_organization_id, v_session_id, null, 'session_created');
  return v_session_id;
end;
$$;

create or replace function public.record_video_release_2_consent(
  p_session_id uuid,
  p_granted boolean
)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_session public.video_release_2_sessions;
begin
  select * into v_session
  from public.video_release_2_sessions
  where id = p_session_id
  for update;
  if not found
    or v_session.rider_id <> auth.uid()
    or not private.video_release_2_adult_rider(v_session.organization_id, auth.uid()) then
    raise exception 'Not allowed to record consent for this session' using errcode = '42501';
  end if;
  if p_granted and v_session.retention_state <> 'active' then
    raise exception 'A deleted video session cannot be reactivated; create a new session to provide fresh consent'
      using errcode = '23514';
  end if;
  update public.video_release_2_sessions
  set consent_status = case when p_granted then 'granted' else 'withdrawn' end,
      consent_recorded_at = now(),
      consent_recorded_by = auth.uid(),
      retention_state = case when p_granted then retention_state else 'deleted' end,
      updated_at = now()
  where id = p_session_id;
  if not p_granted then
    delete from storage.objects
    where bucket_id = 'video-release-2'
      and name in (
        select original_storage_path
        from public.video_release_2_clips
        where session_id = p_session_id
      );
    update public.video_release_2_clips
    set upload_state = 'deleted'
    where session_id = p_session_id;
  end if;
end;
$$;

create or replace function public.register_video_release_2_clip(
  p_session_id uuid,
  p_checksum_sha256 text,
  p_mime_type text,
  p_byte_size bigint,
  p_duration_ms integer
)
returns table (clip_id uuid, storage_path text)
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_session public.video_release_2_sessions;
  v_clip_id uuid := gen_random_uuid();
  v_extension text;
begin
  select * into v_session
  from public.video_release_2_sessions
  where id = p_session_id
  for update;
  if not found or not private.can_upload_video_release_2_session(v_session) then
    raise exception 'Not allowed to register a clip for this session' using errcode = '42501';
  end if;
  if v_session.consent_status <> 'granted' or v_session.retention_state <> 'active' then
    raise exception 'Recorded adult-rider consent is required before upload' using errcode = '23514';
  end if;
  if p_checksum_sha256 !~ '^[a-f0-9]{64}$' then
    raise exception 'Checksum must be a lowercase SHA-256 value' using errcode = '22023';
  end if;
  if p_mime_type not in ('video/mp4', 'video/quicktime', 'video/webm')
    or p_byte_size <= 0 or p_byte_size > 524288000
    or p_duration_ms <= 0 or p_duration_ms > 28800000 then
    raise exception 'Video metadata failed the Release 2 validation policy' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.video_release_2_clips existing
    where existing.organization_id = v_session.organization_id
      and existing.checksum_sha256 = p_checksum_sha256
  ) then
    raise exception 'A private clip with this checksum already exists in this organization'
      using errcode = '23505';
  end if;
  v_extension := case p_mime_type
    when 'video/mp4' then 'mp4'
    when 'video/quicktime' then 'mov'
    else 'webm'
  end;

  insert into public.video_release_2_clips (
    id, organization_id, session_id, original_storage_path, checksum_sha256,
    mime_type, byte_size, duration_ms, uploaded_by
  ) values (
    v_clip_id, v_session.organization_id, v_session.id,
    v_session.organization_id::text || '/' || v_session.id::text || '/' || v_clip_id::text || '/original.' || v_extension,
    p_checksum_sha256, p_mime_type, p_byte_size, p_duration_ms, auth.uid()
  );
  perform private.audit_video_release_2(v_session.organization_id, v_session.id, null, 'clip_registered');
  return query
    select v_clip_id, original_storage_path
    from public.video_release_2_clips where id = v_clip_id;
end;
$$;

create or replace function public.confirm_video_release_2_clip_upload(p_clip_id uuid)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_clip public.video_release_2_clips;
  v_object_size bigint;
  v_object_mime_type text;
begin
  select * into v_clip from public.video_release_2_clips where id = p_clip_id for update;
  if not found or not (
    v_clip.uploaded_by = auth.uid()
    or exists (
      select 1 from public.video_release_2_sessions session
      where session.id = v_clip.session_id
        and private.can_manage_video_release_2_session(session)
    )
  ) then
    raise exception 'Not allowed to confirm this upload' using errcode = '42501';
  end if;
  select
    (object.metadata ->> 'size')::bigint,
    object.metadata ->> 'mimetype'
  into v_object_size, v_object_mime_type
  from storage.objects object
  where object.bucket_id = 'video-release-2'
    and object.name = v_clip.original_storage_path;
  if not found
    or v_object_size <> v_clip.byte_size
    or v_object_mime_type <> v_clip.mime_type then
    raise exception 'Private storage metadata must match the registered clip'
      using errcode = '23514';
  end if;
  update public.video_release_2_clips
  set upload_state = 'uploaded', uploaded_at = now()
  where id = p_clip_id;
  perform private.audit_video_release_2(v_clip.organization_id, v_clip.session_id, null, 'clip_uploaded');
end;
$$;

create or replace function public.create_video_release_2_revision(
  p_session_id uuid,
  p_source_kind text default 'manual'
)
returns uuid
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_session public.video_release_2_sessions;
  v_revision_id uuid;
  v_revision_number integer;
begin
  select * into v_session from public.video_release_2_sessions where id = p_session_id for update;
  if not found or not private.can_manage_video_release_2_session(v_session) then
    raise exception 'Only an enabled coach workspace can create a review draft' using errcode = '42501';
  end if;
  if v_session.consent_status <> 'granted' or v_session.retention_state <> 'active' then
    raise exception 'Active adult-rider consent is required before a review draft can be created'
      using errcode = '23514';
  end if;
  if p_source_kind not in ('manual', 'metric', 'ai') then
    raise exception 'Unsupported review source' using errcode = '22023';
  end if;
  select coalesce(max(revision_number), 0) + 1 into v_revision_number
  from public.video_release_2_review_revisions where session_id = p_session_id;
  insert into public.video_release_2_review_revisions (
    organization_id, session_id, revision_number, source_kind, created_by
  ) values (
    v_session.organization_id, p_session_id, v_revision_number, p_source_kind, auth.uid()
  ) returning id into v_revision_id;
  perform private.audit_video_release_2(v_session.organization_id, p_session_id, v_revision_id, 'revision_created');
  return v_revision_id;
end;
$$;

create or replace function private.assert_video_release_2_draft(p_revision_id uuid)
returns public.video_release_2_review_revisions
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_revision public.video_release_2_review_revisions;
begin
  select * into v_revision from public.video_release_2_review_revisions
  where id = p_revision_id for update;
  if not found or not exists (
    select 1 from public.video_release_2_sessions session
    where session.id = v_revision.session_id
      and private.can_manage_video_release_2_session(session)
      and session.consent_status = 'granted'
      and session.retention_state = 'active'
  ) then
    raise exception 'Not allowed to edit this review revision' using errcode = '42501';
  end if;
  if v_revision.status <> 'draft' then
    raise exception 'Approved or superseded revisions are immutable; create a new draft' using errcode = '23514';
  end if;
  return v_revision;
end;
$$;

create or replace function public.save_video_release_2_course_tag(
  p_revision_id uuid, p_clip_id uuid, p_sequence_number integer, p_fence_label text,
  p_tag_code text, p_position_ms integer default null, p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, private
as $$
declare v_revision public.video_release_2_review_revisions; v_id uuid;
begin
  v_revision := private.assert_video_release_2_draft(p_revision_id);
  if p_clip_id is not null and not exists (
    select 1 from public.video_release_2_clips clip
    where clip.id = p_clip_id
      and clip.organization_id = v_revision.organization_id
      and clip.session_id = v_revision.session_id
  ) then
    raise exception 'Course tags must reference a clip in the same review session'
      using errcode = '23514';
  end if;
  insert into public.video_release_2_course_tags (
    organization_id, revision_id, clip_id, sequence_number, fence_label, tag_code, position_ms, notes
  ) values (
    v_revision.organization_id, p_revision_id, p_clip_id, p_sequence_number, p_fence_label, p_tag_code, p_position_ms, p_notes
  ) returning id into v_id;
  perform private.audit_video_release_2(v_revision.organization_id, v_revision.session_id, p_revision_id, 'observation_saved');
  return v_id;
end;
$$;

create or replace function public.save_video_release_2_stride_observation(
  p_revision_id uuid, p_clip_id uuid, p_start_ms integer, p_end_ms integer,
  p_rhythm_state text, p_stride_count integer default null, p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, private
as $$
declare v_revision public.video_release_2_review_revisions; v_id uuid;
begin
  v_revision := private.assert_video_release_2_draft(p_revision_id);
  if p_clip_id is not null and not exists (
    select 1 from public.video_release_2_clips clip
    where clip.id = p_clip_id
      and clip.organization_id = v_revision.organization_id
      and clip.session_id = v_revision.session_id
  ) then
    raise exception 'Stride observations must reference a clip in the same review session'
      using errcode = '23514';
  end if;
  insert into public.video_release_2_stride_observations (
    organization_id, revision_id, clip_id, start_ms, end_ms, rhythm_state, stride_count, notes
  ) values (
    v_revision.organization_id, p_revision_id, p_clip_id, p_start_ms, p_end_ms, p_rhythm_state, p_stride_count, p_notes
  ) returning id into v_id;
  perform private.audit_video_release_2(v_revision.organization_id, v_revision.session_id, p_revision_id, 'observation_saved');
  return v_id;
end;
$$;

create or replace function public.save_video_release_2_scorecard(
  p_revision_id uuid, p_category text, p_score smallint, p_coach_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, private
as $$
declare v_revision public.video_release_2_review_revisions; v_id uuid;
begin
  v_revision := private.assert_video_release_2_draft(p_revision_id);
  insert into public.video_release_2_scorecards (
    organization_id, revision_id, category, score, coach_note
  ) values (
    v_revision.organization_id, p_revision_id, p_category, p_score, p_coach_note
  )
  on conflict (revision_id, category) do update
  set score = excluded.score, coach_note = excluded.coach_note
  returning id into v_id;
  perform private.audit_video_release_2(v_revision.organization_id, v_revision.session_id, p_revision_id, 'observation_saved');
  return v_id;
end;
$$;

create or replace function public.approve_video_release_2_revision(p_revision_id uuid)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_revision public.video_release_2_review_revisions;
  v_session public.video_release_2_sessions;
begin
  select * into v_revision from public.video_release_2_review_revisions where id = p_revision_id for update;
  select * into v_session from public.video_release_2_sessions where id = v_revision.session_id for update;
  if not found or not private.can_manage_video_release_2_session(v_session) then
    raise exception 'Only the assigned coach can approve this draft' using errcode = '42501';
  end if;
  if v_session.consent_status <> 'granted' or v_session.retention_state <> 'active' then
    raise exception 'Consent and active retention are required before coach approval' using errcode = '23514';
  end if;
  if v_revision.status <> 'draft' then
    raise exception 'Only a draft revision can be approved' using errcode = '23514';
  end if;
  if not exists (select 1 from public.video_release_2_scorecards where revision_id = p_revision_id) then
    raise exception 'All five coach scorecard domains are required before approval' using errcode = '23514';
  end if;
  if (select count(distinct category) from public.video_release_2_scorecards where revision_id = p_revision_id) <> 5 then
    raise exception 'All five coach scorecard domains are required before approval' using errcode = '23514';
  end if;
  update public.video_release_2_review_revisions
  set status = 'superseded',
      superseded_at = now(),
      approved_by = null,
      approved_at = null
  where session_id = v_session.id and status = 'approved';
  update public.video_release_2_review_revisions
  set status = 'approved', approved_by = auth.uid(), approved_at = now()
  where id = p_revision_id;
  update public.video_release_2_sessions
  set review_status = 'approved', approved_revision_id = p_revision_id,
      approved_by = auth.uid(), approved_at = now()
  where id = v_session.id;
  perform private.audit_video_release_2(v_session.organization_id, v_session.id, p_revision_id, 'revision_approved');
end;
$$;

create or replace function public.get_video_release_2_approved_feedback(p_organization_id uuid)
returns table (
  session_id uuid, title text, exercise_context text, approved_at timestamptz,
  revision_id uuid, category text, score smallint, coach_note text,
  rhythm_state text, stride_count integer, stride_notes text
)
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if not private.video_release_2_adult_rider(p_organization_id, auth.uid()) then
    raise exception 'Approved feedback is only available to enrolled adult riders' using errcode = '42501';
  end if;
  perform private.audit_video_release_2(p_organization_id, null, null, 'approved_feedback_read');
  return query
  select session.id, session.title, session.exercise_context, session.approved_at,
    revision.id, scorecard.category, scorecard.score, scorecard.coach_note,
    stride.rhythm_state, stride.stride_count, stride.notes
  from public.video_release_2_sessions session
  join public.video_release_2_review_revisions revision on revision.id = session.approved_revision_id
  left join public.video_release_2_scorecards scorecard on scorecard.revision_id = revision.id
  left join public.video_release_2_stride_observations stride on stride.revision_id = revision.id
  where session.organization_id = p_organization_id
    and session.rider_id = auth.uid()
    and session.review_status = 'approved'
    and session.consent_status = 'granted'
    and session.retention_state = 'active'
  order by session.approved_at desc, scorecard.category;
end;
$$;

create or replace function public.get_video_release_2_rider_consent_sessions(p_organization_id uuid)
returns table (session_id uuid, title text, consent_status text, retention_state text)
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if not private.video_release_2_adult_rider(p_organization_id, auth.uid()) then
    raise exception 'Consent controls are only available to enrolled adult riders' using errcode = '42501';
  end if;
  return query
  select session.id, session.title, session.consent_status, session.retention_state
  from public.video_release_2_sessions session
  where session.organization_id = p_organization_id
    and session.rider_id = auth.uid()
    and session.retention_state = 'active'
  order by session.created_at desc;
end;
$$;

create or replace function public.get_video_release_2_comparison(
  p_organization_id uuid, p_first_session_id uuid, p_second_session_id uuid
)
returns table (category text, first_score smallint, second_score smallint)
language plpgsql
security definer
set search_path = public, private
as $$
declare v_rider_id uuid;
begin
  select rider_id into v_rider_id from public.video_release_2_sessions
  where id = p_first_session_id
    and organization_id = p_organization_id
    and review_status = 'approved'
    and consent_status = 'granted'
    and retention_state = 'active'
    and approved_revision_id is not null;
  if v_rider_id is null
    or not exists (
      select 1 from public.video_release_2_sessions
      where id = p_second_session_id and organization_id = p_organization_id
        and rider_id = v_rider_id
        and review_status = 'approved'
        and consent_status = 'granted'
        and retention_state = 'active'
        and approved_revision_id is not null
    )
    or not (
      private.can_read_approved_video_release_2(p_organization_id, v_rider_id)
      or (
        exists (
          select 1 from public.video_release_2_sessions session
          where session.id = p_first_session_id
            and private.can_manage_video_release_2_session(session)
        )
        and exists (
          select 1 from public.video_release_2_sessions session
          where session.id = p_second_session_id
            and private.can_manage_video_release_2_session(session)
        )
      )
    ) then
    raise exception 'Approved same-rider comparison is not available' using errcode = '42501';
  end if;
  perform private.audit_video_release_2(p_organization_id, p_first_session_id, null, 'comparison_read');
  return query
  with first_scores as (
    select scorecard.category, scorecard.score
    from public.video_release_2_sessions session
    join public.video_release_2_scorecards scorecard on scorecard.revision_id = session.approved_revision_id
    where session.id = p_first_session_id
      and session.review_status = 'approved'
      and session.consent_status = 'granted'
      and session.retention_state = 'active'
  ), second_scores as (
    select scorecard.category, scorecard.score
    from public.video_release_2_sessions session
    join public.video_release_2_scorecards scorecard on scorecard.revision_id = session.approved_revision_id
    where session.id = p_second_session_id
      and session.review_status = 'approved'
      and session.consent_status = 'granted'
      and session.retention_state = 'active'
  )
  select coalesce(first_scores.category, second_scores.category),
    first_scores.score, second_scores.score
  from first_scores
  full outer join second_scores using (category)
  order by 1;
end;
$$;

create or replace function public.get_video_release_2_pilot_riders(p_organization_id uuid)
returns table (rider_id uuid, rider_name text)
language plpgsql
stable
security definer
set search_path = public, private
as $$
begin
  if not private.can_manage_video_release_2(p_organization_id) then
    raise exception 'Only the enabled coach workspace can view pilot riders' using errcode = '42501';
  end if;
  return query
  select participant.user_id, coalesce(profile.full_name, 'Adult pilot rider')
  from public.video_release_2_pilot_participants participant
  join public.profiles profile on profile.id = participant.user_id
  where participant.organization_id = p_organization_id
    and participant.participant_role = 'rider'
    and participant.adult_verified
    and participant.revoked_at is null
    and private.can_coach_video_release_2_rider(
      p_organization_id, auth.uid(), participant.user_id
    )
  order by profile.full_name nulls last;
end;
$$;

create or replace function public.get_video_release_2_trend(
  p_organization_id uuid, p_rider_id uuid default null
)
returns table (session_id uuid, approved_at timestamptz, category text, score smallint)
language plpgsql
security definer
set search_path = public, private
as $$
declare v_rider_id uuid := coalesce(p_rider_id, auth.uid());
begin
  if not (
    private.can_manage_video_release_2(p_organization_id)
    or private.can_read_approved_video_release_2(p_organization_id, v_rider_id)
  ) then
    raise exception 'Approved trend is not available' using errcode = '42501';
  end if;
  perform private.audit_video_release_2(p_organization_id, null, null, 'trend_read');
  return query
  select session.id, session.approved_at, scorecard.category, scorecard.score
  from public.video_release_2_sessions session
  join public.video_release_2_scorecards scorecard on scorecard.revision_id = session.approved_revision_id
  where session.organization_id = p_organization_id
    and session.rider_id = v_rider_id
    and session.review_status = 'approved'
    and session.consent_status = 'granted'
    and session.retention_state = 'active'
    and (
      private.can_read_approved_video_release_2(p_organization_id, v_rider_id)
      or private.can_manage_video_release_2_session(session)
    )
  order by session.approved_at, scorecard.category;
end;
$$;

revoke all on function public.get_video_release_2_access(uuid) from public;
revoke all on function public.create_video_release_2_session(uuid, uuid, uuid, uuid, uuid, text, text) from public;
revoke all on function public.record_video_release_2_consent(uuid, boolean) from public;
revoke all on function public.register_video_release_2_clip(uuid, text, text, bigint, integer) from public;
revoke all on function public.confirm_video_release_2_clip_upload(uuid) from public;
revoke all on function public.create_video_release_2_revision(uuid, text) from public;
revoke all on function public.save_video_release_2_course_tag(uuid, uuid, integer, text, text, integer, text) from public;
revoke all on function public.save_video_release_2_stride_observation(uuid, uuid, integer, integer, text, integer, text) from public;
revoke all on function public.save_video_release_2_scorecard(uuid, text, smallint, text) from public;
revoke all on function public.approve_video_release_2_revision(uuid) from public;
revoke all on function public.get_video_release_2_approved_feedback(uuid) from public;
revoke all on function public.get_video_release_2_rider_consent_sessions(uuid) from public;
revoke all on function public.get_video_release_2_comparison(uuid, uuid, uuid) from public;
revoke all on function public.get_video_release_2_trend(uuid, uuid) from public;
revoke all on function public.get_video_release_2_pilot_riders(uuid) from public;
grant execute on function public.get_video_release_2_access(uuid) to authenticated;
grant execute on function public.create_video_release_2_session(uuid, uuid, uuid, uuid, uuid, text, text) to authenticated;
grant execute on function public.record_video_release_2_consent(uuid, boolean) to authenticated;
grant execute on function public.register_video_release_2_clip(uuid, text, text, bigint, integer) to authenticated;
grant execute on function public.confirm_video_release_2_clip_upload(uuid) to authenticated;
grant execute on function public.create_video_release_2_revision(uuid, text) to authenticated;
grant execute on function public.save_video_release_2_course_tag(uuid, uuid, integer, text, text, integer, text) to authenticated;
grant execute on function public.save_video_release_2_stride_observation(uuid, uuid, integer, integer, text, integer, text) to authenticated;
grant execute on function public.save_video_release_2_scorecard(uuid, text, smallint, text) to authenticated;
grant execute on function public.approve_video_release_2_revision(uuid) to authenticated;
grant execute on function public.get_video_release_2_approved_feedback(uuid) to authenticated;
grant execute on function public.get_video_release_2_rider_consent_sessions(uuid) to authenticated;
grant execute on function public.get_video_release_2_comparison(uuid, uuid, uuid) to authenticated;
grant execute on function public.get_video_release_2_trend(uuid, uuid) to authenticated;
grant execute on function public.get_video_release_2_pilot_riders(uuid) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'video-release-2', 'video-release-2', false, 524288000,
  array['video/mp4', 'video/quicktime', 'video/webm']
)
on conflict (id) do update
set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy video_release_2_storage_staff_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'video-release-2'
    and private.can_manage_video_release_2_storage_path(name)
  );
create policy video_release_2_storage_authorized_upload on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'video-release-2'
    and private.can_upload_video_release_2_storage_path(name)
  );
create policy video_release_2_storage_staff_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'video-release-2'
    and private.can_manage_video_release_2_storage_path(name)
  )
  with check (
    bucket_id = 'video-release-2'
    and private.can_manage_video_release_2_storage_path(name)
  );
create policy video_release_2_storage_staff_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'video-release-2'
    and private.can_manage_video_release_2_storage_path(name)
  );

commit;