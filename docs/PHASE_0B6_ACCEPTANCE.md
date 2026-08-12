# Phase 0B.6 — Performance advisor remediation

Date: 2026-08-12

## Scope

Add seven covering B-tree indexes for foreign keys reported by the Supabase
Performance Advisor:

- `documents(horse_id)`
- `documents(user_id)`
- `health_records(horse_id)`
- `invoices(payment_method_id)`
- `memberships(plan_id)`
- `training_log(author_id)`
- `training_log(horse_id)`

No index is removed. The indexes reported as unused were created recently,
occupy 16 KB each, and have insufficient production history to justify a
destructive cleanup.

The Auth database connection allocation notice is a project capacity setting,
not a SQL migration. It remains unchanged pending expected-load and scaling
requirements.

## Pre-deployment evidence

- All seven foreign keys lack a valid covering-prefix index: confirmed
- Existing index-name collisions: none
- Current affected-table row estimates: 0–2 rows
- Live schema changed by this preparation: no

## Staging acceptance

- Disposable branch: `phase-0b6-performance-indexes`
- Branch ref: `vwjvirbmaqycsotjkchl`
- Hourly cost: `$0.01344`
- Branch deleted after verification: yes
- Main project changed during staging: no
- Migration apply: pass
- Covering-index verification: pass (`7/7` valid and ready)
- Phase 0A.2 personas: pass
- Phase 0B.1 personas: pass
- Phase 0B.2 personas: pass
- Rollback: pass (`0/7` indexes remained)
- Reapply: pass (`7/7` indexes restored)
- Phase 0B.6 target foreign-key advisor findings: `0`

The disposable branch reproduced the known migration-history drift: legacy
tables present on live are absent from the recorded migration chain. The first
apply therefore failed atomically on missing `public.documents`. Validation
continued only after reconstructing the canonical branch baseline, Phases
0A.2/B.1/B.2, and live-compatible shapes for `documents`, `health_records`,
and `training_log`, then applying Phase 0B.5.

The broad branch advisors contain unrelated findings inherited from the
historical migration baseline, including older-module foreign keys, unused
indexes, duplicate permissive policies, and callable `SECURITY DEFINER` RPCs.
None of the seven Phase 0B.6 foreign keys remains unindexed.

## Live deployment

- Project: `equivista-development` (`gtogwivozgrmjnrtungm`)
- Explicit deployment authorization: received 2026-08-12
- Applied migration: `20260812101436_phase_0b6_foreign_key_indexes`
- Staged migration SHA-256: `ce7e73db728ae3bb9e587587427ef0fad7d401a3f1d1ddaab8ef6fd805a1b945`
- Covering-index verification: pass (`7/7` valid and ready)
- Admin, coach, and outsider transactional persona checks: pass
- Phase 0B.6 unindexed foreign-key findings: `0`
- Security Advisor findings: `0`
- Rollback required: no

The remaining live Performance Advisor notices are informational: 40 existing
unused-index notices and one Auth database connection allocation notice. The
new Phase 0B.6 indexes are not among the unused-index notices. No index was
removed and the Auth setting was not changed.
