-- Batch 8: Parent, Membership & Revenue Operations
-- Local migration only. Batch 8 is disabled unless an organization has an
-- explicit ready+enabled row. Payment-link records are non-processing intents:
-- this migration contains no provider call, payment execution, capture, refund, or
-- automatic membership activation path.
begin;

alter table public.invoices
  add constraint batch8_invoices_id_organization_user_unique
  unique (id, organization_id, user_id);

create table public.batch8_feature_readiness (
  organization_id uuid primary key
    references public.organizations(id) on delete cascade,
  readiness_status text not null default 'draft',
  enabled boolean not null default false,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint batch8_feature_readiness_status_check check (
    readiness_status in ('draft', 'review_required', 'ready', 'blocked')
  ),
  constraint batch8_feature_readiness_default_off_check check (
    enabled = false or (
      readiness_status = 'ready'
      and reviewed_by is not null
      and reviewed_at is not null
    )
  )
);

create table public.batch8_family_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.organizations(id) on delete cascade,
  display_name text not null,
  status text not null default 'active',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint batch8_family_accounts_id_organization_unique
    unique (id, organization_id),
  constraint batch8_family_accounts_name_check check (
    char_length(btrim(display_name)) between 2 and 160
  ),
  constraint batch8_family_accounts_status_check check (
    status in ('active', 'suspended', 'closed')
  )
);

create table public.batch8_family_account_riders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.organizations(id) on delete cascade,
  family_account_id uuid not null,
  guardian_id uuid not null,
  rider_id uuid not null,
  status text not null default 'active',
  added_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint batch8_family_account_riders_family_fkey foreign key
    (family_account_id, organization_id)
    references public.batch8_family_accounts(id, organization_id)
    on delete cascade,
  constraint batch8_family_account_riders_relationship_fkey foreign key
    (organization_id, guardian_id, rider_id)
    references public.guardian_riders(organization_id, guardian_id, rider_id)
    on delete restrict,
  constraint batch8_family_account_riders_guardian_membership_fkey foreign key
    (organization_id, guardian_id)
    references public.organization_memberships(organization_id, user_id)
    on delete restrict,
  constraint batch8_family_account_riders_rider_membership_fkey foreign key
    (organization_id, rider_id)
    references public.organization_memberships(organization_id, user_id)
    on delete restrict,
  constraint batch8_family_account_riders_unique
    unique (organization_id, family_account_id, guardian_id, rider_id),
  constraint batch8_family_account_riders_one_family_unique
    unique (organization_id, guardian_id, rider_id),
  constraint batch8_family_account_riders_distinct_check check (
    guardian_id <> rider_id
  ),
  constraint batch8_family_account_riders_status_check check (
    status in ('active', 'review_required', 'inactive')
  )
);

create table public.batch8_membership_packages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.organizations(id) on delete restrict,
  family_account_id uuid,
  rider_id uuid not null,
  plan_id uuid,
  package_name text not null,
  currency text not null default 'USD',
  status text not null default 'draft',
  starts_on date not null,
  renewal_on date,
  ends_on date,
  freeze_limit integer not null default 0,
  freeze_count integer not null default 0,
  freeze_started_at timestamptz,
  freeze_ends_on date,
  missed_lesson_rule text not null default 'no_credit',
  waitlist_rule text not null default 'manual_offer',
  makeup_credit_rule text not null default 'staff_review',
  lock_version integer not null default 1,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint batch8_membership_packages_id_organization_unique
    unique (id, organization_id),
  constraint batch8_membership_packages_id_organization_rider_unique
    unique (id, organization_id, rider_id),
  constraint batch8_membership_packages_family_fkey foreign key
    (family_account_id, organization_id)
    references public.batch8_family_accounts(id, organization_id)
    on delete restrict,
  constraint batch8_membership_packages_rider_membership_fkey foreign key
    (organization_id, rider_id)
    references public.organization_memberships(organization_id, user_id)
    on delete restrict,
  constraint batch8_membership_packages_plan_fkey foreign key
    (plan_id, organization_id)
    references public.membership_plans(id, organization_id)
    on delete restrict,
  constraint batch8_membership_packages_name_check check (
    char_length(btrim(package_name)) between 2 and 160
  ),
  constraint batch8_membership_packages_currency_check check (
    currency ~ '^[A-Z]{3}$'
  ),
  constraint batch8_membership_packages_status_check check (
    status in (
      'draft', 'waitlisted', 'active', 'frozen', 'past_due',
      'cancelled', 'expired'
    )
  ),
  constraint batch8_membership_packages_dates_check check (
    (renewal_on is null or renewal_on >= starts_on)
    and (ends_on is null or ends_on >= starts_on)
    and (
      freeze_ends_on is null
      or freeze_started_at is not null
      and freeze_ends_on >= freeze_started_at::date
    )
  ),
  constraint batch8_membership_packages_freeze_count_check check (
    freeze_limit >= 0
    and freeze_count >= 0
    and freeze_count <= freeze_limit
  ),
  constraint batch8_membership_packages_freeze_state_check check (
    (
      status = 'frozen'
      and freeze_started_at is not null
      and freeze_ends_on is not null
    )
    or (
      status <> 'frozen'
      and freeze_started_at is null
      and freeze_ends_on is null
    )
  ),
  constraint batch8_membership_packages_missed_rule_check check (
    missed_lesson_rule in (
      'no_credit', 'staff_review', 'credit_if_academy_cancelled'
    )
  ),
  constraint batch8_membership_packages_waitlist_rule_check check (
    waitlist_rule in ('disabled', 'manual_offer', 'first_eligible')
  ),
  constraint batch8_membership_packages_makeup_rule_check check (
    makeup_credit_rule in ('disabled', 'staff_review', 'eligible_exception')
  ),
  constraint batch8_membership_packages_lock_version_check check (
    lock_version > 0
  )
);

create table public.batch8_membership_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.organizations(id) on delete restrict,
  membership_package_id uuid not null,
  rider_id uuid not null,
  event_type text not null,
  from_status text,
  to_status text,
  credit_delta integer not null default 0,
  idempotency_key text not null,
  reason text not null,
  metadata jsonb not null default '{}'::jsonb,
  actor_user_id uuid references public.profiles(id) on delete set null,
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint batch8_membership_events_membership_fkey foreign key
    (membership_package_id, organization_id, rider_id)
    references public.batch8_membership_packages(id, organization_id, rider_id)
    on delete restrict,
  constraint batch8_membership_events_rider_membership_fkey foreign key
    (organization_id, rider_id)
    references public.organization_memberships(organization_id, user_id)
    on delete restrict,
  constraint batch8_membership_events_idempotency_unique
    unique (organization_id, idempotency_key),
  constraint batch8_membership_events_type_check check (
    event_type in (
      'activated', 'renewed', 'frozen', 'unfrozen', 'marked_past_due',
      'cancelled', 'expired', 'waitlisted', 'waitlist_offered',
      'waitlist_accepted', 'waitlist_closed', 'missed_lesson_recorded',
      'attendance_exception_approved', 'attendance_exception_declined',
      'makeup_credit_issued', 'makeup_credit_consumed'
    )
  ),
  constraint batch8_membership_events_status_check check (
    (from_status is null or from_status in (
      'draft', 'waitlisted', 'active', 'frozen', 'past_due',
      'cancelled', 'expired'
    ))
    and (to_status is null or to_status in (
      'draft', 'waitlisted', 'active', 'frozen', 'past_due',
      'cancelled', 'expired'
    ))
  ),
  constraint batch8_membership_events_idempotency_check check (
    idempotency_key ~ '^[a-z0-9][a-z0-9:_-]{7,159}$'
  ),
  constraint batch8_membership_events_reason_check check (
    char_length(btrim(reason)) between 3 and 500
  ),
  constraint batch8_membership_events_metadata_check check (
    jsonb_typeof(metadata) = 'object'
  )
);

