# Phase 0C.2B — Canonical-baseline staging acceptance

Date: 2026-08-12

## Authorization and scope

Authorized work:

- create one disposable Supabase branch at USD 0.01344 per hour;
- replay and validate the Phase 0C.2A canonical baseline;
- apply the non-secret Storage bucket and cron configuration;
- run transactional tenancy personas;
- run Security and Performance Advisors; and
- delete the branch.

Not authorized and not performed: live DDL/DML, live migration-ledger repair,
Git staging, commit, push, pull request work, or deployment.

## Disposable environment

- Parent project: `equivista-development`
  (`gtogwivozgrmjnrtungm`)
- Branch: `phase-0c2b-canonical-baseline-validation`
- Branch project ref: `rcypwfqkbuonrrhmihfh`
- Branch ID: `d0732a15-06fc-413b-9a77-282bcc4aecc0`
- Data copy: disabled

Supabase branch creation first replayed the unrepaired live ledger, producing
the known obsolete 89-table/64-migration intermediate state. The disposable
branch's `public` and `private` application schemas and custom Storage
policies were cleared before canonical validation. Supabase-managed schemas
were retained.

## Replay corrections

Staging exposed three extraction-normalization issues, all fixed locally before
the accepted replay:

1. Added missing semicolons between the 74 consecutive
   `pg_get_functiondef` definitions.
2. Normalized ACL grantee OID `0` from PostgreSQL's
   `"unknown (OID=0)"` rendering to the `PUBLIC` pseudo-role in seven
   function grants.
3. Made the live `postgres` ownership of `public` and `private` schemas
   explicit.

The final baseline checksum is recorded in
`supabase/canonical-baseline.sha256`. The repository validator and
`git diff --check` pass.

## Catalog parity

The final clean replay matched the live inventory and every recorded catalog
fingerprint:

- 23 application tables and 211 columns;
- one application sequence;
- 127 constraints, including 63 foreign keys;
- 86 total indexes, of which 52 are non-constraint indexes;
- 74 application functions;
- 14 application triggers;
- RLS enabled on all 23 application tables;
- 36 application policies and five Storage policies;
- five Storage buckets and one cron job;
- zero Vault secrets and zero Realtime publication tables; and
- matching semantic owners and privileges for schemas, relations, functions,
  and default privileges.

Comments, extensions, sequence configuration, function definitions, triggers,
policies, RLS expressions, bucket configuration, and cron configuration also
matched their live SHA-256 fingerprints.

## Persona acceptance

A single transaction created synthetic Auth users and tenancy records for four
personas, then rolled back:

- platform/academy administrator;
- coach;
- rider; and
- non-member outsider.

Checks passed for organization membership scoping, role visibility,
horse/analysis/lesson access, plan visibility, billing isolation, privileged
organization-member RPC access, outsider denial, and fail-closed writes.

After rollback:

- synthetic Auth users: 0;
- synthetic profiles: 0; and
- total application rows on the data-free branch: 0.

## Advisors

- Security Advisor: zero findings.
- Performance Advisor: 46 informational findings only:
  - 45 unused-index notices expected on a data-free disposable branch; and
  - one Auth fixed-connection-allocation notice.
- Performance warnings/errors: zero.

Unused-index guidance:
https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index

Auth production guidance:
https://supabase.com/docs/guides/deployment/going-into-prod

## Closeout

The disposable branch was deleted successfully. A final branch listing showed
only `main`.

Production was rechecked read-only after deletion:

- migration ledger: 69 entries, latest `20260812101436`;
- horses: 1;
- analyses: 10;
- lessons: 4;
- plans: 3;
- memberships: 1;
- invoices: 2; and
- Security Advisor: zero findings.

Commit, push, PR, and live migration-ledger repair remain separate gates.
