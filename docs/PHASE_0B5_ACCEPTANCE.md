# Phase 0B.5 — RLS policy cleanup acceptance

Date: 2026-08-12

## Staging

- Disposable branch: `phase-0b5-rls-policy-cleanup`
- Branch ref: `xnyzkcojyakmtfuelddh`
- Hourly cost: `$0.01344`
- Branch deleted after verification: yes
- Main project changed during staging: no

The branch reproduced the historical migration-drift condition. The documented
canonical fixture plus Phases 0A.2, 0B.1, and 0B.2 were applied first. The
fixture omitted `documents`, `health_records`, and `training_log`; branch-only
live-compatible fixtures were added for those three policy targets.

## Results

- Phase 0B.5 apply: pass
- Phase 0A.2 personas: pass
- Phase 0B.1 personas: pass
- Phase 0B.2 personas: pass
- Phase 0B.5 rollback: pass
- Phase 0B.5 reapply: pass
- All three persona suites after reapply: pass
- Deprecated `auth.role()` policies in Phase 0B.5 scope: `0`
- Uncached `auth.uid()` policies in Phase 0B.5 scope: `0`

The branch carried unrelated legacy advisor findings from its broad baseline
fixture, including exposed `SECURITY DEFINER` RPCs and duplicate policies in
older academy modules. Phase 0B.5 does not change those APIs; they require
separate authorization review rather than mechanical revocation.

## Live deployment

- Project: `equivista-development` (`gtogwivozgrmjnrtungm`)
- Explicit deployment authorization: received 2026-08-12
- Applied migration: `20260812095842_phase_0b5_rls_policy_cleanup`
- Staged migration SHA-256: `0f72c8992dd714db71d7d2a1c7d37c00d501e6f1d075be7ac04560a416829c17`
- Admin, coach, and outsider transactional persona checks: pass
- Deprecated `auth.role()` policies in Phase 0B.5 scope: `0`
- Uncached `auth.uid()` policies in Phase 0B.5 scope: `0`
- Security Advisor findings: `0`

The Performance Advisor reports informational findings for pre-existing
unindexed foreign keys, currently unused indexes, and the Auth database
connection allocation strategy. These are outside the authorized RLS cleanup
and were not changed during this deployment.
