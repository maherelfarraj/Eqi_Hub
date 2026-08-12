begin;

create type public.payroll_period_status as enum ('draft', 'approved', 'paid');

create table public.coach_compensation_rates (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies(id) on delete cascade,
  coach_user_id uuid not null references auth.users(id) on delete restrict,
  amount_minor integer not null check (amount_minor > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  effective_from date not null,
  effective_to date,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (effective_to is null or effective_to >= effective_from),
  unique (academy_id, coach_user_id, effective_from)
);

create table public.payroll_periods (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies(id) on delete cascade,
  starts_on date not null,
  ends_on date not null,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  status public.payroll_period_status not null default 'draft',
  approved_by uuid references auth.users(id) on delete restrict,
  approved_at timestamptz,
  paid_by uuid references auth.users(id) on delete restrict,
  paid_at timestamptz,
  payout_reference text check (payout_reference is null or char_length(payout_reference) <= 120),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on and ends_on - starts_on <= 93),
  check ((approved_at is null) = (approved_by is null)),
  check ((paid_at is null) = (paid_by is null)),
  unique (academy_id, starts_on, ends_on, currency)
);

create table public.payroll_items (
  id uuid primary key default gen_random_uuid(),
  payroll_period_id uuid not null references public.payroll_periods(id) on delete cascade,
  academy_id uuid not null references public.academies(id) on delete cascade,
  coach_user_id uuid not null references auth.users(id) on delete restrict,
  lesson_session_id uuid references public.lesson_sessions(id) on delete restrict,
  item_type text not null check (item_type in ('lesson', 'adjustment')),
  description text not null check (char_length(btrim(description)) between 2 and 240),
  amount_minor integer not null check (amount_minor <> 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (payroll_period_id, lesson_session_id),
  check ((item_type = 'lesson') = (lesson_session_id is not null))
);

create index coach_rates_lookup_idx on public.coach_compensation_rates (academy_id, coach_user_id, effective_from desc);
create index coach_rates_created_by_idx on public.coach_compensation_rates (created_by);
create index payroll_periods_academy_status_idx on public.payroll_periods (academy_id, status, starts_on desc);
create index payroll_periods_approved_by_idx on public.payroll_periods (approved_by) where approved_by is not null;
create index payroll_periods_paid_by_idx on public.payroll_periods (paid_by) where paid_by is not null;
create index payroll_periods_created_by_idx on public.payroll_periods (created_by);
create index payroll_items_period_coach_idx on public.payroll_items (payroll_period_id, coach_user_id);
create index payroll_items_academy_coach_idx on public.payroll_items (academy_id, coach_user_id, created_at desc);
create index payroll_items_created_by_idx on public.payroll_items (created_by);

create function public.set_coach_compensation_rate(target_academy_id uuid, target_coach_user_id uuid, target_amount_minor integer, target_currency text, target_effective_from date)
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); rate_id uuid;
begin
  if actor is null or not private.has_academy_role(target_academy_id, array['academy_admin']::public.app_role[]) then raise exception 'Academy Admin access required' using errcode='42501'; end if;
  if target_amount_minor <= 0 or upper(target_currency) !~ '^[A-Z]{3}$' or not exists (select 1 from public.academy_memberships where academy_id=target_academy_id and user_id=target_coach_user_id and role='coach' and status='active') then raise exception 'Invalid coach rate' using errcode='22023'; end if;
  update public.coach_compensation_rates set effective_to=target_effective_from-1 where academy_id=target_academy_id and coach_user_id=target_coach_user_id and effective_to is null and effective_from < target_effective_from;
  insert into public.coach_compensation_rates(academy_id,coach_user_id,amount_minor,currency,effective_from,created_by)
  values(target_academy_id,target_coach_user_id,target_amount_minor,upper(target_currency),target_effective_from,actor)
  on conflict(academy_id,coach_user_id,effective_from) do update set amount_minor=excluded.amount_minor,currency=excluded.currency,created_by=actor returning id into rate_id;
  perform public.write_audit_event(target_academy_id,'coach_rate.set','coach_compensation_rate',rate_id,jsonb_build_object('coach_user_id',target_coach_user_id,'amount_minor',target_amount_minor,'currency',upper(target_currency))); return rate_id;
end; $$;

create function public.generate_payroll_period(target_academy_id uuid,target_starts_on date,target_ends_on date,target_currency text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); period_id uuid; academy_tz text;
begin
  if actor is null or not private.has_academy_role(target_academy_id,array['academy_admin']::public.app_role[]) then raise exception 'Academy Admin access required' using errcode='42501'; end if;
  if target_ends_on < target_starts_on or target_ends_on-target_starts_on > 93 or upper(target_currency)!~'^[A-Z]{3}$' then raise exception 'Invalid payroll period' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(target_academy_id::text||target_starts_on::text||target_ends_on::text,0));
  select timezone into academy_tz from public.academies where id=target_academy_id;
  insert into public.payroll_periods(academy_id,starts_on,ends_on,currency,created_by) values(target_academy_id,target_starts_on,target_ends_on,upper(target_currency),actor) returning id into period_id;
  insert into public.payroll_items(payroll_period_id,academy_id,coach_user_id,lesson_session_id,item_type,description,amount_minor,currency,created_by)
  select period_id,l.academy_id,l.coach_user_id,l.id,'lesson','Completed lesson · '||l.title,r.amount_minor,r.currency,actor
  from public.lesson_sessions l join lateral (select amount_minor,currency from public.coach_compensation_rates r where r.academy_id=l.academy_id and r.coach_user_id=l.coach_user_id and r.effective_from <= (l.starts_at at time zone academy_tz)::date and (r.effective_to is null or r.effective_to >= (l.starts_at at time zone academy_tz)::date) and r.currency=upper(target_currency) order by r.effective_from desc limit 1) r on true
  where l.academy_id=target_academy_id and l.coach_user_id is not null and l.status='completed' and (l.starts_at at time zone academy_tz)::date between target_starts_on and target_ends_on;
  perform public.write_audit_event(target_academy_id,'payroll_period.generated','payroll_period',period_id,jsonb_build_object('starts_on',target_starts_on,'ends_on',target_ends_on)); return period_id;
