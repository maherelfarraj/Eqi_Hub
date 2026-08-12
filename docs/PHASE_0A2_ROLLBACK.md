# Phase 0A.2 — Emergency Rollback

The rollback restores the exact reviewed ADR-001 browser grants, policies, function ACLs, helper locations, and pre-hotfix `videos` bucket configuration. It does not delete or rewrite business rows.

## Trigger conditions

Use the rollback only for a release-blocking regression that cannot be fixed forward immediately. The rollback deliberately restores known risks, including browser commercial writes and the old trainer-analysis join.

## Sequence

1. Stop further release activity and retain logs/evidence.
2. Apply `supabase/rollback/20260812062006_phase_0a2_security_hotfix_rollback.sql` in one transaction.
3. Verify row counts match the pre-deployment capture.
4. Run `tests/evidence/before.sql` and compare grants, policies, functions, and bucket configuration with the captured baseline.
5. Roll the application back to the matching pre-Phase-0A.2 build only if required.
6. Record the incident and create a forward correction before attempting redeployment.

## Safety boundaries

- Never run the development fixture in production.
- Do not delete rows or storage objects.
- Do not change SMTP, provider keys, or service-role credentials.
- Do not leave the database in the rollback state longer than necessary because it reopens the commercial-write boundary.
