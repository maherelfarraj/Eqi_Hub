-- Phase 0B.1: additive organization tenancy, multi-role RBAC, relationship,
-- audit, and notification foundations. Existing business rows remain legacy
-- rows with organization_id = null; this migration performs no data backfill.

begin;

do $preflight$
declare
  object_name text;
begin
  foreach object_name in array array[
    'public.profiles',
    'public.horses',
    'public.lessons',
    'public.video_analyses',
    'public.membership_plans',
    'public.memberships',
    'public.invoices'
  ] loop
    if to_regclass(object_name) is null then
      raise exception 'Phase 0B.1 preflight failed: % is missing', object_name;
    end if;
  end loop;

  if to_regnamespace('private') is null
     or to_regprocedure('public.set_updated_at()') is null
     or to_regprocedure('private.is_horse_owner(uuid)') is null
     or to_regprocedure('private.is_horse_rider(uuid)') is null then
    raise exception 'Phase 0B.1 preflight failed: Phase 0A.2 is not present';
  end if;

  foreach object_name in array array[
    'public.platform_role_assignments',
    'public.organizations',
    'public.organization_memberships',
    'public.organization_member_roles',
    'public.guardian_riders',
    'public.coach_rider_assignments',
    'public.horse_access_assignments',
    'public.audit_events',
    'public.notification_outbox'
  ] loop
    if to_regclass(object_name) is not null then
      raise exception 'Phase 0B.1 preflight failed: % already exists', object_name;
    end if;
  end loop;
end
$preflight$;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 2 and 160),
  slug text not null unique check (
    slug = lower(slug)
    and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  ),
  organization_type text not null check (
    organization_type in (
      'academy', 'stable', 'federation', 'competition_center',
      'private_trainer'
    )
  ),
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.platform_role_assignments (
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role = 'platform_admin'),
  assigned_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

create table public.organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'active' check (
    status in ('invited', 'active', 'suspended', 'left')
  ),
  invited_by uuid references public.profiles(id) on delete set null,
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id),
  unique (id, organization_id)
);

create table public.organization_member_roles (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null references public.organization_memberships(id) on delete cascade,
  role text not null check (
    role in (
      'academy_admin', 'coach', 'rider', 'guardian', 'horse_owner',
      'stable_manager', 'accountant', 'competition_manager'
    )
  ),
  assigned_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (membership_id, role)
);

-- Add nullable tenant keys without reclassifying or rewriting legacy rows.
alter table public.horses
  add column organization_id uuid references public.organizations(id) on delete restrict,
  add constraint horses_id_organization_unique unique (id, organization_id),
  add constraint horses_owner_organization_membership_fkey
    foreign key (organization_id, owner_id)
    references public.organization_memberships(organization_id, user_id)
    on delete restrict;

alter table public.video_analyses
  add column organization_id uuid references public.organizations(id) on delete restrict,
  add constraint video_analyses_id_organization_unique unique (id, organization_id),
  add constraint video_analyses_rider_organization_membership_fkey
    foreign key (organization_id, rider_id)
    references public.organization_memberships(organization_id, user_id)
    on delete restrict,
  add constraint video_analyses_horse_organization_fkey
    foreign key (horse_id, organization_id)
    references public.horses(id, organization_id)
    on delete restrict;

alter table public.lessons
  add column organization_id uuid references public.organizations(id) on delete restrict,
  add constraint lessons_id_organization_unique unique (id, organization_id),
  add constraint lessons_rider_organization_membership_fkey
    foreign key (organization_id, rider_id)
    references public.organization_memberships(organization_id, user_id)
    on delete restrict,
  add constraint lessons_trainer_organization_membership_fkey
    foreign key (organization_id, trainer_id)
    references public.organization_memberships(organization_id, user_id)
    on delete restrict,
  add constraint lessons_horse_organization_fkey
    foreign key (horse_id, organization_id)
    references public.horses(id, organization_id)
    on delete restrict,
  add constraint lessons_analysis_organization_fkey
    foreign key (analysis_id, organization_id)
    references public.video_analyses(id, organization_id)
    on delete restrict;

alter table public.membership_plans
  add column organization_id uuid references public.organizations(id) on delete restrict,
  add constraint membership_plans_id_organization_unique unique (id, organization_id);

