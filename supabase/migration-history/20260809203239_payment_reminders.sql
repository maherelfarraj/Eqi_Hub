begin;

create table public.payment_reminder_settings (
  academy_id uuid primary key references public.academies(id) on delete cascade,
  supplier_lead_days integer not null default 7,
  payroll_due_days_after_period integer not null default 5,
  overdue_escalation_days integer not null default 3,
  supplier_reminders_enabled boolean not null default true,
  payroll_reminders_enabled boolean not null default true,
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_reminder_supplier_lead_range check (supplier_lead_days between 0 and 60),
  constraint payment_reminder_payroll_due_range check (payroll_due_days_after_period between 0 and 60),
  constraint payment_reminder_escalation_range check (overdue_escalation_days between 1 and 60)
);

create index payment_reminder_settings_created_by_idx on public.payment_reminder_settings (created_by);
create index payment_reminder_settings_updated_by_idx on public.payment_reminder_settings (updated_by);

alter table public.payment_reminder_settings enable row level security;
revoke all on public.payment_reminder_settings from public, anon, authenticated;
grant select, insert, update on public.payment_reminder_settings to authenticated;
grant select, insert, update, delete on public.payment_reminder_settings to service_role;

create policy payment_reminder_settings_read_administrators
on public.payment_reminder_settings for select to authenticated
using ((select private.is_platform_administrator()));

create policy payment_reminder_settings_insert_administrators
on public.payment_reminder_settings for insert to authenticated
with check (
  (select private.is_platform_administrator())
  and created_by = (select auth.uid())
  and updated_by = (select auth.uid())
);

create policy payment_reminder_settings_update_administrators
on public.payment_reminder_settings for update to authenticated
using ((select private.is_platform_administrator()))
with check (
  (select private.is_platform_administrator())
  and updated_by = (select auth.uid())
);

create or replace function public.configure_payment_reminders(
  target_academy_id uuid,
  target_supplier_lead_days integer,
  target_payroll_due_days_after_period integer,
  target_overdue_escalation_days integer,
  target_supplier_reminders_enabled boolean,
  target_payroll_reminders_enabled boolean
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare actor uuid := (select auth.uid());
begin
  if actor is null or not private.is_platform_administrator() then
    raise exception 'platform administrator access required' using errcode = '42501';
  end if;
  if target_supplier_lead_days not between 0 and 60
    or target_payroll_due_days_after_period not between 0 and 60
    or target_overdue_escalation_days not between 1 and 60 then
    raise exception 'invalid payment reminder settings' using errcode = '22023';
  end if;

  insert into public.payment_reminder_settings (
    academy_id, supplier_lead_days, payroll_due_days_after_period,
    overdue_escalation_days, supplier_reminders_enabled,
    payroll_reminders_enabled, created_by, updated_by
  ) values (
    target_academy_id, target_supplier_lead_days,
    target_payroll_due_days_after_period, target_overdue_escalation_days,
    target_supplier_reminders_enabled, target_payroll_reminders_enabled,
    actor, actor
  )
  on conflict (academy_id) do update set
    supplier_lead_days = excluded.supplier_lead_days,
    payroll_due_days_after_period = excluded.payroll_due_days_after_period,
    overdue_escalation_days = excluded.overdue_escalation_days,
    supplier_reminders_enabled = excluded.supplier_reminders_enabled,
    payroll_reminders_enabled = excluded.payroll_reminders_enabled,
    updated_by = actor,
    updated_at = now();

  insert into public.platform_audit_events (actor_user_id, action, academy_id, metadata)
  values (actor, 'platform.payment_reminders_configured', target_academy_id,
    jsonb_build_object(
      'supplier_lead_days', target_supplier_lead_days,
      'payroll_due_days_after_period', target_payroll_due_days_after_period,
      'overdue_escalation_days', target_overdue_escalation_days,
      'supplier_enabled', target_supplier_reminders_enabled,
      'payroll_enabled', target_payroll_reminders_enabled
    ));
end;
$$;

revoke all on function public.configure_payment_reminders(uuid, integer, integer, integer, boolean, boolean) from public, anon, authenticated;
grant execute on function public.configure_payment_reminders(uuid, integer, integer, integer, boolean, boolean) to authenticated;

commit;