end; $$;

create function public.add_payroll_adjustment(target_period_id uuid,target_coach_user_id uuid,target_description text,target_amount_minor integer)
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); scoped public.payroll_periods%rowtype; item_id uuid;
begin
 select * into scoped from public.payroll_periods where id=target_period_id for update;
 if not found or scoped.status<>'draft' or actor is null or not private.has_academy_role(scoped.academy_id,array['academy_admin']::public.app_role[]) then raise exception 'Draft payroll and Academy Admin access required' using errcode='42501'; end if;
 if target_amount_minor=0 or char_length(btrim(target_description)) not between 2 and 240 or not exists(select 1 from public.academy_memberships where academy_id=scoped.academy_id and user_id=target_coach_user_id and role='coach' and status='active') then raise exception 'Invalid adjustment' using errcode='22023'; end if;
 insert into public.payroll_items(payroll_period_id,academy_id,coach_user_id,item_type,description,amount_minor,currency,created_by) values(scoped.id,scoped.academy_id,target_coach_user_id,'adjustment',btrim(target_description),target_amount_minor,scoped.currency,actor) returning id into item_id;
 perform public.write_audit_event(scoped.academy_id,'payroll_adjustment.added','payroll_item',item_id,jsonb_build_object('payroll_period_id',scoped.id,'amount_minor',target_amount_minor)); return item_id;
end; $$;

create function public.transition_payroll_period(target_period_id uuid,target_status text,target_reference text)
returns public.payroll_period_status language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); scoped public.payroll_periods%rowtype; next_status public.payroll_period_status;
begin
 select * into scoped from public.payroll_periods where id=target_period_id for update;
 if not found or actor is null or not private.has_academy_role(scoped.academy_id,array['academy_admin']::public.app_role[]) then raise exception 'Academy Admin access required' using errcode='42501'; end if;
 if target_status='approved' and scoped.status='draft' then next_status='approved'; update public.payroll_periods set status=next_status,approved_by=actor,approved_at=now() where id=scoped.id;
 elsif target_status='paid' and scoped.status='approved' and char_length(btrim(target_reference)) between 2 and 120 then next_status='paid'; update public.payroll_periods set status=next_status,paid_by=actor,paid_at=now(),payout_reference=btrim(target_reference) where id=scoped.id;
 else raise exception 'Invalid payroll transition' using errcode='23514'; end if;
 perform public.write_audit_event(scoped.academy_id,'payroll_period.'||next_status::text,'payroll_period',scoped.id,jsonb_build_object('payout_reference',nullif(btrim(target_reference),''))); return next_status;
end; $$;

alter table public.coach_compensation_rates enable row level security;
alter table public.payroll_periods enable row level security;
alter table public.payroll_items enable row level security;
create policy coach_rates_select_scoped on public.coach_compensation_rates for select to authenticated using(private.has_academy_role(academy_id,array['academy_admin']::public.app_role[]) or (coach_user_id=(select auth.uid()) and private.has_academy_role(academy_id,array['coach']::public.app_role[])));
create policy payroll_periods_select_scoped on public.payroll_periods for select to authenticated using(private.has_academy_role(academy_id,array['academy_admin']::public.app_role[]) or exists(select 1 from public.payroll_items i where i.payroll_period_id=id and i.coach_user_id=(select auth.uid())));
create policy payroll_items_select_scoped on public.payroll_items for select to authenticated using(private.has_academy_role(academy_id,array['academy_admin']::public.app_role[]) or (coach_user_id=(select auth.uid()) and private.has_academy_role(academy_id,array['coach']::public.app_role[])));
revoke all on public.coach_compensation_rates,public.payroll_periods,public.payroll_items from anon,authenticated;
grant select on public.coach_compensation_rates,public.payroll_periods,public.payroll_items to authenticated;
grant usage on type public.payroll_period_status to authenticated;
revoke all on function public.set_coach_compensation_rate(uuid,uuid,integer,text,date),public.generate_payroll_period(uuid,date,date,text),public.add_payroll_adjustment(uuid,uuid,text,integer),public.transition_payroll_period(uuid,text,text) from public,anon;
grant execute on function public.set_coach_compensation_rate(uuid,uuid,integer,text,date),public.generate_payroll_period(uuid,date,date,text),public.add_payroll_adjustment(uuid,uuid,text,integer),public.transition_payroll_period(uuid,text,text) to authenticated;
commit;
