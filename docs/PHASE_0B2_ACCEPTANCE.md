# Phase 0B.2 development acceptance evidence

Date: 2026-08-12

## Environment

- Production project: `gtogwivozgrmjnrtungm`
- Disposable branch: `phase-0b2-organization-operations`
- Branch project ref: `nyjnajlhbuibsolsacjk`
- Repository branch: `codex/equivista-phase-0b2`

The disposable branch had no canonical migration ledger, so the existing
ADR-001 development fixture was applied before Phase 0A.2, Phase 0B.1, and
Phase 0B.2. No production SQL was executed.

## Database round trip

1. Canonical branch fixture: pass
2. Phase 0A.2 migration: pass
3. Phase 0B.1 migration: pass
4. Phase 0B.2 migration: pass
5. Phase 0B.1 personas: pass
6. Phase 0B.2 personas: pass
7. Phase 0B.2 rollback: pass
8. Rollback verification: pass
   - Phase 0B.1 organizations table preserved
   - Phase 0B.1 RBAC helpers preserved
   - four public Phase 0B.2 RPCs removed
   - five private Phase 0B.2 implementations removed
   - Phase 0B.2 index removed
   - organization, membership, and audit rows unchanged at zero
9. Phase 0B.2 reapply: pass
10. Both persona suites after reapply: pass

## Security evidence

- Public RPCs: `4`, all `SECURITY INVOKER`
- Private implementations: `5`, all `SECURITY DEFINER`
- Private implementations with `set search_path = ''`: `5`
- Anonymous access to member-management RPC: denied
- Authenticated access to guarded member-management RPC: granted
- Phase 0B.2 Security Advisor findings: `0`
- Phase 0B.2 non-informational Performance Advisor findings: `0`
- Composite horse-access FK index: present
- The new index has only the expected unused-index `INFO` notice on the fresh
  branch: [Supabase advisor reference](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index)
- Foundation rows after transactional tests: `0`

The disposable branch also contained legacy migration artifacts, producing
unrelated advisor findings for deprecated tables and functions. None named a
Phase 0B.2 RPC, implementation, table, policy, or constraint.

## Persona coverage

- rider denied organization member listing and mutations;
- academy admin allowed to manage non-admin roles in own tenant;
- academy admin denied cross-tenant access;
- academy admin denied assigning or changing academy-admin access;
- platform admin allowed to create an organization and assign academy-admin;
- direct authenticated writes to organization tables remain denied;
- every authorized organization/member mutation writes an audit event;
- public wrappers remain invoker functions and private implementations retain
  fixed search paths.

## Frontend and repository checks

- EquiVista strict TypeScript: pass
- EquiVista production Vite build: pass
- route chunking retained; organization page builds as an independent chunk
- English/Arabic translation parity: `681` leaves each, no missing keys
- `git diff --check`: pass

## Production preservation

Production Phase 0B.1 remains live and unchanged. Phase 0B.2 creates no
organization, assigns no platform role, performs no legacy backfill, and was
not applied to production.
