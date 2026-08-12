# Phase 0B.2 rollback

Run:

`supabase/rollback/20260812081411_phase_0b2_organization_operations_rollback.sql`

The rollback removes the four public wrappers, five private implementations,
and the Phase 0B.2 composite index. It intentionally preserves all organization,
membership, role, relationship, audit, notification, and business rows.

The frontend organization route must be rolled back in the same release because
it depends on the four RPCs. Phase 0B.1 remains live throughout.

After rollback, verify:

- all nine Phase 0B.1 tables still exist with RLS enabled;
- all six tenant columns and cross-tenant constraints still exist;
- organization/member/audit row counts are unchanged;
- the legacy nine screens, video upload, Railway worker, and signed playback
  continue to work.
