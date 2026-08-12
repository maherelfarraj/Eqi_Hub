begin;
create type public.payment_attempt_status as enum ('pending', 'processing', 'succeeded', 'failed', 'cancelled', 'refunded');
create table public.payment_attempts (
 id uuid primary key default gen_random_uuid(), academy_id uuid not null references public.academies(id) on delete cascade,
 invoice_id uuid not null references public.invoices(id) on delete restrict, rider_user_id uuid not null references auth.users(id) on delete restrict,
 idempotency_key uuid not null default gen_random_uuid(), provider text, provider_payment_id text,
 status public.payment_attempt_status not null default 'pending', amount_minor integer not null check (amount_minor > 0),
 currency text not null check (currency ~ '^[A-Z]{3}$'), failure_code text, failure_message text, checkout_url text,
 created_by uuid not null references auth.users(id) on delete restrict, created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(), completed_at timestamptz,
 unique (academy_id, idempotency_key),
 check ((provider is null) = (provider_payment_id is null)), check ((status = 'failed') = (failure_code is not null)),
 check ((status in ('succeeded','failed','cancelled','refunded')) = (completed_at is not null))
);
create table public.payment_reconciliation_events (
 id bigint generated always as identity primary key, academy_id uuid not null references public.academies(id) on delete cascade,
 payment_attempt_id uuid not null references public.payment_attempts(id) on delete restrict, provider text not null,
 provider_event_id text not null, event_type text not null, payload_digest text not null,
 received_at timestamptz not null default now(), processed_at timestamptz, processing_error text,
 unique (provider, provider_event_id)
);
create index payment_attempts_academy_status_idx on public.payment_attempts (academy_id, status, created_at desc);
create index payment_attempts_invoice_idx on public.payment_attempts (invoice_id, created_at desc);
create index payment_attempts_rider_idx on public.payment_attempts (rider_user_id, created_at desc);
create index payment_attempts_created_by_idx on public.payment_attempts (created_by);
create unique index payment_attempts_provider_ref_idx on public.payment_attempts (provider, provider_payment_id) where provider is not null and provider_payment_id is not null;
create index payment_events_attempt_idx on public.payment_reconciliation_events (payment_attempt_id, received_at desc);
create index payment_events_academy_idx on public.payment_reconciliation_events (academy_id, received_at desc);
create function public.prepare_payment_attempt(target_invoice_id uuid, target_idempotency_key uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid()); scoped public.invoices%rowtype; attempt_id uuid;
begin
 select * into scoped from public.invoices where id = target_invoice_id for update;
 if not found or actor is null or not private.can_access_rider_billing(scoped.academy_id, scoped.rider_user_id) then raise exception 'Invoice access required' using errcode = '42501'; end if;
 if scoped.status <> 'issued' then raise exception 'Invoice is not payable' using errcode = '23514'; end if;
 insert into public.payment_attempts (academy_id, invoice_id, rider_user_id, idempotency_key, amount_minor, currency, created_by)
 values (scoped.academy_id, scoped.id, scoped.rider_user_id, target_idempotency_key, scoped.amount_minor, scoped.currency, actor)
 on conflict (academy_id, idempotency_key) do update set updated_at = public.payment_attempts.updated_at returning id into attempt_id;
 perform public.write_audit_event(scoped.academy_id, 'payment_attempt.prepared', 'payment_attempt', attempt_id, jsonb_build_object('invoice_id', scoped.id, 'provider_enabled', false));
 return attempt_id;
end; $$;
alter table public.payment_attempts enable row level security;
alter table public.payment_reconciliation_events enable row level security;
create policy payment_attempts_select_scoped on public.payment_attempts for select to authenticated using (private.can_access_rider_billing(academy_id, rider_user_id));
create policy payment_events_select_admins on public.payment_reconciliation_events for select to authenticated using (private.has_academy_role(academy_id, array['academy_admin']::public.app_role[]));
revoke all on public.payment_attempts, public.payment_reconciliation_events from anon, authenticated;
grant select on public.payment_attempts, public.payment_reconciliation_events to authenticated;
grant usage on type public.payment_attempt_status to authenticated;
revoke all on function public.prepare_payment_attempt(uuid, uuid) from public, anon;
grant execute on function public.prepare_payment_attempt(uuid, uuid) to authenticated;
commit;
