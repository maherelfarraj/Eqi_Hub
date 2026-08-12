-- EquiVista Phase 0C.2A canonical live-schema baseline
-- Source: read-only pg_catalog extraction from Supabase project gtogwivozgrmjnrtungm
-- Scope: application schema only; no production rows, auth identities, object data, or secrets
-- Baseline version intentionally reuses the latest recorded live migration: 20260812101436

set check_function_bodies = false;
set client_min_messages = warning;

create schema if not exists private;
alter schema private owner to postgres;
alter schema public owner to postgres;

create extension if not exists btree_gist with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_stat_statements with schema extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists supabase_vault with schema vault;
create extension if not exists "uuid-ossp" with schema extensions;

-- Application sequences

create sequence public.invoice_number_seq as bigint increment by 1 minvalue 1 maxvalue 9223372036854775807 start with 1001 cache 1 no cycle;

-- Application tables

create table public.audit_events (
  id uuid default gen_random_uuid() not null,
  organization_id uuid,
  request_id uuid,
  source text not null,
  actor_user_id uuid,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  before_data jsonb,
  after_data jsonb,
  occurred_at timestamp with time zone default now() not null,
  created_at timestamp with time zone default now() not null
);

create table public.coach_rider_assignments (
  organization_id uuid not null,
  coach_id uuid not null,
  rider_id uuid not null,
  active boolean default true not null,
  starts_on date default CURRENT_DATE not null,
  ends_on date,
  created_by uuid,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.documents (
  id uuid default gen_random_uuid() not null,
  horse_id uuid,
  user_id uuid,
  name text not null,
  url text not null,
  created_at timestamp with time zone default now() not null
);

create table public.guardian_riders (
  organization_id uuid not null,
  guardian_id uuid not null,
  rider_id uuid not null,
  active boolean default true not null,
  created_by uuid,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.health_records (
  id uuid default gen_random_uuid() not null,
  horse_id uuid not null,
  rec_date date default CURRENT_DATE not null,
  rec_type text not null,
  summary text,
  created_at timestamp with time zone default now() not null
);

create table public.horse_access_assignments (
  organization_id uuid not null,
  horse_id uuid not null,
  profile_id uuid not null,
  access_type text not null,
  active boolean default true not null,
  created_by uuid,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.horse_riders (
  horse_id uuid not null,
  rider_id uuid not null
);

create table public.horses (
  id uuid default gen_random_uuid() not null,
  owner_id uuid not null,
  name text not null,
  breed text,
  birth_year integer,
  color text,
  height_cm integer,
  photo_url text,
  status text default 'active'::text not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  organization_id uuid
);

create table public.invoice_lines (
  id uuid default gen_random_uuid() not null,
  invoice_id uuid not null,
  label text not null,
  qty numeric default 1 not null,
  unit_price_cents integer default 0 not null,
  total_cents integer default 0 not null
);

create table public.invoices (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  number text default 'INV-'::text || nextval('invoice_number_seq'::regclass) not null,
  issue_date date default CURRENT_DATE not null,
  due_date date,
  description text,
  status text default 'open'::text not null,
  currency text default 'USD'::text not null,
  subtotal_cents integer default 0 not null,
  tax_cents integer default 0 not null,
  total_cents integer default 0 not null,
  pdf_url text,
  membership_id uuid,
  payment_method_id uuid,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  organization_id uuid
);

create table public.lessons (
  id uuid default gen_random_uuid() not null,
  rider_id uuid not null,
  trainer_id uuid,
  horse_id uuid,
  date_time timestamp with time zone not null,
  duration_min integer default 45 not null,
  lesson_type text not null,
  status text default 'pending'::text not null,
  notes text,
  feedback_text text,
  homework text,
  analysis_id uuid,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  organization_id uuid
);

create table public.membership_plans (
  id uuid default gen_random_uuid() not null,
  name text not null,
  price_cents integer not null,
  currency text default 'USD'::text not null,
  "interval" text default 'month'::text not null,
  features jsonb default '[]'::jsonb not null,
  lessons_per_month integer default 0 not null,
  analyses_per_month integer default 0 not null,
  highlighted boolean default false not null,
  active boolean default true not null,
  sort_order integer default 0 not null,
  created_at timestamp with time zone default now() not null,
  organization_id uuid
);

create table public.memberships (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  plan_id uuid not null,
  status text default 'active'::text not null,
  renews_at timestamp with time zone,
  lessons_used integer default 0 not null,
  analyses_used integer default 0 not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  organization_id uuid
);

create table public.notification_outbox (
  id uuid default gen_random_uuid() not null,
  organization_id uuid,
  recipient_id uuid not null,
  channel text not null,
  subject text,
  payload jsonb default '{}'::jsonb not null,
  status text default 'queued'::text not null,
  attempt_count integer default 0 not null,
  available_at timestamp with time zone default now() not null,
  sent_at timestamp with time zone,
  last_error text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.notification_prefs (
  user_id uuid not null,
  lesson_reminders boolean default true not null,
  analysis_ready boolean default true not null,
  payment_receipts boolean default true not null,
  marketing boolean default false not null,
  channel text default 'email'::text not null,
  updated_at timestamp with time zone default now() not null
);

create table public.organization_member_roles (
  id uuid default gen_random_uuid() not null,
  membership_id uuid not null,
  role text not null,
  assigned_by uuid,
  created_at timestamp with time zone default now() not null
);

create table public.organization_memberships (
  id uuid default gen_random_uuid() not null,
  organization_id uuid not null,
  user_id uuid not null,
  status text default 'active'::text not null,
  invited_by uuid,
  joined_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.organizations (
  id uuid default gen_random_uuid() not null,
  name text not null,
  slug text not null,
  organization_type text not null,
  active boolean default true not null,
  created_by uuid,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.payment_methods (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  brand text,
  last4 text,
  exp_month integer,
  exp_year integer,
  is_default boolean default false not null,
  provider_token text,
  created_at timestamp with time zone default now() not null
);

create table public.platform_role_assignments (
  user_id uuid not null,
  role text not null,
  assigned_by uuid,
  created_at timestamp with time zone default now() not null
);

create table public.profiles (
  id uuid not null,
  full_name text,
  email text,
  phone text,
  avatar_url text,
  role text default 'rider'::text not null,
  discipline text,
  skill_level text,
  goals text,
  locale text default 'en'::text not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table public.training_log (
  id uuid default gen_random_uuid() not null,
  horse_id uuid not null,
  author_id uuid not null,
  log_date date default CURRENT_DATE not null,
  note text not null,
  created_at timestamp with time zone default now() not null
);

create table public.video_analyses (
  id uuid default gen_random_uuid() not null,
  rider_id uuid not null,
  horse_id uuid,
  title text not null,
  discipline text default 'Flatwork'::text not null,
  video_url text,
  thumbnail_url text,
  status text default 'uploaded'::text not null,
  score numeric(5,2),
  metrics jsonb default '[]'::jsonb not null,
  ai_feedback jsonb default '{}'::jsonb not null,
  trainer_comment jsonb,
  session_date date default CURRENT_DATE not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  organization_id uuid
);

-- Sequence ownership

-- Non-foreign-key constraints

alter table only public.audit_events add constraint audit_events_pkey PRIMARY KEY (id);
alter table only public.coach_rider_assignments add constraint coach_rider_assignments_pkey PRIMARY KEY (organization_id, coach_id, rider_id);
alter table only public.documents add constraint documents_pkey PRIMARY KEY (id);
alter table only public.guardian_riders add constraint guardian_riders_pkey PRIMARY KEY (organization_id, guardian_id, rider_id);
alter table only public.health_records add constraint health_records_pkey PRIMARY KEY (id);
alter table only public.horse_access_assignments add constraint horse_access_assignments_pkey PRIMARY KEY (organization_id, horse_id, profile_id, access_type);
alter table only public.horse_riders add constraint horse_riders_pkey PRIMARY KEY (horse_id, rider_id);
alter table only public.horses add constraint horses_pkey PRIMARY KEY (id);
alter table only public.invoice_lines add constraint invoice_lines_pkey PRIMARY KEY (id);
alter table only public.invoices add constraint invoices_pkey PRIMARY KEY (id);
alter table only public.lessons add constraint lessons_pkey PRIMARY KEY (id);
alter table only public.membership_plans add constraint membership_plans_pkey PRIMARY KEY (id);
alter table only public.memberships add constraint memberships_pkey PRIMARY KEY (id);
alter table only public.notification_outbox add constraint notification_outbox_pkey PRIMARY KEY (id);
alter table only public.notification_prefs add constraint notification_prefs_pkey PRIMARY KEY (user_id);
alter table only public.organization_member_roles add constraint organization_member_roles_pkey PRIMARY KEY (id);
alter table only public.organization_memberships add constraint organization_memberships_pkey PRIMARY KEY (id);
alter table only public.organizations add constraint organizations_pkey PRIMARY KEY (id);
alter table only public.payment_methods add constraint payment_methods_pkey PRIMARY KEY (id);
alter table only public.platform_role_assignments add constraint platform_role_assignments_pkey PRIMARY KEY (user_id, role);
alter table only public.profiles add constraint profiles_pkey PRIMARY KEY (id);
alter table only public.training_log add constraint training_log_pkey PRIMARY KEY (id);
alter table only public.video_analyses add constraint video_analyses_pkey PRIMARY KEY (id);
alter table only public.horses add constraint horses_id_organization_unique UNIQUE (id, organization_id);
alter table only public.invoices add constraint invoices_number_key UNIQUE (number);
alter table only public.lessons add constraint lessons_id_organization_unique UNIQUE (id, organization_id);
alter table only public.membership_plans add constraint membership_plans_id_organization_unique UNIQUE (id, organization_id);
alter table only public.membership_plans add constraint membership_plans_name_key UNIQUE (name);
alter table only public.memberships add constraint memberships_id_organization_unique UNIQUE (id, organization_id);
alter table only public.organization_member_roles add constraint organization_member_roles_membership_id_role_key UNIQUE (membership_id, role);
alter table only public.organization_memberships add constraint organization_memberships_id_organization_id_key UNIQUE (id, organization_id);
alter table only public.organization_memberships add constraint organization_memberships_organization_id_user_id_key UNIQUE (organization_id, user_id);
alter table only public.organizations add constraint organizations_slug_key UNIQUE (slug);
alter table only public.video_analyses add constraint video_analyses_id_organization_unique UNIQUE (id, organization_id);
alter table only public.audit_events add constraint audit_events_action_check CHECK (length(btrim(action)) >= 1 AND length(btrim(action)) <= 120);
alter table only public.audit_events add constraint audit_events_check CHECK (organization_id IS NOT NULL OR source = 'platform'::text);
alter table only public.audit_events add constraint audit_events_entity_type_check CHECK (length(btrim(entity_type)) >= 1 AND length(btrim(entity_type)) <= 80);
alter table only public.audit_events add constraint audit_events_source_check CHECK (source = ANY (ARRAY['application'::text, 'payment_service'::text, 'worker'::text, 'system'::text, 'platform'::text]));
alter table only public.coach_rider_assignments add constraint coach_rider_assignments_check CHECK (coach_id <> rider_id);
alter table only public.coach_rider_assignments add constraint coach_rider_assignments_check1 CHECK (ends_on IS NULL OR ends_on >= starts_on);
alter table only public.guardian_riders add constraint guardian_riders_check CHECK (guardian_id <> rider_id);
alter table only public.health_records add constraint health_records_rec_type_check CHECK (rec_type = ANY (ARRAY['Farrier'::text, 'Vet'::text, 'Dental'::text, 'Vaccine'::text, 'Other'::text]));
alter table only public.horse_access_assignments add constraint horse_access_assignments_access_type_check CHECK (access_type = ANY (ARRAY['owner'::text, 'coach'::text, 'trainer'::text, 'rider'::text, 'caretaker'::text, 'vet'::text, 'farrier'::text, 'guardian'::text]));
alter table only public.horses add constraint horses_status_check CHECK (status = ANY (ARRAY['active'::text, 'resting'::text, 'retired'::text]));
alter table only public.invoices add constraint invoices_status_check CHECK (status = ANY (ARRAY['paid'::text, 'open'::text, 'overdue'::text, 'void'::text]));
alter table only public.lessons add constraint lessons_duration_min_check CHECK (duration_min = ANY (ARRAY[30, 45, 60]));
alter table only public.lessons add constraint lessons_lesson_type_check CHECK (lesson_type = ANY (ARRAY['Flatwork'::text, 'Jumping'::text, 'Dressage'::text, 'Groundwork'::text]));
alter table only public.lessons add constraint lessons_status_check CHECK (status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'completed'::text, 'cancelled'::text]));
alter table only public.membership_plans add constraint membership_plans_interval_check CHECK ("interval" = ANY (ARRAY['month'::text, 'year'::text]));
alter table only public.memberships add constraint memberships_status_check CHECK (status = ANY (ARRAY['trialing'::text, 'active'::text, 'past_due'::text, 'cancelled'::text]));
alter table only public.notification_outbox add constraint notification_outbox_attempt_count_check CHECK (attempt_count >= 0);
alter table only public.notification_outbox add constraint notification_outbox_channel_check CHECK (channel = ANY (ARRAY['email'::text, 'push'::text, 'sms'::text, 'in_app'::text, 'whatsapp'::text]));
alter table only public.notification_outbox add constraint notification_outbox_status_check CHECK (status = ANY (ARRAY['queued'::text, 'processing'::text, 'sent'::text, 'failed'::text, 'cancelled'::text]));
alter table only public.notification_prefs add constraint notification_prefs_channel_check CHECK (channel = ANY (ARRAY['email'::text, 'push'::text, 'both'::text]));
alter table only public.organization_member_roles add constraint organization_member_roles_role_check CHECK (role = ANY (ARRAY['academy_admin'::text, 'coach'::text, 'rider'::text, 'guardian'::text, 'horse_owner'::text, 'stable_manager'::text, 'accountant'::text, 'competition_manager'::text]));
alter table only public.organization_memberships add constraint organization_memberships_status_check CHECK (status = ANY (ARRAY['invited'::text, 'active'::text, 'suspended'::text, 'left'::text]));
alter table only public.organizations add constraint organizations_name_check CHECK (length(btrim(name)) >= 2 AND length(btrim(name)) <= 160);
alter table only public.organizations add constraint organizations_organization_type_check CHECK (organization_type = ANY (ARRAY['academy'::text, 'stable'::text, 'federation'::text, 'competition_center'::text, 'private_trainer'::text]));
alter table only public.organizations add constraint organizations_slug_check CHECK (slug = lower(slug) AND slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::text);
alter table only public.platform_role_assignments add constraint platform_role_assignments_role_check CHECK (role = 'platform_admin'::text);
alter table only public.profiles add constraint profiles_role_check CHECK (role = ANY (ARRAY['rider'::text, 'trainer'::text, 'owner'::text, 'admin'::text]));
alter table only public.profiles add constraint profiles_skill_level_check CHECK (skill_level = ANY (ARRAY['Beginner'::text, 'Intermediate'::text, 'Advanced'::text, 'Competition'::text]));
alter table only public.video_analyses add constraint video_analyses_discipline_check CHECK (discipline = ANY (ARRAY['Flatwork'::text, 'Show jumping'::text, 'Dressage'::text]));
alter table only public.video_analyses add constraint video_analyses_status_check CHECK (status = ANY (ARRAY['uploaded'::text, 'processing'::text, 'analyzed'::text, 'failed'::text]));

-- Foreign-key constraints

alter table only public.audit_events add constraint audit_events_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES profiles(id) ON DELETE SET NULL;
alter table only public.audit_events add constraint audit_events_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT;
alter table only public.coach_rider_assignments add constraint coach_rider_assignments_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table only public.coach_rider_assignments add constraint coach_rider_assignments_organization_id_coach_id_fkey FOREIGN KEY (organization_id, coach_id) REFERENCES organization_memberships(organization_id, user_id) ON DELETE CASCADE;
alter table only public.coach_rider_assignments add constraint coach_rider_assignments_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
alter table only public.coach_rider_assignments add constraint coach_rider_assignments_organization_id_rider_id_fkey FOREIGN KEY (organization_id, rider_id) REFERENCES organization_memberships(organization_id, user_id) ON DELETE CASCADE;
alter table only public.documents add constraint documents_horse_id_fkey FOREIGN KEY (horse_id) REFERENCES horses(id) ON DELETE CASCADE;
alter table only public.documents add constraint documents_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table only public.guardian_riders add constraint guardian_riders_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table only public.guardian_riders add constraint guardian_riders_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
alter table only public.guardian_riders add constraint guardian_riders_organization_id_guardian_id_fkey FOREIGN KEY (organization_id, guardian_id) REFERENCES organization_memberships(organization_id, user_id) ON DELETE CASCADE;
alter table only public.guardian_riders add constraint guardian_riders_organization_id_rider_id_fkey FOREIGN KEY (organization_id, rider_id) REFERENCES organization_memberships(organization_id, user_id) ON DELETE CASCADE;
alter table only public.health_records add constraint health_records_horse_id_fkey FOREIGN KEY (horse_id) REFERENCES horses(id) ON DELETE CASCADE;
alter table only public.horse_access_assignments add constraint horse_access_assignments_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table only public.horse_access_assignments add constraint horse_access_assignments_horse_id_organization_id_fkey FOREIGN KEY (horse_id, organization_id) REFERENCES horses(id, organization_id) ON DELETE CASCADE;
alter table only public.horse_access_assignments add constraint horse_access_assignments_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
alter table only public.horse_access_assignments add constraint horse_access_assignments_organization_id_profile_id_fkey FOREIGN KEY (organization_id, profile_id) REFERENCES organization_memberships(organization_id, user_id) ON DELETE CASCADE;
alter table only public.horse_riders add constraint horse_riders_horse_id_fkey FOREIGN KEY (horse_id) REFERENCES horses(id) ON DELETE CASCADE;
alter table only public.horse_riders add constraint horse_riders_rider_id_fkey FOREIGN KEY (rider_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table only public.horses add constraint horses_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT;
alter table only public.horses add constraint horses_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table only public.horses add constraint horses_owner_organization_membership_fkey FOREIGN KEY (organization_id, owner_id) REFERENCES organization_memberships(organization_id, user_id) ON DELETE RESTRICT;
alter table only public.invoice_lines add constraint invoice_lines_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE;
alter table only public.invoices add constraint invoices_membership_id_fkey FOREIGN KEY (membership_id) REFERENCES memberships(id) ON DELETE SET NULL;
alter table only public.invoices add constraint invoices_membership_organization_fkey FOREIGN KEY (membership_id, organization_id) REFERENCES memberships(id, organization_id) ON DELETE RESTRICT;
alter table only public.invoices add constraint invoices_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT;
alter table only public.invoices add constraint invoices_payment_method_id_fkey FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id) ON DELETE SET NULL;
alter table only public.invoices add constraint invoices_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table only public.invoices add constraint invoices_user_organization_membership_fkey FOREIGN KEY (organization_id, user_id) REFERENCES organization_memberships(organization_id, user_id) ON DELETE RESTRICT;
alter table only public.lessons add constraint lessons_analysis_id_fkey FOREIGN KEY (analysis_id) REFERENCES video_analyses(id) ON DELETE SET NULL;
alter table only public.lessons add constraint lessons_analysis_organization_fkey FOREIGN KEY (analysis_id, organization_id) REFERENCES video_analyses(id, organization_id) ON DELETE RESTRICT;
alter table only public.lessons add constraint lessons_horse_id_fkey FOREIGN KEY (horse_id) REFERENCES horses(id);
alter table only public.lessons add constraint lessons_horse_organization_fkey FOREIGN KEY (horse_id, organization_id) REFERENCES horses(id, organization_id) ON DELETE RESTRICT;
alter table only public.lessons add constraint lessons_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT;
alter table only public.lessons add constraint lessons_rider_id_fkey FOREIGN KEY (rider_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table only public.lessons add constraint lessons_rider_organization_membership_fkey FOREIGN KEY (organization_id, rider_id) REFERENCES organization_memberships(organization_id, user_id) ON DELETE RESTRICT;
alter table only public.lessons add constraint lessons_trainer_id_fkey FOREIGN KEY (trainer_id) REFERENCES profiles(id);
alter table only public.lessons add constraint lessons_trainer_organization_membership_fkey FOREIGN KEY (organization_id, trainer_id) REFERENCES organization_memberships(organization_id, user_id) ON DELETE RESTRICT;
alter table only public.membership_plans add constraint membership_plans_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT;
alter table only public.memberships add constraint memberships_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT;
alter table only public.memberships add constraint memberships_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES membership_plans(id);
alter table only public.memberships add constraint memberships_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table only public.memberships add constraint memberships_user_organization_membership_fkey FOREIGN KEY (organization_id, user_id) REFERENCES organization_memberships(organization_id, user_id) ON DELETE RESTRICT;
alter table only public.notification_outbox add constraint notification_outbox_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT;
alter table only public.notification_outbox add constraint notification_outbox_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table only public.notification_prefs add constraint notification_prefs_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table only public.organization_member_roles add constraint organization_member_roles_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table only public.organization_member_roles add constraint organization_member_roles_membership_id_fkey FOREIGN KEY (membership_id) REFERENCES organization_memberships(id) ON DELETE CASCADE;
alter table only public.organization_memberships add constraint organization_memberships_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table only public.organization_memberships add constraint organization_memberships_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
alter table only public.organization_memberships add constraint organization_memberships_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table only public.organizations add constraint organizations_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table only public.payment_methods add constraint payment_methods_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table only public.platform_role_assignments add constraint platform_role_assignments_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES profiles(id) ON DELETE SET NULL;
alter table only public.platform_role_assignments add constraint platform_role_assignments_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table only public.profiles add constraint profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table only public.training_log add constraint training_log_author_id_fkey FOREIGN KEY (author_id) REFERENCES profiles(id);
alter table only public.training_log add constraint training_log_horse_id_fkey FOREIGN KEY (horse_id) REFERENCES horses(id) ON DELETE CASCADE;
alter table only public.video_analyses add constraint video_analyses_horse_id_fkey FOREIGN KEY (horse_id) REFERENCES horses(id);
alter table only public.video_analyses add constraint video_analyses_horse_organization_fkey FOREIGN KEY (horse_id, organization_id) REFERENCES horses(id, organization_id) ON DELETE RESTRICT;
alter table only public.video_analyses add constraint video_analyses_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE RESTRICT;
alter table only public.video_analyses add constraint video_analyses_rider_id_fkey FOREIGN KEY (rider_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table only public.video_analyses add constraint video_analyses_rider_organization_membership_fkey FOREIGN KEY (organization_id, rider_id) REFERENCES organization_memberships(organization_id, user_id) ON DELETE RESTRICT;

-- Secondary indexes

CREATE INDEX audit_events_actor_idx ON public.audit_events USING btree (actor_user_id);
CREATE INDEX audit_events_entity_idx ON public.audit_events USING btree (entity_type, entity_id, occurred_at DESC);
CREATE INDEX audit_events_organization_occurred_idx ON public.audit_events USING btree (organization_id, occurred_at DESC);
CREATE INDEX coach_rider_assignments_created_by_idx ON public.coach_rider_assignments USING btree (created_by);
CREATE INDEX coach_rider_assignments_rider_idx ON public.coach_rider_assignments USING btree (organization_id, rider_id);
CREATE INDEX documents_horse_id_idx ON public.documents USING btree (horse_id);
CREATE INDEX documents_user_id_idx ON public.documents USING btree (user_id);
CREATE INDEX guardian_riders_created_by_idx ON public.guardian_riders USING btree (created_by);
CREATE INDEX guardian_riders_rider_idx ON public.guardian_riders USING btree (organization_id, rider_id);
CREATE INDEX health_records_horse_id_idx ON public.health_records USING btree (horse_id);
CREATE INDEX horse_access_assignments_created_by_idx ON public.horse_access_assignments USING btree (created_by);
CREATE INDEX horse_access_assignments_horse_organization_idx ON public.horse_access_assignments USING btree (horse_id, organization_id);
CREATE INDEX horse_access_assignments_profile_idx ON public.horse_access_assignments USING btree (organization_id, profile_id);
CREATE INDEX horse_riders_rider_id_idx ON public.horse_riders USING btree (rider_id);
CREATE INDEX horses_organization_idx ON public.horses USING btree (organization_id);
CREATE INDEX horses_organization_owner_idx ON public.horses USING btree (organization_id, owner_id) WHERE (organization_id IS NOT NULL);
CREATE INDEX horses_owner_id_idx ON public.horses USING btree (owner_id);
CREATE INDEX idx_analyses_horse ON public.video_analyses USING btree (horse_id);
CREATE INDEX idx_analyses_rider ON public.video_analyses USING btree (rider_id, session_date DESC);
CREATE INDEX idx_invoice_lines_invoice ON public.invoice_lines USING btree (invoice_id);
CREATE INDEX idx_invoices_user ON public.invoices USING btree (user_id, issue_date DESC);
CREATE INDEX idx_lessons_rider ON public.lessons USING btree (rider_id, date_time DESC);
CREATE INDEX idx_lessons_trainer ON public.lessons USING btree (trainer_id, date_time DESC);
CREATE INDEX idx_memberships_user ON public.memberships USING btree (user_id, status);
CREATE INDEX idx_payment_methods_user ON public.payment_methods USING btree (user_id);
CREATE INDEX invoices_membership_organization_idx ON public.invoices USING btree (membership_id, organization_id) WHERE ((organization_id IS NOT NULL) AND (membership_id IS NOT NULL));
CREATE INDEX invoices_organization_idx ON public.invoices USING btree (organization_id);
CREATE INDEX invoices_organization_user_idx ON public.invoices USING btree (organization_id, user_id) WHERE (organization_id IS NOT NULL);
CREATE INDEX invoices_payment_method_id_idx ON public.invoices USING btree (payment_method_id);
CREATE INDEX lessons_analysis_organization_idx ON public.lessons USING btree (analysis_id, organization_id) WHERE ((organization_id IS NOT NULL) AND (analysis_id IS NOT NULL));
CREATE INDEX lessons_horse_organization_idx ON public.lessons USING btree (horse_id, organization_id) WHERE ((organization_id IS NOT NULL) AND (horse_id IS NOT NULL));
CREATE INDEX lessons_organization_idx ON public.lessons USING btree (organization_id);
CREATE INDEX lessons_organization_rider_idx ON public.lessons USING btree (organization_id, rider_id) WHERE (organization_id IS NOT NULL);
CREATE INDEX lessons_organization_trainer_idx ON public.lessons USING btree (organization_id, trainer_id) WHERE ((organization_id IS NOT NULL) AND (trainer_id IS NOT NULL));
CREATE INDEX membership_plans_organization_idx ON public.membership_plans USING btree (organization_id);
CREATE INDEX memberships_organization_idx ON public.memberships USING btree (organization_id);
CREATE INDEX memberships_organization_user_idx ON public.memberships USING btree (organization_id, user_id) WHERE (organization_id IS NOT NULL);
CREATE INDEX memberships_plan_id_idx ON public.memberships USING btree (plan_id);
CREATE INDEX notification_outbox_delivery_idx ON public.notification_outbox USING btree (status, available_at) WHERE (status = ANY (ARRAY['queued'::text, 'failed'::text]));
CREATE INDEX notification_outbox_organization_idx ON public.notification_outbox USING btree (organization_id) WHERE (organization_id IS NOT NULL);
CREATE INDEX notification_outbox_recipient_idx ON public.notification_outbox USING btree (recipient_id, created_at DESC);
CREATE INDEX organization_member_roles_assigned_by_idx ON public.organization_member_roles USING btree (assigned_by);
CREATE INDEX organization_memberships_invited_by_idx ON public.organization_memberships USING btree (invited_by);
CREATE INDEX organization_memberships_organization_status_idx ON public.organization_memberships USING btree (organization_id, status);
CREATE INDEX organization_memberships_user_status_idx ON public.organization_memberships USING btree (user_id, status);
CREATE INDEX organizations_created_by_idx ON public.organizations USING btree (created_by);
CREATE INDEX platform_role_assignments_assigned_by_idx ON public.platform_role_assignments USING btree (assigned_by);
CREATE INDEX training_log_author_id_idx ON public.training_log USING btree (author_id);
CREATE INDEX training_log_horse_id_idx ON public.training_log USING btree (horse_id);
CREATE INDEX video_analyses_horse_organization_idx ON public.video_analyses USING btree (horse_id, organization_id) WHERE ((organization_id IS NOT NULL) AND (horse_id IS NOT NULL));
CREATE INDEX video_analyses_organization_idx ON public.video_analyses USING btree (organization_id);
CREATE INDEX video_analyses_organization_rider_idx ON public.video_analyses USING btree (organization_id, rider_id) WHERE (organization_id IS NOT NULL);

-- Application functions

CREATE OR REPLACE FUNCTION private.allocate_cost_center_on_post()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if new.status in ('posted','reversed') and old.status is distinct from new.status then
    perform private.refresh_cost_center_entry(new.id);
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION private.audit_action_center_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare actor uuid := (select auth.uid());
begin
  if actor is null or not private.is_platform_administrator() then
    raise exception 'platform administrator access required' using errcode = '42501';
  end if;
  insert into public.platform_audit_events (actor_user_id, action, target_user_id, academy_id, metadata)
  values (
    actor, 'platform.action_center_updated', new.assigned_to, new.academy_id,
    jsonb_build_object('action_key', new.action_key, 'category', new.category,
      'status', new.status, 'due_at', new.due_at, 'has_note', new.note is not null)
  );
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION private.audit_conduct_acknowledgement()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  insert into public.platform_audit_events (
    actor_user_id, action, target_user_id, metadata
  ) values (
    new.user_id,
    'platform.conduct_policy_acknowledged',
    new.user_id,
    jsonb_build_object('policy_id', new.policy_id)
  );
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION private.audit_conduct_policy_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid := coalesce((select auth.uid()), new.published_by);
begin
  if tg_op = 'INSERT' then
    insert into public.platform_audit_events (actor_user_id, action, metadata)
    values (
      actor,
      'platform.conduct_policy_published',
      jsonb_build_object('policy_id', new.id, 'title', new.title, 'version', new.version)
    );
  elsif old.status = 'published' and new.status = 'retired' then
    insert into public.platform_audit_events (actor_user_id, action, metadata)
    values (
      actor,
      'platform.conduct_policy_retired',
      jsonb_build_object('policy_id', new.id)
    );
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION private.audit_feed_stock_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid := (select auth.uid());
begin
  if actor is null or not private.is_platform_administrator() then
    raise exception 'platform administrator access required' using errcode = '42501';
  end if;

  insert into public.platform_audit_events (actor_user_id, action, academy_id, metadata)
  values (
    actor,
    case when tg_table_name = 'feed_stock_adjustments' then 'platform.feed_stock_adjusted'
         when tg_op = 'INSERT' then 'platform.feed_stock_item_created'
         else 'platform.feed_stock_item_updated' end,
    new.academy_id,
    case when tg_table_name = 'feed_stock_adjustments'
      then jsonb_build_object('item_id', new.item_id, 'quantity_delta', new.quantity_delta, 'balance_after', new.balance_after, 'reason', new.reason)
      else jsonb_build_object('item_id', new.id, 'feed_name', new.feed_name, 'quantity_on_hand', new.quantity_on_hand, 'reorder_threshold', new.reorder_threshold)
    end
  );
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION private.audit_staff_attendance_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare actor uuid := (select auth.uid()); event_action text; event_metadata jsonb := '{}'::jsonb; event_academy uuid; event_shift uuid; event_entry uuid; event_staff uuid;
begin
  if actor is null then raise exception 'authentication required' using errcode='42501'; end if;
  if tg_table_name='staff_shifts' then
    event_academy:=new.academy_id; event_shift:=new.id; event_staff:=new.staff_user_id;
    event_action:=case when tg_op='INSERT' then 'shift.created' when old.status='scheduled' and new.status='cancelled' then 'shift.cancelled' end;
  else
    event_academy:=new.academy_id; event_shift:=new.shift_id; event_entry:=new.id; event_staff:=new.staff_user_id;
    event_action:=case when tg_op='INSERT' then 'clock.in' when old.status='open' and new.status='submitted' then 'clock.out' when old.status='submitted' and new.status='approved' then 'timesheet.approved' when old.status='submitted' and new.status='rejected' then 'timesheet.rejected' else 'timesheet.corrected' end;
    event_metadata:=jsonb_build_object('status',new.status,'break_minutes',new.break_minutes);
  end if;
  if event_action is not null then insert into public.staff_attendance_events(academy_id,shift_id,time_entry_id,actor_user_id,staff_user_id,action,metadata) values(event_academy,event_shift,event_entry,actor,event_staff,event_action,event_metadata); end if;
  return new;
end; $function$;

CREATE OR REPLACE FUNCTION private.audit_supplier_ledger_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare actor uuid := (select auth.uid());
begin
  if actor is null or not private.is_platform_administrator() then
    raise exception 'platform administrator access required' using errcode = '42501';
  end if;
  insert into public.platform_audit_events (actor_user_id, action, academy_id, metadata)
  values (
    actor,
    case when tg_table_name = 'supplier_profiles'
      then case when tg_op = 'INSERT' then 'platform.supplier_created' else 'platform.supplier_updated' end
      else case when tg_op = 'INSERT' then 'platform.supplier_invoice_created' else 'platform.supplier_invoice_updated' end
    end,
    new.academy_id,
    case when tg_table_name = 'supplier_profiles'
      then jsonb_build_object('supplier_id', new.id, 'supplier_name', new.supplier_name, 'active', new.active)
      else jsonb_build_object('invoice_id', new.id, 'supplier_id', new.supplier_id, 'invoice_number', new.invoice_number, 'status', new.status)
    end
  );
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION private.can_access_lesson_booking(target_academy_id uuid, target_session_id uuid, target_rider_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    private.has_academy_role(
      target_academy_id,
      array['academy_admin']::public.app_role[]
    )
    or target_rider_user_id = (select auth.uid())
    or exists (
      select 1
      from public.lesson_sessions lesson
      where lesson.id = target_session_id
        and lesson.academy_id = target_academy_id
        and lesson.coach_user_id = (select auth.uid())
        and private.has_academy_role(
          target_academy_id,
          array['coach']::public.app_role[]
        )
    )
    or exists (
      select 1
      from public.parent_rider_links link
      where link.academy_id = target_academy_id
        and link.parent_user_id = (select auth.uid())
        and link.rider_user_id = target_rider_user_id
        and private.has_academy_role(
          target_academy_id,
          array['parent']::public.app_role[]
        )
    );
$function$;

CREATE OR REPLACE FUNCTION private.can_access_lesson_report(target_lesson_session_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from public.lesson_sessions lesson
    where lesson.id = target_lesson_session_id
      and private.can_access_lesson_session(
        lesson.academy_id,
        lesson.coach_user_id,
        lesson.rider_user_id
      )
  );
$function$;

CREATE OR REPLACE FUNCTION private.can_access_lesson_session(target_academy_id uuid, target_coach_user_id uuid, target_rider_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    private.has_academy_role(
      target_academy_id,
      array['academy_admin']::public.app_role[]
    )
    or (
      target_coach_user_id = (select auth.uid())
      and private.has_academy_role(
        target_academy_id,
        array['coach']::public.app_role[]
      )
    )
    or (
      target_rider_user_id = (select auth.uid())
      and private.has_academy_role(
        target_academy_id,
        array['rider']::public.app_role[]
      )
    )
    or (
      private.has_academy_role(
        target_academy_id,
        array['parent']::public.app_role[]
      )
      and exists (
        select 1
        from public.parent_rider_links link
        where link.academy_id = target_academy_id
          and link.parent_user_id = (select auth.uid())
          and link.rider_user_id = target_rider_user_id
      )
    );
$function$;

CREATE OR REPLACE FUNCTION private.can_access_profile(target_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    private.is_platform_administrator()
    or target_user_id = (select auth.uid())
    or exists (
      select 1
      from public.academy_memberships viewer
      join public.academy_memberships target
        on target.academy_id = viewer.academy_id
       and target.user_id = target_user_id
       and target.status = 'active'
      where viewer.user_id = (select auth.uid())
        and viewer.status = 'active'
        and viewer.role = 'academy_admin'
    )
    or exists (
      select 1 from public.coach_rider_assignments assignment
      where assignment.coach_user_id = (select auth.uid())
        and assignment.rider_user_id = target_user_id
    )
    or exists (
      select 1 from public.parent_rider_links link
      where link.parent_user_id = (select auth.uid())
        and link.rider_user_id = target_user_id
    );
$function$;

CREATE OR REPLACE FUNCTION private.can_access_rider_billing(target_academy_id uuid, target_rider_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select private.has_academy_role(target_academy_id, array['academy_admin']::public.app_role[])
    or (
      target_rider_user_id = (select auth.uid())
      and private.has_academy_role(target_academy_id, array['rider']::public.app_role[])
    )
    or exists (
      select 1 from public.parent_rider_links link
      where link.academy_id = target_academy_id
        and link.parent_user_id = (select auth.uid())
        and link.rider_user_id = target_rider_user_id
        and private.has_academy_role(target_academy_id, array['parent']::public.app_role[])
    );
$function$;

CREATE OR REPLACE FUNCTION private.can_access_rider_pathway(target_academy_id uuid, target_rider_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from public.academy_memberships rider
    where rider.academy_id = target_academy_id
      and rider.user_id = target_rider_user_id
      and rider.role = 'rider'::public.app_role
      and rider.status = 'active'::public.membership_status
      and (
        target_rider_user_id = (select auth.uid())
        or private.has_academy_role(
          target_academy_id,
          array['academy_admin']::public.app_role[]
        )
        or (
          private.has_academy_role(
            target_academy_id,
            array['coach']::public.app_role[]
          )
          and exists (
            select 1
            from public.coach_rider_assignments assignment
            where assignment.academy_id = target_academy_id
              and assignment.coach_user_id = (select auth.uid())
              and assignment.rider_user_id = target_rider_user_id
          )
        )
        or (
          private.has_academy_role(
            target_academy_id,
            array['parent']::public.app_role[]
          )
          and exists (
            select 1
            from public.parent_rider_links link
            where link.academy_id = target_academy_id
              and link.parent_user_id = (select auth.uid())
              and link.rider_user_id = target_rider_user_id
          )
        )
      )
  );
$function$;

CREATE OR REPLACE FUNCTION private.can_manage_riding_analysis(target_academy_id uuid, target_rider_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select private.is_platform_administrator()
    or private.has_academy_role(
      target_academy_id,
      array['academy_admin']::public.app_role[]
    )
    or (
      private.has_academy_role(
        target_academy_id,
        array['coach']::public.app_role[]
      )
      and exists (
        select 1
        from public.coach_rider_assignments assignment
        where assignment.academy_id = target_academy_id
          and assignment.coach_user_id = (select auth.uid())
          and assignment.rider_user_id = target_rider_id
      )
    );
$function$;

CREATE OR REPLACE FUNCTION private.can_view_approved_riding_analysis(target_academy_id uuid, target_rider_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select target_rider_id=(select auth.uid()) or exists(select 1 from public.parent_rider_links l where l.academy_id=target_academy_id and l.parent_user_id=(select auth.uid()) and l.rider_user_id=target_rider_id);
$function$;

CREATE OR REPLACE FUNCTION private.can_write_lesson_report(target_lesson_session_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from public.lesson_sessions lesson
    where lesson.id = target_lesson_session_id
      and lesson.status = 'completed'::public.lesson_status
      and lesson.rider_user_id is not null
      and (
        private.has_academy_role(
          lesson.academy_id,
          array['academy_admin']::public.app_role[]
        )
        or (
          lesson.coach_user_id = (select auth.uid())
          and private.has_academy_role(
            lesson.academy_id,
            array['coach']::public.app_role[]
          )
        )
      )
  );
$function$;

CREATE OR REPLACE FUNCTION private.can_write_rider_pathway(target_academy_id uuid, target_rider_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from public.academy_memberships rider
    where rider.academy_id = target_academy_id
      and rider.user_id = target_rider_user_id
      and rider.role = 'rider'::public.app_role
      and rider.status = 'active'::public.membership_status
      and (
        private.has_academy_role(
          target_academy_id,
          array['academy_admin']::public.app_role[]
        )
        or (
          private.has_academy_role(
            target_academy_id,
            array['coach']::public.app_role[]
          )
          and exists (
            select 1
            from public.coach_rider_assignments assignment
            where assignment.academy_id = target_academy_id
              and assignment.coach_user_id = (select auth.uid())
              and assignment.rider_user_id = target_rider_user_id
          )
        )
      )
  );
$function$;

CREATE OR REPLACE FUNCTION private.consume_lesson_credit(target_academy_id uuid, target_rider_user_id uuid, target_booking_id uuid, actor_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if exists (
    select 1 from public.billing_ledger_entries
    where lesson_booking_id = target_booking_id and entry_type = 'credit_consumption'
  ) then return; end if;

  update public.lesson_credit_accounts
  set balance = balance - 1, updated_at = now()
  where academy_id = target_academy_id and rider_user_id = target_rider_user_id and balance > 0;
  if not found then raise exception 'Rider has no available lesson credits' using errcode = 'P0001'; end if;

  insert into public.billing_ledger_entries (
    academy_id, rider_user_id, lesson_booking_id, entry_type, credit_delta, note, created_by
  ) values (
    target_academy_id, target_rider_user_id, target_booking_id,
    'credit_consumption', -1, 'Credit used for confirmed lesson booking', actor_id
  );
end;
$function$;

CREATE OR REPLACE FUNCTION private.has_operational_assignment(target_academy_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select private.is_platform_administrator()
    or exists (
      select 1
      from public.academy_memberships membership
      where membership.academy_id = target_academy_id
        and membership.user_id = (select auth.uid())
        and membership.status = 'active'
    );
$function$;

CREATE OR REPLACE FUNCTION private.has_organization_role(p_organization_id uuid, p_roles text[])
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from public.organization_memberships as membership
    join public.organization_member_roles as member_role
      on member_role.membership_id = membership.id
    where membership.organization_id = p_organization_id
      and membership.user_id = (select auth.uid())
      and membership.status = 'active'
      and member_role.role = any(p_roles)
  );
$function$;

CREATE OR REPLACE FUNCTION private.is_academy_member(target_academy_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select private.is_platform_administrator()
    and exists (select 1 from public.academies academy where academy.id = target_academy_id);
$function$;

CREATE OR REPLACE FUNCTION private.is_horse_owner(p_horse_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from public.horses
    where id = p_horse_id
      and owner_id = (select auth.uid())
  );
$function$;

CREATE OR REPLACE FUNCTION private.is_horse_rider(p_horse_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from public.horse_riders
    where horse_id = p_horse_id
      and rider_id = (select auth.uid())
  );
$function$;

CREATE OR REPLACE FUNCTION private.is_organization_member(p_organization_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from public.organization_memberships
    where organization_id = p_organization_id
      and user_id = (select auth.uid())
      and status = 'active'
  );
$function$;

CREATE OR REPLACE FUNCTION private.is_platform_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from public.platform_role_assignments
    where user_id = (select auth.uid())
      and role = 'platform_admin'
  );
$function$;

CREATE OR REPLACE FUNCTION private.is_platform_administrator()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from public.platform_access access
    where access.user_id = (select auth.uid())
      and access.status = 'active'
      and access.access_level = 'administrator'
  );
$function$;

CREATE OR REPLACE FUNCTION private.is_platform_user()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from public.platform_access access
    where access.user_id = (select auth.uid())
      and access.status = 'active'
  );
$function$;

CREATE OR REPLACE FUNCTION private.phase_0b2_create_organization(p_name text, p_slug text, p_organization_type text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor_id uuid := (select auth.uid());
  organization_id uuid;
  created_membership_id uuid;
begin
  if actor_id is null then
    raise insufficient_privilege using message = 'Authentication required';
  end if;

  if not (select private.is_platform_admin()) then
    raise insufficient_privilege using message = 'Platform administrator access required';
  end if;

  insert into public.organizations (
    name,
    slug,
    organization_type,
    created_by
  ) values (
    btrim(p_name),
    lower(btrim(p_slug)),
    p_organization_type,
    actor_id
  )
  returning id into organization_id;

  insert into public.organization_memberships (
    organization_id,
    user_id,
    status,
    invited_by,
    joined_at
  ) values (
    organization_id,
    actor_id,
    'active',
    actor_id,
    now()
  )
  returning id into created_membership_id;

  insert into public.organization_member_roles (
    membership_id,
    role,
    assigned_by
  ) values (
    created_membership_id,
    'academy_admin',
    actor_id
  );

  insert into public.audit_events (
    organization_id,
    request_id,
    source,
    actor_user_id,
    entity_type,
    entity_id,
    action,
    after_data
  ) values (
    organization_id,
    gen_random_uuid(),
    'application',
    actor_id,
    'organization',
    organization_id,
    'organization.created',
    jsonb_build_object(
      'name', btrim(p_name),
      'slug', lower(btrim(p_slug)),
      'organization_type', p_organization_type
    )
  );

  return organization_id;
end;
$function$;

CREATE OR REPLACE FUNCTION private.phase_0b2_get_organization_members(p_organization_id uuid)
 RETURNS TABLE(membership_id uuid, user_id uuid, email text, full_name text, status text, roles text[], joined_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if (select auth.uid()) is null then
    raise insufficient_privilege using message = 'Authentication required';
  end if;

  if not (select private.phase_0b2_is_organization_manager(p_organization_id)) then
    raise insufficient_privilege using message = 'Organization administrator access required';
  end if;

  return query
  select
    membership.id,
    membership.user_id,
    profile.email,
    profile.full_name,
    membership.status,
    coalesce(
      array_agg(member_role.role order by member_role.role)
        filter (where member_role.role is not null),
      '{}'::text[]
    ),
    membership.joined_at
  from public.organization_memberships as membership
  join public.profiles as profile on profile.id = membership.user_id
  left join public.organization_member_roles as member_role
    on member_role.membership_id = membership.id
  where membership.organization_id = p_organization_id
  group by membership.id, profile.email, profile.full_name
  order by profile.full_name, profile.email;
end;
$function$;

CREATE OR REPLACE FUNCTION private.phase_0b2_is_organization_manager(p_organization_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    (select private.is_platform_admin())
    or (select private.has_organization_role(
      p_organization_id,
      array['academy_admin']::text[]
    ));
$function$;

CREATE OR REPLACE FUNCTION private.phase_0b2_manage_organization_member(p_organization_id uuid, p_email text, p_status text, p_roles text[])
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor_id uuid := (select auth.uid());
  target_user_id uuid;
  target_count integer;
  managed_membership_id uuid;
  previous_status text;
  previous_roles text[] := '{}'::text[];
  normalized_roles text[];
  actor_is_platform_admin boolean;
  target_was_academy_admin boolean := false;
begin
  if actor_id is null then
    raise insufficient_privilege using message = 'Authentication required';
  end if;

  actor_is_platform_admin := (select private.is_platform_admin());

  if not actor_is_platform_admin
     and not (select private.has_organization_role(
       p_organization_id,
       array['academy_admin']::text[]
     )) then
    raise insufficient_privilege using message = 'Organization administrator access required';
  end if;

  -- Serialize member administration so two concurrent requests cannot remove
  -- the last active academy administrators at the same time.
  perform 1
  from public.organizations as organization
  where organization.id = p_organization_id
  for update;

  if not found then
    raise no_data_found using message = 'Organization not found';
  end if;

  if p_status not in ('active', 'suspended', 'left') then
    raise check_violation using message = 'Unsupported organization membership status';
  end if;

  select coalesce(array_agg(distinct requested_role order by requested_role), '{}'::text[])
  into normalized_roles
  from unnest(coalesce(p_roles, '{}'::text[])) as requested_role;

  if p_status = 'active' and cardinality(normalized_roles) = 0 then
    raise check_violation using message = 'An active member requires at least one role';
  end if;

  if exists (
    select 1
    from unnest(normalized_roles) as requested_role
    where requested_role <> all(array[
      'academy_admin', 'coach', 'rider', 'guardian', 'horse_owner',
      'stable_manager', 'accountant', 'competition_manager'
    ]::text[])
  ) then
    raise check_violation using message = 'Unsupported organization role';
  end if;

  select count(*), min(profile.id::text)::uuid
  into target_count, target_user_id
  from public.profiles as profile
  where lower(profile.email) = lower(btrim(p_email));

  if target_count <> 1 then
    raise no_data_found using message = 'Exactly one registered EquiVista account is required';
  end if;

  if not actor_is_platform_admin and target_user_id = actor_id then
    raise insufficient_privilege using message = 'Organization administrators cannot change their own access';
  end if;

  select membership.id, membership.status
  into managed_membership_id, previous_status
  from public.organization_memberships as membership
  where membership.organization_id = p_organization_id
    and membership.user_id = target_user_id
  for update;

  if managed_membership_id is not null then
    select coalesce(array_agg(member_role.role order by member_role.role), '{}'::text[])
    into previous_roles
    from public.organization_member_roles as member_role
    where member_role.membership_id = managed_membership_id;

    target_was_academy_admin := 'academy_admin' = any(previous_roles);
  end if;

  if not actor_is_platform_admin
     and (
       target_was_academy_admin
       or 'academy_admin' = any(normalized_roles)
     ) then
    raise insufficient_privilege using message = 'Only a platform administrator may manage academy administrators';
  end if;

  if target_was_academy_admin
     and (p_status <> 'active' or not ('academy_admin' = any(normalized_roles)))
     and not exists (
       select 1
       from public.organization_memberships as other_membership
       join public.organization_member_roles as other_role
         on other_role.membership_id = other_membership.id
       where other_membership.organization_id = p_organization_id
         and other_membership.status = 'active'
         and other_membership.user_id <> target_user_id
         and other_role.role = 'academy_admin'
     ) then
    raise check_violation using message = 'An organization must retain at least one active academy administrator';
  end if;

  insert into public.organization_memberships (
    organization_id,
    user_id,
    status,
    invited_by,
    joined_at
  ) values (
    p_organization_id,
    target_user_id,
    p_status,
    actor_id,
    case when p_status = 'active' then now() end
  )
  on conflict (organization_id, user_id) do update
  set status = excluded.status,
      joined_at = case
        when excluded.status = 'active'
          then coalesce(public.organization_memberships.joined_at, now())
        else public.organization_memberships.joined_at
      end,
      updated_at = now()
  returning id into managed_membership_id;

  delete from public.organization_member_roles
  where organization_member_roles.membership_id = managed_membership_id;

  insert into public.organization_member_roles (
    membership_id,
    role,
    assigned_by
  )
  select managed_membership_id, requested_role, actor_id
  from unnest(normalized_roles) as requested_role;

  insert into public.audit_events (
    organization_id,
    request_id,
    source,
    actor_user_id,
    entity_type,
    entity_id,
    action,
    before_data,
    after_data
  ) values (
    p_organization_id,
    gen_random_uuid(),
    'application',
    actor_id,
    'organization_membership',
    managed_membership_id,
    case when previous_status is null then 'organization_member.created'
         else 'organization_member.updated' end,
    case when previous_status is null then null
         else jsonb_build_object('status', previous_status, 'roles', previous_roles) end,
    jsonb_build_object(
      'user_id', target_user_id,
      'status', p_status,
      'roles', normalized_roles
    )
  );

  return managed_membership_id;
end;
$function$;

CREATE OR REPLACE FUNCTION private.phase_0b2_update_organization_name(p_organization_id uuid, p_name text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor_id uuid := (select auth.uid());
  previous_name text;
begin
  if actor_id is null then
    raise insufficient_privilege using message = 'Authentication required';
  end if;

  if not (select private.phase_0b2_is_organization_manager(p_organization_id)) then
    raise insufficient_privilege using message = 'Organization administrator access required';
  end if;

  select organization.name
  into previous_name
  from public.organizations as organization
  where organization.id = p_organization_id
  for update;

  if previous_name is null then
    raise no_data_found using message = 'Organization not found';
  end if;

  update public.organizations
  set name = btrim(p_name)
  where id = p_organization_id;

  insert into public.audit_events (
    organization_id,
    request_id,
    source,
    actor_user_id,
    entity_type,
    entity_id,
    action,
    before_data,
    after_data
  ) values (
    p_organization_id,
    gen_random_uuid(),
    'application',
    actor_id,
    'organization',
    p_organization_id,
    'organization.renamed',
    jsonb_build_object('name', previous_name),
    jsonb_build_object('name', btrim(p_name))
  );
end;
$function$;

CREATE OR REPLACE FUNCTION private.protect_closed_audit_finding()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if old.status = 'closed' then raise exception 'closed audit finding is immutable' using errcode = '23514'; end if;
  new.updated_at := now(); return new;
end; $function$;

CREATE OR REPLACE FUNCTION private.protect_closed_compliance_breach()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$begin if old.status='closed'then raise exception 'closed compliance breach is immutable' using errcode='23514';end if;new.updated_at:=now();return new;end;$function$;

CREATE OR REPLACE FUNCTION private.protect_closed_enterprise_risk()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$begin if old.status='closed'then raise exception 'closed risk is immutable' using errcode='23514';end if;new.updated_at:=now();return new;end;$function$;

CREATE OR REPLACE FUNCTION private.protect_completed_audit_engagement()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$begin if old.status in('completed','cancelled')then raise exception 'terminal audit engagement is immutable' using errcode='23514';end if;new.updated_at:=now();return new;end;$function$;

CREATE OR REPLACE FUNCTION private.protect_completed_audit_test()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if old.status in ('effective','deficient') then raise exception 'completed audit control test is immutable' using errcode = '23514'; end if;
  new.updated_at := now(); return new;
end; $function$;

CREATE OR REPLACE FUNCTION private.protect_fixed_asset_depreciation_history()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
 if tg_table_name='fixed_asset_depreciation_runs' and tg_op='UPDATE' and old.journal_entry_id is null and new.journal_entry_id is not null and old.id=new.id and old.academy_id=new.academy_id and old.period_end=new.period_end and old.currency=new.currency and old.created_by=new.created_by and old.created_at=new.created_at then return new;end if;
 raise exception 'depreciation history is immutable' using errcode='23514';
end;$function$;

CREATE OR REPLACE FUNCTION private.protect_fixed_asset_financial_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
 if old.academy_id<>new.academy_id or old.asset_code<>new.asset_code or old.acquired_on<>new.acquired_on or old.in_service_on<>new.in_service_on or old.currency<>new.currency or old.purchase_cost_minor<>new.purchase_cost_minor or old.residual_value_minor<>new.residual_value_minor or old.useful_life_months<>new.useful_life_months or old.asset_account_id<>new.asset_account_id or old.accumulated_depreciation_account_id<>new.accumulated_depreciation_account_id or old.depreciation_expense_account_id<>new.depreciation_expense_account_id or (old.acquisition_entry_id is not null and old.acquisition_entry_id is distinct from new.acquisition_entry_id) then raise exception 'fixed asset financial terms are immutable' using errcode='23514';end if;return new;
end;$function$;

CREATE OR REPLACE FUNCTION private.protect_locked_consolidation_snapshot()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$begin if old.status='locked' then raise exception 'locked consolidation snapshot is immutable' using errcode='23514';end if;return new;end;$function$;

CREATE OR REPLACE FUNCTION private.protect_locked_management_report_pack()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$begin if old.status='locked' then raise exception 'locked management report pack is immutable' using errcode='23514';end if;new.updated_at:=now();return new;end;$function$;

CREATE OR REPLACE FUNCTION private.protect_posted_gl_lines()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare entry_status public.gl_entry_status;
begin select status into entry_status from public.gl_journal_entries where id=coalesce(new.journal_entry_id,old.journal_entry_id);if entry_status<>'draft' then raise exception 'posted journal lines are immutable' using errcode='23514';end if;return coalesce(new,old);end;$function$;

CREATE OR REPLACE FUNCTION private.protect_resolved_monitoring_exception()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$begin if old.status='resolved'then raise exception 'resolved monitoring exception is immutable' using errcode='23514';end if;new.updated_at:=now();return new;end;$function$;

CREATE OR REPLACE FUNCTION private.protect_risk_review()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$begin raise exception 'risk review is immutable' using errcode='23514';end;$function$;

CREATE OR REPLACE FUNCTION private.protect_terminal_compliance_filing()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$begin if old.status in('submitted','waived')then raise exception 'terminal compliance filing is immutable' using errcode='23514';end if;new.updated_at:=now();return new;end;$function$;

CREATE OR REPLACE FUNCTION private.protect_terminal_monitoring_run()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$begin if old.status in('completed','failed')then raise exception 'completed monitoring run is immutable' using errcode='23514';end if;return new;end;$function$;

CREATE OR REPLACE FUNCTION private.refresh_cost_center_entry(target_entry_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare scoped_entry public.gl_journal_entries%rowtype;source record;rule record;inserted integer:=0;source_amount bigint;
begin
 if (select auth.uid()) is null or not private.is_platform_administrator() then raise exception 'platform administrator access required' using errcode='42501';end if;
 select * into scoped_entry from public.gl_journal_entries where id=target_entry_id;if not found or scoped_entry.status not in('posted','reversed') then return 0;end if;
 delete from public.cost_center_allocations allocation where allocation.journal_entry_id=scoped_entry.id;
 for source in select line.id line_id,line.account_id,account.category,account.normal_balance,line.debit_minor,line.credit_minor from public.gl_journal_lines line join public.gl_accounts account on account.id=line.account_id where line.journal_entry_id=scoped_entry.id and account.category in('revenue','expense') loop
  source_amount:=case when source.normal_balance='debit' then source.debit_minor-source.credit_minor else source.credit_minor-source.debit_minor end;
  for rule in select allocation_rule.id,allocation_rule.cost_center_id,allocation_rule.allocation_bps from public.cost_center_allocation_rules allocation_rule join public.cost_centers center on center.id=allocation_rule.cost_center_id where allocation_rule.account_id=source.account_id and allocation_rule.academy_id=scoped_entry.academy_id and center.active and allocation_rule.effective_from<=scoped_entry.entry_date and (allocation_rule.effective_to is null or allocation_rule.effective_to>=scoped_entry.entry_date) order by allocation_rule.id loop
   insert into public.cost_center_allocations(academy_id,journal_entry_id,journal_line_id,account_id,cost_center_id,rule_id,entry_date,currency,source_amount_minor,allocated_minor,allocation_bps)
   values(scoped_entry.academy_id,scoped_entry.id,source.line_id,source.account_id,rule.cost_center_id,rule.id,scoped_entry.entry_date,scoped_entry.currency,source_amount,round(source_amount*rule.allocation_bps/10000.0)::bigint,rule.allocation_bps);inserted:=inserted+1;
  end loop;
 end loop;return inserted;
end;
$function$;

CREATE OR REPLACE FUNCTION private.refresh_feed_stock_alert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if new.active and new.quantity_on_hand <= new.reorder_threshold then
    insert into public.feed_stock_alerts as alert (
      item_id, academy_id, status, quantity_on_hand, reorder_threshold,
      triggered_at, resolved_at, updated_at
    ) values (
      new.id, new.academy_id, 'open', new.quantity_on_hand, new.reorder_threshold,
      now(), null, now()
    )
    on conflict (item_id) do update
    set academy_id = excluded.academy_id,
        status = 'open',
        quantity_on_hand = excluded.quantity_on_hand,
        reorder_threshold = excluded.reorder_threshold,
        triggered_at = case when alert.status = 'resolved' then now() else alert.triggered_at end,
        resolved_at = null,
        updated_at = now();
  else
    update public.feed_stock_alerts
    set status = 'resolved', quantity_on_hand = new.quantity_on_hand,
        reorder_threshold = new.reorder_threshold, resolved_at = now(), updated_at = now()
    where item_id = new.id and status = 'open';
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION private.restore_lesson_credit(target_academy_id uuid, target_rider_user_id uuid, target_booking_id uuid, actor_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not exists (
    select 1 from public.billing_ledger_entries
    where lesson_booking_id = target_booking_id and entry_type = 'credit_consumption'
  ) or exists (
    select 1 from public.billing_ledger_entries
    where lesson_booking_id = target_booking_id and entry_type = 'credit_restoration'
  ) then return; end if;

  update public.lesson_credit_accounts
  set balance = balance + 1, updated_at = now()
  where academy_id = target_academy_id and rider_user_id = target_rider_user_id;

  insert into public.billing_ledger_entries (
    academy_id, rider_user_id, lesson_booking_id, entry_type, credit_delta, note, created_by
  ) values (
    target_academy_id, target_rider_user_id, target_booking_id,
    'credit_restoration', 1, 'Credit restored after eligible cancellation', actor_id
  );
end;
$function$;

CREATE OR REPLACE FUNCTION private.run_continuous_controls_monitoring(target_trigger text DEFAULT 'scheduled'::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare actor uuid:=(select auth.uid());generated_run_id uuid;rule record;signal record;generated_exception_id uuid;generated_finding_id uuid;rules_count integer:=0;exceptions_count integer:=0;findings_count integer:=0;cycle date:=date_trunc('month',current_date)::date;
begin
 if target_trigger not in('scheduled','manual')then raise exception 'invalid monitoring trigger' using errcode='22023';end if;
 if actor is not null and not private.is_platform_administrator()then raise exception 'platform administrator access required' using errcode='42501';end if;
 if actor is null and session_user<>'postgres'then raise exception 'trusted scheduler required' using errcode='42501';end if;
 if not pg_try_advisory_xact_lock(hashtextextended('equivista-continuous-controls',0))then raise exception 'continuous monitoring is already running' using errcode='55P03';end if;
 insert into public.continuous_monitoring_runs(trigger_type,status,created_by)values(target_trigger,'running',actor)returning id into generated_run_id;
 for rule in select * from public.continuous_monitoring_rules where enabled order by academy_id,rule_key loop
  rules_count:=rules_count+1;
  for signal in
   select * from(
    select 'audit_control_test'::text source_type,test.id source_id,('Overdue control test · '||control.control_code)::text title,('Control test due '||test.due_on||' remains '||test.status||'.')::text details
    from public.audit_control_tests test join public.audit_control_definitions control on control.id=test.control_id where rule.rule_key='control_test_overdue'and control.academy_id=rule.academy_id and test.status in('planned','in_progress')and test.due_on<current_date-rule.threshold_days
    union all select 'bank_statement_line',line.id,('Unreconciled bank line · '||line.account_label),('Transaction dated '||line.transaction_date||' for '||line.amount_minor||' '||line.currency||' remains unmatched.') from public.bank_statement_lines line where rule.rule_key='bank_unreconciled'and line.academy_id=rule.academy_id and line.status='unmatched'and line.transaction_date<current_date-rule.threshold_days
    union all select 'supplier_payment_run',pay.id,('Supplier payment overdue · '||pay.run_number),('Approved payment scheduled for '||pay.scheduled_on||' remains unpaid.') from public.supplier_payment_runs pay where rule.rule_key='supplier_payment_past_due'and pay.academy_id=rule.academy_id and pay.status='approved'and pay.scheduled_on<current_date-rule.threshold_days
    union all select 'academy_monthly_budget',budget.id,('Financial close overdue · '||budget.month_start),('Approved budget period '||budget.month_start||' has no completed financial close.') from public.academy_monthly_budgets budget where rule.rule_key='financial_close_overdue'and budget.academy_id=rule.academy_id and budget.status='approved'and current_date>(budget.month_start+interval '1 month'+make_interval(days=>rule.threshold_days))::date and not exists(select 1 from public.financial_close_periods close where close.budget_id=budget.id and close.status='closed')
    union all select 'vat_return',vat.id,('VAT return overdue · '||vat.period_ends_on),('VAT return ending '||vat.period_ends_on||' remains draft beyond the filing window.') from public.vat_returns vat where rule.rule_key='vat_return_overdue'and vat.academy_id=rule.academy_id and vat.status='draft'and current_date>vat.period_ends_on+rule.threshold_days
   )detected
  loop
   generated_exception_id:=null;generated_finding_id:=null;
   insert into public.continuous_monitoring_exceptions(rule_id,run_id,academy_id,control_id,source_entity_type,source_entity_id,detected_period,title,details,severity,assigned_to,created_by,updated_by)
   values(rule.id,generated_run_id,rule.academy_id,rule.control_id,signal.source_type,signal.source_id,cycle,signal.title,signal.details,rule.severity,rule.owner_user_id,actor,actor)
   on conflict(rule_id,source_entity_type,source_entity_id,detected_period)do update set run_id=excluded.run_id,last_detected_at=now(),occurrence_count=public.continuous_monitoring_exceptions.occurrence_count+1,updated_by=actor,updated_at=now()
   where public.continuous_monitoring_exceptions.status<>'resolved'
   returning id,finding_id into generated_exception_id,generated_finding_id;
   if generated_exception_id is null then continue;end if;
   exceptions_count:=exceptions_count+1;
   if generated_finding_id is null then
    insert into public.audit_findings(academy_id,control_id,severity,title,details,recommendation,owner_user_id,target_date,status,origin,monitoring_exception_id,created_by,updated_by)
    values(rule.academy_id,rule.control_id,rule.severity,signal.title,signal.details,'Investigate the source record, correct the control failure, retain evidence, and submit the remediation for review.',rule.owner_user_id,current_date+case rule.severity when'critical'then 3 when'high'then 7 when'medium'then 14 else 30 end,'open','automated',generated_exception_id,null,null)returning id into generated_finding_id;
    update public.continuous_monitoring_exceptions set finding_id=generated_finding_id where id=generated_exception_id;findings_count:=findings_count+1;
   end if;
  end loop;
 end loop;
 update public.continuous_monitoring_runs set status='completed',finished_at=now(),rules_evaluated=rules_count,exceptions_detected=exceptions_count,new_findings_created=findings_count where id=generated_run_id;
 return generated_run_id;
exception when others then
 if generated_run_id is not null then update public.continuous_monitoring_runs set status='failed',finished_at=now(),rules_evaluated=rules_count,exceptions_detected=exceptions_count,new_findings_created=findings_count,error_message=left(sqlerrm,1000)where id=generated_run_id;return generated_run_id;end if;raise;
end;$function$;

CREATE OR REPLACE FUNCTION private.touch_horse_welfare_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION private.touch_lesson_booking_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION private.touch_lesson_report_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION private.touch_lesson_session_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION private.touch_rider_pathway_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION private.valid_riding_analysis_timeline(target_metrics jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
declare event jsonb;point jsonb;start_value numeric;peak_value numeric;end_value numeric;coordinate numeric;
begin
 if jsonb_typeof(target_metrics->'timeline')<>'array' or jsonb_array_length(target_metrics->'timeline')>100 then return false;end if;
 for event in select value from jsonb_array_elements(target_metrics->'timeline')loop
  if jsonb_typeof(event)<>'object' or not(event?&array['code','title','severity','confidence','start_seconds','peak_seconds','end_seconds','frame_index','overlay']) or event->>'severity'not in('high','moderate','low') or jsonb_typeof(event->'confidence')<>'number' or jsonb_typeof(event->'start_seconds')<>'number' or jsonb_typeof(event->'peak_seconds')<>'number' or jsonb_typeof(event->'end_seconds')<>'number' or jsonb_typeof(event->'frame_index')<>'number' or jsonb_typeof(event->'overlay')<>'object' or jsonb_typeof(event->'overlay'->'points')<>'array' or jsonb_array_length(event->'overlay'->'points')not between 4 and 16 then return false;end if;
  start_value:=(event->>'start_seconds')::numeric;peak_value:=(event->>'peak_seconds')::numeric;end_value:=(event->>'end_seconds')::numeric;
  if start_value<0 or peak_value<start_value or end_value<peak_value or end_value-start_value>5 or(event->>'confidence')::numeric not between 0 and 100 or(event->>'frame_index')::numeric<0 or char_length(event->>'code')not between 3 and 80 or char_length(event->>'title')not between 5 and 180 then return false;end if;
  for point in select value from jsonb_array_elements(event->'overlay'->'points')loop
   if jsonb_typeof(point)<>'object' or not(point?&array['name','x','y']) or jsonb_typeof(point->'x')<>'number' or jsonb_typeof(point->'y')<>'number' or(point?'visibility'and jsonb_typeof(point->'visibility')<>'number')then return false;end if;
   coordinate:=(point->>'x')::numeric;if coordinate not between 0 and 1 then return false;end if;coordinate:=(point->>'y')::numeric;if coordinate not between 0 and 1 then return false;end if;
   if point?'visibility'and(point->>'visibility')::numeric not between 0 and 1 then return false;end if;
  end loop;
 end loop;
 return true;
exception when others then return false;
end;$function$;

CREATE OR REPLACE FUNCTION private.validate_coach_rider_assignment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not exists (
    select 1
    from public.academy_memberships membership
    where membership.academy_id = new.academy_id
      and membership.user_id = new.coach_user_id
      and membership.role = 'coach'
      and membership.status = 'active'
  ) then
    raise exception 'coach must have an active academy membership'
      using errcode = '23514';
  end if;

  if not exists (
    select 1
    from public.academy_memberships membership
    where membership.academy_id = new.academy_id
      and membership.user_id = new.rider_user_id
      and membership.role = 'rider'
      and membership.status = 'active'
  ) then
    raise exception 'rider must have an active academy membership'
      using errcode = '23514';
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION private.validate_cost_center_scope()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
 if new.linked_horse_id is not null and not exists(select 1 from public.horses where id=new.linked_horse_id and academy_id=new.academy_id) then raise exception 'linked horse must belong to academy' using errcode='23514';end if;new.updated_at:=now();return new;
end;$function$;

CREATE OR REPLACE FUNCTION private.validate_financial_budget_line_write()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare scoped_plan public.financial_budget_plans%rowtype;scoped_account public.gl_accounts%rowtype;
begin
 select * into scoped_plan from public.financial_budget_plans where id=new.plan_id;
 select * into scoped_account from public.gl_accounts where id=new.account_id;
 if scoped_plan.id is null or scoped_plan.status<>'draft' then raise exception 'draft budget plan required' using errcode='23514';end if;
 if scoped_plan.academy_id<>new.academy_id or scoped_account.academy_id<>new.academy_id or scoped_account.category not in('revenue','expense') then raise exception 'budget account scope is invalid' using errcode='23514';end if;
 if extract(year from new.month_start)::integer<>scoped_plan.fiscal_year then raise exception 'budget month must match fiscal year' using errcode='23514';end if;
 new.updated_at:=now();return new;
end;$function$;

CREATE OR REPLACE FUNCTION private.validate_financial_budget_plan_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
 if old.status='approved' and new.status='superseded' and row(old.academy_id,old.fiscal_year,old.version,old.name,old.currency,old.variance_threshold_bps,old.note,old.created_by,old.approved_by,old.approved_at) is distinct from row(new.academy_id,new.fiscal_year,new.version,new.name,new.currency,new.variance_threshold_bps,new.note,new.created_by,new.approved_by,new.approved_at) then raise exception 'approved budget plan is immutable' using errcode='23514';end if;
 if old.status<>'draft' and not(old.status='approved' and new.status='superseded') then raise exception 'approved budget plan is immutable' using errcode='23514';end if;
 if old.status='draft' and new.status not in('draft','approved') then raise exception 'invalid budget status transition' using errcode='23514';end if;
 new.updated_at:=now();return new;
end;$function$;

CREATE OR REPLACE FUNCTION private.validate_gl_entry_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare debits bigint;credits bigint;line_count integer;
begin
 if tg_op='UPDATE' then
  if old.status in('posted','reversed') and new.status<>(case when old.status='posted' then 'reversed'::public.gl_entry_status else old.status end) then raise exception 'posted journal entries are immutable' using errcode='23514';end if;
 end if;
 if new.status='posted' and (tg_op='INSERT' or (tg_op='UPDATE' and old.status='draft')) then
  select count(*),coalesce(sum(debit_minor),0),coalesce(sum(credit_minor),0) into line_count,debits,credits from public.gl_journal_lines where journal_entry_id=new.id;
  if line_count<2 or debits<=0 or debits<>credits then raise exception 'journal entry must contain at least two balanced lines' using errcode='23514';end if;
 end if;return new;
end;$function$;

CREATE OR REPLACE FUNCTION private.validate_horse_welfare_check()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  scoped_horse public.horses%rowtype;
begin
  select *
  into scoped_horse
  from public.horses
  where id = new.horse_id;

  if scoped_horse.id is null then
    raise exception 'Horse does not exist'
      using errcode = '23514';
  end if;

  if scoped_horse.academy_id <> new.academy_id then
    raise exception 'Welfare check must match the horse academy'
      using errcode = '23514';
  end if;

  if new.checked_at > now() + interval '5 minutes' then
    raise exception 'Welfare check time cannot be in the future'
      using errcode = '23514';
  end if;

  if tg_op = 'INSERT' then
    if new.recorded_by <> (select auth.uid())
      or not private.has_academy_role(
        new.academy_id,
        array['academy_admin', 'coach']::public.app_role[]
      )
    then
      raise exception 'Only Academy Admins and coaches may record welfare checks'
        using errcode = '42501';
    end if;
  else
    if new.academy_id <> old.academy_id
      or new.horse_id <> old.horse_id
      or new.recorded_by <> old.recorded_by
    then
      raise exception 'Welfare check ownership and scope cannot be changed'
        using errcode = '23514';
    end if;

    if not (
      private.has_academy_role(
        new.academy_id,
        array['academy_admin']::public.app_role[]
      )
      or (
        new.recorded_by = (select auth.uid())
        and private.has_academy_role(
          new.academy_id,
          array['coach']::public.app_role[]
        )
      )
    ) then
      raise exception 'Only an Academy Admin or the coach who recorded the check may update it'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION private.validate_lesson_report_scope()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  lesson public.lesson_sessions%rowtype;
begin
  select *
  into lesson
  from public.lesson_sessions
  where id = new.lesson_session_id;

  if lesson.id is null then
    raise exception 'Lesson does not exist'
      using errcode = '23514';
  end if;

  if lesson.academy_id <> new.academy_id
    or lesson.rider_user_id is null
    or lesson.rider_user_id <> new.rider_user_id
  then
    raise exception 'Report must match the lesson academy and assigned rider'
      using errcode = '23514';
  end if;

  if lesson.status <> 'completed'::public.lesson_status then
    raise exception 'Progress reports require a completed lesson'
      using errcode = '23514';
  end if;

  if new.author_user_id <> (select auth.uid())
    or not private.can_write_lesson_report(new.lesson_session_id)
  then
    raise exception 'Only the Academy Admin or assigned coach may write this report'
      using errcode = '42501';
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION private.validate_lesson_session_scope()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if new.horse_id is not null and not exists (
    select 1
    from public.horses horse
    where horse.id = new.horse_id
      and horse.academy_id = new.academy_id
  ) then
    raise exception 'Horse must belong to the lesson academy'
      using errcode = '23514';
  end if;

  if new.coach_user_id is not null and not exists (
    select 1
    from public.academy_memberships membership
    where membership.academy_id = new.academy_id
      and membership.user_id = new.coach_user_id
      and membership.role = 'coach'
      and membership.status = 'active'
  ) then
    raise exception 'Coach must have an active coach membership in the lesson academy'
      using errcode = '23514';
  end if;

  if new.rider_user_id is not null and not exists (
    select 1
    from public.academy_memberships membership
    where membership.academy_id = new.academy_id
      and membership.user_id = new.rider_user_id
      and membership.role = 'rider'
      and membership.status = 'active'
  ) then
    raise exception 'Rider must have an active rider membership in the lesson academy'
      using errcode = '23514';
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION private.validate_parent_rider_link()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not exists (
    select 1
    from public.academy_memberships membership
    where membership.academy_id = new.academy_id
      and membership.user_id = new.parent_user_id
      and membership.role = 'parent'
      and membership.status = 'active'
  ) then
    raise exception 'parent must have an active academy membership'
      using errcode = '23514';
  end if;

  if not exists (
    select 1
    from public.academy_memberships membership
    where membership.academy_id = new.academy_id
      and membership.user_id = new.rider_user_id
      and membership.role = 'rider'
      and membership.status = 'active'
  ) then
    raise exception 'rider must have an active academy membership'
      using errcode = '23514';
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION private.validate_rider_pathway_assessment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not exists (
    select 1
    from public.academy_memberships rider
    where rider.academy_id = new.academy_id
      and rider.user_id = new.rider_user_id
      and rider.role = 'rider'::public.app_role
      and rider.status = 'active'::public.membership_status
  ) then
    raise exception 'Assessment requires an active academy rider'
      using errcode = '23514';
  end if;

  if new.assessed_at > now() + interval '5 minutes' then
    raise exception 'Assessment time cannot be in the future'
      using errcode = '23514';
  end if;

  if tg_op = 'INSERT' then
    if new.assessed_by <> (select auth.uid())
      or not private.can_write_rider_pathway(
        new.academy_id,
        new.rider_user_id
      )
    then
      raise exception 'Only an Academy Admin or assigned coach may assess this rider'
        using errcode = '42501';
    end if;
  else
    if new.academy_id <> old.academy_id
      or new.rider_user_id <> old.rider_user_id
      or new.assessed_by <> old.assessed_by
    then
      raise exception 'Assessment ownership and scope cannot be changed'
        using errcode = '23514';
    end if;

    if not (
      private.has_academy_role(
        new.academy_id,
        array['academy_admin']::public.app_role[]
      )
      or (
        new.assessed_by = (select auth.uid())
        and private.can_write_rider_pathway(
          new.academy_id,
          new.rider_user_id
        )
      )
    ) then
      raise exception 'Only an Academy Admin or the assessing coach may update this assessment'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION private.validate_staff_time_entry_write()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare actor uuid := (select auth.uid()); administrator boolean := private.is_platform_administrator(); scoped_shift public.staff_shifts%rowtype;
begin
  if actor is null then raise exception 'authentication required' using errcode='42501'; end if;
  select * into scoped_shift from public.staff_shifts where id=new.shift_id;
  if not found or scoped_shift.academy_id<>new.academy_id or scoped_shift.staff_user_id<>new.staff_user_id then raise exception 'time entry must match its shift' using errcode='23514'; end if;
  if administrator then return new; end if;
  if tg_op='INSERT' then
    if new.staff_user_id<>actor or scoped_shift.status<>'scheduled' or new.status<>'open' or new.clock_out_at is not null or new.break_minutes<>0 or new.correction_note is not null or new.reviewed_by is not null or new.reviewed_at is not null or new.created_by<>actor or new.updated_by<>actor or new.clock_in_at not between now()-interval '1 minute' and now()+interval '1 minute' then raise exception 'staff may only clock in to their assigned shift' using errcode='42501'; end if;
  elsif old.staff_user_id<>actor or new.staff_user_id<>old.staff_user_id or new.academy_id<>old.academy_id or new.shift_id<>old.shift_id or new.clock_in_at<>old.clock_in_at or old.status<>'open' or new.status<>'submitted' or old.clock_out_at is not null or new.clock_out_at not between now()-interval '1 minute' and now()+interval '1 minute' or new.break_minutes<>old.break_minutes or new.correction_note is distinct from old.correction_note or new.reviewed_by is distinct from old.reviewed_by or new.reviewed_at is distinct from old.reviewed_at or new.created_by<>old.created_by or new.created_at<>old.created_at or new.updated_by<>actor then
    raise exception 'staff may only clock out their own open entry' using errcode='42501';
  end if;
  return new;
end; $function$;

CREATE OR REPLACE FUNCTION private.write_worker_audit_event(target_academy_id uuid, target_actor_user_id uuid, event_action text, event_entity_type text, event_entity_id uuid, event_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare audit_id bigint;
begin
  if current_user not in ('postgres', 'service_role') then
    raise exception 'Worker access required' using errcode = '42501';
  end if;
  if target_academy_id is null or target_actor_user_id is null then
    raise exception 'Worker audit scope required' using errcode = '22023';
  end if;
  if jsonb_typeof(event_metadata) <> 'object' then
    raise exception 'Audit metadata must be an object' using errcode = '22023';
  end if;
  insert into public.audit_events(academy_id, actor_user_id, action, entity_type, entity_id, metadata)
  values(target_academy_id, target_actor_user_id, event_action, event_entity_type, event_entity_id, event_metadata)
  returning id into audit_id;
  return audit_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.create_organization(p_name text, p_slug text, p_organization_type text)
 RETURNS uuid
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  select private.phase_0b2_create_organization(p_name, p_slug, p_organization_type);
$function$;

CREATE OR REPLACE FUNCTION public.get_organization_members(p_organization_id uuid)
 RETURNS TABLE(membership_id uuid, user_id uuid, email text, full_name text, status text, roles text[], joined_at timestamp with time zone)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select *
  from private.phase_0b2_get_organization_members(p_organization_id);
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;

  insert into public.notification_prefs (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end
$function$;

CREATE OR REPLACE FUNCTION public.manage_organization_member(p_organization_id uuid, p_email text, p_status text, p_roles text[])
 RETURNS uuid
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  select private.phase_0b2_manage_organization_member(
    p_organization_id,
    p_email,
    p_status,
    p_roles
  );
$function$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  new.updated_at = pg_catalog.now();
  return new;
end
$function$;

CREATE OR REPLACE FUNCTION public.update_organization_name(p_organization_id uuid, p_name text)
 RETURNS void
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  select private.phase_0b2_update_organization_name(p_organization_id, p_name);
$function$;

-- Triggers, including the auth.users profile bootstrap trigger

drop trigger if exists on_auth_user_created on auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();

drop trigger if exists coach_rider_assignments_set_updated_at on public.coach_rider_assignments;
CREATE TRIGGER coach_rider_assignments_set_updated_at BEFORE UPDATE ON coach_rider_assignments FOR EACH ROW EXECUTE FUNCTION set_updated_at();

drop trigger if exists guardian_riders_set_updated_at on public.guardian_riders;
CREATE TRIGGER guardian_riders_set_updated_at BEFORE UPDATE ON guardian_riders FOR EACH ROW EXECUTE FUNCTION set_updated_at();

drop trigger if exists horse_access_assignments_set_updated_at on public.horse_access_assignments;
CREATE TRIGGER horse_access_assignments_set_updated_at BEFORE UPDATE ON horse_access_assignments FOR EACH ROW EXECUTE FUNCTION set_updated_at();

drop trigger if exists trg_horses_updated on public.horses;
CREATE TRIGGER trg_horses_updated BEFORE UPDATE ON horses FOR EACH ROW EXECUTE FUNCTION set_updated_at();

drop trigger if exists trg_invoices_updated on public.invoices;
CREATE TRIGGER trg_invoices_updated BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION set_updated_at();

drop trigger if exists trg_lessons_updated on public.lessons;
CREATE TRIGGER trg_lessons_updated BEFORE UPDATE ON lessons FOR EACH ROW EXECUTE FUNCTION set_updated_at();

drop trigger if exists trg_memberships_updated on public.memberships;
CREATE TRIGGER trg_memberships_updated BEFORE UPDATE ON memberships FOR EACH ROW EXECUTE FUNCTION set_updated_at();

drop trigger if exists notification_outbox_set_updated_at on public.notification_outbox;
CREATE TRIGGER notification_outbox_set_updated_at BEFORE UPDATE ON notification_outbox FOR EACH ROW EXECUTE FUNCTION set_updated_at();

drop trigger if exists trg_notification_prefs_updated on public.notification_prefs;
CREATE TRIGGER trg_notification_prefs_updated BEFORE UPDATE ON notification_prefs FOR EACH ROW EXECUTE FUNCTION set_updated_at();

drop trigger if exists organization_memberships_set_updated_at on public.organization_memberships;
CREATE TRIGGER organization_memberships_set_updated_at BEFORE UPDATE ON organization_memberships FOR EACH ROW EXECUTE FUNCTION set_updated_at();

drop trigger if exists organizations_set_updated_at on public.organizations;
CREATE TRIGGER organizations_set_updated_at BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION set_updated_at();

drop trigger if exists trg_profiles_updated on public.profiles;
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();

drop trigger if exists trg_analyses_updated on public.video_analyses;
CREATE TRIGGER trg_analyses_updated BEFORE UPDATE ON video_analyses FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Row-level security

alter table public.audit_events enable row level security;
alter table public.coach_rider_assignments enable row level security;
alter table public.documents enable row level security;
alter table public.guardian_riders enable row level security;
alter table public.health_records enable row level security;
alter table public.horse_access_assignments enable row level security;
alter table public.horse_riders enable row level security;
alter table public.horses enable row level security;
alter table public.invoice_lines enable row level security;
alter table public.invoices enable row level security;
alter table public.lessons enable row level security;
alter table public.membership_plans enable row level security;
alter table public.memberships enable row level security;
alter table public.notification_outbox enable row level security;
alter table public.notification_prefs enable row level security;
alter table public.organization_member_roles enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.organizations enable row level security;
alter table public.payment_methods enable row level security;
alter table public.platform_role_assignments enable row level security;
alter table public.profiles enable row level security;
alter table public.training_log enable row level security;
alter table public.video_analyses enable row level security;

-- Application and Storage policies

drop policy if exists audit_events_select_authorized on public.audit_events;
create policy audit_events_select_authorized on public.audit_events as permissive for select to authenticated using (( SELECT private.is_platform_admin() AS is_platform_admin) OR organization_id IS NOT NULL AND ( SELECT private.has_organization_role(audit_events.organization_id, ARRAY['academy_admin'::text, 'accountant'::text]) AS has_organization_role));

drop policy if exists coach_rider_assignments_select_authorized on public.coach_rider_assignments;
create policy coach_rider_assignments_select_authorized on public.coach_rider_assignments as permissive for select to authenticated using (coach_id = (( SELECT auth.uid() AS uid)) OR rider_id = (( SELECT auth.uid() AS uid)) OR ( SELECT private.is_platform_admin() AS is_platform_admin) OR ( SELECT private.has_organization_role(coach_rider_assignments.organization_id, ARRAY['academy_admin'::text, 'stable_manager'::text]) AS has_organization_role));

drop policy if exists documents_access on public.documents;
create policy documents_access on public.documents as permissive for all to authenticated using ((( SELECT auth.uid() AS uid)) = user_id OR (EXISTS ( SELECT 1
   FROM horses h
  WHERE h.id = documents.horse_id AND h.owner_id = (( SELECT auth.uid() AS uid))))) with check ((( SELECT auth.uid() AS uid)) = user_id);

drop policy if exists guardian_riders_select_authorized on public.guardian_riders;
create policy guardian_riders_select_authorized on public.guardian_riders as permissive for select to authenticated using (guardian_id = (( SELECT auth.uid() AS uid)) OR rider_id = (( SELECT auth.uid() AS uid)) OR ( SELECT private.is_platform_admin() AS is_platform_admin) OR ( SELECT private.has_organization_role(guardian_riders.organization_id, ARRAY['academy_admin'::text, 'stable_manager'::text]) AS has_organization_role));

drop policy if exists health_records_access on public.health_records;
create policy health_records_access on public.health_records as permissive for all to authenticated using ((EXISTS ( SELECT 1
   FROM horses h
  WHERE h.id = health_records.horse_id AND h.owner_id = (( SELECT auth.uid() AS uid))))) with check ((EXISTS ( SELECT 1
   FROM horses h
  WHERE h.id = health_records.horse_id AND h.owner_id = (( SELECT auth.uid() AS uid)))));

drop policy if exists horse_access_assignments_select_authorized on public.horse_access_assignments;
create policy horse_access_assignments_select_authorized on public.horse_access_assignments as permissive for select to authenticated using (profile_id = (( SELECT auth.uid() AS uid)) OR ( SELECT private.is_platform_admin() AS is_platform_admin) OR ( SELECT private.has_organization_role(horse_access_assignments.organization_id, ARRAY['academy_admin'::text, 'stable_manager'::text]) AS has_organization_role));

drop policy if exists horse_riders_delete_owner on public.horse_riders;
create policy horse_riders_delete_owner on public.horse_riders as permissive for delete to authenticated using (private.is_horse_owner(horse_id));

drop policy if exists horse_riders_insert_owner on public.horse_riders;
create policy horse_riders_insert_owner on public.horse_riders as permissive for insert to authenticated with check (private.is_horse_owner(horse_id));

drop policy if exists horse_riders_select on public.horse_riders;
create policy horse_riders_select on public.horse_riders as permissive for select to authenticated using (rider_id = (( SELECT auth.uid() AS uid)) OR private.is_horse_owner(horse_id));

drop policy if exists horse_riders_update_owner on public.horse_riders;
create policy horse_riders_update_owner on public.horse_riders as permissive for update to authenticated using (private.is_horse_owner(horse_id)) with check (private.is_horse_owner(horse_id));

drop policy if exists horses_delete_owner on public.horses;
create policy horses_delete_owner on public.horses as permissive for delete to authenticated using (owner_id = (( SELECT auth.uid() AS uid)));

drop policy if exists horses_insert_owner on public.horses;
create policy horses_insert_owner on public.horses as permissive for insert to authenticated with check (owner_id = (( SELECT auth.uid() AS uid)));

drop policy if exists horses_select on public.horses;
create policy horses_select on public.horses as permissive for select to authenticated using (owner_id = (( SELECT auth.uid() AS uid)) OR ( SELECT private.is_horse_rider(horses.id) AS is_horse_rider));

drop policy if exists horses_update_owner on public.horses;
create policy horses_update_owner on public.horses as permissive for update to authenticated using (owner_id = (( SELECT auth.uid() AS uid))) with check (owner_id = (( SELECT auth.uid() AS uid)));

drop policy if exists invoice_lines_select_own on public.invoice_lines;
create policy invoice_lines_select_own on public.invoice_lines as permissive for select to authenticated using ((EXISTS ( SELECT 1
   FROM invoices i
  WHERE i.id = invoice_lines.invoice_id AND i.user_id = (( SELECT auth.uid() AS uid)))));

drop policy if exists invoices_select_own on public.invoices;
create policy invoices_select_own on public.invoices as permissive for select to authenticated using ((( SELECT auth.uid() AS uid)) = user_id);

drop policy if exists lessons_delete_rider on public.lessons;
create policy lessons_delete_rider on public.lessons as permissive for delete to authenticated using ((( SELECT auth.uid() AS uid)) = rider_id);

drop policy if exists lessons_insert_rider on public.lessons;
create policy lessons_insert_rider on public.lessons as permissive for insert to authenticated with check ((( SELECT auth.uid() AS uid)) = rider_id);

drop policy if exists lessons_select on public.lessons;
create policy lessons_select on public.lessons as permissive for select to authenticated using ((( SELECT auth.uid() AS uid)) = rider_id OR (( SELECT auth.uid() AS uid)) = trainer_id);

drop policy if exists lessons_update_participant on public.lessons;
create policy lessons_update_participant on public.lessons as permissive for update to authenticated using ((( SELECT auth.uid() AS uid)) = rider_id OR (( SELECT auth.uid() AS uid)) = trainer_id) with check ((( SELECT auth.uid() AS uid)) = rider_id OR (( SELECT auth.uid() AS uid)) = trainer_id);

drop policy if exists plans_select on public.membership_plans;
create policy plans_select on public.membership_plans as permissive for select to authenticated using (active = true);

drop policy if exists memberships_select_own on public.memberships;
create policy memberships_select_own on public.memberships as permissive for select to authenticated using (user_id = (( SELECT auth.uid() AS uid)));

drop policy if exists notification_outbox_select_authorized on public.notification_outbox;
create policy notification_outbox_select_authorized on public.notification_outbox as permissive for select to authenticated using (recipient_id = (( SELECT auth.uid() AS uid)) OR ( SELECT private.is_platform_admin() AS is_platform_admin) OR organization_id IS NOT NULL AND ( SELECT private.has_organization_role(notification_outbox.organization_id, ARRAY['academy_admin'::text, 'stable_manager'::text]) AS has_organization_role));

drop policy if exists prefs_all_own on public.notification_prefs;
create policy prefs_all_own on public.notification_prefs as permissive for all to authenticated using ((( SELECT auth.uid() AS uid)) = user_id) with check ((( SELECT auth.uid() AS uid)) = user_id);

drop policy if exists organization_member_roles_select_authorized on public.organization_member_roles;
create policy organization_member_roles_select_authorized on public.organization_member_roles as permissive for select to authenticated using ((EXISTS ( SELECT 1
   FROM organization_memberships membership
  WHERE membership.id = organization_member_roles.membership_id AND (membership.user_id = (( SELECT auth.uid() AS uid)) OR ( SELECT private.is_platform_admin() AS is_platform_admin) OR ( SELECT private.has_organization_role(membership.organization_id, ARRAY['academy_admin'::text, 'stable_manager'::text]) AS has_organization_role)))));

drop policy if exists organization_memberships_select_authorized on public.organization_memberships;
create policy organization_memberships_select_authorized on public.organization_memberships as permissive for select to authenticated using (user_id = (( SELECT auth.uid() AS uid)) OR ( SELECT private.is_platform_admin() AS is_platform_admin) OR ( SELECT private.has_organization_role(organization_memberships.organization_id, ARRAY['academy_admin'::text, 'stable_manager'::text]) AS has_organization_role));

drop policy if exists organizations_select_member on public.organizations;
create policy organizations_select_member on public.organizations as permissive for select to authenticated using (( SELECT private.is_platform_admin() AS is_platform_admin) OR ( SELECT private.is_organization_member(organizations.id) AS is_organization_member));

drop policy if exists payment_methods_select_own on public.payment_methods;
create policy payment_methods_select_own on public.payment_methods as permissive for select to authenticated using (user_id = (( SELECT auth.uid() AS uid)));

drop policy if exists platform_roles_select_authorized on public.platform_role_assignments;
create policy platform_roles_select_authorized on public.platform_role_assignments as permissive for select to authenticated using (user_id = (( SELECT auth.uid() AS uid)) OR ( SELECT private.is_platform_admin() AS is_platform_admin));

drop policy if exists profiles_select_authorized on public.profiles;
create policy profiles_select_authorized on public.profiles as permissive for select to authenticated using ((( SELECT auth.uid() AS uid)) = id OR role = 'trainer'::text);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles as permissive for update to authenticated using ((( SELECT auth.uid() AS uid)) = id) with check ((( SELECT auth.uid() AS uid)) = id);

drop policy if exists training_log_access on public.training_log;
create policy training_log_access on public.training_log as permissive for all to authenticated using ((EXISTS ( SELECT 1
   FROM horses h
  WHERE h.id = training_log.horse_id AND (h.owner_id = (( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM horse_riders hr
          WHERE hr.horse_id = h.id AND hr.rider_id = (( SELECT auth.uid() AS uid)))))))) with check (author_id = (( SELECT auth.uid() AS uid)));

drop policy if exists analyses_delete_rider on public.video_analyses;
create policy analyses_delete_rider on public.video_analyses as permissive for delete to authenticated using (rider_id = (( SELECT auth.uid() AS uid)));

drop policy if exists analyses_insert_rider on public.video_analyses;
create policy analyses_insert_rider on public.video_analyses as permissive for insert to authenticated with check (rider_id = (( SELECT auth.uid() AS uid)));

drop policy if exists analyses_select_participant on public.video_analyses;
create policy analyses_select_participant on public.video_analyses as permissive for select to authenticated using (rider_id = (( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM lessons lesson
  WHERE lesson.analysis_id = video_analyses.id AND lesson.trainer_id = (( SELECT auth.uid() AS uid)))));

drop policy if exists analyses_update_rider on public.video_analyses;
create policy analyses_update_rider on public.video_analyses as permissive for update to authenticated using (rider_id = (( SELECT auth.uid() AS uid))) with check (rider_id = (( SELECT auth.uid() AS uid)));

drop policy if exists storage_avatars_public_read on storage.objects;
create policy storage_avatars_public_read on storage.objects as permissive for select to public using (bucket_id = ANY (ARRAY['avatars'::text, 'horse-photos'::text]));

drop policy if exists storage_user_delete_own on storage.objects;
create policy storage_user_delete_own on storage.objects as permissive for delete to public using (auth.role() = 'authenticated'::text AND (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists storage_user_read_own on storage.objects;
create policy storage_user_read_own on storage.objects as permissive for select to public using (auth.role() = 'authenticated'::text AND (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists storage_user_update_own on storage.objects;
create policy storage_user_update_own on storage.objects as permissive for update to public using (auth.role() = 'authenticated'::text AND (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists storage_user_upload on storage.objects;
create policy storage_user_upload on storage.objects as permissive for insert to public with check (auth.role() = 'authenticated'::text AND (storage.foldername(name))[1] = auth.uid()::text);

-- Object privileges

revoke all privileges on schema private from public, anon, authenticated, service_role;
revoke all privileges on schema public from public, anon, authenticated, service_role;

grant USAGE on schema private to authenticated;
grant USAGE on schema private to service_role;
grant CREATE, USAGE on schema public to anon;
grant CREATE, USAGE on schema public to authenticated;
grant CREATE, USAGE on schema public to service_role;

revoke all privileges on table public.audit_events from public, anon, authenticated, service_role;
revoke all privileges on table public.coach_rider_assignments from public, anon, authenticated, service_role;
revoke all privileges on table public.documents from public, anon, authenticated, service_role;
revoke all privileges on table public.guardian_riders from public, anon, authenticated, service_role;
revoke all privileges on table public.health_records from public, anon, authenticated, service_role;
revoke all privileges on table public.horse_access_assignments from public, anon, authenticated, service_role;
revoke all privileges on table public.horse_riders from public, anon, authenticated, service_role;
revoke all privileges on table public.horses from public, anon, authenticated, service_role;
revoke all privileges on table public.invoice_lines from public, anon, authenticated, service_role;
revoke all privileges on sequence public.invoice_number_seq from public, anon, authenticated, service_role;
revoke all privileges on table public.invoices from public, anon, authenticated, service_role;
revoke all privileges on table public.lessons from public, anon, authenticated, service_role;
revoke all privileges on table public.membership_plans from public, anon, authenticated, service_role;
revoke all privileges on table public.memberships from public, anon, authenticated, service_role;
revoke all privileges on table public.notification_outbox from public, anon, authenticated, service_role;
revoke all privileges on table public.notification_prefs from public, anon, authenticated, service_role;
revoke all privileges on table public.organization_member_roles from public, anon, authenticated, service_role;
revoke all privileges on table public.organization_memberships from public, anon, authenticated, service_role;
revoke all privileges on table public.organizations from public, anon, authenticated, service_role;
revoke all privileges on table public.payment_methods from public, anon, authenticated, service_role;
revoke all privileges on table public.platform_role_assignments from public, anon, authenticated, service_role;
revoke all privileges on table public.profiles from public, anon, authenticated, service_role;
revoke all privileges on table public.training_log from public, anon, authenticated, service_role;
revoke all privileges on table public.video_analyses from public, anon, authenticated, service_role;

grant SELECT on table public.audit_events to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.audit_events to service_role;
grant SELECT on table public.coach_rider_assignments to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.coach_rider_assignments to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.documents to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.documents to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.documents to service_role;
grant SELECT on table public.guardian_riders to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.guardian_riders to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.health_records to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.health_records to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.health_records to service_role;
grant SELECT on table public.horse_access_assignments to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.horse_access_assignments to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.horse_riders to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.horse_riders to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.horse_riders to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.horses to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.horses to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.horses to service_role;
grant MAINTAIN, SELECT on table public.invoice_lines to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.invoice_lines to service_role;
grant SELECT, UPDATE, USAGE on sequence public.invoice_number_seq to anon;
grant SELECT, UPDATE, USAGE on sequence public.invoice_number_seq to authenticated;
grant SELECT, UPDATE, USAGE on sequence public.invoice_number_seq to service_role;
grant MAINTAIN, SELECT on table public.invoices to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.invoices to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.lessons to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.lessons to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.lessons to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.membership_plans to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.membership_plans to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.membership_plans to service_role;
grant MAINTAIN, SELECT on table public.memberships to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.memberships to service_role;
grant SELECT on table public.notification_outbox to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.notification_outbox to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.notification_prefs to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.notification_prefs to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.notification_prefs to service_role;
grant SELECT on table public.organization_member_roles to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.organization_member_roles to service_role;
grant SELECT on table public.organization_memberships to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.organization_memberships to service_role;
grant SELECT on table public.organizations to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.organizations to service_role;
grant MAINTAIN on table public.payment_methods to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.payment_methods to service_role;
grant SELECT on table public.platform_role_assignments to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.platform_role_assignments to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.profiles to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.profiles to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.profiles to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.training_log to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.training_log to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.training_log to service_role;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.video_analyses to anon;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.video_analyses to authenticated;
grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on table public.video_analyses to service_role;

revoke all privileges on function private.allocate_cost_center_on_post() from public, anon, authenticated, service_role;
revoke all privileges on function private.audit_action_center_change() from public, anon, authenticated, service_role;
revoke all privileges on function private.audit_conduct_acknowledgement() from public, anon, authenticated, service_role;
revoke all privileges on function private.audit_conduct_policy_change() from public, anon, authenticated, service_role;
revoke all privileges on function private.audit_feed_stock_change() from public, anon, authenticated, service_role;
revoke all privileges on function private.audit_staff_attendance_change() from public, anon, authenticated, service_role;
revoke all privileges on function private.audit_supplier_ledger_change() from public, anon, authenticated, service_role;
revoke all privileges on function private.can_access_lesson_booking(target_academy_id uuid, target_session_id uuid, target_rider_user_id uuid) from public, anon, authenticated, service_role;
revoke all privileges on function private.can_access_lesson_report(target_lesson_session_id uuid) from public, anon, authenticated, service_role;
revoke all privileges on function private.can_access_lesson_session(target_academy_id uuid, target_coach_user_id uuid, target_rider_user_id uuid) from public, anon, authenticated, service_role;
revoke all privileges on function private.can_access_profile(target_user_id uuid) from public, anon, authenticated, service_role;
revoke all privileges on function private.can_access_rider_billing(target_academy_id uuid, target_rider_user_id uuid) from public, anon, authenticated, service_role;
revoke all privileges on function private.can_access_rider_pathway(target_academy_id uuid, target_rider_user_id uuid) from public, anon, authenticated, service_role;
revoke all privileges on function private.can_manage_riding_analysis(target_academy_id uuid, target_rider_id uuid) from public, anon, authenticated, service_role;
revoke all privileges on function private.can_view_approved_riding_analysis(target_academy_id uuid, target_rider_id uuid) from public, anon, authenticated, service_role;
revoke all privileges on function private.can_write_lesson_report(target_lesson_session_id uuid) from public, anon, authenticated, service_role;
revoke all privileges on function private.can_write_rider_pathway(target_academy_id uuid, target_rider_user_id uuid) from public, anon, authenticated, service_role;
revoke all privileges on function private.consume_lesson_credit(target_academy_id uuid, target_rider_user_id uuid, target_booking_id uuid, actor_id uuid) from public, anon, authenticated, service_role;
revoke all privileges on function private.has_operational_assignment(target_academy_id uuid) from public, anon, authenticated, service_role;
revoke all privileges on function private.has_organization_role(p_organization_id uuid, p_roles text[]) from public, anon, authenticated, service_role;
revoke all privileges on function private.is_academy_member(target_academy_id uuid) from public, anon, authenticated, service_role;
revoke all privileges on function private.is_horse_owner(p_horse_id uuid) from public, anon, authenticated, service_role;
revoke all privileges on function private.is_horse_rider(p_horse_id uuid) from public, anon, authenticated, service_role;
revoke all privileges on function private.is_organization_member(p_organization_id uuid) from public, anon, authenticated, service_role;
revoke all privileges on function private.is_platform_admin() from public, anon, authenticated, service_role;
revoke all privileges on function private.is_platform_administrator() from public, anon, authenticated, service_role;
revoke all privileges on function private.is_platform_user() from public, anon, authenticated, service_role;
revoke all privileges on function private.phase_0b2_create_organization(p_name text, p_slug text, p_organization_type text) from public, anon, authenticated, service_role;
revoke all privileges on function private.phase_0b2_get_organization_members(p_organization_id uuid) from public, anon, authenticated, service_role;
revoke all privileges on function private.phase_0b2_is_organization_manager(p_organization_id uuid) from public, anon, authenticated, service_role;
revoke all privileges on function private.phase_0b2_manage_organization_member(p_organization_id uuid, p_email text, p_status text, p_roles text[]) from public, anon, authenticated, service_role;
revoke all privileges on function private.phase_0b2_update_organization_name(p_organization_id uuid, p_name text) from public, anon, authenticated, service_role;
revoke all privileges on function private.protect_closed_audit_finding() from public, anon, authenticated, service_role;
revoke all privileges on function private.protect_closed_compliance_breach() from public, anon, authenticated, service_role;
revoke all privileges on function private.protect_closed_enterprise_risk() from public, anon, authenticated, service_role;
revoke all privileges on function private.protect_completed_audit_engagement() from public, anon, authenticated, service_role;
revoke all privileges on function private.protect_completed_audit_test() from public, anon, authenticated, service_role;
revoke all privileges on function private.protect_fixed_asset_depreciation_history() from public, anon, authenticated, service_role;
revoke all privileges on function private.protect_fixed_asset_financial_fields() from public, anon, authenticated, service_role;
revoke all privileges on function private.protect_locked_consolidation_snapshot() from public, anon, authenticated, service_role;
revoke all privileges on function private.protect_locked_management_report_pack() from public, anon, authenticated, service_role;
revoke all privileges on function private.protect_posted_gl_lines() from public, anon, authenticated, service_role;
revoke all privileges on function private.protect_resolved_monitoring_exception() from public, anon, authenticated, service_role;
revoke all privileges on function private.protect_risk_review() from public, anon, authenticated, service_role;
revoke all privileges on function private.protect_terminal_compliance_filing() from public, anon, authenticated, service_role;
revoke all privileges on function private.protect_terminal_monitoring_run() from public, anon, authenticated, service_role;
revoke all privileges on function private.refresh_cost_center_entry(target_entry_id uuid) from public, anon, authenticated, service_role;
revoke all privileges on function private.refresh_feed_stock_alert() from public, anon, authenticated, service_role;
revoke all privileges on function private.restore_lesson_credit(target_academy_id uuid, target_rider_user_id uuid, target_booking_id uuid, actor_id uuid) from public, anon, authenticated, service_role;
revoke all privileges on function private.run_continuous_controls_monitoring(target_trigger text) from public, anon, authenticated, service_role;
revoke all privileges on function private.touch_horse_welfare_updated_at() from public, anon, authenticated, service_role;
revoke all privileges on function private.touch_lesson_booking_updated_at() from public, anon, authenticated, service_role;
revoke all privileges on function private.touch_lesson_report_updated_at() from public, anon, authenticated, service_role;
revoke all privileges on function private.touch_lesson_session_updated_at() from public, anon, authenticated, service_role;
revoke all privileges on function private.touch_rider_pathway_updated_at() from public, anon, authenticated, service_role;
revoke all privileges on function private.valid_riding_analysis_timeline(target_metrics jsonb) from public, anon, authenticated, service_role;
revoke all privileges on function private.validate_coach_rider_assignment() from public, anon, authenticated, service_role;
revoke all privileges on function private.validate_cost_center_scope() from public, anon, authenticated, service_role;
revoke all privileges on function private.validate_financial_budget_line_write() from public, anon, authenticated, service_role;
revoke all privileges on function private.validate_financial_budget_plan_update() from public, anon, authenticated, service_role;
revoke all privileges on function private.validate_gl_entry_status() from public, anon, authenticated, service_role;
revoke all privileges on function private.validate_horse_welfare_check() from public, anon, authenticated, service_role;
revoke all privileges on function private.validate_lesson_report_scope() from public, anon, authenticated, service_role;
revoke all privileges on function private.validate_lesson_session_scope() from public, anon, authenticated, service_role;
revoke all privileges on function private.validate_parent_rider_link() from public, anon, authenticated, service_role;
revoke all privileges on function private.validate_rider_pathway_assessment() from public, anon, authenticated, service_role;
revoke all privileges on function private.validate_staff_time_entry_write() from public, anon, authenticated, service_role;
revoke all privileges on function private.write_worker_audit_event(target_academy_id uuid, target_actor_user_id uuid, event_action text, event_entity_type text, event_entity_id uuid, event_metadata jsonb) from public, anon, authenticated, service_role;
revoke all privileges on function public.create_organization(p_name text, p_slug text, p_organization_type text) from public, anon, authenticated, service_role;
revoke all privileges on function public.get_organization_members(p_organization_id uuid) from public, anon, authenticated, service_role;
revoke all privileges on function public.handle_new_user() from public, anon, authenticated, service_role;
revoke all privileges on function public.manage_organization_member(p_organization_id uuid, p_email text, p_status text, p_roles text[]) from public, anon, authenticated, service_role;
revoke all privileges on function public.set_updated_at() from public, anon, authenticated, service_role;
revoke all privileges on function public.update_organization_name(p_organization_id uuid, p_name text) from public, anon, authenticated, service_role;

grant EXECUTE on function private.can_access_lesson_booking(target_academy_id uuid, target_session_id uuid, target_rider_user_id uuid) to authenticated;
grant EXECUTE on function private.can_access_lesson_report(target_lesson_session_id uuid) to authenticated;
grant EXECUTE on function private.can_access_lesson_session(target_academy_id uuid, target_coach_user_id uuid, target_rider_user_id uuid) to authenticated;
grant EXECUTE on function private.can_access_profile(target_user_id uuid) to authenticated;
grant EXECUTE on function private.can_access_profile(target_user_id uuid) to public;
grant EXECUTE on function private.can_access_rider_billing(target_academy_id uuid, target_rider_user_id uuid) to authenticated;
grant EXECUTE on function private.can_access_rider_pathway(target_academy_id uuid, target_rider_user_id uuid) to authenticated;
grant EXECUTE on function private.can_manage_riding_analysis(target_academy_id uuid, target_rider_id uuid) to authenticated;
grant EXECUTE on function private.can_view_approved_riding_analysis(target_academy_id uuid, target_rider_id uuid) to authenticated;
grant EXECUTE on function private.can_write_lesson_report(target_lesson_session_id uuid) to authenticated;
grant EXECUTE on function private.can_write_rider_pathway(target_academy_id uuid, target_rider_user_id uuid) to authenticated;
grant EXECUTE on function private.has_operational_assignment(target_academy_id uuid) to authenticated;
grant EXECUTE on function private.has_operational_assignment(target_academy_id uuid) to public;
grant EXECUTE on function private.has_organization_role(p_organization_id uuid, p_roles text[]) to authenticated;
grant EXECUTE on function private.is_academy_member(target_academy_id uuid) to authenticated;
grant EXECUTE on function private.is_academy_member(target_academy_id uuid) to public;
grant EXECUTE on function private.is_horse_owner(p_horse_id uuid) to authenticated;
grant EXECUTE on function private.is_horse_rider(p_horse_id uuid) to authenticated;
grant EXECUTE on function private.is_organization_member(p_organization_id uuid) to authenticated;
grant EXECUTE on function private.is_platform_admin() to authenticated;
grant EXECUTE on function private.is_platform_administrator() to authenticated;
grant EXECUTE on function private.is_platform_administrator() to public;
grant EXECUTE on function private.is_platform_user() to authenticated;
grant EXECUTE on function private.is_platform_user() to public;
grant EXECUTE on function private.phase_0b2_create_organization(p_name text, p_slug text, p_organization_type text) to authenticated;
grant EXECUTE on function private.phase_0b2_get_organization_members(p_organization_id uuid) to authenticated;
grant EXECUTE on function private.phase_0b2_is_organization_manager(p_organization_id uuid) to authenticated;
grant EXECUTE on function private.phase_0b2_manage_organization_member(p_organization_id uuid, p_email text, p_status text, p_roles text[]) to authenticated;
grant EXECUTE on function private.phase_0b2_update_organization_name(p_organization_id uuid, p_name text) to authenticated;
grant EXECUTE on function private.refresh_cost_center_entry(target_entry_id uuid) to authenticated;
grant EXECUTE on function private.run_continuous_controls_monitoring(target_trigger text) to authenticated;
grant EXECUTE on function private.validate_financial_budget_line_write() to public;
grant EXECUTE on function private.validate_financial_budget_plan_update() to public;
grant EXECUTE on function public.create_organization(p_name text, p_slug text, p_organization_type text) to authenticated;
grant EXECUTE on function public.get_organization_members(p_organization_id uuid) to authenticated;
grant EXECUTE on function public.handle_new_user() to service_role;
grant EXECUTE on function public.manage_organization_member(p_organization_id uuid, p_email text, p_status text, p_roles text[]) to authenticated;
grant EXECUTE on function public.set_updated_at() to service_role;
grant EXECUTE on function public.update_organization_name(p_organization_id uuid, p_name text) to authenticated;

-- Default privileges

alter default privileges for role postgres in schema public revoke all on sequences from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema public revoke all on functions from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema public revoke all on tables from public, anon, authenticated, service_role;

alter default privileges for role postgres in schema public grant SELECT, UPDATE, USAGE on sequences to anon;
alter default privileges for role postgres in schema public grant SELECT, UPDATE, USAGE on sequences to authenticated;
alter default privileges for role postgres in schema public grant SELECT, UPDATE, USAGE on sequences to service_role;
alter default privileges for role postgres in schema public grant EXECUTE on functions to anon;
alter default privileges for role postgres in schema public grant EXECUTE on functions to authenticated;
alter default privileges for role postgres in schema public grant EXECUTE on functions to service_role;
alter default privileges for role postgres in schema public grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on tables to anon;
alter default privileges for role postgres in schema public grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on tables to authenticated;
alter default privileges for role postgres in schema public grant DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on tables to service_role;

-- Comments

comment on table public.audit_events is 'Append-only audit metadata. Never store secrets, tokens, national IDs, or full provider payloads.';

reset check_function_bodies;
reset client_min_messages;
