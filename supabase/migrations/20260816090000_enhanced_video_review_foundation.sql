-- Enhanced Video Intelligence Release 1: private, tenant-scoped review records only.
-- This migration deliberately excludes automated analysis, WebRTC, public sharing,
-- medical/soundness assessment, and any public storage access.
begin;

create table public.video_review_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  rider_id uuid not null references public.profiles(id) on delete restrict,
  horse_id uuid references public.horses(id) on delete set null,
  coach_id uuid not null references public.profiles(id) on delete restrict,
  lesson_id uuid references public.lessons(id) on delete set null,
  training_objective text,
  competition_reference text,
  title text not null,
  consent_status text not null default 'pending',
  consent_recorded_by uuid references public.profiles(id) on delete set null,
  consent_recorded_at timestamptz,
  review_status text not null default 'draft',
  coach_approved_by uuid references public.profiles(id) on delete set null,
  coach_approved_at timestamptz,
  retention_state text not null default 'active',
  retention_delete_after timestamptz,
  deletion_requested_at timestamptz,
  deleted_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint video_review_sessions_title_check
    check (char_length(btrim(title)) between 3 and 160),
  constraint video_review_sessions_context_check
    check (
      lesson_id is not null
      or nullif(btrim(training_objective), '') is not null
      or nullif(btrim(competition_reference), '') is not null
    ),
  constraint video_review_sessions_objective_length_check
    check (training_objective is null or char_length(btrim(training_objective)) between 3 and 500),
  constraint video_review_sessions_competition_length_check
    check (competition_reference is null or char_length(btrim(competition_reference)) between 3 and 240),
  constraint video_review_sessions_consent_check
    check (
      (consent_status in ('pending', 'withdrawn') and consent_recorded_by is null and consent_recorded_at is null)
      or (consent_status in ('granted', 'not_required') and consent_recorded_by is not null and consent_recorded_at is not null)
    ),
  constraint video_review_sessions_consent_status_check
    check (consent_status in ('pending', 'granted', 'withdrawn', 'not_required')),
  constraint video_review_sessions_review_status_check
    check (review_status in ('draft', 'ready_for_review', 'reviewed', 'coach_approved', 'archived')),
  constraint video_review_sessions_approval_check
    check (
      (review_status = 'coach_approved' and coach_approved_by is not null and coach_approved_at is not null)
      or (review_status <> 'coach_approved' and coach_approved_by is null and coach_approved_at is null)
    ),
  constraint video_review_sessions_retention_state_check
    check (retention_state in ('active', 'retention_due', 'deletion_requested', 'deleted')),
  constraint video_review_sessions_deleted_state_check
    check (
      (retention_state = 'deleted' and deleted_at is not null)
      or (retention_state <> 'deleted' and deleted_at is null)
    )
);

create table public.video_review_clips (
  id uuid primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  session_id uuid not null references public.video_review_sessions(id) on delete cascade,
  original_filename text not null,
  original_storage_path text not null unique,
  original_content_type text not null,
  original_size_bytes bigint not null,
  duration_ms integer,
  processing_status text not null default 'uploaded',
  streaming_storage_path text unique,
  thumbnail_storage_path text unique,
  keyframe_timeline jsonb not null default '[]'::jsonb,
  slow_motion_rates jsonb not null default '[0.25, 0.5, 0.75, 1]'::jsonb,
  deleted_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint video_review_clips_filename_check
    check (char_length(btrim(original_filename)) between 1 and 255),
  constraint video_review_clips_content_type_check
    check (original_content_type in ('video/mp4', 'video/quicktime', 'video/webm')),
  constraint video_review_clips_size_check
    check (original_size_bytes between 1 and 524288000),
  constraint video_review_clips_duration_check
    check (duration_ms is null or duration_ms between 1 and 28800000),
  constraint video_review_clips_processing_status_check
    check (processing_status in ('uploaded', 'derivatives_ready', 'failed', 'deleted')),
  constraint video_review_clips_processing_paths_check
    check (
      (processing_status = 'derivatives_ready' and streaming_storage_path is not null)
      or processing_status <> 'derivatives_ready'
    ),
  constraint video_review_clips_deleted_check
    check (
      (processing_status = 'deleted' and deleted_at is not null)
      or (processing_status <> 'deleted' and deleted_at is null)
    ),
  constraint video_review_clips_keyframe_timeline_check
    check (jsonb_typeof(keyframe_timeline) = 'array'),
  constraint video_review_clips_slow_motion_rates_check
    check (jsonb_typeof(slow_motion_rates) = 'array')
);

