-- Batch 3: verified guardian relationships, view-only minor portal,
-- narrowly scoped approval permissions, adulthood review, and immutable audit.
begin;

alter table public.guardian_riders
  add column relationship_type text not null default 'legal_guardian',
  add column legal_authority boolean not null default true,
  add column verification_status text not null default 'verified',
  add column can_view_financials boolean not null default true,
  add column can_approve_purchases boolean not null default false,
  add column can_approve_horse_registration boolean not null default false,
  add column can_approve_video_ai boolean not null default false,
  add column can_approve_supervised_jumping boolean not null default false,
  add column access_expires_at timestamptz,
  add column adulthood_review_on date,
  add column verified_by uuid references public.profiles(id) on delete set null,
  add column verified_at timestamptz default now(),
  add column revoked_by uuid references public.profiles(id) on delete set null,
  add column revoked_at timestamptz,
  add column revocation_reason text;

update public.guardian_riders
set verification_status = case when active then 'verified' else 'revoked' end,
    verified_at = case when active then coalesce(updated_at, created_at) else null end,
    revoked_at = case when active then null else coalesce(updated_at, created_at) end;

alter table public.guardian_riders
  add constraint guardian_riders_relationship_type_check check (
    relationship_type in ('parent', 'legal_guardian', 'court_guardian', 'supporter')
  ),
  add constraint guardian_riders_verification_status_check check (
    verification_status in ('pending', 'verified', 'review_required', 'revoked')
  ),
  add constraint guardian_riders_access_state_check check (
    (active and verification_status = 'verified' and verified_at is not null and revoked_at is null)
    or (
      not active
      and verification_status in ('pending', 'review_required', 'revoked')
      and (verification_status <> 'revoked' or revoked_at is not null)
    )
  ),
  add constraint guardian_riders_supporter_permissions_check check (
    relationship_type <> 'supporter'
    or (
      not legal_authority
      and not can_approve_purchases
      and not can_approve_horse_registration
      and not can_approve_video_ai
      and not can_approve_supervised_jumping
    )
  ),
  add constraint guardian_riders_revocation_reason_length check (
    revocation_reason is null
    or char_length(btrim(revocation_reason)) between 1 and 500
  );

create index guardian_riders_guardian_verified_idx
  on public.guardian_riders (organization_id, guardian_id, rider_id)
  where active and verification_status = 'verified';
create index guardian_riders_verified_by_idx on public.guardian_riders (verified_by);
create index guardian_riders_revoked_by_idx on public.guardian_riders (revoked_by);
create index guardian_riders_adulthood_review_idx
  on public.guardian_riders (adulthood_review_on)
  where active and adulthood_review_on is not null;

create table public.guardian_approval_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  guardian_id uuid not null,
  rider_id uuid not null,
  request_key text not null,
  approval_type text not null,
  subject_type text not null,
  subject_id uuid,
  summary text not null,
  details jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  requested_by uuid not null references public.profiles(id) on delete restrict,
  requested_at timestamptz not null default now(),
  expires_at timestamptz,
  responded_by uuid references public.profiles(id) on delete restrict,
  responded_at timestamptz,
  response_note text,
  constraint guardian_approval_relationship_fkey foreign key
    (organization_id, guardian_id, rider_id)
    references public.guardian_riders (organization_id, guardian_id, rider_id)
    on delete restrict,
  constraint guardian_approval_request_unique unique (organization_id, request_key),
  constraint guardian_approval_request_key_format check (
    request_key ~ '^[a-z0-9][a-z0-9:_-]{2,159}$'
  ),
  constraint guardian_approval_type_check check (
    approval_type in (
      'purchase', 'horse_registration', 'video_ai_consent', 'supervised_jumping'
    )
  ),
  constraint guardian_approval_subject_type_check check (
    subject_type ~ '^[a-z][a-z0-9_]{2,63}$'
  ),
  constraint guardian_approval_summary_length check (
    char_length(btrim(summary)) between 3 and 300
  ),
  constraint guardian_approval_details_object check (jsonb_typeof(details) = 'object'),
  constraint guardian_approval_status_check check (
    status in ('pending', 'approved', 'declined', 'withdrawn', 'expired')
  ),
  constraint guardian_approval_expiry_check check (
    expires_at is null or expires_at > requested_at
  ),
  constraint guardian_approval_response_check check (
    (status in ('approved', 'declined') and responded_by is not null and responded_at is not null)
    or (status not in ('approved', 'declined') and responded_by is null and responded_at is null)
  ),
  constraint guardian_approval_response_note_length check (
    response_note is null or char_length(btrim(response_note)) between 1 and 500
  )
);