create table public.batch8_attendance_exceptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.organizations(id) on delete restrict,
  membership_package_id uuid not null,
  rider_id uuid not null,
  lesson_id uuid not null,
  exception_type text not null,
  review_status text not null default 'pending',
  credit_eligible boolean not null default false,
  idempotency_key text not null,
  reason text not null,
  occurred_at timestamptz not null,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint batch8_attendance_exceptions_membership_fkey foreign key
    (membership_package_id, organization_id, rider_id)
    references public.batch8_membership_packages(id, organization_id, rider_id)
    on delete restrict,
  constraint batch8_attendance_exceptions_lesson_fkey foreign key
    (lesson_id, organization_id)
    references public.lessons(id, organization_id)
    on delete restrict,
  constraint batch8_attendance_exceptions_idempotency_unique
    unique (organization_id, idempotency_key),
  constraint batch8_attendance_exceptions_type_check check (
    exception_type in (
      'rider_missed', 'rider_cancelled', 'academy_cancelled',
      'coach_cancelled', 'weather_cancelled'
    )
  ),
  constraint batch8_attendance_exceptions_review_check check (
    (
      review_status = 'pending'
      and reviewed_by is null
      and reviewed_at is null
      and credit_eligible = false
    )
    or (
      review_status in ('approved', 'declined')
      and reviewed_by is not null
      and reviewed_at is not null
      and (review_status <> 'declined' or credit_eligible = false)
    )
  ),
  constraint batch8_attendance_exceptions_reason_check check (
    char_length(btrim(reason)) between 3 and 500
  ),
  constraint batch8_attendance_exceptions_idempotency_check check (
    idempotency_key ~ '^[a-z0-9][a-z0-9:_-]{7,159}$'
  )
);

create table public.batch8_waitlist_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.organizations(id) on delete restrict,
  membership_package_id uuid not null,
  rider_id uuid not null,
  requested_for date not null,
  status text not null default 'queued',
  priority integer not null default 100,
  idempotency_key text not null,
  offered_at timestamptz,
  offer_expires_at timestamptz,
  closed_at timestamptz,
  reason text not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint batch8_waitlist_entries_membership_fkey foreign key
    (membership_package_id, organization_id, rider_id)
    references public.batch8_membership_packages(id, organization_id, rider_id)
    on delete restrict,
  constraint batch8_waitlist_entries_idempotency_unique
    unique (organization_id, idempotency_key),
  constraint batch8_waitlist_entries_status_check check (
    status in ('queued', 'offered', 'accepted', 'expired', 'cancelled')
  ),
  constraint batch8_waitlist_entries_priority_check check (
    priority between 1 and 10000
  ),
  constraint batch8_waitlist_entries_offer_check check (
    (
      status = 'offered'
      and offered_at is not null
      and offer_expires_at is not null
      and offer_expires_at > offered_at
      and closed_at is null
    )
    or (
      status = 'queued'
      and offered_at is null
      and offer_expires_at is null
      and closed_at is null
    )
    or (
      status in ('accepted', 'expired', 'cancelled')
      and closed_at is not null
    )
  ),
  constraint batch8_waitlist_entries_reason_check check (
    char_length(btrim(reason)) between 3 and 500
  ),
  constraint batch8_waitlist_entries_idempotency_check check (
    idempotency_key ~ '^[a-z0-9][a-z0-9:_-]{7,159}$'
  )
);

create table public.batch8_makeup_credits (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.organizations(id) on delete restrict,
  membership_package_id uuid not null,
  rider_id uuid not null,
  source_exception_id uuid not null
    references public.batch8_attendance_exceptions(id) on delete restrict,
  granted_units integer not null,
  remaining_units integer not null,
  idempotency_key text not null,
  reason text not null,
  granted_by uuid references public.profiles(id) on delete set null,
  granted_at timestamptz not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint batch8_makeup_credits_membership_fkey foreign key
    (membership_package_id, organization_id, rider_id)
    references public.batch8_membership_packages(id, organization_id, rider_id)
    on delete restrict,
  constraint batch8_makeup_credits_idempotency_unique
    unique (organization_id, idempotency_key),
  constraint batch8_makeup_credits_balance_check check (
    granted_units > 0
    and remaining_units >= 0
    and remaining_units <= granted_units
  ),
  constraint batch8_makeup_credits_expiry_check check (
    expires_at > granted_at
  ),
  constraint batch8_makeup_credits_reason_check check (
    char_length(btrim(reason)) between 3 and 500
  ),
  constraint batch8_makeup_credits_idempotency_check check (
    idempotency_key ~ '^[a-z0-9][a-z0-9:_-]{7,159}$'
  )
);

create table public.batch8_payment_link_intents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.organizations(id) on delete restrict,
  family_account_id uuid not null,
  rider_id uuid not null,
  invoice_id uuid not null,
  status text not null default 'draft',
  amount_cents integer not null,
  currency text not null,
  processor text not null default 'none',
  captured_cents integer not null default 0,
  idempotency_key text not null,
  requested_by uuid references public.profiles(id) on delete set null,
  prepared_at timestamptz,
  presented_at timestamptz,
  expires_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint batch8_payment_link_intents_family_fkey foreign key
    (family_account_id, organization_id)
    references public.batch8_family_accounts(id, organization_id)
    on delete restrict,
  constraint batch8_payment_link_intents_invoice_fkey foreign key
    (invoice_id, organization_id, rider_id)
    references public.invoices(id, organization_id, user_id)
    on delete restrict,
  constraint batch8_payment_link_intents_scoped_unique
    unique (id, organization_id, invoice_id, rider_id),
  constraint batch8_payment_link_intents_idempotency_unique
    unique (organization_id, idempotency_key),
  constraint batch8_payment_link_intents_status_check check (
    status in ('draft', 'prepared', 'presented', 'expired', 'cancelled')
  ),
  constraint batch8_payment_link_intents_amount_check check (
    amount_cents > 0 and captured_cents = 0
  ),
  constraint batch8_payment_link_intents_currency_check check (
    currency ~ '^[A-Z]{3}$'
  ),
  constraint batch8_payment_link_intents_nonprocessing_check check (
    processor = 'none'
  ),
  constraint batch8_payment_link_intents_timestamps_check check (
    (prepared_at is null or prepared_at >= created_at)
    and (presented_at is null or prepared_at is not null and presented_at >= prepared_at)
    and (expires_at is null or expires_at > coalesce(presented_at, prepared_at, created_at))
    and (cancelled_at is null or cancelled_at >= created_at)
  ),
  constraint batch8_payment_link_intents_idempotency_check check (
    idempotency_key ~ '^[a-z0-9][a-z0-9:_-]{7,159}$'
  )
);

create table public.batch8_collection_cases (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.organizations(id) on delete restrict,
  family_account_id uuid not null,
  rider_id uuid not null,
  invoice_id uuid not null,
  payment_link_intent_id uuid,
  status text not null default 'open',
  risk_level text not null default 'low',
  opened_at timestamptz not null,
  next_review_at timestamptz,
  resolved_at timestamptz,
  resolution_reason text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint batch8_collection_cases_family_fkey foreign key
    (family_account_id, organization_id)
    references public.batch8_family_accounts(id, organization_id)
    on delete restrict,
  constraint batch8_collection_cases_invoice_fkey foreign key
    (invoice_id, organization_id, rider_id)
    references public.invoices(id, organization_id, user_id)
    on delete restrict,
  constraint batch8_collection_cases_payment_link_fkey foreign key
    (payment_link_intent_id, organization_id, invoice_id, rider_id)
    references public.batch8_payment_link_intents(
      id, organization_id, invoice_id, rider_id
    )
    on delete restrict,
  constraint batch8_collection_cases_invoice_unique
    unique (organization_id, invoice_id),
  constraint batch8_collection_cases_status_check check (
    status in (
      'open', 'contact_ready', 'link_prepared', 'paused', 'resolved', 'closed'
    )
  ),
  constraint batch8_collection_cases_risk_check check (
    risk_level in ('low', 'medium', 'high')
  ),
  constraint batch8_collection_cases_resolution_check check (
    (
      status in ('resolved', 'closed')
      and resolved_at is not null
      and char_length(btrim(resolution_reason)) between 3 and 500
    )
    or (
      status not in ('resolved', 'closed')
      and resolved_at is null
      and resolution_reason is null
    )
  )
);