create table public.video_review_annotations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  clip_id uuid not null references public.video_review_clips(id) on delete cascade,
  annotation_type text not null,
  visibility text not null default 'coach_only',
  timecode_ms integer,
  payload jsonb not null default '{}'::jsonb,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint video_review_annotations_type_check
    check (annotation_type in ('tag', 'text', 'voice', 'drawing', 'frame')),
  constraint video_review_annotations_visibility_check
    check (visibility in ('coach_only', 'approved_audience')),
  constraint video_review_annotations_timecode_check
    check (timecode_ms is null or timecode_ms >= 0),
  constraint video_review_annotations_payload_check
    check (jsonb_typeof(payload) = 'object')
);

create table public.video_review_activity_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  -- Audit identifiers intentionally remain after source review data is deleted.
  session_id uuid not null,
  clip_id uuid,
  annotation_id uuid,
  actor_user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  constraint video_review_activity_action_check
    check (action in ('upload', 'view', 'download', 'edit', 'approve', 'share', 'delete')),
  constraint video_review_activity_metadata_check
    check (jsonb_typeof(metadata) = 'object')
);

create index video_review_sessions_tenant_rider_idx
  on public.video_review_sessions (organization_id, rider_id, created_at desc);
create index video_review_sessions_tenant_coach_idx
  on public.video_review_sessions (organization_id, coach_id, updated_at desc);
create index video_review_sessions_audience_idx
  on public.video_review_sessions (organization_id, rider_id, coach_approved_at desc)
  where review_status = 'coach_approved' and retention_state = 'active';
create index video_review_clips_session_idx
  on public.video_review_clips (organization_id, session_id, created_at);
create index video_review_annotations_clip_idx
  on public.video_review_annotations (organization_id, clip_id, created_at);
create index video_review_activity_session_idx
  on public.video_review_activity_events (organization_id, session_id, occurred_at desc);
create index video_review_activity_clip_idx
  on public.video_review_activity_events (organization_id, clip_id, occurred_at desc)
  where clip_id is not null;

comment on table public.video_review_sessions is
  'Private tenant-scoped review sessions. This foundation does not perform automated analysis or safety/medical assessment.';
comment on table public.video_review_clips is
  'Private source and derivative metadata only; storage paths are never public URLs.';
comment on table public.video_review_activity_events is
  'Append-only audit trail for private review upload, view, download, edit, approval, internal share, and delete events.';

create function private.can_manage_video_review(
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
      p_organization_id, array['academy_admin', 'stable_manager']
    )
    or exists (
      select 1
      from public.coach_rider_assignments as assignment
      where assignment.organization_id = p_organization_id
        and assignment.coach_id = (select auth.uid())
        and assignment.rider_id = p_rider_id
        and assignment.active
        and (assignment.ends_on is null or assignment.ends_on >= current_date)
        and private.has_organization_role(p_organization_id, array['coach'])
    );
$$;

