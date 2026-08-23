# Batch 22 — academy onboarding operations and observability

## Outcome

Batch 22 adds a tenant-scoped operations surface to the Batch 21 onboarding
workflow. Academy administrators can monitor pending, expiring, accepted,
revoked, and expired invitations; review a secret-free lifecycle activity feed;
revoke a pending invitation; and generate an audited replacement link.

Replacement generation rotates the invitation token hash, invalidates the old
link, enforces a five-minute cooldown and a maximum of five replacements, and
returns the new plaintext link once for an operator-controlled download. It does
not send email, create a delivery job, or retain the plaintext token.

## Security boundary

- Operational RPCs require an authenticated platform administrator or a manager
  of the selected organization.
- Invitation tables remain RLS-enabled, explicitly denied, and unavailable to
  direct browser reads. The UI uses hardened private implementations behind
  `SECURITY INVOKER` public wrappers.
- Metrics are aggregates and the activity feed returns only whitelisted audit
  details. Neither surface returns invitation tokens or token hashes.
- Replacement links use 256 bits of randomness and store only SHA-256 hashes.
- Replacement reasons use a fixed allowlist so free-form personal data cannot be
  copied into the audit log.
- The replacement timestamp remains after an operator profile is deleted; its
  nullable actor reference becomes `System`. Batch creators remain protected by
  the existing non-null history-preserving relationship.
- Batch 22 creates no organizations, accounts, memberships, invitations, email,
  or production records.

## Operator flow

1. Open **Organization → Production onboarding**.
2. Review pending invitations, near-term expiries, acceptance rate, and lifecycle
   activity.
3. Select a batch to inspect invitation-level status.
4. Revoke a pending invitation when access should end.
5. If a link must be replaced, generate one replacement. Store its downloaded
   CSV securely and share it only with the intended recipient. The previous link
   becomes invalid immediately.
6. Close the batch when onboarding is complete.

## Review gates

1. Run `pnpm install --frozen-lockfile`.
2. Run `pnpm typecheck`.
3. Run `pnpm --filter @workspace/equus-voyages test:server`.
4. Run `pnpm verify:supabase`.
5. Run `node --test scripts/test-batch22-onboarding-operations.mjs`.
6. Run `pnpm build`.
7. Replay the canonical migration chain on a disposable Supabase branch and run
   `tests/rls/batch_22_onboarding_operations.sql`.
8. Run Supabase Security and Performance Advisors on the disposable branch.
9. Apply the Batch 22 rollback, verify Batch 21 data and APIs remain intact, then
   reapply and repeat the acceptance suite.

## Production release controls

Apply the schema changes through the version-controlled Git integration only.
Schedule the short metadata-locking migration during a low-traffic window and
monitor it until complete. No invitation, account, membership, or email delivery
is created by either migration.

## Development verification — 2026-08-23

- Full workspace typecheck, 48 frontend/server tests, Worker typecheck and 18
  tests, production builds, and the complete Supabase static verification chain
  passed.
- The Batch 22 transactional tenant/RLS suite passed on
  `equivista-development`.
- Rollback removed all Batch 22 operations, restored the Batch 21 invitation
  reader, and preserved the empty Batch 21 onboarding tables. Corrected reapply
  and repeat acceptance passed.
- Development Supabase Security Advisor returned zero findings. Performance
  Advisor returned 75 INFO notices only and no warning or error findings.
- Root and Worker dependency audits returned no known vulnerabilities.
- A read-only production check confirmed that Batch 22 functions and columns are
  absent, onboarding remains at zero batches and zero invitations, and the four
  controlled personas remain unchanged with zero live sessions.

## Rollback

Apply
`supabase/rollback/20260823090000_batch22_onboarding_operations_rollback.sql`.
The rollback removes Batch 22 metrics, activity, and replacement operations,
drops the additive replacement metadata, and restores the Batch 21 invitation
reader. Existing Batch 21 batches and invitations are preserved.