create table public.batch8_renewal_signals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.organizations(id) on delete restrict,
  membership_package_id uuid not null,
  rider_id uuid not null,
  renewal_on date not null,
  risk_level text not null,
  reason_code text not null,
  status text not null default 'open',
  generated_at timestamptz not null,
  acknowledged_by uuid references public.profiles(id) on delete set null,
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint batch8_renewal_signals_membership_fkey foreign key
    (membership_package_id, organization_id, rider_id)
    references public.batch8_membership_packages(id, organization_id, rider_id)
    on delete restrict,
  constraint batch8_renewal_signals_unique
    unique (organization_id, membership_package_id, renewal_on, reason_code),
  constraint batch8_renewal_signals_risk_check check (
    risk_level in ('low', 'medium', 'high')
  ),
  constraint batch8_renewal_signals_reason_check check (
    reason_code in (
      'healthy', 'low_attendance', 'missed_lessons', 'past_due',
      'credits_unused', 'freeze_active', 'waitlist_unresolved'
    )
  ),
  constraint batch8_renewal_signals_status_check check (
    status in ('open', 'acknowledged', 'resolved', 'dismissed')
  ),
  constraint batch8_renewal_signals_state_check check (
    (
      status = 'open'
      and acknowledged_by is null
      and acknowledged_at is null
      and resolved_at is null
    )
    or (
      status = 'acknowledged'
      and acknowledged_by is not null
      and acknowledged_at is not null
      and resolved_at is null
    )
    or (
      status in ('resolved', 'dismissed')
      and resolved_at is not null
    )
  )
);

create table public.batch8_revenue_daily (
  organization_id uuid not null
    references public.organizations(id) on delete cascade,
  business_date date not null,
  currency text not null,
  collected_cents bigint not null default 0,
  outstanding_cents bigint not null default 0,
  overdue_cents bigint not null default 0,
  active_memberships integer not null default 0,
  renewals_next_30_days integer not null default 0,
  high_risk_renewals integer not null default 0,
  generated_at timestamptz not null,
  generated_by uuid references public.profiles(id) on delete set null,
  constraint batch8_revenue_daily_pkey
    primary key (organization_id, business_date, currency),
  constraint batch8_revenue_daily_currency_check check (
    currency ~ '^[A-Z]{3}$'
  ),
  constraint batch8_revenue_daily_nonnegative_check check (
    collected_cents >= 0
    and outstanding_cents >= 0
    and overdue_cents >= 0
    and active_memberships >= 0
    and renewals_next_30_days >= 0
    and high_risk_renewals >= 0
  ),
  constraint batch8_revenue_daily_overdue_check check (
    overdue_cents <= outstanding_cents
  )
);

create index batch8_family_accounts_organization_idx
  on public.batch8_family_accounts(organization_id, status, created_at);
create index batch8_family_account_riders_guardian_idx
  on public.batch8_family_account_riders(
    organization_id, guardian_id, status, family_account_id
  );
create index batch8_family_account_riders_rider_idx
  on public.batch8_family_account_riders(
    organization_id, rider_id, status, family_account_id
  );
create index batch8_membership_packages_rider_idx
  on public.batch8_membership_packages(
    organization_id, rider_id, status, renewal_on
  );
create index batch8_membership_packages_family_idx
  on public.batch8_membership_packages(
    organization_id, family_account_id, status
  );
create index batch8_membership_events_membership_idx
  on public.batch8_membership_events(
    organization_id, membership_package_id, occurred_at desc
  );
create index batch8_attendance_exceptions_rider_idx
  on public.batch8_attendance_exceptions(
    organization_id, rider_id, occurred_at desc
  );
create index batch8_waitlist_entries_queue_idx
  on public.batch8_waitlist_entries(
    organization_id, status, requested_for, priority, created_at
  );
create index batch8_makeup_credits_available_idx
  on public.batch8_makeup_credits(
    organization_id, rider_id, expires_at, remaining_units
  )
  where remaining_units > 0;
create index batch8_payment_link_intents_invoice_idx
  on public.batch8_payment_link_intents(
    organization_id, invoice_id, status, created_at desc
  );
create index batch8_collection_cases_queue_idx
  on public.batch8_collection_cases(
    organization_id, status, risk_level, next_review_at
  );
create index batch8_renewal_signals_queue_idx
  on public.batch8_renewal_signals(
    organization_id, status, risk_level, renewal_on
  );

comment on table public.batch8_feature_readiness is
  'Default-off Batch 8 readiness gate. Absence of a row also means disabled.';
comment on table public.batch8_payment_link_intents is
  'Non-processing payment-link preparation only. No provider URL, token, capture, refund, or activation behavior.';
comment on table public.batch8_collection_cases is
  'Read-only collections preparation state. It does not send messages or collect payment.';
comment on table public.batch8_revenue_daily is
  'Read-only organization-scoped revenue snapshot for authorized staff dashboards.';

create function private.batch8_is_enabled(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.batch8_feature_readiness as readiness
    where readiness.organization_id = p_organization_id
      and readiness.readiness_status = 'ready'
      and readiness.enabled
  );
$$;