create index guardian_approval_requests_guardian_idx
  on public.guardian_approval_requests
  (organization_id, guardian_id, status, requested_at desc);
create index guardian_approval_requests_rider_idx
  on public.guardian_approval_requests
  (organization_id, rider_id, status, requested_at desc);
create index guardian_approval_requests_requested_by_idx
  on public.guardian_approval_requests (requested_by);
create index guardian_approval_requests_responded_by_idx
  on public.guardian_approval_requests (responded_by);
create index guardian_approval_requests_expiry_idx
  on public.guardian_approval_requests (expires_at)
  where status = 'pending' and expires_at is not null;

create table public.guardian_access_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  guardian_id uuid not null,
  rider_id uuid not null,
  actor_user_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  approval_request_id uuid references public.guardian_approval_requests(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  constraint guardian_access_event_relationship_fkey foreign key
    (organization_id, guardian_id, rider_id)
    references public.guardian_riders (organization_id, guardian_id, rider_id)
    on delete restrict,
  constraint guardian_access_event_type_check check (
    event_type in (
      'relationship_verified', 'relationship_review_required',
      'relationship_revoked', 'permissions_changed', 'portal_viewed',
      'approval_requested', 'approval_approved', 'approval_declined'
    )
  ),
  constraint guardian_access_event_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create index guardian_access_events_guardian_idx
  on public.guardian_access_events
  (organization_id, guardian_id, occurred_at desc);
create index guardian_access_events_rider_idx
  on public.guardian_access_events
  (organization_id, rider_id, occurred_at desc);
create index guardian_access_events_actor_idx on public.guardian_access_events (actor_user_id);
create index guardian_access_events_approval_idx
  on public.guardian_access_events (approval_request_id);

comment on table public.guardian_approval_requests is
  'Narrow, auditable guardian decisions. Medical signatures and payments remain separate gated batches.';
comment on table public.guardian_access_events is
  'Append-only audit history for guardian relationship, portal access, and approval decisions.';

create function private.guardian_permission_allows(
  p_link public.guardian_riders,
  p_approval_type text
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case p_approval_type
    when 'purchase' then p_link.can_approve_purchases
    when 'horse_registration' then p_link.can_approve_horse_registration
    when 'video_ai_consent' then p_link.can_approve_video_ai
    when 'supervised_jumping' then p_link.can_approve_supervised_jumping
    else false
  end;
$$;

create function private.can_guardian_access_rider(
  p_organization_id uuid,
  p_guardian_id uuid,
  p_rider_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.guardian_riders as link
    where link.organization_id = p_organization_id
      and link.guardian_id = p_guardian_id
      and link.rider_id = p_rider_id
      and link.active
      and link.verification_status = 'verified'
      and (link.access_expires_at is null or link.access_expires_at > now())
      and (link.adulthood_review_on is null or link.adulthood_review_on > current_date)
      and exists (
        select 1
        from public.organization_memberships as membership
        join public.organization_member_roles as member_role
          on member_role.membership_id = membership.id
        where membership.organization_id = p_organization_id
          and membership.user_id = p_guardian_id
          and membership.status = 'active'
          and member_role.role = 'guardian'
      )
  );
$$;

create function private.guardian_can_approve(
  p_organization_id uuid,
  p_guardian_id uuid,
  p_rider_id uuid,
  p_approval_type text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.guardian_riders as link
    where link.organization_id = p_organization_id
      and link.guardian_id = p_guardian_id
      and link.rider_id = p_rider_id
      and link.legal_authority
      and private.can_guardian_access_rider(
        link.organization_id, link.guardian_id, link.rider_id
      )
      and private.guardian_permission_allows(link, p_approval_type)
  );
$$;

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
    or private.can_guardian_access_rider(
      p_organization_id, (select auth.uid()), p_rider_id
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

create function private.prepare_guardian_approval_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
begin
  if actor is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  if actor <> new.rider_id
    and not private.has_organization_role(
      new.organization_id, array['academy_admin', 'stable_manager']
    )
  then
    raise exception 'Only the rider or authorized staff may request guardian approval'
      using errcode = '42501';
  end if;

  if not private.guardian_can_approve(
    new.organization_id, new.guardian_id, new.rider_id, new.approval_type
  ) then
    raise exception 'Guardian is not verified for this approval type'
      using errcode = '42501';
  end if;

  new.status := 'pending';
  new.requested_by := actor;
  new.requested_at := now();
  new.responded_by := null;
  new.responded_at := null;
  new.response_note := null;
  return new;
end;
$$;

create function private.prepare_guardian_approval_response()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
begin
  if old.status <> 'pending'
    or new.status not in ('approved', 'declined')
    or actor is null
    or actor <> old.guardian_id
    or not private.guardian_can_approve(
      old.organization_id, old.guardian_id, old.rider_id, old.approval_type
    )
  then
    raise exception 'Guardian approval response is not authorized'
      using errcode = '42501';
  end if;

  if new.organization_id is distinct from old.organization_id
    or new.guardian_id is distinct from old.guardian_id
    or new.rider_id is distinct from old.rider_id
    or new.request_key is distinct from old.request_key
    or new.approval_type is distinct from old.approval_type
    or new.subject_type is distinct from old.subject_type
    or new.subject_id is distinct from old.subject_id
    or new.summary is distinct from old.summary
    or new.details is distinct from old.details
    or new.requested_by is distinct from old.requested_by
    or new.requested_at is distinct from old.requested_at
    or new.expires_at is distinct from old.expires_at
  then
    raise exception 'Guardian approval request details are immutable'
      using errcode = '42501';
  end if;

  if old.expires_at is not null and old.expires_at <= now() then
    raise exception 'Guardian approval request has expired' using errcode = '22023';
  end if;

  new.responded_by := actor;
  new.responded_at := now();
  new.response_note := nullif(btrim(new.response_note), '');
  return new;
end;
$$;

create function private.audit_guardian_relationship()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := coalesce((select auth.uid()), new.created_by, new.verified_by, new.revoked_by);
  event_name text;
begin
  if tg_op = 'INSERT' and new.verification_status = 'verified' then
    event_name := 'relationship_verified';
  elsif tg_op = 'UPDATE' and old.verification_status is distinct from new.verification_status then
    event_name := case new.verification_status
      when 'verified' then 'relationship_verified'
      when 'review_required' then 'relationship_review_required'
      when 'revoked' then 'relationship_revoked'
      else null
    end;
  elsif tg_op = 'UPDATE' and (
    old.can_view_financials is distinct from new.can_view_financials
    or old.can_approve_purchases is distinct from new.can_approve_purchases
    or old.can_approve_horse_registration is distinct from new.can_approve_horse_registration
    or old.can_approve_video_ai is distinct from new.can_approve_video_ai
    or old.can_approve_supervised_jumping is distinct from new.can_approve_supervised_jumping
  ) then
    event_name := 'permissions_changed';
  end if;

  if event_name is not null then
    insert into public.guardian_access_events (
      organization_id, guardian_id, rider_id, actor_user_id, event_type, metadata
    ) values (
      new.organization_id, new.guardian_id, new.rider_id, actor, event_name,
      jsonb_build_object(
        'relationshipType', new.relationship_type,
        'verificationStatus', new.verification_status
      )
    );
  end if;
  return new;
end;
$$;

create function private.audit_guardian_approval()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.guardian_access_events (
    organization_id, guardian_id, rider_id, actor_user_id,
    event_type, approval_request_id, metadata
  ) values (
    new.organization_id, new.guardian_id, new.rider_id,
    coalesce((select auth.uid()), new.requested_by, new.responded_by),
    case
      when tg_op = 'INSERT' then 'approval_requested'
      when new.status = 'approved' then 'approval_approved'
      else 'approval_declined'
    end,
    new.id,
    jsonb_build_object('approvalType', new.approval_type, 'subjectType', new.subject_type)
  );
  return new;
end;
$$;

create function private.log_guardian_portal_access(
  p_organization_id uuid,
  p_rider_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
begin
  if actor is null
    or not private.can_guardian_access_rider(p_organization_id, actor, p_rider_id)
  then
    raise exception 'Guardian portal is not available for this rider'
      using errcode = '42501';
  end if;

  insert into public.guardian_access_events (
    organization_id, guardian_id, rider_id, actor_user_id, event_type
  ) values (
    p_organization_id, actor, p_rider_id, actor, 'portal_viewed'
  );
end;
$$;

create trigger guardian_approval_request_prepare
before insert on public.guardian_approval_requests
for each row execute function private.prepare_guardian_approval_request();
create trigger guardian_approval_response_prepare
before update on public.guardian_approval_requests
for each row execute function private.prepare_guardian_approval_response();
create trigger guardian_relationship_audit
after insert or update on public.guardian_riders
for each row execute function private.audit_guardian_relationship();
create trigger guardian_approval_audit
after insert or update of status on public.guardian_approval_requests
for each row execute function private.audit_guardian_approval();

alter table public.guardian_approval_requests enable row level security;
alter table public.guardian_access_events enable row level security;

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

drop policy if exists invoices_select_own on public.invoices;
create policy invoices_select_own_or_financial_guardian
on public.invoices for select to authenticated
using (
  user_id = (select auth.uid())
  or exists (
    select 1
    from public.guardian_riders as link
    where link.organization_id = invoices.organization_id
      and link.guardian_id = (select auth.uid())
      and link.rider_id = invoices.user_id
      and link.can_view_financials
      and private.can_guardian_access_rider(
        link.organization_id, link.guardian_id, link.rider_id
      )
  )
);

create policy guardian_approval_requests_select_scoped
on public.guardian_approval_requests for select to authenticated
using (
  guardian_id = (select auth.uid())
  or rider_id = (select auth.uid())
  or private.is_platform_admin()
  or private.has_organization_role(
    organization_id, array['academy_admin', 'stable_manager']
  )
);

create policy guardian_approval_requests_insert_scoped
on public.guardian_approval_requests for insert to authenticated
with check (
  requested_by = (select auth.uid())
  and (
    rider_id = (select auth.uid())
    or private.has_organization_role(
      organization_id, array['academy_admin', 'stable_manager']
    )
  )
  and private.guardian_can_approve(
    organization_id, guardian_id, rider_id, approval_type
  )
);

create policy guardian_approval_requests_update_guardian
on public.guardian_approval_requests for update to authenticated
using (
  guardian_id = (select auth.uid())
  and status = 'pending'
  and private.guardian_can_approve(
    organization_id, guardian_id, rider_id, approval_type
  )
)
with check (
  guardian_id = (select auth.uid())
  and status in ('approved', 'declined')
  and responded_by = (select auth.uid())
);

create policy guardian_access_events_select_scoped
on public.guardian_access_events for select to authenticated
using (
  guardian_id = (select auth.uid())
  or rider_id = (select auth.uid())
  or private.is_platform_admin()
  or private.has_organization_role(
    organization_id, array['academy_admin', 'stable_manager']
  )
);

create function public.respond_guardian_approval(
  p_request_id uuid,
  p_decision text,
  p_response_note text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_request_id uuid;
begin
  if p_decision not in ('approved', 'declined') then
    raise exception 'Decision must be approved or declined' using errcode = '22023';
  end if;

  update public.guardian_approval_requests
  set status = p_decision,
      response_note = p_response_note
  where id = p_request_id
  returning id into v_request_id;

  if v_request_id is null then
    raise exception 'Guardian approval request is not available'
      using errcode = '42501';
  end if;
  return v_request_id;
end;
$$;

create function public.get_guardian_portal(
  p_organization_id uuid,
  p_rider_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  link public.guardian_riders;
  result jsonb;
begin
  select relationship.* into link
  from public.guardian_riders as relationship
  where relationship.organization_id = p_organization_id
    and relationship.guardian_id = actor
    and relationship.rider_id = p_rider_id
    and private.can_guardian_access_rider(
      relationship.organization_id, relationship.guardian_id, relationship.rider_id
    );

  if link is null then
    raise exception 'Guardian portal is not available for this rider'
      using errcode = '42501';
  end if;

  perform private.log_guardian_portal_access(p_organization_id, p_rider_id);

  select jsonb_build_object(
    'relationship', jsonb_build_object(
      'relationshipType', link.relationship_type,
      'legalAuthority', link.legal_authority,
      'verificationStatus', link.verification_status,
      'adulthoodReviewOn', link.adulthood_review_on,
      'accessExpiresAt', link.access_expires_at,
      'permissions', jsonb_build_object(
        'viewFinancials', link.can_view_financials,
        'approvePurchases', link.can_approve_purchases,
        'approveHorseRegistration', link.can_approve_horse_registration,
        'approveVideoAi', link.can_approve_video_ai,
        'approveSupervisedJumping', link.can_approve_supervised_jumping
      )
    ),
    'rider', (
      select jsonb_build_object('id', profile.id, 'name', profile.full_name)
      from public.profiles as profile where profile.id = p_rider_id
    ),
    'riderSync', public.get_rider_sync_dashboard(p_organization_id, p_rider_id),
    'lessons', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', lesson.id, 'dateTime', lesson.date_time,
        'durationMin', lesson.duration_min, 'type', lesson.lesson_type,
        'status', lesson.status
      ) order by lesson.date_time desc)
      from public.lessons as lesson
      where lesson.organization_id = p_organization_id
        and lesson.rider_id = p_rider_id
        and lesson.date_time >= now() - interval '90 days'
    ), '[]'::jsonb),
    'attendance', (
      select jsonb_build_object(
        'completed', count(*) filter (where lesson.status = 'completed'),
        'scheduled', count(*) filter (where lesson.status in ('pending', 'confirmed'))
      )
      from public.lessons as lesson
      where lesson.organization_id = p_organization_id
        and lesson.rider_id = p_rider_id
        and lesson.date_time >= now() - interval '90 days'
    ),
    'horses', coalesce((
      select jsonb_agg(distinct jsonb_build_object(
        'id', horse.id, 'name', horse.name, 'status', horse.status
      ))
      from public.horse_riders as rider_horse
      join public.horses as horse on horse.id = rider_horse.horse_id
      where rider_horse.rider_id = p_rider_id
        and horse.organization_id = p_organization_id
    ), '[]'::jsonb),
    'invoices', case when link.can_view_financials then coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', invoice.id, 'number', invoice.number, 'issueDate', invoice.issue_date,
        'dueDate', invoice.due_date, 'status', invoice.status,
        'currency', invoice.currency, 'totalCents', invoice.total_cents
      ) order by invoice.issue_date desc)
      from public.invoices as invoice
      where invoice.organization_id = p_organization_id
        and invoice.user_id = p_rider_id
    ), '[]'::jsonb) else '[]'::jsonb end,
    'approvals', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', approval.id, 'approvalType', approval.approval_type,
        'subjectType', approval.subject_type, 'summary', approval.summary,
        'status', approval.status, 'requestedAt', approval.requested_at,
        'expiresAt', approval.expires_at, 'respondedAt', approval.responded_at,
        'responseNote', approval.response_note
      ) order by approval.requested_at desc)
      from public.guardian_approval_requests as approval
      where approval.organization_id = p_organization_id
        and approval.guardian_id = actor
        and approval.rider_id = p_rider_id
    ), '[]'::jsonb),
    'accessHistory', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', event.id, 'eventType', event.event_type,
        'occurredAt', event.occurred_at
      ) order by event.occurred_at desc)
      from (
        select history.id, history.event_type, history.occurred_at
        from public.guardian_access_events as history
        where history.organization_id = p_organization_id
          and history.guardian_id = actor
          and history.rider_id = p_rider_id
        order by history.occurred_at desc
        limit 20
      ) as event
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