alter table public.memberships
  add column organization_id uuid references public.organizations(id) on delete restrict,
  add constraint memberships_id_organization_unique unique (id, organization_id),
  add constraint memberships_user_organization_membership_fkey
    foreign key (organization_id, user_id)
    references public.organization_memberships(organization_id, user_id)
    on delete restrict;

alter table public.invoices
  add column organization_id uuid references public.organizations(id) on delete restrict,
  add constraint invoices_user_organization_membership_fkey
    foreign key (organization_id, user_id)
    references public.organization_memberships(organization_id, user_id)
    on delete restrict,
  add constraint invoices_membership_organization_fkey
    foreign key (membership_id, organization_id)
    references public.memberships(id, organization_id)
    on delete restrict;

create table public.guardian_riders (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  guardian_id uuid not null,
  rider_id uuid not null,
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, guardian_id, rider_id),
  check (guardian_id <> rider_id),
  foreign key (organization_id, guardian_id)
    references public.organization_memberships(organization_id, user_id)
    on delete cascade,
  foreign key (organization_id, rider_id)
    references public.organization_memberships(organization_id, user_id)
    on delete cascade
);

create table public.coach_rider_assignments (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  coach_id uuid not null,
  rider_id uuid not null,
  active boolean not null default true,
  starts_on date not null default current_date,
  ends_on date,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, coach_id, rider_id),
  check (coach_id <> rider_id),
  check (ends_on is null or ends_on >= starts_on),
  foreign key (organization_id, coach_id)
    references public.organization_memberships(organization_id, user_id)
    on delete cascade,
  foreign key (organization_id, rider_id)
    references public.organization_memberships(organization_id, user_id)
    on delete cascade
);

create table public.horse_access_assignments (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  horse_id uuid not null,
  profile_id uuid not null,
  access_type text not null check (
    access_type in (
      'owner', 'coach', 'trainer', 'rider', 'caretaker', 'vet',
      'farrier', 'guardian'
    )
  ),
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, horse_id, profile_id, access_type),
  foreign key (horse_id, organization_id)
    references public.horses(id, organization_id)
    on delete cascade,
  foreign key (organization_id, profile_id)
    references public.organization_memberships(organization_id, user_id)
    on delete cascade
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete restrict,
  request_id uuid,
  source text not null check (
    source in ('application', 'payment_service', 'worker', 'system', 'platform')
  ),
  actor_user_id uuid references public.profiles(id) on delete set null,
  entity_type text not null check (length(btrim(entity_type)) between 1 and 80),
  entity_id uuid,
  action text not null check (length(btrim(action)) between 1 and 120),
  before_data jsonb,
  after_data jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check (organization_id is not null or source = 'platform')
);

comment on table public.audit_events is
  'Append-only audit metadata. Never store secrets, tokens, national IDs, or full provider payloads.';

create table public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete restrict,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  channel text not null check (channel in ('email', 'push', 'sms', 'in_app', 'whatsapp')),
  subject text,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (
    status in ('queued', 'processing', 'sent', 'failed', 'cancelled')
  ),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  available_at timestamptz not null default now(),
  sent_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index platform_role_assignments_assigned_by_idx
  on public.platform_role_assignments(assigned_by);
create index organizations_created_by_idx on public.organizations(created_by);
create index organization_memberships_user_status_idx
  on public.organization_memberships(user_id, status);
create index organization_memberships_organization_status_idx
  on public.organization_memberships(organization_id, status);
create index organization_memberships_invited_by_idx
  on public.organization_memberships(invited_by);
create index organization_member_roles_assigned_by_idx
  on public.organization_member_roles(assigned_by);
create index horses_organization_idx on public.horses(organization_id);
create index horses_organization_owner_idx
  on public.horses(organization_id, owner_id)
  where organization_id is not null;
create index video_analyses_organization_idx on public.video_analyses(organization_id);
create index video_analyses_organization_rider_idx
  on public.video_analyses(organization_id, rider_id)
  where organization_id is not null;
create index video_analyses_horse_organization_idx
  on public.video_analyses(horse_id, organization_id)
  where organization_id is not null and horse_id is not null;
