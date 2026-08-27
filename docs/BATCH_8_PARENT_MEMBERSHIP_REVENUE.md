# Batch 8 Parent, Membership & Revenue Operations

## Release boundary

Batch 8 is an organization-scoped, default-off operations foundation. It does
not change personas, call a payment provider, handle card details, collect or
refund funds, send collection messages, activate memberships automatically, or
enable itself.

Two conditions are required before the UI reads Batch 8 data:

1. The client build has `VITE_BATCH8_ENABLED=true`.
2. The selected organization has a reviewed `ready` and `enabled` Batch 8
   readiness row.

An absent environment variable, an absent readiness row, or any non-ready
status keeps the feature off.

## Role and relationship boundaries

- `/family-operations` is route-gated to the active organization's `guardian`
  role.
- `/revenue-operations` is route-gated to `academy_admin`, `accountant`, or
  `platform_admin`.
- Family data is derived from existing verified, active, unexpired guardian
  relationships and explicit family-account rider links.
- Financial totals and payment-link preparation status are returned only when
  the existing guardian relationship grants financial visibility.
- Guardians receive a redacted aggregate RPC response with balances separated
  by ISO currency; monetary values in different currencies are never summed.
  A guardian/rider pair can belong to only one family account per organization,
  preventing duplicate rider cards and balances. Guardians cannot select raw
  attendance reasons, lifecycle metadata, payment-intent rows, collection
  cases, renewal signals, or revenue snapshots.
- Authorized staff reads and all lifecycle mutations fail closed when Batch 8
  is not enabled for the organization.

## Lifecycle rules

Membership, attendance, waitlist, and make-up-credit changes use
security-definer RPCs with explicit organization checks, allowed transition
matrices, timestamps, reasons, and organization-unique idempotency keys.

- Memberships support explicit activation, freeze, unfreeze, past-due,
  cancellation, expiry, and renewal transitions.
- Freeze transitions enforce the configured limit and a future end date.
- Attendance exceptions begin pending and require an explicit approved or
  declined review.
- Credit eligibility is derived from the package's missed-lesson and make-up
  rules; a declined exception cannot be credit-eligible.
- Waitlists allow `queued -> offered|cancelled` and
  `offered -> accepted|expired|cancelled`. Offer expiry is enforced.
- Make-up credits can be issued only from an approved eligible exception and
  are consumed oldest-expiring-first.
- Lifecycle events are append-only. State changes are audited.

## Non-processing financial foundation

Payment-link intents contain no URL, provider token, provider reference, or
card data. Their database constraints require `processor = 'none'` and
`captured_cents = 0`. Collection records are preparation state only; they do
not send messages or collect funds.

The revenue surface reads every currency-scoped snapshot for the latest
available business date plus open collection and renewal-risk records. It
exposes no mutation control.

## Validation

Run:

```sh
pnpm verify:parent-revenue-operations
```

This performs repository contract checks, focused UI/i18n tests, and an
isolated PostgreSQL migration test covering default-off behavior, role and
tenant boundaries, guardian financial redaction, idempotency, transition
matrices, immutable history, direct-write denial, and non-processing payment
constraints.