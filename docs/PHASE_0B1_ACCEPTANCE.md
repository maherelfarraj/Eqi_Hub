# Phase 0B.1 development acceptance evidence

Date: 2026-08-12

## Environment

- Production project: `gtogwivozgrmjnrtungm`
- Disposable branch: `phase-0b1-tenancy-rbac`
- Branch project ref: `qgfxrmhelmdcglsqgruk`
- Repository branch: `codex/equivista-phase-0b1`

The Supabase branch initially reported `MIGRATIONS_FAILED` while replaying the
known obsolete migration history. Its database remained healthy. The canonical
ADR-001 fixture was therefore applied to the disposable branch before Phase
0A.2 and Phase 0B.1. No production SQL was executed.

## Database round trip

1. Canonical branch fixture: pass
2. Phase 0A.2 migration: pass
3. Phase 0B.1 migration: pass
4. Phase 0A.2 personas: pass
5. Phase 0B.1 personas: pass
6. Phase 0B.1 rollback: pass
7. Rollback verification: pass
   - Phase 0B.1 tables: `0`
   - tenant columns: `0`
   - Phase 0B.1 private helpers: absent
   - Phase 0A.2 horse helpers: present
   - video limit: `524288000`
8. Phase 0B.1 reapply: pass
9. Both persona suites after reapply: pass

## Security evidence

- New tables: `9`
- New tables with RLS: `9`
- New SELECT policies: `9`
- `anon` privileges on new tables: `0`
- authenticated non-SELECT privileges on new tables: `0`
- foundation rows after tests: `0`
- non-null tenant keys after tests: `0`
- Phase 0B.1 Security Advisor findings: `0`
- Phase 0B.1 non-informational Performance Advisor findings: `0`
- All three private RBAC helpers are `SECURITY DEFINER`, use
  `set search_path = ''`, and derive identity from `(select auth.uid())`.

## Persona coverage

- legacy rider
- legacy trainer
- legacy owner
- legacy admin
- organization rider
- organization coach
- guardian
- academy admin
- platform admin
- unrelated tenant

The suite also proves browser mutation denial and rejects cross-tenant guardian
and horse-access relationships with foreign-key violations.

## Frontend and repository checks

- EquiVista TypeScript: pass
- EquiVista production Vite build: pass
- workspace library TypeScript build: pass
- API server TypeScript and build: pass
- mockup TypeScript and build: pass
- scripts TypeScript: pass
- `git diff --check`: pass

## Production preservation

Read-only verification after branch testing:

- profiles: `3`
- horses: `1`
- lessons: `4`
- video analyses: `10`
- memberships: `1`
- invoices: `2`
- Phase 0B.1 production tables: `0`

Production deployment remains unapproved.
