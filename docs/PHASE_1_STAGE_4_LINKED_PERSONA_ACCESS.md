# Phase 1 Stage 4 — Linked-Persona Access Correction

Date: 2026-08-13 (Asia/Amman)

## Local implementation outcome

Stage 4 corrects the two acceptance blockers discovered during Stage 3 without changing production in this commit:

- active `guardian_riders` links authorize read-only access to the linked rider's profile, lessons, analyses, private riding video, and horse-related records;
- active `horse_access_assignments` becomes the canonical horse-visibility source, while the legacy `horse_riders` helper remains compatible during transition; and
- frontend lesson, analysis, progress, dashboard, and horse queries resolve linked riders instead of always filtering to the signed-in guardian's UUID.

Guardian access is deliberately read-only. Existing rider, coach, owner, and administrator write policies are unchanged.

## Security design

The migration adds two private, stable helpers:

- `private.can_read_rider(organization_id, rider_id)` validates self, active guardian, or administrator scope;
- `private.can_access_horse(horse_id)` validates ownership, an active canonical assignment, or a legacy rider link and applies the linked-rider rule.

Both functions are `SECURITY DEFINER` only because they must inspect RLS-protected relationship tables from policies. They are in the non-exposed `private` schema, use an empty `search_path`, derive identity only from `auth.uid()`, and revoke execution from `public` and `anon`.

No authorization decision uses editable user metadata. No table, bucket, role, or broad Data API grant is added.

## Validation package

- `scripts/verify-phase1-linked-persona-access.mjs` rejects missing active-link checks, missing canonical horse access, deprecated `auth.role()`, non-transactional SQL, widened guardian writes, and incomplete rollback.
- `scripts/test-phase1-linked-persona-access.mjs` exercises safe and unsafe migration variants.
- `tests/rls/phase_1_stage4_linked_personas.sql` is a read-only post-migration production/preview acceptance test. It resolves the active pilot link at runtime, impersonates guardian and rider, verifies exact linked visibility, and rolls back session state.

## Deployment boundary

Publication, a paid Supabase preview, migration application, production verification, application deployment, and the named browser acceptance window remain separate external actions. The production migration must not be applied until canonical replay, preview RLS validation, security advisors, and both required GitHub checks pass.

## Rollback

The paired rollback restores the previous profile, lesson, analysis, horse, legacy horse-rider, canonical assignment, and Storage read policies; restores the former `is_horse_rider` implementation; and removes the Stage 4 helpers. Rollback should be used only for verified regression or exposure and must be followed by the Stage 3 READY preflight.