create function private.can_approve_video_review(
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
    or exists (
      select 1
      from public.coach_rider_assignments as assignment
      where assignment.organization_id = p_organization_id
        and assignment.coach_id = (select auth.uid())
        and assignment.rider_id = p_rider_id
        and assignment.active
        and (assignment.ends_on is null or assignment.ends_on >= current_date)
        and private.has_organization_role(p_organization_id, array['coach'])
    );
$$;

create function private.video_review_audience_visible(
  p_session public.video_review_sessions
)
returns boolean
language sql
stable
set search_path = ''
as $$
  select
    p_session.review_status = 'coach_approved'
    and p_session.consent_status in ('granted', 'not_required')
    and p_session.retention_state = 'active'
    and p_session.deleted_at is null;
$$;

create function private.can_read_approved_video_review(
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
    (
      p_rider_id = (select auth.uid())
      and exists (
        select 1
        from public.organization_memberships as membership
        join public.organization_member_roles as member_role
          on member_role.membership_id = membership.id
        where membership.organization_id = p_organization_id
          and membership.user_id = p_rider_id
          and membership.status = 'active'
          and member_role.role = 'rider'
      )
    )
    or private.can_guardian_access_rider(
      p_organization_id, (select auth.uid()), p_rider_id
    );
$$;

create function private.can_manage_video_review_storage_path(
  p_object_name text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    p_object_name ~ '^[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}/'
    and exists (
      select 1
      from public.video_review_sessions as session
      where session.id = (storage.foldername(p_object_name))[2]::uuid
        and session.organization_id = (storage.foldername(p_object_name))[1]::uuid
        and private.can_manage_video_review(session.organization_id, session.rider_id)
    );
$$;

create function private.can_read_video_review_derivative_path(
  p_object_name text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.video_review_clips as clip
    join public.video_review_sessions as session on session.id = clip.session_id
    where clip.organization_id = session.organization_id
      and (clip.streaming_storage_path = p_object_name or clip.thumbnail_storage_path = p_object_name)
      and private.video_review_audience_visible(session)
      and private.can_read_approved_video_review(session.organization_id, session.rider_id)
  );
$$;

create function private.prepare_video_review_session()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.created_by is distinct from (select auth.uid()) then
      raise exception 'video review session creator must be the current user';
    end if;
    if new.review_status <> 'draft' then
      raise exception 'video review sessions must start as drafts';
    end if;
    -- Client inserts always begin with unrecorded consent; a later authorized
    -- update records the actor and timestamp server-side.
    new.consent_status := 'pending';
    new.consent_recorded_by := null;
    new.consent_recorded_at := null;
    new.updated_by := (select auth.uid());
  else
    new.updated_by := (select auth.uid());
    new.updated_at := now();
  end if;

  if not exists (
    select 1
    from public.organization_memberships as membership
    join public.organization_member_roles as member_role
      on member_role.membership_id = membership.id
    where membership.organization_id = new.organization_id
      and membership.user_id = new.rider_id
      and membership.status = 'active'
      and member_role.role = 'rider'
  ) then
    raise exception 'video review rider must have an active rider membership in this organization';
  end if;

  if new.horse_id is not null and not exists (
    select 1 from public.horses as horse
    where horse.id = new.horse_id
      and horse.organization_id = new.organization_id
  ) then
    raise exception 'video review horse must belong to this organization';
  end if;

  if new.lesson_id is not null and not exists (
    select 1 from public.lessons as lesson
    where lesson.id = new.lesson_id
      and lesson.organization_id = new.organization_id
      and lesson.rider_id = new.rider_id
      and (new.horse_id is null or lesson.horse_id = new.horse_id)
  ) then
    raise exception 'video review lesson must belong to this organization, rider, and horse context';
  end if;

  if not exists (
    select 1
    from public.coach_rider_assignments as assignment
    join public.organization_memberships as membership
      on membership.organization_id = assignment.organization_id
      and membership.user_id = assignment.coach_id
      and membership.status = 'active'
    join public.organization_member_roles as member_role
      on member_role.membership_id = membership.id
    where assignment.organization_id = new.organization_id
      and assignment.coach_id = new.coach_id
      and assignment.rider_id = new.rider_id
      and assignment.active
      and (assignment.ends_on is null or assignment.ends_on >= current_date)
      and member_role.role = 'coach'
  ) and not private.is_platform_admin() then
    raise exception 'video review coach must be an active assigned coach for this rider';
  end if;

  if tg_op = 'UPDATE' and new.consent_status is distinct from old.consent_status then
    if new.consent_status in ('granted', 'not_required') then
      new.consent_recorded_by := (select auth.uid());
      new.consent_recorded_at := now();
    else
      new.consent_recorded_by := null;
      new.consent_recorded_at := null;
    end if;
  end if;

  if new.review_status = 'coach_approved'
    and old.review_status is distinct from 'coach_approved' then
    if new.consent_status not in ('granted', 'not_required') then
      raise exception 'consent must be granted before coach approval';
    end if;
    if not private.can_approve_video_review(new.organization_id, new.rider_id) then
      raise exception 'only an assigned coach may approve video review output';
    end if;
    new.coach_approved_by := (select auth.uid());
    new.coach_approved_at := now();
  elsif new.review_status <> 'coach_approved' then
    new.coach_approved_by := null;
    new.coach_approved_at := null;
  end if;

  if new.retention_state = 'deleted'
    and (tg_op = 'INSERT' or old.retention_state <> 'deleted') then
    new.deleted_at := now();
  elsif new.retention_state <> 'deleted' then
    new.deleted_at := null;
  end if;

  return new;
end;
$$;

create function private.invalidate_video_review_approval(
  p_session_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Any changed clip is withheld until an assigned coach re-approves the session.
  update public.video_review_sessions
  set review_status = 'reviewed'
  where id = p_session_id
    and review_status = 'coach_approved';
end;
$$;

create function private.prepare_video_review_clip()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.created_by is distinct from (select auth.uid()) then
      raise exception 'video review clip creator must be the current user';
    end if;
    if not exists (
      select 1 from public.video_review_sessions as session
      where session.id = new.session_id
        and session.organization_id = new.organization_id
    ) then
      raise exception 'video review clip session must belong to its organization';
    end if;
  else
    new.updated_at := now();
    if new.processing_status = 'deleted' and old.processing_status <> 'deleted' then
      new.deleted_at := now();
    elsif new.processing_status <> 'deleted' then
      new.deleted_at := null;
    end if;
  end if;
  perform private.invalidate_video_review_approval(new.session_id);
  return new;
end;
$$;

create function private.prepare_video_review_annotation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.created_by is distinct from (select auth.uid()) then
      raise exception 'video review annotation creator must be the current user';
    end if;
  else
    if new.created_by is distinct from old.created_by then
      raise exception 'video review annotation creator is immutable';
    end if;
    new.updated_at := now();
  end if;

  if not exists (
    select 1
    from public.video_review_clips as clip
    join public.video_review_sessions as session on session.id = clip.session_id
    where clip.id = new.clip_id
      and clip.organization_id = new.organization_id
      and session.organization_id = new.organization_id
  ) then
    raise exception 'video review annotation clip must belong to its organization';
  end if;
  if new.visibility = 'approved_audience'
    or (tg_op = 'UPDATE' and old.visibility = 'approved_audience') then
    perform private.invalidate_video_review_approval((
      select clip.session_id
      from public.video_review_clips as clip
      where clip.id = new.clip_id
    ));
  end if;
  return new;
end;
$$;

create function private.audit_video_review_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_organization_id uuid;
  v_session_id uuid;
  v_clip_id uuid;
  v_annotation_id uuid;
  v_actor_id uuid;
  v_action text := 'edit';
begin
  if tg_table_name = 'video_review_sessions' then
    if tg_op = 'DELETE' then
      v_organization_id := old.organization_id;
      v_session_id := old.id;
      v_actor_id := coalesce((select auth.uid()), old.updated_by, old.created_by);
      v_action := 'delete';
    else
      v_organization_id := new.organization_id;
      v_session_id := new.id;
      v_actor_id := coalesce((select auth.uid()), new.updated_by, new.created_by);
      if tg_op = 'UPDATE' and new.review_status = 'coach_approved'
        and old.review_status is distinct from 'coach_approved' then v_action := 'approve';
      end if;
    end if;
  elsif tg_table_name = 'video_review_clips' then
    if tg_op = 'DELETE' then
      v_organization_id := old.organization_id;
      v_session_id := old.session_id;
      v_clip_id := old.id;
      v_actor_id := coalesce((select auth.uid()), old.created_by);
      v_action := 'delete';
    else
      v_organization_id := new.organization_id;
      v_session_id := new.session_id;
      v_clip_id := new.id;
      v_actor_id := coalesce((select auth.uid()), new.created_by);
      if tg_op = 'INSERT' then v_action := 'upload';
      elsif tg_op = 'UPDATE' and new.processing_status = 'deleted' then v_action := 'delete';
      end if;
    end if;
  else
    if tg_op = 'DELETE' then
      v_organization_id := old.organization_id;
      v_clip_id := old.clip_id;
      v_annotation_id := old.id;
      v_actor_id := coalesce((select auth.uid()), old.created_by);
      v_action := 'delete';
    else
      v_organization_id := new.organization_id;
      v_clip_id := new.clip_id;
      v_annotation_id := new.id;
      v_actor_id := coalesce((select auth.uid()), new.created_by);
    end if;
    select clip.session_id into v_session_id from public.video_review_clips as clip where clip.id = v_clip_id;
  end if;

  insert into public.video_review_activity_events (
    organization_id, session_id, clip_id, annotation_id, actor_user_id, action, metadata
  ) values (
    v_organization_id, v_session_id, v_clip_id, v_annotation_id, v_actor_id, v_action,
    jsonb_build_object('source', 'database_trigger', 'operation', lower(tg_op))
  );

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create function public.record_video_review_activity(
  p_clip_id uuid,
  p_action text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_clip public.video_review_clips;
  v_session public.video_review_sessions;
begin
  if p_action not in ('view', 'download', 'share') then
    raise exception 'unsupported video review activity';
  end if;

  select * into v_clip from public.video_review_clips where id = p_clip_id;
  select * into v_session from public.video_review_sessions where id = v_clip.session_id;
  if not found then raise exception 'video review clip not found'; end if;

  if not (
    private.can_manage_video_review(v_session.organization_id, v_session.rider_id)
    or (
      private.video_review_audience_visible(v_session)
      and private.can_read_approved_video_review(v_session.organization_id, v_session.rider_id)
    )
  ) then
    raise exception 'not authorized to access video review activity';
  end if;

  insert into public.video_review_activity_events (
    organization_id, session_id, clip_id, actor_user_id, action, metadata
  ) values (
    v_session.organization_id, v_session.id, v_clip.id, (select auth.uid()), p_action,
    jsonb_build_object('source', 'client_intent')
  );
end;
$$;

create trigger video_review_session_prepare
before insert or update on public.video_review_sessions
for each row execute function private.prepare_video_review_session();
create trigger video_review_clip_prepare
before insert or update on public.video_review_clips
for each row execute function private.prepare_video_review_clip();
create trigger video_review_annotation_prepare
before insert or update on public.video_review_annotations
for each row execute function private.prepare_video_review_annotation();
create trigger video_review_session_audit
after insert or update or delete on public.video_review_sessions
for each row execute function private.audit_video_review_change();
create trigger video_review_clip_audit
after insert or update or delete on public.video_review_clips
for each row execute function private.audit_video_review_change();
create trigger video_review_annotation_audit
after insert or update or delete on public.video_review_annotations
for each row execute function private.audit_video_review_change();

alter table public.video_review_sessions enable row level security;
alter table public.video_review_clips enable row level security;
alter table public.video_review_annotations enable row level security;
alter table public.video_review_activity_events enable row level security;

create policy video_review_sessions_select_authorized
on public.video_review_sessions for select to authenticated
using (
  private.can_manage_video_review(organization_id, rider_id)
  or (
    private.video_review_audience_visible(video_review_sessions)
    and private.can_read_approved_video_review(organization_id, rider_id)
  )
);
create policy video_review_sessions_insert_staff
on public.video_review_sessions for insert to authenticated
with check (
  private.can_manage_video_review(organization_id, rider_id)
  and created_by = (select auth.uid())
);
create policy video_review_sessions_update_staff
on public.video_review_sessions for update to authenticated
using (private.can_manage_video_review(organization_id, rider_id))
with check (private.can_manage_video_review(organization_id, rider_id));

create policy video_review_clips_select_authorized
on public.video_review_clips for select to authenticated
using (
  exists (
    select 1 from public.video_review_sessions as session
    where session.id = video_review_clips.session_id
      and session.organization_id = video_review_clips.organization_id
      and (
        private.can_manage_video_review(session.organization_id, session.rider_id)
        or (
          private.video_review_audience_visible(session)
          and private.can_read_approved_video_review(session.organization_id, session.rider_id)
        )
      )
  )
);
create policy video_review_clips_insert_staff
on public.video_review_clips for insert to authenticated
with check (
  exists (
    select 1 from public.video_review_sessions as session
    where session.id = video_review_clips.session_id
      and session.organization_id = video_review_clips.organization_id
      and private.can_manage_video_review(session.organization_id, session.rider_id)
  )
  and created_by = (select auth.uid())
);
create policy video_review_clips_update_staff
on public.video_review_clips for update to authenticated
using (
  exists (
    select 1 from public.video_review_sessions as session
    where session.id = video_review_clips.session_id
      and private.can_manage_video_review(session.organization_id, session.rider_id)
  )
)
with check (
  exists (
    select 1 from public.video_review_sessions as session
    where session.id = video_review_clips.session_id
      and session.organization_id = video_review_clips.organization_id
      and private.can_manage_video_review(session.organization_id, session.rider_id)
  )
);

create policy video_review_annotations_select_authorized
on public.video_review_annotations for select to authenticated
using (
  exists (
    select 1
    from public.video_review_clips as clip
    join public.video_review_sessions as session on session.id = clip.session_id
    where clip.id = video_review_annotations.clip_id
      and clip.organization_id = video_review_annotations.organization_id
      and (
        private.can_manage_video_review(session.organization_id, session.rider_id)
        or (
          video_review_annotations.visibility = 'approved_audience'
          and private.video_review_audience_visible(session)
          and private.can_read_approved_video_review(session.organization_id, session.rider_id)
        )
      )
  )
);
create policy video_review_annotations_insert_staff
on public.video_review_annotations for insert to authenticated
with check (
  created_by = (select auth.uid())
  and exists (
    select 1
    from public.video_review_clips as clip
    join public.video_review_sessions as session on session.id = clip.session_id
    where clip.id = video_review_annotations.clip_id
      and clip.organization_id = video_review_annotations.organization_id
      and private.can_manage_video_review(session.organization_id, session.rider_id)
  )
);
create policy video_review_annotations_update_staff
on public.video_review_annotations for update to authenticated
using (
  exists (
    select 1 from public.video_review_clips as clip
    join public.video_review_sessions as session on session.id = clip.session_id
    where clip.id = video_review_annotations.clip_id
      and private.can_manage_video_review(session.organization_id, session.rider_id)
  )
)
with check (
  created_by = (select auth.uid())
  and exists (
    select 1
    from public.video_review_clips as clip
    join public.video_review_sessions as session on session.id = clip.session_id
    where clip.id = video_review_annotations.clip_id
      and clip.organization_id = video_review_annotations.organization_id
      and session.organization_id = video_review_annotations.organization_id
      and private.can_manage_video_review(session.organization_id, session.rider_id)
  )
);
create policy video_review_annotations_delete_staff
on public.video_review_annotations for delete to authenticated
using (
  exists (
    select 1 from public.video_review_clips as clip
    join public.video_review_sessions as session on session.id = clip.session_id
    where clip.id = video_review_annotations.clip_id
      and private.can_manage_video_review(session.organization_id, session.rider_id)
  )
);

create policy video_review_activity_select_authorized
on public.video_review_activity_events for select to authenticated
using (
  exists (
    select 1 from public.video_review_sessions as session
    where session.id = video_review_activity_events.session_id
      and (
        private.can_manage_video_review(session.organization_id, session.rider_id)
        or (
          private.video_review_audience_visible(session)
          and private.can_read_approved_video_review(session.organization_id, session.rider_id)
        )
      )
  )
);

grant select, insert, update on public.video_review_sessions to authenticated;
grant select, insert, update on public.video_review_clips to authenticated;
grant select, insert, update on public.video_review_annotations to authenticated;
grant select on public.video_review_activity_events to authenticated;
revoke all on function private.can_manage_video_review(uuid, uuid) from public, anon;
revoke all on function private.can_approve_video_review(uuid, uuid) from public, anon;
revoke all on function private.can_read_approved_video_review(uuid, uuid) from public, anon;
revoke all on function private.can_manage_video_review_storage_path(text) from public, anon;
revoke all on function private.can_read_video_review_derivative_path(text) from public, anon;
revoke all on function private.invalidate_video_review_approval(uuid) from public, anon, authenticated, service_role;
grant execute on function private.can_manage_video_review(uuid, uuid) to authenticated;
grant execute on function private.can_approve_video_review(uuid, uuid) to authenticated;
grant execute on function private.can_read_approved_video_review(uuid, uuid) to authenticated;
grant execute on function private.can_manage_video_review_storage_path(text) to authenticated;
grant execute on function private.can_read_video_review_derivative_path(text) to authenticated;
grant execute on function public.record_video_review_activity(uuid, text) to authenticated;

drop policy if exists video_review_storage_staff_manage on storage.objects;
create policy video_review_storage_staff_manage
on storage.objects for all to authenticated
using (
  bucket_id = 'video-reviews'
  and private.can_manage_video_review_storage_path(name)
)
with check (
  bucket_id = 'video-reviews'
  and private.can_manage_video_review_storage_path(name)
);
drop policy if exists video_review_storage_read_approved_derivatives on storage.objects;
create policy video_review_storage_read_approved_derivatives
on storage.objects for select to authenticated
using (
  bucket_id = 'video-reviews'
  and private.can_read_video_review_derivative_path(name)
);

commit;