create function private.batch8_staff_has_role(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.is_platform_admin()
    or private.has_organization_role(
      p_organization_id, array['academy_admin', 'accountant']
    );
$$;

create function private.batch8_staff_can_read(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.batch8_is_enabled(p_organization_id)
    and private.batch8_staff_has_role(p_organization_id);
$$;

create function private.batch8_staff_can_manage(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.batch8_is_enabled(p_organization_id)
    and (
      private.is_platform_admin()
      or private.has_organization_role(
        p_organization_id, array['academy_admin']
      )
    );
$$;

create function private.batch8_guardian_can_read_rider(
  p_organization_id uuid,
  p_family_account_id uuid,
  p_rider_id uuid,
  p_financial boolean default false
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    private.batch8_is_enabled(p_organization_id)
    and exists (
      select 1
      from public.batch8_family_account_riders as family_link
      join public.batch8_family_accounts as family
        on family.id = family_link.family_account_id
       and family.organization_id = family_link.organization_id
      join public.guardian_riders as guardian_link
        on guardian_link.organization_id = family_link.organization_id
       and guardian_link.guardian_id = family_link.guardian_id
       and guardian_link.rider_id = family_link.rider_id
      where family_link.organization_id = p_organization_id
        and family_link.family_account_id = p_family_account_id
        and family_link.rider_id = p_rider_id
        and family_link.guardian_id = (select auth.uid())
        and family_link.status = 'active'
        and family.status = 'active'
        and private.can_guardian_access_rider(
          family_link.organization_id,
          family_link.guardian_id,
          family_link.rider_id
        )
        and (not p_financial or guardian_link.can_view_financials)
    );
$$;

create function private.batch8_prevent_history_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'Batch 8 history is append-only'
    using errcode = '42501';
end;
$$;

create function private.batch8_audit_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  row_after jsonb := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  row_before jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  organization uuid := coalesce(
    (row_after ->> 'organization_id')::uuid,
    (row_before ->> 'organization_id')::uuid
  );
  entity uuid := coalesce(
    (row_after ->> 'id')::uuid,
    (row_before ->> 'id')::uuid
  );
begin
  insert into public.audit_events (
    organization_id,
    source,
    actor_user_id,
    entity_type,
    entity_id,
    action,
    before_data,
    after_data,
    occurred_at
  ) values (
    organization,
    'application',
    (select auth.uid()),
    tg_table_name,
    entity,
    lower(tg_op),
    row_before,
    row_after,
    now()
  );
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create function private.batch8_validate_family_rider_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.family_account_id is not null
    and not exists (
      select 1
      from public.batch8_family_account_riders as family_link
      where family_link.organization_id = new.organization_id
        and family_link.family_account_id = new.family_account_id
        and family_link.rider_id = new.rider_id
        and family_link.status = 'active'
    )
  then
    raise exception 'Batch 8 family and rider scope do not match'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create function public.apply_batch8_membership_transition(
  p_membership_package_id uuid,
  p_to_status text,
  p_reason text,
  p_idempotency_key text,
  p_occurred_at timestamptz default now(),
  p_freeze_ends_on date default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  membership public.batch8_membership_packages;
  existing_event uuid;
  event_name text;
  event_id uuid := gen_random_uuid();
  transition_allowed boolean := false;
begin
  select package.*
  into membership
  from public.batch8_membership_packages as package
  where package.id = p_membership_package_id
  for update;

  if not found
    or not private.batch8_staff_can_manage(membership.organization_id)
  then
    raise exception 'Batch 8 membership transition is not authorized'
      using errcode = '42501';
  end if;

  if p_occurred_at is null
    or p_occurred_at > now() + interval '5 minutes'
    or p_occurred_at < membership.created_at
  then
    raise exception 'Batch 8 transition timestamp is invalid'
      using errcode = '22023';
  end if;

  if p_reason is null
    or char_length(btrim(p_reason)) not between 3 and 500
    or p_idempotency_key is null
    or p_idempotency_key !~ '^[a-z0-9][a-z0-9:_-]{7,159}$'
  then
    raise exception 'Batch 8 transition reason or idempotency key is invalid'
      using errcode = '22023';
  end if;

  select event.id
  into existing_event
  from public.batch8_membership_events as event
  where event.organization_id = membership.organization_id
    and event.membership_package_id = membership.id
    and event.idempotency_key = p_idempotency_key
    and event.to_status is not distinct from p_to_status;

  if existing_event is not null then
    return existing_event;
  end if;

  transition_allowed := case membership.status
    when 'draft' then p_to_status in ('waitlisted', 'active', 'cancelled')
    when 'waitlisted' then p_to_status in ('active', 'cancelled', 'expired')
    when 'active' then p_to_status in ('frozen', 'past_due', 'cancelled', 'expired')
    when 'frozen' then p_to_status in ('active', 'cancelled', 'expired')
    when 'past_due' then p_to_status in ('active', 'cancelled', 'expired')
    else false
  end;

  if transition_allowed is not true then
    raise exception 'Batch 8 membership transition is not allowed'
      using errcode = '22023';
  end if;

  if p_to_status = 'frozen' then
    if membership.freeze_count >= membership.freeze_limit
      or p_freeze_ends_on is null
      or p_freeze_ends_on <= p_occurred_at::date
    then
      raise exception 'Batch 8 freeze is not eligible'
        using errcode = '22023';
    end if;
    event_name := 'frozen';
  elsif membership.status = 'frozen' and p_to_status = 'active' then
    event_name := 'unfrozen';
  else
    event_name := case p_to_status
      when 'waitlisted' then 'waitlisted'
      when 'active' then 'activated'
      when 'past_due' then 'marked_past_due'
      when 'cancelled' then 'cancelled'
      when 'expired' then 'expired'
    end;
  end if;

  update public.batch8_membership_packages
  set
    status = p_to_status,
    freeze_count = case
      when p_to_status = 'frozen' then freeze_count + 1
      else freeze_count
    end,
    freeze_started_at = case
      when p_to_status = 'frozen' then p_occurred_at
      else null
    end,
    freeze_ends_on = case
      when p_to_status = 'frozen' then p_freeze_ends_on
      else null
    end,
    lock_version = lock_version + 1,
    updated_at = now()
  where id = membership.id;

  insert into public.batch8_membership_events (
    id,
    organization_id,
    membership_package_id,
    rider_id,
    event_type,
    from_status,
    to_status,
    idempotency_key,
    reason,
    actor_user_id,
    occurred_at
  ) values (
    event_id,
    membership.organization_id,
    membership.id,
    membership.rider_id,
    event_name,
    membership.status,
    p_to_status,
    p_idempotency_key,
    btrim(p_reason),
    (select auth.uid()),
    p_occurred_at
  );

  return event_id;
end;
$$;

create function public.record_batch8_membership_renewal(
  p_membership_package_id uuid,
  p_renewal_on date,
  p_reason text,
  p_idempotency_key text,
  p_occurred_at timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  membership public.batch8_membership_packages;
  existing_event uuid;
  event_id uuid := gen_random_uuid();
begin
  select package.*
  into membership
  from public.batch8_membership_packages as package
  where package.id = p_membership_package_id
  for update;

  if not found
    or not private.batch8_staff_can_manage(membership.organization_id)
  then
    raise exception 'Batch 8 renewal is not authorized'
      using errcode = '42501';
  end if;

  if p_idempotency_key is not null then
    select id into existing_event
    from public.batch8_membership_events
    where organization_id = membership.organization_id
      and membership_package_id = membership.id
      and event_type = 'renewed'
      and idempotency_key = p_idempotency_key;
    if existing_event is not null then
      return existing_event;
    end if;
  end if;

  if membership.status not in ('active', 'past_due')
    or p_renewal_on is null
    or p_renewal_on <= coalesce(membership.renewal_on, membership.starts_on)
    or p_reason is null
    or char_length(btrim(p_reason)) not between 3 and 500
    or p_idempotency_key is null
    or p_idempotency_key !~ '^[a-z0-9][a-z0-9:_-]{7,159}$'
    or p_occurred_at is null
    or p_occurred_at > now() + interval '5 minutes'
    or p_occurred_at < membership.created_at
  then
    raise exception 'Batch 8 renewal is not eligible'
      using errcode = '22023';
  end if;

  update public.batch8_membership_packages
  set
    status = 'active',
    renewal_on = p_renewal_on,
    lock_version = lock_version + 1,
    updated_at = now()
  where id = membership.id;

  insert into public.batch8_membership_events (
    id,
    organization_id,
    membership_package_id,
    rider_id,
    event_type,
    from_status,
    to_status,
    idempotency_key,
    reason,
    actor_user_id,
    occurred_at,
    metadata
  ) values (
    event_id,
    membership.organization_id,
    membership.id,
    membership.rider_id,
    'renewed',
    membership.status,
    'active',
    p_idempotency_key,
    btrim(p_reason),
    (select auth.uid()),
    p_occurred_at,
    jsonb_build_object(
      'previousRenewalOn', membership.renewal_on,
      'renewalOn', p_renewal_on
    )
  );

  return event_id;
end;
$$;

create function public.issue_batch8_makeup_credit(
  p_source_exception_id uuid,
  p_units integer,
  p_expires_at timestamptz,
  p_reason text,
  p_idempotency_key text,
  p_granted_at timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  exception_record public.batch8_attendance_exceptions;
  existing_credit uuid;
  credit_id uuid := gen_random_uuid();
begin
  select exception_row.*
  into exception_record
  from public.batch8_attendance_exceptions as exception_row
  where exception_row.id = p_source_exception_id
  for update;

  if not found
    or not private.batch8_staff_can_manage(exception_record.organization_id)
  then
    raise exception 'Batch 8 make-up credit is not authorized'
      using errcode = '42501';
  end if;

  if p_idempotency_key is not null then
    select id into existing_credit
    from public.batch8_makeup_credits
    where organization_id = exception_record.organization_id
      and source_exception_id = exception_record.id
      and idempotency_key = p_idempotency_key;
    if existing_credit is not null then
      return existing_credit;
    end if;
  end if;

  if exception_record.review_status <> 'approved'
    or not exception_record.credit_eligible
    or p_units is null
    or p_units not between 1 and 12
    or p_granted_at is null
    or exception_record.reviewed_at is null
    or p_granted_at < exception_record.reviewed_at
    or p_granted_at > now() + interval '5 minutes'
    or p_expires_at is null
    or p_expires_at <= p_granted_at
    or p_reason is null
    or char_length(btrim(p_reason)) not between 3 and 500
    or p_idempotency_key is null
    or p_idempotency_key !~ '^[a-z0-9][a-z0-9:_-]{7,159}$'
  then
    raise exception 'Batch 8 make-up credit is not eligible'
      using errcode = '22023';
  end if;

  insert into public.batch8_makeup_credits (
    id,
    organization_id,
    membership_package_id,
    rider_id,
    source_exception_id,
    granted_units,
    remaining_units,
    idempotency_key,
    reason,
    granted_by,
    granted_at,
    expires_at
  ) values (
    credit_id,
    exception_record.organization_id,
    exception_record.membership_package_id,
    exception_record.rider_id,
    exception_record.id,
    p_units,
    p_units,
    p_idempotency_key,
    btrim(p_reason),
    (select auth.uid()),
    p_granted_at,
    p_expires_at
  );

  insert into public.batch8_membership_events (
    organization_id,
    membership_package_id,
    rider_id,
    event_type,
    credit_delta,
    idempotency_key,
    reason,
    metadata,
    actor_user_id,
    occurred_at
  ) values (
    exception_record.organization_id,
    exception_record.membership_package_id,
    exception_record.rider_id,
    'makeup_credit_issued',
    p_units,
    p_idempotency_key,
    btrim(p_reason),
    jsonb_build_object(
      'creditId', credit_id,
      'sourceExceptionId', exception_record.id
    ),
    (select auth.uid()),
    p_granted_at
  );

  return credit_id;
end;
$$;

create function public.consume_batch8_makeup_credit(
  p_membership_package_id uuid,
  p_reason text,
  p_idempotency_key text,
  p_consumed_at timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  membership public.batch8_membership_packages;
  credit public.batch8_makeup_credits;
  existing_event uuid;
  event_id uuid := gen_random_uuid();
begin
  select package.*
  into membership
  from public.batch8_membership_packages as package
  where package.id = p_membership_package_id
  for update;

  if not found
    or not private.batch8_staff_can_manage(membership.organization_id)
  then
    raise exception 'Batch 8 make-up credit consumption is not authorized'
      using errcode = '42501';
  end if;

  if p_idempotency_key is not null then
    select id into existing_event
    from public.batch8_membership_events
    where organization_id = membership.organization_id
      and membership_package_id = membership.id
      and event_type = 'makeup_credit_consumed'
      and idempotency_key = p_idempotency_key;
    if existing_event is not null then
      return existing_event;
    end if;
  end if;

  if membership.status not in ('active', 'frozen')
    or p_reason is null
    or char_length(btrim(p_reason)) not between 3 and 500
    or p_idempotency_key is null
    or p_idempotency_key !~ '^[a-z0-9][a-z0-9:_-]{7,159}$'
    or p_consumed_at is null
    or p_consumed_at > now() + interval '5 minutes'
  then
    raise exception 'Batch 8 make-up credit consumption is not authorized'
      using errcode = '42501';
  end if;

  select credit_row.*
  into credit
  from public.batch8_makeup_credits as credit_row
  where credit_row.organization_id = membership.organization_id
    and credit_row.membership_package_id = membership.id
    and credit_row.rider_id = membership.rider_id
    and credit_row.remaining_units > 0
    and credit_row.granted_at <= p_consumed_at
    and credit_row.expires_at > p_consumed_at
    and credit_row.expires_at > now()
  order by credit_row.expires_at, credit_row.granted_at, credit_row.id
  limit 1
  for update;

  if not found then
    raise exception 'No eligible Batch 8 make-up credit is available'
      using errcode = '22023';
  end if;

  update public.batch8_makeup_credits
  set remaining_units = remaining_units - 1, updated_at = now()
  where id = credit.id;

  insert into public.batch8_membership_events (
    id,
    organization_id,
    membership_package_id,
    rider_id,
    event_type,
    credit_delta,
    idempotency_key,
    reason,
    metadata,
    actor_user_id,
    occurred_at
  ) values (
    event_id,
    membership.organization_id,
    membership.id,
    membership.rider_id,
    'makeup_credit_consumed',
    -1,
    p_idempotency_key,
    btrim(p_reason),
    jsonb_build_object('creditId', credit.id),
    (select auth.uid()),
    p_consumed_at
  );

  return event_id;
end;
$$;

create function public.record_batch8_attendance_exception(
  p_membership_package_id uuid,
  p_lesson_id uuid,
  p_exception_type text,
  p_reason text,
  p_idempotency_key text,
  p_occurred_at timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  membership public.batch8_membership_packages;
  existing_exception uuid;
  exception_id uuid := gen_random_uuid();
begin
  select package.*
  into membership
  from public.batch8_membership_packages as package
  where package.id = p_membership_package_id
  for update;

  if not found
    or not private.batch8_staff_can_manage(membership.organization_id)
  then
    raise exception 'Batch 8 attendance exception is not authorized'
      using errcode = '42501';
  end if;

  if p_idempotency_key is not null then
    select id into existing_exception
    from public.batch8_attendance_exceptions
    where organization_id = membership.organization_id
      and membership_package_id = membership.id
      and idempotency_key = p_idempotency_key;
    if existing_exception is not null then
      return existing_exception;
    end if;
  end if;

  if membership.status not in ('active', 'frozen', 'past_due')
    or p_lesson_id is null
    or p_exception_type is null
    or p_exception_type not in (
      'rider_missed', 'rider_cancelled', 'academy_cancelled',
      'coach_cancelled', 'weather_cancelled'
    )
    or p_reason is null
    or char_length(btrim(p_reason)) not between 3 and 500
    or p_idempotency_key is null
    or p_idempotency_key !~ '^[a-z0-9][a-z0-9:_-]{7,159}$'
    or p_occurred_at is null
    or p_occurred_at > now() + interval '5 minutes'
    or p_occurred_at < membership.created_at
    or not exists (
      select 1
      from public.lessons as lesson
      where lesson.id = p_lesson_id
        and lesson.organization_id = membership.organization_id
        and lesson.rider_id = membership.rider_id
    )
  then
    raise exception 'Batch 8 attendance exception is invalid'
      using errcode = '22023';
  end if;

  insert into public.batch8_attendance_exceptions (
    id,
    organization_id,
    membership_package_id,
    rider_id,
    lesson_id,
    exception_type,
    review_status,
    credit_eligible,
    idempotency_key,
    reason,
    occurred_at
  ) values (
    exception_id,
    membership.organization_id,
    membership.id,
    membership.rider_id,
    p_lesson_id,
    p_exception_type,
    'pending',
    false,
    p_idempotency_key,
    btrim(p_reason),
    p_occurred_at
  );

  insert into public.batch8_membership_events (
    organization_id,
    membership_package_id,
    rider_id,
    event_type,
    idempotency_key,
    reason,
    metadata,
    actor_user_id,
    occurred_at
  ) values (
    membership.organization_id,
    membership.id,
    membership.rider_id,
    'missed_lesson_recorded',
    p_idempotency_key,
    btrim(p_reason),
    jsonb_build_object(
      'attendanceExceptionId', exception_id,
      'exceptionType', p_exception_type,
      'lessonId', p_lesson_id
    ),
    (select auth.uid()),
    p_occurred_at
  );

  return exception_id;
end;
$$;

create function public.review_batch8_attendance_exception(
  p_attendance_exception_id uuid,
  p_decision text,
  p_credit_eligible boolean,
  p_reason text,
  p_idempotency_key text,
  p_reviewed_at timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  exception_record public.batch8_attendance_exceptions;
  membership public.batch8_membership_packages;
  existing_event uuid;
  event_id uuid := gen_random_uuid();
  credit_allowed boolean := false;
begin
  select exception_row.*
  into exception_record
  from public.batch8_attendance_exceptions as exception_row
  where exception_row.id = p_attendance_exception_id
  for update;

  if not found
    or not private.batch8_staff_can_manage(exception_record.organization_id)
  then
    raise exception 'Batch 8 attendance review is not authorized'
      using errcode = '42501';
  end if;

  select package.*
  into membership
  from public.batch8_membership_packages as package
  where package.id = exception_record.membership_package_id
    and package.organization_id = exception_record.organization_id;

  if p_idempotency_key is not null then
    select event.id into existing_event
    from public.batch8_membership_events as event
    where event.organization_id = exception_record.organization_id
      and event.membership_package_id = exception_record.membership_package_id
      and event.idempotency_key = p_idempotency_key
      and event.metadata ->> 'attendanceExceptionId'
        = exception_record.id::text;
    if existing_event is not null then
      return existing_event;
    end if;
  end if;

  credit_allowed :=
    membership.makeup_credit_rule <> 'disabled'
    and (
      membership.missed_lesson_rule = 'staff_review'
      or (
        membership.missed_lesson_rule = 'credit_if_academy_cancelled'
        and exception_record.exception_type in (
          'academy_cancelled', 'coach_cancelled', 'weather_cancelled'
        )
      )
    );

  if exception_record.review_status <> 'pending'
    or p_decision is null
    or p_decision not in ('approved', 'declined')
    or p_credit_eligible is null
    or (p_decision = 'declined' and p_credit_eligible)
    or (p_credit_eligible and not credit_allowed)
    or p_reason is null
    or char_length(btrim(p_reason)) not between 3 and 500
    or p_idempotency_key is null
    or p_idempotency_key !~ '^[a-z0-9][a-z0-9:_-]{7,159}$'
    or p_reviewed_at is null
    or p_reviewed_at < exception_record.occurred_at
    or p_reviewed_at > now() + interval '5 minutes'
  then
    raise exception 'Batch 8 attendance review transition is invalid'
      using errcode = '22023';
  end if;

  update public.batch8_attendance_exceptions
  set
    review_status = p_decision,
    credit_eligible = p_credit_eligible,
    reviewed_by = (select auth.uid()),
    reviewed_at = p_reviewed_at
  where id = exception_record.id;

  insert into public.batch8_membership_events (
    id,
    organization_id,
    membership_package_id,
    rider_id,
    event_type,
    idempotency_key,
    reason,
    metadata,
    actor_user_id,
    occurred_at
  ) values (
    event_id,
    exception_record.organization_id,
    exception_record.membership_package_id,
    exception_record.rider_id,
    case p_decision
      when 'approved' then 'attendance_exception_approved'
      else 'attendance_exception_declined'
    end,
    p_idempotency_key,
    btrim(p_reason),
    jsonb_build_object(
      'attendanceExceptionId', exception_record.id,
      'creditEligible', p_credit_eligible
    ),
    (select auth.uid()),
    p_reviewed_at
  );

  return event_id;
end;
$$;

create function public.create_batch8_waitlist_entry(
  p_membership_package_id uuid,
  p_requested_for date,
  p_priority integer,
  p_reason text,
  p_idempotency_key text,
  p_created_at timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  membership public.batch8_membership_packages;
  existing_entry uuid;
  entry_id uuid := gen_random_uuid();
begin
  select package.*
  into membership
  from public.batch8_membership_packages as package
  where package.id = p_membership_package_id
  for update;

  if not found
    or not private.batch8_staff_can_manage(membership.organization_id)
  then
    raise exception 'Batch 8 waitlist entry is not authorized'
      using errcode = '42501';
  end if;

  if p_idempotency_key is not null then
    select id into existing_entry
    from public.batch8_waitlist_entries
    where organization_id = membership.organization_id
      and membership_package_id = membership.id
      and idempotency_key = p_idempotency_key;
    if existing_entry is not null then
      return existing_entry;
    end if;
  end if;

  if membership.status not in ('active', 'frozen')
    or membership.waitlist_rule = 'disabled'
    or p_created_at is null
    or p_created_at > now() + interval '5 minutes'
    or p_requested_for is null
    or p_requested_for < p_created_at::date
    or p_priority is null
    or p_priority not between 1 and 10000
    or p_reason is null
    or char_length(btrim(p_reason)) not between 3 and 500
    or p_idempotency_key is null
    or p_idempotency_key !~ '^[a-z0-9][a-z0-9:_-]{7,159}$'
  then
    raise exception 'Batch 8 waitlist entry is invalid'
      using errcode = '22023';
  end if;

  insert into public.batch8_waitlist_entries (
    id,
    organization_id,
    membership_package_id,
    rider_id,
    requested_for,
    status,
    priority,
    idempotency_key,
    reason,
    created_by,
    created_at,
    updated_at
  ) values (
    entry_id,
    membership.organization_id,
    membership.id,
    membership.rider_id,
    p_requested_for,
    'queued',
    p_priority,
    p_idempotency_key,
    btrim(p_reason),
    (select auth.uid()),
    p_created_at,
    p_created_at
  );

  insert into public.batch8_membership_events (
    organization_id,
    membership_package_id,
    rider_id,
    event_type,
    idempotency_key,
    reason,
    metadata,
    actor_user_id,
    occurred_at
  ) values (
    membership.organization_id,
    membership.id,
    membership.rider_id,
    'waitlisted',
    p_idempotency_key,
    btrim(p_reason),
    jsonb_build_object(
      'waitlistEntryId', entry_id,
      'requestedFor', p_requested_for
    ),
    (select auth.uid()),
    p_created_at
  );

  return entry_id;
end;
$$;

create function public.apply_batch8_waitlist_transition(
  p_waitlist_entry_id uuid,
  p_to_status text,
  p_reason text,
  p_idempotency_key text,
  p_occurred_at timestamptz default now(),
  p_offer_expires_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  entry public.batch8_waitlist_entries;
  membership public.batch8_membership_packages;
  existing_event uuid;
  event_id uuid := gen_random_uuid();
  event_name text;
  transition_allowed boolean := false;
begin
  select waitlist.*
  into entry
  from public.batch8_waitlist_entries as waitlist
  where waitlist.id = p_waitlist_entry_id
  for update;

  if not found
    or not private.batch8_staff_can_manage(entry.organization_id)
  then
    raise exception 'Batch 8 waitlist transition is not authorized'
      using errcode = '42501';
  end if;

  select package.*
  into membership
  from public.batch8_membership_packages as package
  where package.id = entry.membership_package_id
    and package.organization_id = entry.organization_id;

  if p_idempotency_key is not null then
    select event.id into existing_event
    from public.batch8_membership_events as event
    where event.organization_id = entry.organization_id
      and event.membership_package_id = entry.membership_package_id
      and event.idempotency_key = p_idempotency_key
      and event.metadata ->> 'waitlistEntryId' = entry.id::text;
    if existing_event is not null then
      return existing_event;
    end if;
  end if;

  transition_allowed := case entry.status
    when 'queued' then p_to_status in ('offered', 'cancelled')
    when 'offered' then p_to_status in ('accepted', 'expired', 'cancelled')
    else false
  end;

  if transition_allowed is not true
    or membership.status not in ('active', 'frozen')
    or p_reason is null
    or char_length(btrim(p_reason)) not between 3 and 500
    or p_idempotency_key is null
    or p_idempotency_key !~ '^[a-z0-9][a-z0-9:_-]{7,159}$'
    or p_occurred_at is null
    or p_occurred_at < entry.created_at
    or p_occurred_at > now() + interval '5 minutes'
    or (
      p_to_status = 'offered'
      and (
        p_offer_expires_at is null
        or p_offer_expires_at <= p_occurred_at
      )
    )
    or (
      p_to_status = 'accepted'
      and (
        entry.offer_expires_at is null
        or p_occurred_at > entry.offer_expires_at
      )
    )
    or (
      p_to_status = 'expired'
      and (
        entry.offer_expires_at is null
        or p_occurred_at < entry.offer_expires_at
      )
    )
  then
    raise exception 'Batch 8 waitlist transition is invalid'
      using errcode = '22023';
  end if;

  event_name := case p_to_status
    when 'offered' then 'waitlist_offered'
    when 'accepted' then 'waitlist_accepted'
    else 'waitlist_closed'
  end;

  update public.batch8_waitlist_entries
  set
    status = p_to_status,
    offered_at = case
      when p_to_status = 'offered' then p_occurred_at
      else offered_at
    end,
    offer_expires_at = case
      when p_to_status = 'offered' then p_offer_expires_at
      else offer_expires_at
    end,
    closed_at = case
      when p_to_status in ('accepted', 'expired', 'cancelled')
        then p_occurred_at
      else null
    end,
    updated_at = now()
  where id = entry.id;

  insert into public.batch8_membership_events (
    id,
    organization_id,
    membership_package_id,
    rider_id,
    event_type,
    idempotency_key,
    reason,
    metadata,
    actor_user_id,
    occurred_at
  ) values (
    event_id,
    entry.organization_id,
    entry.membership_package_id,
    entry.rider_id,
    event_name,
    p_idempotency_key,
    btrim(p_reason),
    jsonb_build_object(
      'waitlistEntryId', entry.id,
      'fromWaitlistStatus', entry.status,
      'toWaitlistStatus', p_to_status
    ),
    (select auth.uid()),
    p_occurred_at
  );

  return event_id;
end;
$$;

create function public.get_batch8_availability(
  p_organization_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
begin
  if actor is null
    or not (
      private.is_platform_admin()
      or exists (
        select 1
        from public.organization_memberships as membership
        where membership.organization_id = p_organization_id
          and membership.user_id = actor
          and membership.status = 'active'
      )
    )
  then
    raise exception 'Batch 8 availability is not authorized'
      using errcode = '42501';
  end if;

  return private.batch8_is_enabled(p_organization_id);
end;
$$;

create function public.get_batch8_family_operations(
  p_organization_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  result jsonb;
begin
  if actor is null
    or not private.batch8_is_enabled(p_organization_id)
    or not private.has_organization_role(
      p_organization_id, array['guardian']
    )
  then
    raise exception 'Batch 8 family operations are unavailable'
      using errcode = '42501';
  end if;

  with authorized as (
    select distinct
      family_link.rider_id,
      guardian_link.relationship_type,
      guardian_link.verification_status,
      guardian_link.can_view_financials
    from public.batch8_family_account_riders as family_link
    join public.batch8_family_accounts as family
      on family.id = family_link.family_account_id
     and family.organization_id = family_link.organization_id
    join public.guardian_riders as guardian_link
      on guardian_link.organization_id = family_link.organization_id
     and guardian_link.guardian_id = family_link.guardian_id
     and guardian_link.rider_id = family_link.rider_id
    where family_link.organization_id = p_organization_id
      and family_link.guardian_id = actor
      and family_link.status = 'active'
      and family.status = 'active'
      and private.can_guardian_access_rider(
        family_link.organization_id,
        family_link.guardian_id,
        family_link.rider_id
      )
  ),
  rider_rows as (
    select
      authorized.rider_id,
      profile.full_name,
      authorized.relationship_type,
      authorized.verification_status,
      authorized.can_view_financials,
      package.status as membership_status,
      package.package_name,
      package.renewal_on,
      coalesce(credits.remaining_units, 0)::integer as credits_remaining,
      coalesce(waitlist.waitlist_count, 0)::integer as waitlist_count,
      coalesce(financials.balances, '[]'::jsonb) as financials
    from authorized
    join public.profiles as profile on profile.id = authorized.rider_id
    left join lateral (
      select package_row.*
      from public.batch8_membership_packages as package_row
      where package_row.organization_id = p_organization_id
        and package_row.rider_id = authorized.rider_id
        and exists (
          select 1
          from public.batch8_family_account_riders as package_link
          where package_link.organization_id = package_row.organization_id
            and package_link.family_account_id = package_row.family_account_id
            and package_link.rider_id = package_row.rider_id
            and package_link.guardian_id = actor
            and package_link.status = 'active'
        )
      order by package_row.updated_at desc, package_row.id
      limit 1
    ) as package on true
    left join lateral (
      select coalesce(sum(credit.remaining_units), 0) as remaining_units
      from public.batch8_makeup_credits as credit
      where credit.organization_id = p_organization_id
        and credit.rider_id = authorized.rider_id
        and credit.remaining_units > 0
        and credit.expires_at > now()
    ) as credits on true
    left join lateral (
      select count(*) as waitlist_count
      from public.batch8_waitlist_entries as entry
      where entry.organization_id = p_organization_id
        and entry.rider_id = authorized.rider_id
        and entry.status in ('queued', 'offered')
    ) as waitlist on true
    left join lateral (
      select jsonb_agg(
        jsonb_build_object(
          'currency', balance.currency,
          'outstandingBalance', balance.outstanding_cents,
          'overdueAmount', balance.overdue_cents,
          'nextPaymentDate', balance.next_due_date,
          'paymentLinkStatus',
          coalesce(
            (
              select intent.status
              from public.batch8_payment_link_intents as intent
              where intent.organization_id = p_organization_id
                and intent.rider_id = authorized.rider_id
                and intent.currency = balance.currency
              order by intent.created_at desc, intent.id
              limit 1
            ),
            'none'
          )
        )
        order by balance.currency
      ) as balances
      from (
        select
          invoice.currency,
          sum(invoice.total_cents) as outstanding_cents,
          coalesce(
            sum(invoice.total_cents) filter (
              where invoice.status = 'overdue'
            ),
            0
          ) as overdue_cents,
          min(invoice.due_date) as next_due_date
        from public.invoices as invoice
        where authorized.can_view_financials
          and invoice.organization_id = p_organization_id
          and invoice.user_id = authorized.rider_id
          and invoice.status in ('open', 'overdue')
        group by invoice.currency
      ) as balance
    ) as financials on true
  ),
  family_balances as (
    select
      invoice.currency,
      sum(invoice.total_cents) as outstanding_cents,
      coalesce(
        sum(invoice.total_cents) filter (
          where invoice.status = 'overdue'
        ),
        0
      ) as overdue_cents,
      min(invoice.due_date) as next_due_date
    from authorized
    join public.invoices as invoice
      on invoice.organization_id = p_organization_id
     and invoice.user_id = authorized.rider_id
    where authorized.can_view_financials
      and invoice.status in ('open', 'overdue')
    group by invoice.currency
  )
  select jsonb_build_object(
    'riders',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', rider_rows.rider_id,
            'name', coalesce(rider_rows.full_name, 'Rider'),
            'relationship', rider_rows.relationship_type,
            'relationshipStatus', rider_rows.verification_status,
            'membershipStatus', coalesce(rider_rows.membership_status, 'none'),
            'packageName', coalesce(rider_rows.package_name, ''),
            'renewalDate', rider_rows.renewal_on,
            'creditsRemaining', rider_rows.credits_remaining,
            'waitlistCount', rider_rows.waitlist_count,
            'financialAccess', rider_rows.can_view_financials,
            'financials', rider_rows.financials
          )
          order by rider_rows.full_name, rider_rows.rider_id
        )
        from rider_rows
      ),
      '[]'::jsonb
    ),
    'familySummary',
    jsonb_build_object(
      'balances',
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'currency', family_balances.currency,
              'outstandingBalance', family_balances.outstanding_cents,
              'overdueAmount', family_balances.overdue_cents,
              'nextPaymentDate', family_balances.next_due_date
            )
            order by family_balances.currency
          )
          from family_balances
        ),
        '[]'::jsonb
      )
    )
  )
  into result;

  return result;
end;
$$;

create function public.get_batch8_revenue_operations(
  p_organization_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  snapshot_date date;
  summaries jsonb;
  renewals jsonb;
  collections jsonb;
begin
  if not private.batch8_staff_can_read(p_organization_id) then
    raise exception 'Batch 8 revenue operations are unavailable'
      using errcode = '42501';
  end if;

  select max(daily.business_date)
  into snapshot_date
  from public.batch8_revenue_daily as daily
  where daily.organization_id = p_organization_id
  ;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'currency', daily.currency,
        'collectedThisPeriod', daily.collected_cents,
        'outstanding', daily.outstanding_cents,
        'overdue', daily.overdue_cents,
        'activeMemberships', daily.active_memberships,
        'renewalsNext30Days', daily.renewals_next_30_days,
        'highRiskRenewals', daily.high_risk_renewals
      )
      order by daily.currency
    ),
    '[]'::jsonb
  )
  into summaries
  from public.batch8_revenue_daily as daily
  where daily.organization_id = p_organization_id
    and daily.business_date = snapshot_date;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'riderName', coalesce(profile.full_name, 'Rider'),
        'packageName', package.package_name,
        'renewalDate', signal.renewal_on,
        'riskLevel', signal.risk_level,
        'reason', signal.reason_code
      )
      order by signal.risk_level desc, signal.renewal_on, signal.id
    ),
    '[]'::jsonb
  )
  into renewals
  from public.batch8_renewal_signals as signal
  join public.batch8_membership_packages as package
    on package.id = signal.membership_package_id
   and package.organization_id = signal.organization_id
  join public.profiles as profile on profile.id = signal.rider_id
  where signal.organization_id = p_organization_id
    and signal.status in ('open', 'acknowledged');

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'invoiceNumber', invoice.number,
        'riderName', coalesce(profile.full_name, 'Rider'),
        'amount', invoice.total_cents,
        'currency', invoice.currency,
        'daysOverdue', greatest(
          0,
          current_date - coalesce(invoice.due_date, invoice.issue_date)
        ),
        'status', collection.status,
        'paymentLinkStatus', coalesce(intent.status, 'none')
      )
      order by collection.risk_level desc, invoice.due_date, collection.id
    ),
    '[]'::jsonb
  )
  into collections
  from public.batch8_collection_cases as collection
  join public.invoices as invoice
    on invoice.id = collection.invoice_id
   and invoice.organization_id = collection.organization_id
  join public.profiles as profile on profile.id = collection.rider_id
  left join public.batch8_payment_link_intents as intent
    on intent.id = collection.payment_link_intent_id
  where collection.organization_id = p_organization_id
    and collection.status not in ('resolved', 'closed');

  return jsonb_build_object(
    'summaries', summaries,
    'renewals', renewals,
    'collections', collections
  );
