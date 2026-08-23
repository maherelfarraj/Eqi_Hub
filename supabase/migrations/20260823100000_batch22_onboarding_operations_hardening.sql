-- Batch 22 follow-up hardening. This additive migration creates no tenants, users,
-- memberships, invitations, or delivery jobs.
begin;

do $preflight$
begin
  if to_regclass('public.academy_onboarding_invitations') is null
     or to_regprocedure('public.get_academy_onboarding_metrics(uuid)') is null then
    raise exception 'Batch 22 hardening preflight failed: Batch 22 is not present';
  end if;
end
$preflight$;

-- Preserve the historical replacement event if an operator profile is retired.
alter table public.academy_onboarding_invitations
  drop constraint if exists academy_onboarding_invitations_last_reissued_by_fkey,
  add constraint academy_onboarding_invitations_last_reissued_by_fkey
    foreign key (last_reissued_by) references public.profiles(id) on delete set null,
  drop constraint if exists academy_onboarding_invitations_reissue_state_check,
  add constraint academy_onboarding_invitations_reissue_state_check
    check (
      (reissue_count = 0 and last_reissued_at is null and last_reissued_by is null)
      or (reissue_count > 0 and last_reissued_at is not null)
    );

notify pgrst, 'reload schema';
commit;