create index lessons_organization_idx on public.lessons(organization_id);
create index lessons_organization_rider_idx
  on public.lessons(organization_id, rider_id)
  where organization_id is not null;
create index lessons_organization_trainer_idx
  on public.lessons(organization_id, trainer_id)
  where organization_id is not null and trainer_id is not null;
create index lessons_horse_organization_idx
  on public.lessons(horse_id, organization_id)
  where organization_id is not null and horse_id is not null;
create index lessons_analysis_organization_idx
  on public.lessons(analysis_id, organization_id)
  where organization_id is not null and analysis_id is not null;
create index membership_plans_organization_idx on public.membership_plans(organization_id);
create index memberships_organization_idx on public.memberships(organization_id);
create index memberships_organization_user_idx
  on public.memberships(organization_id, user_id)
  where organization_id is not null;
create index invoices_organization_idx on public.invoices(organization_id);
create index invoices_organization_user_idx
  on public.invoices(organization_id, user_id)
  where organization_id is not null;
create index invoices_membership_organization_idx
  on public.invoices(membership_id, organization_id)
  where organization_id is not null and membership_id is not null;
create index guardian_riders_rider_idx on public.guardian_riders(organization_id, rider_id);
create index guardian_riders_created_by_idx on public.guardian_riders(created_by);
create index coach_rider_assignments_rider_idx
  on public.coach_rider_assignments(organization_id, rider_id);
create index coach_rider_assignments_created_by_idx
  on public.coach_rider_assignments(created_by);
create index horse_access_assignments_profile_idx
  on public.horse_access_assignments(organization_id, profile_id);
create index horse_access_assignments_created_by_idx
  on public.horse_access_assignments(created_by);
create index audit_events_organization_occurred_idx
  on public.audit_events(organization_id, occurred_at desc);
create index audit_events_entity_idx
  on public.audit_events(entity_type, entity_id, occurred_at desc);
create index audit_events_actor_idx on public.audit_events(actor_user_id);
create index notification_outbox_delivery_idx
  on public.notification_outbox(status, available_at)
  where status in ('queued', 'failed');
create index notification_outbox_recipient_idx
  on public.notification_outbox(recipient_id, created_at desc);
create index notification_outbox_organization_idx
  on public.notification_outbox(organization_id)
  where organization_id is not null;

create trigger organizations_set_updated_at
before update on public.organizations
for each row execute function public.set_updated_at();
create trigger organization_memberships_set_updated_at
before update on public.organization_memberships
for each row execute function public.set_updated_at();
create trigger guardian_riders_set_updated_at
before update on public.guardian_riders
for each row execute function public.set_updated_at();
create trigger coach_rider_assignments_set_updated_at
before update on public.coach_rider_assignments
for each row execute function public.set_updated_at();
create trigger horse_access_assignments_set_updated_at
before update on public.horse_access_assignments
for each row execute function public.set_updated_at();
create trigger notification_outbox_set_updated_at
before update on public.notification_outbox
for each row execute function public.set_updated_at();

create function private.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.platform_role_assignments
    where user_id = (select auth.uid())
      and role = 'platform_admin'
  );
$function$;

create function private.is_organization_member(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.organization_memberships
    where organization_id = p_organization_id
      and user_id = (select auth.uid())
      and status = 'active'
  );
$function$;