end;
$$;

create trigger batch8_membership_events_append_only
before update or delete on public.batch8_membership_events
for each row execute function private.batch8_prevent_history_mutation();

create trigger batch8_attendance_exceptions_append_only
before delete on public.batch8_attendance_exceptions
for each row execute function private.batch8_prevent_history_mutation();

create trigger batch8_revenue_daily_append_only
before update or delete on public.batch8_revenue_daily
for each row execute function private.batch8_prevent_history_mutation();

create trigger batch8_membership_packages_family_scope
before insert or update on public.batch8_membership_packages
for each row execute function private.batch8_validate_family_rider_scope();
create trigger batch8_payment_link_intents_family_scope
before insert or update on public.batch8_payment_link_intents
for each row execute function private.batch8_validate_family_rider_scope();
create trigger batch8_collection_cases_family_scope
before insert or update on public.batch8_collection_cases
for each row execute function private.batch8_validate_family_rider_scope();

create trigger batch8_family_accounts_audit
after insert or update on public.batch8_family_accounts
for each row execute function private.batch8_audit_change();
create trigger batch8_family_account_riders_audit
after insert or update on public.batch8_family_account_riders
for each row execute function private.batch8_audit_change();
create trigger batch8_membership_packages_audit
after insert or update on public.batch8_membership_packages
for each row execute function private.batch8_audit_change();
create trigger batch8_attendance_exceptions_audit
after insert or update on public.batch8_attendance_exceptions
for each row execute function private.batch8_audit_change();
create trigger batch8_waitlist_entries_audit
after insert or update on public.batch8_waitlist_entries
for each row execute function private.batch8_audit_change();
create trigger batch8_makeup_credits_audit
after insert or update on public.batch8_makeup_credits
for each row execute function private.batch8_audit_change();
create trigger batch8_payment_link_intents_audit
after insert or update on public.batch8_payment_link_intents
for each row execute function private.batch8_audit_change();
create trigger batch8_collection_cases_audit
after insert or update on public.batch8_collection_cases
for each row execute function private.batch8_audit_change();
create trigger batch8_renewal_signals_audit
after insert or update on public.batch8_renewal_signals
for each row execute function private.batch8_audit_change();

