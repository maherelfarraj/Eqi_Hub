# Phase 0B.1 rollback

Rollback file:
`supabase/rollback/20260812073038_phase_0b1_tenancy_rbac_foundation_rollback.sql`

The rollback is intentionally guarded. It succeeds only before tenant
adoption, when:

- every Phase 0B.1 foundation table is empty; and
- every additive `organization_id` column is still null.

If either condition is false, rollback stops with an exception. This prevents
silent deletion of organizations, role assignments, relationships, audit
events, notifications, or tenant classification.

## Development verification

1. Apply Phase 0A.2.
2. Apply Phase 0B.1.
3. Run persona tests (they roll back their fixture rows).
4. Run the Phase 0B.1 rollback.
5. Verify the Phase 0B.1 tables, helpers, and tenant columns are absent.
6. Verify Phase 0A.2 policies, grants, functions, and Storage limits remain.
7. Reapply Phase 0B.1 and rerun persona tests.

## After tenant adoption

Do not use this rollback after organizations or tenant keys contain data.
Prepare a forward corrective migration instead. Restoring only the frontend
role reader is independently reversible by reverting the `AuthContext.tsx`
change; that does not remove or weaken database authorization.
