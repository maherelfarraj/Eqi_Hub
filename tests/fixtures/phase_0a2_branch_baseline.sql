-- Disposable Supabase development-branch fixture only.
-- Reconstructs the audited ADR-001 objects because the repository migration
-- history predates the current production schema. Never run in production.

begin;

create schema if not exists private;
grant usage on schema private to authenticated;

-- Clear legacy migration artifacts that collide with the canonical forward
-- Phase 0B.1 names. This file is disposable-branch-only and never production.
drop table if exists public.notification_outbox cascade;
drop table if exists public.audit_events cascade;
drop table if exists public.horse_access_assignments cascade;
drop table if exists public.coach_rider_assignments cascade;
drop table if exists public.guardian_riders cascade;
drop table if exists public.organization_member_roles cascade;
drop table if exists public.organization_memberships cascade;
drop table if exists public.platform_role_assignments cascade;
drop table if exists public.organizations cascade;

drop table if exists public.invoice_lines cascade;
drop table if exists public.invoices cascade;
drop table if exists public.payment_methods cascade;
drop table if exists public.memberships cascade;
drop table if exists public.membership_plans cascade;
drop table if exists public.lessons cascade;
drop table if exists public.video_analyses cascade;
drop table if exists public.horse_riders cascade;
drop table if exists public.horses cascade;
drop table if exists public.notification_prefs cascade;
drop table if exists public.profiles cascade;

create table public.profiles (
  id uuid primary key,
  email text not null,
  full_name text not null default '',
  role text not null
);

create table public.notification_prefs (
  user_id uuid primary key references public.profiles(id) on delete cascade
);