alter table public.batch8_feature_readiness enable row level security;
alter table public.batch8_family_accounts enable row level security;
alter table public.batch8_family_account_riders enable row level security;
alter table public.batch8_membership_packages enable row level security;
alter table public.batch8_membership_events enable row level security;
alter table public.batch8_attendance_exceptions enable row level security;
alter table public.batch8_waitlist_entries enable row level security;
alter table public.batch8_makeup_credits enable row level security;
alter table public.batch8_payment_link_intents enable row level security;
alter table public.batch8_collection_cases enable row level security;
alter table public.batch8_renewal_signals enable row level security;
alter table public.batch8_revenue_daily enable row level security;

create policy batch8_feature_readiness_staff_select
on public.batch8_feature_readiness
for select to authenticated
using (private.batch8_staff_has_role(organization_id));

create policy batch8_family_accounts_authorized_select
on public.batch8_family_accounts
for select to authenticated
using (
  private.batch8_staff_can_read(organization_id)
  or exists (
    select 1
    from public.batch8_family_account_riders as family_link
    where family_link.organization_id = batch8_family_accounts.organization_id
      and family_link.family_account_id = batch8_family_accounts.id
      and private.batch8_guardian_can_read_rider(
        family_link.organization_id,
        family_link.family_account_id,
        family_link.rider_id,
        false
      )
  )
);