revoke all on public.guardian_approval_requests from anon, authenticated;
grant select, insert, update on public.guardian_approval_requests to authenticated;
revoke all on public.guardian_access_events from anon, authenticated;
grant select on public.guardian_access_events to authenticated;

revoke all on function private.guardian_permission_allows(public.guardian_riders, text) from public, anon, authenticated;
revoke all on function private.can_guardian_access_rider(uuid, uuid, uuid) from public, anon;
grant execute on function private.can_guardian_access_rider(uuid, uuid, uuid) to authenticated;
revoke all on function private.guardian_can_approve(uuid, uuid, uuid, text) from public, anon;
grant execute on function private.guardian_can_approve(uuid, uuid, uuid, text) to authenticated;
revoke all on function private.prepare_guardian_approval_request() from public, anon, authenticated;
revoke all on function private.prepare_guardian_approval_response() from public, anon, authenticated;
revoke all on function private.audit_guardian_relationship() from public, anon, authenticated;
revoke all on function private.audit_guardian_approval() from public, anon, authenticated;
revoke all on function private.log_guardian_portal_access(uuid, uuid) from public, anon;
grant execute on function private.log_guardian_portal_access(uuid, uuid) to authenticated;
revoke all on function private.can_read_rider(uuid, uuid) from public, anon;
grant execute on function private.can_read_rider(uuid, uuid) to authenticated;
revoke all on function public.respond_guardian_approval(uuid, text, text) from public, anon;
grant execute on function public.respond_guardian_approval(uuid, text, text) to authenticated;
revoke all on function public.get_guardian_portal(uuid, uuid) from public, anon;
grant execute on function public.get_guardian_portal(uuid, uuid) to authenticated;

commit;
