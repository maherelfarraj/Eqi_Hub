-- Phase 0B.1 emergency rollback. It refuses to run after tenant adoption so
-- no organization-scoped data can be silently discarded.

begin;

do $preflight$
declare
  populated_table text;
  populated_count bigint;
begin
  if to_regclass('public.organizations') is null
     or to_regprocedure('private.is_platform_admin()') is null then
    raise exception 'Phase 0B.1 rollback preflight failed: forward state not found';
  end if;

  foreach populated_table in array array[
    'platform_role_assignments',
    'organizations',
    'organization_memberships',
    'organization_member_roles',
    'guardian_riders',
    'coach_rider_assignments',
    'horse_access_assignments',
    'audit_events',
    'notification_outbox'
  ] loop
    execute format('select count(*) from public.%I', populated_table)
      into populated_count;
    if populated_count <> 0 then
      raise exception
        'Phase 0B.1 rollback refused: public.% contains % rows',
        populated_table,
        populated_count;
    end if;
  end loop;

  if exists (select 1 from public.horses where organization_id is not null)
     or exists (select 1 from public.video_analyses where organization_id is not null)
     or exists (select 1 from public.lessons where organization_id is not null)
     or exists (select 1 from public.membership_plans where organization_id is not null)
     or exists (select 1 from public.memberships where organization_id is not null)
     or exists (select 1 from public.invoices where organization_id is not null) then
    raise exception 'Phase 0B.1 rollback refused: tenant keys are in use';
  end if;
end
$preflight$;

drop policy if exists notification_outbox_select_authorized on public.notification_outbox;
drop policy if exists audit_events_select_authorized on public.audit_events;
drop policy if exists horse_access_assignments_select_authorized on public.horse_access_assignments;
drop policy if exists coach_rider_assignments_select_authorized on public.coach_rider_assignments;
drop policy if exists guardian_riders_select_authorized on public.guardian_riders;
drop policy if exists organization_member_roles_select_authorized on public.organization_member_roles;
drop policy if exists organization_memberships_select_authorized on public.organization_memberships;
drop policy if exists platform_roles_select_authorized on public.platform_role_assignments;
drop policy if exists organizations_select_member on public.organizations;

drop function private.has_organization_role(uuid, text[]);
drop function private.is_organization_member(uuid);
drop function private.is_platform_admin();

drop table public.notification_outbox;
drop table public.audit_events;
drop table public.horse_access_assignments;
drop table public.coach_rider_assignments;
drop table public.guardian_riders;
drop table public.organization_member_roles;

alter table public.invoices drop column organization_id;
alter table public.memberships drop column organization_id;
alter table public.membership_plans drop column organization_id;
alter table public.lessons drop column organization_id;
alter table public.video_analyses drop column organization_id;
alter table public.horses drop column organization_id;

drop table public.organization_memberships;
drop table public.platform_role_assignments;
drop table public.organizations;

commit;
