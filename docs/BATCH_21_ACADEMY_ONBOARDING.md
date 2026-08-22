# Batch 21 — production academy onboarding

## Outcome

Batch 21 adds a migration-backed, tenant-scoped onboarding path for production
academies without provisioning any production data. An academy administrator can
download a CSV template, validate up to 100 people with a server-side dry run,
and create expiring one-time invitation links. A recipient must authenticate with
the exact invited email before the invitation atomically activates membership and
the authorized roles.

`academy_admin` cannot be granted through batch onboarding. Platform and academy
administration remain in the existing privileged workflow.

## Security boundary

- Invitation tokens contain 256 bits of randomness and are stored only as SHA-256
  hashes. Plaintext links are returned once in the generated operator CSV.
- Invitation tables are RLS-enabled and have no browser table privileges. Browser
  access is through `SECURITY INVOKER` public RPC wrappers backed by fixed
  `search_path` private implementations.
- Preview, create, list, revoke, and close operations require platform-admin or
  same-organization academy-admin authority.
- Claim requires an authenticated profile whose normalized email exactly matches
  the invitation, a live invitation, and an active batch.
- Audit events contain identifiers, role names, counts, and lifecycle status only;
  they do not contain email addresses or invitation tokens.
- Closing a batch revokes all remaining pending links. Accepted memberships are
  not rolled back automatically.

## Operator flow

1. Open **Organization → Production onboarding** for the intended active academy.
2. Download the CSV template and complete `email`, `full_name`, and `roles`.
   Separate multiple roles with `|`. Keep each batch at or below 100 rows.
3. Upload the CSV and run the dry check. Resolve every local and server-side error.
4. Name the batch, choose a 1–30 day expiry, and create invitations.
5. Store the automatically downloaded invitation CSV in an approved encrypted
   location. Share each link only with its intended recipient. The plaintext links
   cannot be reconstructed from the database.
6. Ask each recipient to sign in or create an account using the exact invited
   email, then accept the invitation.
7. Verify accepted roles in **Members and roles**. Guardian/rider and coach/rider
   relationships remain separate verified operations and are never inferred from
   matching names or CSV row order.
8. Close the batch when onboarding is complete. This revokes every unused link.

## Review gates

1. Run `pnpm install --frozen-lockfile`.
2. Run `pnpm typecheck`.
3. Run `pnpm --filter @workspace/equus-voyages test:server`.
4. Run `pnpm verify:supabase`.
5. Run `node --test scripts/test-batch21-academy-onboarding.mjs`.
6. Run `pnpm build`.
7. On a disposable Supabase branch, replay migrations and run
   `tests/rls/batch_21_academy_onboarding.sql`.
8. Run Supabase Security and Performance Advisors on the disposable branch.
9. Apply the Batch 21 rollback, verify onboarding tables/RPCs are absent and
   accepted membership/audit records remain, then reapply and rerun the suite.

## Production hold point

This branch and its draft pull request do not apply the migration, deploy the
frontend, create an invitation batch, send email, or mutate production. Production
deployment requires separate action-time authorization after review and staging.

## Development verification — 2026-08-22

- The migration, persona acceptance suite, rollback, and corrected reapply all
  passed on `equivista-development`.
- Rollback preserved the pre-test 11 organization memberships and 7 audit rows.
- The development Security Advisor returned zero findings after reapply.
- The Performance Advisor returned INFO notices only. Four Batch 21 notices are
  expected unused-index observations on newly created empty tables; there are no
  Batch 21 unindexed-foreign-key findings.
- A separate read-only production check confirmed that the Batch 21 tables and
  migration are absent from the `EquiVista` project.

## Rollback

Apply
`supabase/rollback/20260822094500_batch21_academy_onboarding_rollback.sql`.
The rollback removes Batch 21 tables and RPCs. It deliberately preserves accepted
organization memberships, assigned roles, and append-only audit events. Revoke or
change those business records through the existing audited organization controls
only when separately authorized.
