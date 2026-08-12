# Phase 0A.2 — Security Hotfix Deployment

Status: review and staging only. Production SQL requires a separate explicit approval after the evidence package is reviewed.

## Coupled release contents

- `supabase/migrations/20260812104929_phase_0a2_security_hotfix.sql`
- `supabase/rollback/20260812104929_phase_0a2_security_hotfix_rollback.sql`
- commercial frontend hooks/pages and EN/AR copy under `artifacts/equus-voyages/src`
- `tests/fixtures/phase_0a2_branch_baseline.sql`
- `tests/rls/phase_0a2_personas.sql`
- `tests/evidence/before.sql` and `tests/evidence/after.sql`

The database migration and frontend compatibility patch are one release unit. Do not restrict browser writes while deploying an older frontend that still attempts direct commercial mutations.

## Development-branch validation

1. Create a fresh, non-persistent Supabase development branch.
2. Because the repository migration ledger predates ADR-001, run the disposable branch fixture. Never run the fixture in production.
3. Run `tests/evidence/before.sql` and retain the output.
4. Apply the forward migration.
5. Run `tests/evidence/after.sql` and `tests/rls/phase_0a2_personas.sql`.
6. Apply the rollback and confirm the before evidence is restored exactly.
7. Apply the forward migration again and rerun all after/persona checks.
8. Run Supabase Security Advisor and record findings.
9. Delete the development branch to stop branch charges.

## Application gates

```bash
pnpm install --frozen-lockfile
pnpm --filter @workspace/equus-voyages typecheck
PORT=4173 BASE_PATH=/ \
  VITE_SUPABASE_URL=https://example.supabase.co \
  VITE_SUPABASE_ANON_KEY=test-anon-key \
  pnpm --filter @workspace/equus-voyages build
pnpm run typecheck
```

Static acceptance:

- no client insert/update/delete on memberships, payment methods, invoices, or invoice lines;
- payment reads explicitly exclude `provider_token`;
- no frontend `process-video` Edge Function invocation;
- membership, payments, and billing remain readable and show the localized protected-service pending state;
- EN/AR translation trees are symmetric.

## Production sequence after approval

1. Capture production before evidence and row counts.
2. Deploy the frontend compatibility build.
3. Apply the single forward migration.
4. Enable Supabase Auth leaked-password protection.
5. Run after evidence, persona checks using approved production test accounts, and Security Advisor.
6. Smoke-test upload → Railway worker → signed playback.

Do not merge a Supabase development branch into production for this release. Apply the reviewed repository migration through the normal production migration workflow.
