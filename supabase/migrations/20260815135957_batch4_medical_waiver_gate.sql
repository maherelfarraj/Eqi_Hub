-- Batch 4: versioned medical/safety forms, waivers, guardian signatures,
-- immutable receipts, and fail-closed lesson and membership readiness gates.
begin;

create table public.rider_safety_profiles (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  rider_id uuid not null references public.profiles(id) on delete cascade,
  date_of_birth date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, rider_id),
  constraint rider_safety_profile_membership_fkey foreign key (organization_id, rider_id)
    references public.organization_memberships (organization_id, user_id) on delete cascade
);

create index rider_safety_profiles_rider_id_idx
  on public.rider_safety_profiles (rider_id);

create table public.compliance_document_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_type text not null,
  version integer not null,
  title_en text not null,
  title_ar text not null,
  body_en text not null,
  body_ar text not null,
  content_hash text not null,
  valid_days integer not null default 365,
  requires_guardian_when_minor boolean not null default true,
  required_for_lessons boolean not null default true,
  required_for_membership_renewal boolean not null default true,
  active boolean not null default true,
  published_by uuid references public.profiles(id) on delete restrict,
  published_at timestamptz not null default now(),
  retired_at timestamptz,
  created_at timestamptz not null default now(),
  constraint compliance_template_type_check check (
    document_type in ('medical_safety', 'liability_waiver', 'emergency_consent')
  ),
  constraint compliance_template_version_check check (version > 0),
  constraint compliance_template_valid_days_check check (valid_days between 1 and 1095),
  constraint compliance_template_hash_check check (content_hash ~ '^[a-f0-9]{64}$'),
  constraint compliance_template_title_check check (
    char_length(btrim(title_en)) between 3 and 160
    and char_length(btrim(title_ar)) between 3 and 160
  ),
  constraint compliance_template_body_check check (
    char_length(btrim(body_en)) between 20 and 20000
    and char_length(btrim(body_ar)) between 20 and 20000
  ),
  constraint compliance_template_retirement_check check (
    (active and retired_at is null) or (not active and retired_at is not null)
  ),
  unique (organization_id, document_type, version),
  unique (id, organization_id)
);

create unique index compliance_templates_one_active_type_idx
  on public.compliance_document_templates (organization_id, document_type)
  where active;
create index compliance_templates_published_by_idx
  on public.compliance_document_templates (published_by);

create table public.rider_compliance_submissions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  rider_id uuid not null references public.profiles(id) on delete restrict,
  template_id uuid not null,
  template_version integer not null,
  document_type text not null,
  status text not null default 'signed',
  answers jsonb not null default '{}'::jsonb,
  minor_at_signing boolean not null,
  medical_review_status text not null default 'not_required',
  medical_reviewed_by uuid references public.profiles(id) on delete restrict,
  medical_reviewed_at timestamptz,
  medical_review_note text,
  valid_from timestamptz not null default now(),
  valid_until timestamptz not null,
  superseded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rider_compliance_template_fkey foreign key (template_id, organization_id)
    references public.compliance_document_templates (id, organization_id) on delete restrict,
  constraint rider_compliance_membership_fkey foreign key (organization_id, rider_id)
    references public.organization_memberships (organization_id, user_id) on delete restrict,
  constraint rider_compliance_type_check check (
    document_type in ('medical_safety', 'liability_waiver', 'emergency_consent')
  ),
  constraint rider_compliance_status_check check (
    status in ('signed', 'expired', 'superseded', 'rejected')
  ),
  constraint rider_compliance_answers_object check (jsonb_typeof(answers) = 'object'),
  constraint rider_compliance_review_check check (
    medical_review_status in ('not_required', 'review_required', 'approved', 'rejected')
  ),
  constraint rider_compliance_review_actor_check check (
    (medical_review_status in ('approved', 'rejected')
      and medical_reviewed_by is not null and medical_reviewed_at is not null)
    or (medical_review_status in ('not_required', 'review_required')
      and medical_reviewed_by is null and medical_reviewed_at is null)
  ),
  constraint rider_compliance_validity_check check (valid_until > valid_from),
  constraint rider_compliance_superseded_check check (
    (status = 'superseded' and superseded_at is not null)
    or (status <> 'superseded' and superseded_at is null)
  )
);