create table public.membership_plans (
  id uuid primary key,
  name text not null,
  price_cents integer not null,
  currency text not null,
  interval text not null,
  features jsonb not null default '[]'::jsonb,
  lessons_per_month integer not null default 0,
  analyses_per_month integer not null default 0,
  highlighted boolean not null default false,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.memberships (
  id uuid primary key,
  user_id uuid not null references public.profiles(id),
  plan_id uuid not null references public.membership_plans(id),
  status text not null,
  renews_at timestamptz,
  lessons_used integer not null default 0,
  analyses_used integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.payment_methods (
  id uuid primary key,
  user_id uuid not null references public.profiles(id),
  provider text,
  provider_token text,
  brand text,
  last4 text,
  exp_month integer,
  exp_year integer,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.invoices (
  id uuid primary key,
  user_id uuid not null references public.profiles(id),
  membership_id uuid references public.memberships(id),
  payment_method_id uuid references public.payment_methods(id),
  number text,
  issue_date date not null default current_date,
  due_date date,
  description text,
  status text not null,
  currency text not null,
  subtotal_cents integer not null,
  tax_cents integer not null default 0,
  total_cents integer not null,
  pdf_url text,
  created_at timestamptz not null default now()
);

create table public.invoice_lines (
  id uuid primary key,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  label text not null,
  qty integer not null,
  unit_price_cents integer not null,
  total_cents integer not null,
  created_at timestamptz not null default now()
);

create table public.horses (
  id uuid primary key,
  owner_id uuid not null references public.profiles(id),
  name text not null,
  created_at timestamptz not null default now()
);

create table public.horse_riders (
  id uuid primary key,
  horse_id uuid not null references public.horses(id) on delete cascade,
  rider_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (horse_id, rider_id)
);

create table public.video_analyses (
  id uuid primary key,
  rider_id uuid not null references public.profiles(id),
  horse_id uuid references public.horses(id),
  title text not null,
  discipline text not null,
  session_date date,
  video_url text,
  thumbnail_url text,
  status text not null,
  score integer,
  metrics jsonb not null default '[]'::jsonb,
  ai_feedback jsonb not null default '{}'::jsonb,
  trainer_comment jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.lessons (
  id uuid primary key,
  rider_id uuid not null references public.profiles(id),
  trainer_id uuid not null references public.profiles(id),
  horse_id uuid references public.horses(id),
  analysis_id uuid references public.video_analyses(id),
  starts_at timestamptz not null,
  status text not null,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.notification_prefs enable row level security;
alter table public.membership_plans enable row level security;
alter table public.memberships enable row level security;
alter table public.payment_methods enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_lines enable row level security;
alter table public.horses enable row level security;
alter table public.horse_riders enable row level security;
alter table public.video_analyses enable row level security;
alter table public.lessons enable row level security;

grant all privileges on table public.memberships, public.payment_methods,
  public.invoices, public.invoice_lines to anon, authenticated, service_role;
grant select on table public.profiles, public.membership_plans,
  public.horses, public.horse_riders, public.video_analyses, public.lessons
  to authenticated;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = 'public'
as $function$
begin
  insert into public.profiles (id, email, full_name, role)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''), 'rider')
  on conflict (id) do nothing;
  insert into public.notification_prefs (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end
$function$;

create or replace function public.set_updated_at()
returns trigger language plpgsql
as $function$
begin
  new.updated_at = now();
  return new;
end
$function$;

create or replace function public.is_horse_owner(p_horse_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $function$
  select exists (
    select 1 from public.horses
    where id = p_horse_id and owner_id = (select auth.uid())
  );
$function$;

create or replace function public.is_horse_rider(p_horse_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $function$
  select exists (
    select 1 from public.horse_riders
    where horse_id = p_horse_id and rider_id = (select auth.uid())
  );
$function$;

grant execute on function public.handle_new_user() to public, anon, authenticated, service_role;
grant execute on function public.set_updated_at() to public, anon, authenticated, service_role;
revoke all on function public.is_horse_owner(uuid) from public, anon;
revoke all on function public.is_horse_rider(uuid) from public, anon;
grant execute on function public.is_horse_owner(uuid) to authenticated, service_role;
grant execute on function public.is_horse_rider(uuid) to authenticated, service_role;

create policy memberships_all_own on public.memberships for all to public
using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy payment_methods_all_own on public.payment_methods for all to public
using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy invoices_select_own on public.invoices for select to public
using (auth.uid() = user_id);
create policy invoice_lines_select_own on public.invoice_lines for select to public
using (exists (select 1 from public.invoices i where i.id = invoice_id and i.user_id = auth.uid()));
create policy analyses_all_own on public.video_analyses for all to public
using (auth.uid() = rider_id) with check (auth.uid() = rider_id);
create policy analyses_select_trainer on public.video_analyses for select to public
using (exists (
  select 1 from public.lessons l
  where l.analysis_id = l.id and l.trainer_id = (select auth.uid())
));
create policy lessons_select_participant on public.lessons for select to authenticated
using (
  rider_id = (select auth.uid())
  or trainer_id = (select auth.uid())
);
create policy horses_select on public.horses for select to authenticated
using (owner_id = (select auth.uid()) or public.is_horse_rider(id));
create policy horses_modify_owner on public.horses for all to authenticated
using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy horse_riders_select on public.horse_riders for select to authenticated
using (rider_id = (select auth.uid()) or public.is_horse_owner(horse_id));
create policy horse_riders_insert_owner on public.horse_riders for insert to authenticated
with check (public.is_horse_owner(horse_id));
create policy horse_riders_update_owner on public.horse_riders for update to authenticated
using (public.is_horse_owner(horse_id)) with check (public.is_horse_owner(horse_id));
create policy horse_riders_delete_owner on public.horse_riders for delete to authenticated
using (public.is_horse_owner(horse_id));

update storage.buckets
set public = false, file_size_limit = null, allowed_mime_types = null
where id = 'videos';
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
select 'videos', 'videos', false, null, null
where not exists (select 1 from storage.buckets where id = 'videos');

insert into public.profiles (id, email, full_name, role) values
  ('10000000-0000-0000-0000-000000000001', 'rider@example.test', 'Rider Fixture', 'rider'),
  ('20000000-0000-0000-0000-000000000002', 'trainer@example.test', 'Trainer Fixture', 'trainer'),
  ('30000000-0000-0000-0000-000000000003', 'owner@example.test', 'Owner Fixture', 'owner'),
  ('40000000-0000-0000-0000-000000000004', 'admin@example.test', 'Admin Fixture', 'admin');

insert into public.membership_plans (id, name, price_cents, currency, interval)
values ('60000000-0000-0000-0000-000000000001', 'Fixture Plan', 5000, 'JOD', 'month');
insert into public.memberships (id, user_id, plan_id, status)
values ('60000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', 'active');
insert into public.payment_methods (id, user_id, provider, provider_token, brand, last4, exp_month, exp_year, is_default)
values ('60000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'fixture', 'secret-provider-token', 'visa', '4242', 12, 2030, true);
insert into public.invoices (id, user_id, membership_id, payment_method_id, number, status, currency, subtotal_cents, total_cents)
values ('60000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-000000000003', 'FIX-001', 'open', 'JOD', 5000, 5000);
insert into public.invoice_lines (id, invoice_id, label, qty, unit_price_cents, total_cents)
values ('60000000-0000-0000-0000-000000000005', '60000000-0000-0000-0000-000000000004', 'Fixture plan', 1, 5000, 5000);
insert into public.horses (id, owner_id, name)
values ('50000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000003', 'Fixture Horse');
insert into public.horse_riders (id, horse_id, rider_id)
values ('50000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001');
insert into public.video_analyses (id, rider_id, horse_id, title, discipline, status)
values ('70000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 'Fixture Analysis', 'Flatwork', 'analyzed');
insert into public.lessons (id, rider_id, trainer_id, horse_id, analysis_id, starts_at, status)
values ('80000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', now(), 'completed');

commit;
