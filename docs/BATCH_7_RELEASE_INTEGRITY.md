# Batch 7 — Release Integrity & Feature Readiness

## Purpose

Batch 7 is an offline release-readiness package for the accepted Batch 3–6
contracts. It restores a stable repository-level `verify` status, records
synthetic role coverage, and makes the database-preview policy explicit. It
does not authorize a release, enable a feature, mutate a hosted environment,
create a persona, alter financial access, or process a payment.

## CI contract

`verify` is the repository-level required context. It runs on every pull
request and every push to `main`, independent of path filters. Before its
verification commands begin, it waits for `supabase-preview-gate`, then executes:

1. the complete Supabase static/replay contract;
2. Batch 7 release-integrity evidence validation; and
3. root typecheck and build checks.

`worker-verify` remains the worker-specific check. `frontend-verify` remains
the frontend and browser-server contract. Keeping these names distinct prevents
a worker-only path filter from satisfying the repository-level `verify` gate.
The repository, worker, and Supabase replay workflow definitions are included
in this change and are validated as a required set.

## Supabase Preview policy

- For a pull request that changes `supabase/**`, `supabase-preview-gate`
  polls all commit check-runs and requires exactly one successful external
  **Supabase Preview** owned by the pinned Supabase GitHub App before the
  required root `verify` can pass. `supabase-replay` must
  also pass. The replay workflow also runs when validation scripts, root package
  metadata, or its own workflow change.
- For a non-Supabase pull request, a **Supabase Preview** result of `skipped`
  is the intentional non-Supabase outcome. It is paired with a passing root
  `verify` result and does not claim that a database preview ran.
- A missing, pending, cancelled, or failed Supabase Preview result for a
  database change makes `supabase-preview-gate`, and therefore `verify`, fail.
  A skipped result must never be reclassified as a successful database preview.
- The preview evaluator is always extracted from the pull request's trusted
  base revision. If the base revision does not contain the evaluator files,
  the gate fails closed; pull-request check data remains input and cannot
  replace the evaluator code.

This policy documents the external Supabase check; it does not create, apply,
or publish a preview database.

## Synthetic role acceptance

The committed evidence manifest is intentionally synthetic. It records
coverage—not live user activity—for these stages:

1. **Static contract** — migration, policy, UI-route, and workflow assertions.
2. **Isolated policy** — disposable RLS, tenant-isolation, approval, and
   default-off regression coverage.
3. **Route boundary** — unauthenticated and role-route guard coverage without
   creating or modifying accounts.

It covers Rider, Guardian, Coach, Academy Administrator, Stable Manager,
Accountant, and Platform Administrator boundaries. The evidence confirms
expected allowed and denied scopes without embedding account references,
credentials, contact data, safety answers, private notes, payroll figures, or
payment information.

## Batch 3–6 evidence boundaries

| Batch | Evidence source                                | Release boundary                                                                                |
| ----- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 3     | Guardian View acceptance                       | Verified linked-rider read-only access; no unrelated rider or private staff content             |
| 4     | Medical/Waiver Gate acceptance                 | Versioned consent and fail-closed readiness; safety data remains role-limited                   |
| 5     | Pilot and Horse Welfare regressions            | No cohort expansion; welfare stays default-off and staff-authorized                             |
| 6     | Feasibility and Academy Operations regressions | Feasibility remains offline; academy operations stay default-off and compensation approval-only |

The evidence hash is deterministic over the committed synthetic record. It is
an integrity reference, not a deployment authorization or a production receipt.

## Focused regression commands

```bash
pnpm verify:release-integrity
pnpm verify:supabase
pnpm typecheck
pnpm build
```

The Supabase suite includes Guardian View private-content denial, Medical/Waiver
readiness and isolation, Horse Welfare staff/default-off/private workflow
checks, and Academy Operations payroll/commission approval, immutability, and
workspace private-note redaction checks.

## Exclusions

Batch 7 does not deploy or publish. It does not apply migrations, enable
feature flags, mutate production or hosted Supabase, create or alter personas,
expand financial visibility or approval roles, or process payments.