create unique index rider_compliance_one_current_template_idx
  on public.rider_compliance_submissions (organization_id, rider_id, template_id)
  where status = 'signed';
create index rider_compliance_rider_status_idx
  on public.rider_compliance_submissions (organization_id, rider_id, status, valid_until);
create index rider_compliance_rider_id_idx
  on public.rider_compliance_submissions (rider_id);
create index rider_compliance_template_idx on public.rider_compliance_submissions (template_id);
create index rider_compliance_medical_reviewer_idx
  on public.rider_compliance_submissions (medical_reviewed_by);

create table public.compliance_signature_receipts (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.rider_compliance_submissions(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  rider_id uuid not null references public.profiles(id) on delete restrict,
  signer_id uuid not null references public.profiles(id) on delete restrict,
  signer_capacity text not null,
  typed_name text not null,
  document_hash text not null,
  consent_hash text not null,
  receipt_key text not null unique,
  signed_at timestamptz not null default now(),
  constraint compliance_signature_capacity_check check (
    signer_capacity in ('adult_rider', 'legal_guardian')
  ),
  constraint compliance_signature_name_check check (
    char_length(btrim(typed_name)) between 2 and 160
  ),
  constraint compliance_signature_document_hash_check check (document_hash ~ '^[a-f0-9]{64}$'),
  constraint compliance_signature_consent_hash_check check (consent_hash ~ '^[a-f0-9]{64}$'),
  unique (submission_id)
);

create index compliance_signature_organization_rider_idx
  on public.compliance_signature_receipts (organization_id, rider_id, signed_at desc);
create index compliance_signature_signer_idx
  on public.compliance_signature_receipts (signer_id, signed_at desc);
create index compliance_signature_rider_id_idx
  on public.compliance_signature_receipts (rider_id);

create table public.compliance_audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  rider_id uuid not null references public.profiles(id) on delete restrict,
  actor_id uuid references public.profiles(id) on delete set null,
  submission_id uuid references public.rider_compliance_submissions(id) on delete set null,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  constraint compliance_audit_event_type_check check (
    event_type in ('profile_updated', 'document_signed', 'medical_approved',
      'medical_rejected', 'document_superseded', 'readiness_blocked')
  ),
  constraint compliance_audit_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create index compliance_audit_rider_idx
  on public.compliance_audit_events (organization_id, rider_id, occurred_at desc);
create index compliance_audit_actor_idx on public.compliance_audit_events (actor_id);
create index compliance_audit_rider_id_idx on public.compliance_audit_events (rider_id);
create index compliance_audit_submission_idx on public.compliance_audit_events (submission_id);

comment on table public.rider_safety_profiles is
  'Restricted rider age record used only for minor/guardian signature enforcement.';
comment on table public.rider_compliance_submissions is
  'Restricted medical, safety, waiver, and emergency-consent declarations; never exposed in Guardian View.';
comment on table public.compliance_signature_receipts is
  'Append-only proof of the exact document and consent text accepted by an adult rider or verified legal guardian.';

create function private.can_manage_compliance(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_platform_admin()
    or private.has_organization_role(
      p_organization_id, array['academy_admin', 'stable_manager']
    );
$$;

create function private.can_read_rider_compliance(
  p_organization_id uuid,
  p_rider_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_rider_id = (select auth.uid())
    or private.can_manage_compliance(p_organization_id)
    or exists (
      select 1
      from public.guardian_riders as link
      where link.organization_id = p_organization_id
        and link.guardian_id = (select auth.uid())
        and link.rider_id = p_rider_id
        and link.legal_authority
        and link.relationship_type <> 'supporter'
        and private.can_guardian_access_rider(
          link.organization_id, link.guardian_id, link.rider_id
        )
    );
$$;

create function private.rider_is_minor(
  p_organization_id uuid,
  p_rider_id uuid,
  p_on_date date default current_date
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select profile.date_of_birth + interval '18 years' > p_on_date::timestamp
      from public.rider_safety_profiles as profile
      where profile.organization_id = p_organization_id
        and profile.rider_id = p_rider_id
    ),
    true
  );
$$;

create function private.rider_compliance_ready(
  p_organization_id uuid,
  p_rider_id uuid,
  p_purpose text,
  p_at timestamptz default now()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    p_purpose in ('lesson', 'membership_renewal')
    and exists (
      select 1
      from public.rider_safety_profiles as profile
      where profile.organization_id = p_organization_id
        and profile.rider_id = p_rider_id
    )
    and (
      select count(distinct template.document_type)
      from public.compliance_document_templates as template
      where template.organization_id = p_organization_id
        and template.active
        and case p_purpose
          when 'lesson' then template.required_for_lessons
          when 'membership_renewal' then template.required_for_membership_renewal
          else false
        end
    ) = 3
    and not exists (
      select 1
      from public.compliance_document_templates as template
      where template.organization_id = p_organization_id
        and template.active
        and case p_purpose
          when 'lesson' then template.required_for_lessons
          when 'membership_renewal' then template.required_for_membership_renewal
          else false
        end
        and not exists (
          select 1
          from public.rider_compliance_submissions as submission
          join public.compliance_signature_receipts as signature
            on signature.submission_id = submission.id
          where submission.organization_id = template.organization_id
            and submission.rider_id = p_rider_id
            and submission.template_id = template.id
            and submission.template_version = template.version
            and submission.document_type = template.document_type
            and submission.status = 'signed'
            and submission.valid_from <= p_at
            and submission.valid_until > p_at
            and submission.medical_review_status in ('not_required', 'approved')
            and signature.document_hash = template.content_hash
            and submission.minor_at_signing = private.rider_is_minor(
              p_organization_id, p_rider_id, p_at::date
            )
            and signature.signer_capacity = case
              when private.rider_is_minor(
                p_organization_id, p_rider_id, p_at::date
              ) then 'legal_guardian'
              else 'adult_rider'
            end
        )
    );
$$;

create function private.reject_compliance_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Compliance signatures and audit receipts are immutable'
    using errcode = '42501';
end;
$$;

create trigger compliance_signature_immutable
before update or delete on public.compliance_signature_receipts
for each row execute function private.reject_compliance_mutation();

create trigger compliance_audit_immutable
before update or delete on public.compliance_audit_events
for each row execute function private.reject_compliance_mutation();

create function public.set_rider_safety_profile(
  p_organization_id uuid,
  p_rider_id uuid,
  p_date_of_birth date
)
returns void
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
  if p_date_of_birth is null or p_date_of_birth > current_date then
    raise exception 'A valid date of birth is required' using errcode = '22007';
  end if;
  if not private.can_manage_compliance(p_organization_id)
    and not exists (
      select 1
      from public.guardian_riders as link
      where link.organization_id = p_organization_id
        and link.guardian_id = actor and link.rider_id = p_rider_id
        and link.legal_authority and link.relationship_type <> 'supporter'
        and private.can_guardian_access_rider(
          link.organization_id, link.guardian_id, link.rider_id
        )
    )
  then
    raise exception 'Not authorized to update this safety profile' using errcode = '42501';
  end if;

  insert into public.rider_safety_profiles (organization_id, rider_id, date_of_birth)
  values (p_organization_id, p_rider_id, p_date_of_birth)
  on conflict (organization_id, rider_id) do update
    set date_of_birth = excluded.date_of_birth, updated_at = now();

  insert into public.compliance_audit_events (
    organization_id, rider_id, actor_id, event_type, metadata
  ) values (
    p_organization_id, p_rider_id, actor, 'profile_updated',
    jsonb_build_object('date_of_birth_changed', true)
  );
end;
$$;

create function public.sign_compliance_document(
  p_organization_id uuid,
  p_rider_id uuid,
  p_template_id uuid,
  p_answers jsonb,
  p_typed_name text,
  p_consent_hash text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  template public.compliance_document_templates%rowtype;
  is_minor boolean;
  capacity text;
  review_status text;
  created_submission uuid;
begin
  if actor is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;
  if jsonb_typeof(coalesce(p_answers, '{}'::jsonb)) <> 'object' then
    raise exception 'Answers must be a JSON object' using errcode = '22023';
  end if;
  if char_length(btrim(coalesce(p_typed_name, ''))) not between 2 and 160 then
    raise exception 'Typed legal name is required' using errcode = '22023';
  end if;
  if coalesce(p_consent_hash, '') !~ '^[a-f0-9]{64}$' then
    raise exception 'Consent hash is invalid' using errcode = '22023';
  end if;

  select * into template
  from public.compliance_document_templates
  where id = p_template_id and organization_id = p_organization_id and active
  for share;
  if template.id is null then
    raise exception 'Active compliance template not found' using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from public.rider_safety_profiles
    where organization_id = p_organization_id and rider_id = p_rider_id
  ) then
    raise exception 'Date of birth is required before signing' using errcode = '23514';
  end if;

  is_minor := private.rider_is_minor(p_organization_id, p_rider_id, current_date);
  if is_minor and template.requires_guardian_when_minor then
    if not exists (
      select 1 from public.guardian_riders as link
      where link.organization_id = p_organization_id
        and link.guardian_id = actor and link.rider_id = p_rider_id
        and link.legal_authority and link.relationship_type <> 'supporter'
        and private.can_guardian_access_rider(
          link.organization_id, link.guardian_id, link.rider_id
        )
    ) then
      raise exception 'A verified legal guardian must sign for a minor'
        using errcode = '42501';
    end if;
    capacity := 'legal_guardian';
  else
    if actor <> p_rider_id then
      raise exception 'An adult rider must sign their own document' using errcode = '42501';
    end if;
    capacity := 'adult_rider';
  end if;

  update public.rider_compliance_submissions
  set status = 'superseded', superseded_at = now(), updated_at = now()
  where organization_id = p_organization_id and rider_id = p_rider_id
    and document_type = template.document_type and status = 'signed';

  review_status := case
    when template.document_type = 'medical_safety'
      and coalesce((p_answers ->> 'medical_attention_required')::boolean, false)
      then 'review_required'
    else 'not_required'
  end;

  insert into public.rider_compliance_submissions (
    organization_id, rider_id, template_id, template_version, document_type,
    answers, minor_at_signing, medical_review_status, valid_until
  ) values (
    p_organization_id, p_rider_id, template.id, template.version, template.document_type,
    coalesce(p_answers, '{}'::jsonb), is_minor, review_status,
    now() + make_interval(days => template.valid_days)
  ) returning id into created_submission;

  insert into public.compliance_signature_receipts (
    submission_id, organization_id, rider_id, signer_id, signer_capacity,
    typed_name, document_hash, consent_hash, receipt_key
  ) values (
    created_submission, p_organization_id, p_rider_id, actor, capacity,
    btrim(p_typed_name), template.content_hash, p_consent_hash,
    encode(digest(
      created_submission::text || ':' || actor::text || ':' || template.content_hash || ':' || clock_timestamp()::text,
      'sha256'
    ), 'hex')
  );

  insert into public.compliance_audit_events (
    organization_id, rider_id, actor_id, submission_id, event_type, metadata
  ) values (
    p_organization_id, p_rider_id, actor, created_submission, 'document_signed',
    jsonb_build_object('document_type', template.document_type, 'version', template.version,
      'signer_capacity', capacity, 'medical_review_status', review_status)
  );
  return created_submission;
end;
$$;

create function public.review_medical_declaration(
  p_submission_id uuid,
  p_decision text,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  target public.rider_compliance_submissions%rowtype;
begin
  select * into target from public.rider_compliance_submissions
  where id = p_submission_id for update;
  if target.id is null then raise exception 'Submission not found' using errcode = 'P0002'; end if;
  if not private.can_manage_compliance(target.organization_id) then
    raise exception 'Only authorized staff may review medical declarations' using errcode = '42501';
  end if;
  if target.document_type <> 'medical_safety' or target.medical_review_status <> 'review_required' then
    raise exception 'Submission is not awaiting medical review' using errcode = '23514';
  end if;
  if p_decision not in ('approved', 'rejected') then
    raise exception 'Decision must be approved or rejected' using errcode = '22023';
  end if;
  if p_note is not null and char_length(btrim(p_note)) > 500 then
    raise exception 'Review note is too long' using errcode = '22023';
  end if;

  update public.rider_compliance_submissions
  set medical_review_status = p_decision,
      medical_reviewed_by = actor,
      medical_reviewed_at = now(),
      medical_review_note = nullif(btrim(p_note), ''),
      status = case when p_decision = 'rejected' then 'rejected' else status end,
      updated_at = now()
  where id = target.id;

  insert into public.compliance_audit_events (
    organization_id, rider_id, actor_id, submission_id, event_type, metadata
  ) values (
    target.organization_id, target.rider_id, actor, target.id,
    case when p_decision = 'approved' then 'medical_approved' else 'medical_rejected' end,
    jsonb_build_object('note_recorded', p_note is not null)
  );
end;
$$;

create function public.get_rider_compliance_portal(
  p_organization_id uuid,
  p_rider_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.can_read_rider_compliance(p_organization_id, p_rider_id) then
    raise exception 'Not authorized to view rider compliance' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'rider_id', p_rider_id,
    'date_of_birth', (
      select date_of_birth from public.rider_safety_profiles
      where organization_id = p_organization_id and rider_id = p_rider_id
    ),
    'lesson_ready', private.rider_compliance_ready(p_organization_id, p_rider_id, 'lesson', now()),
    'renewal_ready', private.rider_compliance_ready(p_organization_id, p_rider_id, 'membership_renewal', now()),
    'documents', coalesce((
      select jsonb_agg(jsonb_build_object(
        'template_id', template.id,
        'submission_id', submission.id,
        'document_type', template.document_type,
        'version', template.version,
        'title_en', template.title_en,
        'title_ar', template.title_ar,
        'body_en', template.body_en,
        'body_ar', template.body_ar,
        'content_hash', template.content_hash,
        'valid_days', template.valid_days,
        'status', coalesce(submission.status, 'missing'),
        'medical_review_status', submission.medical_review_status,
        'valid_until', submission.valid_until,
        'minor_at_signing', submission.minor_at_signing,
        'signed_at', signature.signed_at,
        'signer_capacity', signature.signer_capacity,
        'receipt_key', signature.receipt_key
      ) order by template.document_type)
      from public.compliance_document_templates as template
      left join lateral (
        select current_submission.*
        from public.rider_compliance_submissions as current_submission
        where current_submission.organization_id = p_organization_id
          and current_submission.rider_id = p_rider_id
          and current_submission.template_id = template.id
          and current_submission.status = 'signed'
        order by current_submission.created_at desc limit 1
      ) as submission on true
      left join public.compliance_signature_receipts as signature
        on signature.submission_id = submission.id
      where template.organization_id = p_organization_id and template.active
    ), '[]'::jsonb)
  );
end;
$$;

create function public.get_compliance_admin_summary(p_organization_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.can_manage_compliance(p_organization_id) then
    raise exception 'Only authorized staff may view compliance operations' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'riders', coalesce((
      select jsonb_agg(jsonb_build_object(
        'rider_id', membership.user_id,
        'rider_name', profile.full_name,
        'lesson_ready', private.rider_compliance_ready(
          p_organization_id, membership.user_id, 'lesson', now()
        ),
        'renewal_ready', private.rider_compliance_ready(
          p_organization_id, membership.user_id, 'membership_renewal', now()
        )
      ) order by profile.full_name)
      from public.organization_memberships as membership
      join public.organization_member_roles as role on role.membership_id = membership.id
      join public.profiles as profile on profile.id = membership.user_id
      where membership.organization_id = p_organization_id
        and membership.status = 'active' and role.role = 'rider'
    ), '[]'::jsonb),
    'medical_review_required', (
      select count(*) from public.rider_compliance_submissions
      where organization_id = p_organization_id
        and status = 'signed' and medical_review_status = 'review_required'
    )
  );
end;
$$;

create function private.enforce_lesson_compliance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.organization_id is not null
    and new.status in ('pending', 'confirmed')
    and new.date_time >= now()
    and not private.rider_compliance_ready(new.organization_id, new.rider_id, 'lesson', new.date_time)
  then
    insert into public.compliance_audit_events (
      organization_id, rider_id, actor_id, event_type, metadata
    ) values (
      new.organization_id, new.rider_id, (select auth.uid()), 'readiness_blocked',
      jsonb_build_object('purpose', 'lesson')
    );
    raise exception 'Current medical, waiver, and consent signatures are required before booking'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger lessons_require_compliance
before insert or update of rider_id, organization_id, date_time, status on public.lessons
for each row execute function private.enforce_lesson_compliance();

create function private.enforce_membership_compliance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  readiness_changed boolean;
begin
  if tg_op = 'INSERT' then
    readiness_changed := true;
  else
    readiness_changed := old.status is distinct from new.status
      or old.renews_at is distinct from new.renews_at
      or old.user_id is distinct from new.user_id
      or old.organization_id is distinct from new.organization_id;
  end if;

  if new.organization_id is not null and new.status = 'active'
    and readiness_changed
    and not private.rider_compliance_ready(
      new.organization_id, new.user_id, 'membership_renewal', coalesce(new.renews_at, now())
    )
  then
    insert into public.compliance_audit_events (
      organization_id, rider_id, actor_id, event_type, metadata
    ) values (
      new.organization_id, new.user_id, (select auth.uid()), 'readiness_blocked',
      jsonb_build_object('purpose', 'membership_renewal')
    );
    raise exception 'Current medical, waiver, and consent signatures are required before renewal'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger memberships_require_compliance
before insert or update of user_id, organization_id, status, renews_at on public.memberships
for each row execute function private.enforce_membership_compliance();

alter table public.rider_safety_profiles enable row level security;
alter table public.compliance_document_templates enable row level security;
alter table public.rider_compliance_submissions enable row level security;
alter table public.compliance_signature_receipts enable row level security;
alter table public.compliance_audit_events enable row level security;

create policy rider_safety_profiles_select_authorized
on public.rider_safety_profiles for select to authenticated
using (private.can_read_rider_compliance(organization_id, rider_id));

create policy compliance_templates_select_members
on public.compliance_document_templates for select to authenticated
using (
  private.is_platform_admin()
  or private.has_organization_role(
    organization_id,
    array['rider', 'guardian', 'academy_admin', 'stable_manager']
  )
);

create policy rider_compliance_submissions_select_authorized
on public.rider_compliance_submissions for select to authenticated
using (private.can_read_rider_compliance(organization_id, rider_id));

create policy compliance_signature_receipts_select_authorized
on public.compliance_signature_receipts for select to authenticated
using (private.can_read_rider_compliance(organization_id, rider_id));

create policy compliance_audit_events_select_authorized
on public.compliance_audit_events for select to authenticated
using (private.can_read_rider_compliance(organization_id, rider_id));

revoke all on table public.rider_safety_profiles from public, anon, authenticated;
revoke all on table public.compliance_document_templates from public, anon, authenticated;
revoke all on table public.rider_compliance_submissions from public, anon, authenticated;
revoke all on table public.compliance_signature_receipts from public, anon, authenticated;
revoke all on table public.compliance_audit_events from public, anon, authenticated;
grant select on table public.rider_safety_profiles to authenticated;
grant select on table public.compliance_document_templates to authenticated;
grant select on table public.rider_compliance_submissions to authenticated;
grant select on table public.compliance_signature_receipts to authenticated;
grant select on table public.compliance_audit_events to authenticated;

revoke all on function private.can_manage_compliance(uuid) from public, anon;
revoke all on function private.can_read_rider_compliance(uuid, uuid) from public, anon;
revoke all on function private.rider_is_minor(uuid, uuid, date) from public, anon;
revoke all on function private.rider_compliance_ready(uuid, uuid, text, timestamptz) from public, anon;
grant execute on function private.can_manage_compliance(uuid) to authenticated;
grant execute on function private.can_read_rider_compliance(uuid, uuid) to authenticated;
grant execute on function private.rider_is_minor(uuid, uuid, date) to authenticated;
grant execute on function private.rider_compliance_ready(uuid, uuid, text, timestamptz) to authenticated;

revoke all on function public.set_rider_safety_profile(uuid, uuid, date) from public, anon;
revoke all on function public.sign_compliance_document(uuid, uuid, uuid, jsonb, text, text) from public, anon;
revoke all on function public.review_medical_declaration(uuid, text, text) from public, anon;
revoke all on function public.get_rider_compliance_portal(uuid, uuid) from public, anon;
revoke all on function public.get_compliance_admin_summary(uuid) from public, anon;
grant execute on function public.set_rider_safety_profile(uuid, uuid, date) to authenticated;
grant execute on function public.sign_compliance_document(uuid, uuid, uuid, jsonb, text, text) to authenticated;
grant execute on function public.review_medical_declaration(uuid, text, text) to authenticated;
grant execute on function public.get_rider_compliance_portal(uuid, uuid) to authenticated;
grant execute on function public.get_compliance_admin_summary(uuid) to authenticated;

-- Every organization starts with one active, reviewable version of each gate.
-- Legal counsel may replace these drafts through a later versioned migration;
-- the hash prevents signatures from silently carrying across text changes.
insert into public.compliance_document_templates (
  organization_id, document_type, version, title_en, title_ar, body_en, body_ar,
  content_hash, valid_days, requires_guardian_when_minor,
  required_for_lessons, required_for_membership_renewal
)
select organization.id, seed.document_type, 1, seed.title_en, seed.title_ar,
  seed.body_en, seed.body_ar,
  encode(digest(seed.body_en || E'\n---\n' || seed.body_ar, 'sha256'), 'hex'),
  seed.valid_days, true, true, true
from public.organizations as organization
cross join (values
  ('medical_safety', 'Medical and safety declaration', 'إقرار طبي وسلامة',
   'I confirm that the rider medical and emergency information supplied is accurate and I will report any material change before riding.',
   'أؤكد أن المعلومات الطبية ومعلومات الطوارئ المقدمة للفارس صحيحة، وسأبلغ عن أي تغيير جوهري قبل الركوب.', 365),
  ('liability_waiver', 'Riding activity liability waiver', 'إقرار مسؤولية نشاط الفروسية',
   'I understand that equestrian activity carries inherent risk and accept the academy rules, supervision requirements, and emergency procedures.',
   'أفهم أن نشاط الفروسية ينطوي على مخاطر متأصلة، وأوافق على قواعد الأكاديمية ومتطلبات الإشراف وإجراءات الطوارئ.', 365),
  ('emergency_consent', 'Emergency treatment consent', 'موافقة العلاج الطارئ',
   'If the rider cannot provide consent, I authorize the academy to seek appropriate emergency assistance while attempting to contact the recorded guardian.',
   'إذا تعذر على الفارس تقديم الموافقة، أفوض الأكاديمية بطلب المساعدة الطارئة المناسبة مع محاولة التواصل مع ولي الأمر المسجل.', 365)
) as seed(document_type, title_en, title_ar, body_en, body_ar, valid_days)
where organization.active;

commit;