create function private.has_organization_role(
  p_organization_id uuid,
  p_roles text[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
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

revoke all on function private.is_platform_admin() from public, anon, authenticated, service_role;
revoke all on function private.is_organization_member(uuid) from public, anon, authenticated, service_role;
revoke all on function private.has_organization_role(uuid, text[]) from public, anon, authenticated, service_role;
grant execute on function private.is_platform_admin() to authenticated;
grant execute on function private.is_organization_member(uuid) to authenticated;
grant execute on function private.has_organization_role(uuid, text[]) to authenticated;
grant usage on schema private to authenticated, service_role;

alter table public.organizations enable row level security;
alter table public.platform_role_assignments enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.organization_member_roles enable row level security;
alter table public.guardian_riders enable row level security;
alter table public.coach_rider_assignments enable row level security;
alter table public.horse_access_assignments enable row level security;
alter table public.audit_events enable row level security;
alter table public.notification_outbox enable row level security;

create policy organizations_select_member
on public.organizations for select to authenticated
using (
  (select private.is_platform_admin())
  or (select private.is_organization_member(id))
);

create policy platform_roles_select_authorized
on public.platform_role_assignments for select to authenticated
using (
  user_id = (select auth.uid())
  or (select private.is_platform_admin())
);

create policy organization_memberships_select_authorized
on public.organization_memberships for select to authenticated
using (
  user_id = (select auth.uid())
  or (select private.is_platform_admin())
  or (select private.has_organization_role(
    organization_id,
    array['academy_admin', 'stable_manager']::text[]
  ))
);

create policy organization_member_roles_select_authorized
on public.organization_member_roles for select to authenticated
using (
  exists (
    select 1
    from public.organization_memberships as membership
    where membership.id = organization_member_roles.membership_id
      and (
        membership.user_id = (select auth.uid())
        or (select private.is_platform_admin())
        or (select private.has_organization_role(
          membership.organization_id,
          array['academy_admin', 'stable_manager']::text[]
        ))
      )
  )
);

create policy guardian_riders_select_authorized
on public.guardian_riders for select to authenticated
using (
  guardian_id = (select auth.uid())
  or rider_id = (select auth.uid())
  or (select private.is_platform_admin())
  or (select private.has_organization_role(
    organization_id,
    array['academy_admin', 'stable_manager']::text[]
  ))
);

create policy coach_rider_assignments_select_authorized
on public.coach_rider_assignments for select to authenticated
using (
  coach_id = (select auth.uid())
  or rider_id = (select auth.uid())
  or (select private.is_platform_admin())
  or (select private.has_organization_role(
    organization_id,
    array['academy_admin', 'stable_manager']::text[]
  ))
);

create policy horse_access_assignments_select_authorized
on public.horse_access_assignments for select to authenticated
using (
  profile_id = (select auth.uid())
  or (select private.is_platform_admin())
  or (select private.has_organization_role(
    organization_id,
    array['academy_admin', 'stable_manager']::text[]
  ))
);

create policy audit_events_select_authorized
on public.audit_events for select to authenticated
using (
  (select private.is_platform_admin())
  or (
    organization_id is not null
    and (select private.has_organization_role(
      organization_id,
      array['academy_admin', 'accountant']::text[]
    ))
  )
);

create policy notification_outbox_select_authorized
on public.notification_outbox for select to authenticated
using (
  recipient_id = (select auth.uid())
  or (select private.is_platform_admin())
  or (
    organization_id is not null
    and (select private.has_organization_role(
      organization_id,
      array['academy_admin', 'stable_manager']::text[]
    ))
  )
);

-- Explicit Data API exposure. Anonymous users get no access; authenticated
-- users can only read rows admitted by RLS; service_role owns mutations.
revoke all on table public.organizations from anon, authenticated;
revoke all on table public.platform_role_assignments from anon, authenticated;
revoke all on table public.organization_memberships from anon, authenticated;
revoke all on table public.organization_member_roles from anon, authenticated;
revoke all on table public.guardian_riders from anon, authenticated;
revoke all on table public.coach_rider_assignments from anon, authenticated;
revoke all on table public.horse_access_assignments from anon, authenticated;
revoke all on table public.audit_events from anon, authenticated;
revoke all on table public.notification_outbox from anon, authenticated;

grant select on table public.organizations to authenticated;
grant select on table public.platform_role_assignments to authenticated;
grant select on table public.organization_memberships to authenticated;
grant select on table public.organization_member_roles to authenticated;
grant select on table public.guardian_riders to authenticated;
grant select on table public.coach_rider_assignments to authenticated;
grant select on table public.horse_access_assignments to authenticated;
grant select on table public.audit_events to authenticated;
grant select on table public.notification_outbox to authenticated;

grant all privileges on table public.organizations to service_role;
grant all privileges on table public.platform_role_assignments to service_role;
grant all privileges on table public.organization_memberships to service_role;
grant all privileges on table public.organization_member_roles to service_role;
grant all privileges on table public.guardian_riders to service_role;
grant all privileges on table public.coach_rider_assignments to service_role;
grant all privileges on table public.horse_access_assignments to service_role;
grant all privileges on table public.audit_events to service_role;
grant all privileges on table public.notification_outbox to service_role;

commit;