create policy batch8_family_account_riders_authorized_select
on public.batch8_family_account_riders
for select to authenticated
using (
  private.batch8_staff_can_read(organization_id)
  or private.batch8_guardian_can_read_rider(
    organization_id, family_account_id, rider_id, false
  )
);

create policy batch8_membership_packages_authorized_select
on public.batch8_membership_packages
for select to authenticated
using (
  private.batch8_staff_can_read(organization_id)
  or exists (
    select 1
    from public.batch8_family_account_riders as family_link
    where family_link.organization_id = batch8_membership_packages.organization_id
      and family_link.family_account_id = batch8_membership_packages.family_account_id
      and family_link.rider_id = batch8_membership_packages.rider_id
      and private.batch8_guardian_can_read_rider(
        family_link.organization_id,
        family_link.family_account_id,
        family_link.rider_id,
        false
      )
  )
);

create policy batch8_membership_events_staff_select
on public.batch8_membership_events
for select to authenticated
using (private.batch8_staff_can_read(organization_id));

create policy batch8_attendance_exceptions_staff_select
on public.batch8_attendance_exceptions
for select to authenticated
using (private.batch8_staff_can_read(organization_id));

create policy batch8_waitlist_entries_staff_select
on public.batch8_waitlist_entries
for select to authenticated
using (private.batch8_staff_can_read(organization_id));

