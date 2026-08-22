-- Roll back Batch 21 schema and RPCs. Accepted memberships and audit records
-- are deliberately preserved because they are independent business records.
begin;

drop function if exists public.close_academy_onboarding_batch(uuid, uuid);
drop function if exists public.revoke_academy_onboarding_invitation(uuid, uuid);
drop function if exists public.claim_academy_onboarding_invitation(text);
drop function if exists public.get_academy_onboarding_invitations(uuid, uuid);
drop function if exists public.get_academy_onboarding_batches(uuid);
drop function if exists public.create_academy_onboarding_batch(uuid, text, jsonb, integer);
drop function if exists public.preview_academy_onboarding(uuid, jsonb);

drop function if exists private.batch21_close_onboarding_batch(uuid, uuid);
drop function if exists private.batch21_revoke_onboarding_invitation(uuid, uuid);
drop function if exists private.batch21_claim_onboarding_invitation(text);
drop function if exists private.batch21_get_onboarding_invitations(uuid, uuid);
drop function if exists private.batch21_get_onboarding_batches(uuid);
drop function if exists private.batch21_create_onboarding_batch(uuid, text, jsonb, integer);
drop function if exists private.batch21_validate_onboarding_entries(uuid, jsonb);

drop table if exists public.academy_onboarding_invitations;
drop table if exists public.academy_onboarding_batches;

notify pgrst, 'reload schema';

commit;