create policy batch8_makeup_credits_staff_select
on public.batch8_makeup_credits
for select to authenticated
using (private.batch8_staff_can_read(organization_id));

create policy batch8_payment_link_intents_staff_select
on public.batch8_payment_link_intents
for select to authenticated
using (private.batch8_staff_can_read(organization_id));

create policy batch8_collection_cases_staff_select
on public.batch8_collection_cases
for select to authenticated
using (private.batch8_staff_can_read(organization_id));

create policy batch8_renewal_signals_staff_select
on public.batch8_renewal_signals
for select to authenticated
using (private.batch8_staff_can_read(organization_id));

create policy batch8_revenue_daily_staff_select
on public.batch8_revenue_daily
for select to authenticated
using (private.batch8_staff_can_read(organization_id));

revoke all on function private.batch8_is_enabled(uuid) from public;
revoke all on function private.batch8_staff_has_role(uuid) from public;
revoke all on function private.batch8_staff_can_read(uuid) from public;
revoke all on function private.batch8_staff_can_manage(uuid) from public;
revoke all on function private.batch8_guardian_can_read_rider(
  uuid, uuid, uuid, boolean
) from public;
revoke all on function private.batch8_prevent_history_mutation() from public;
revoke all on function private.batch8_audit_change() from public;
revoke all on function private.batch8_validate_family_rider_scope()
  from public;

grant execute on function private.batch8_is_enabled(uuid) to authenticated;
grant execute on function private.batch8_staff_has_role(uuid) to authenticated;
grant execute on function private.batch8_staff_can_read(uuid) to authenticated;
grant execute on function private.batch8_guardian_can_read_rider(
  uuid, uuid, uuid, boolean
) to authenticated;

revoke all on function public.apply_batch8_membership_transition(
  uuid, text, text, text, timestamptz, date
) from public;
revoke all on function public.record_batch8_membership_renewal(
  uuid, date, text, text, timestamptz
) from public;
revoke all on function public.issue_batch8_makeup_credit(
  uuid, integer, timestamptz, text, text, timestamptz
) from public;
revoke all on function public.consume_batch8_makeup_credit(
  uuid, text, text, timestamptz
) from public;
revoke all on function public.record_batch8_attendance_exception(
  uuid, uuid, text, text, text, timestamptz
) from public;
revoke all on function public.review_batch8_attendance_exception(
  uuid, text, boolean, text, text, timestamptz
) from public;
revoke all on function public.create_batch8_waitlist_entry(
  uuid, date, integer, text, text, timestamptz
) from public;
revoke all on function public.apply_batch8_waitlist_transition(
  uuid, text, text, text, timestamptz, timestamptz
) from public;
revoke all on function public.get_batch8_availability(uuid) from public;
revoke all on function public.get_batch8_family_operations(uuid) from public;
revoke all on function public.get_batch8_revenue_operations(uuid) from public;

grant execute on function public.apply_batch8_membership_transition(
  uuid, text, text, text, timestamptz, date
) to authenticated;
grant execute on function public.record_batch8_membership_renewal(
  uuid, date, text, text, timestamptz
) to authenticated;
grant execute on function public.issue_batch8_makeup_credit(
  uuid, integer, timestamptz, text, text, timestamptz
) to authenticated;
grant execute on function public.consume_batch8_makeup_credit(
  uuid, text, text, timestamptz
) to authenticated;
grant execute on function public.record_batch8_attendance_exception(
  uuid, uuid, text, text, text, timestamptz
) to authenticated;
grant execute on function public.review_batch8_attendance_exception(
  uuid, text, boolean, text, text, timestamptz
) to authenticated;
grant execute on function public.create_batch8_waitlist_entry(
  uuid, date, integer, text, text, timestamptz
) to authenticated;
grant execute on function public.apply_batch8_waitlist_transition(
  uuid, text, text, text, timestamptz, timestamptz
) to authenticated;
grant execute on function public.get_batch8_availability(uuid)
  to authenticated;
grant execute on function public.get_batch8_family_operations(uuid)
  to authenticated;
grant execute on function public.get_batch8_revenue_operations(uuid)
  to authenticated;

commit;