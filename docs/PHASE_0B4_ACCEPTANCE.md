# Phase 0B.4 — active-organization data scoping acceptance

Date: 2026-08-12

## Scope

Phase 0B.4 makes the selected organization an explicit query and mutation
boundary throughout the existing EquiVista application. It does not change the
live database schema or relax Row Level Security.

Tenant-bearing reads now filter `organization_id` for:

- horses and horse analyses;
- riding analyses and progress history;
- lessons and organization coach selection;
- membership plans and current memberships;
- checkout plan lookup;
- invoices and invoice details;
- dashboard lesson, membership, analysis, invoice, horse, and trend queries.

New horse, lesson, and video-analysis writes require an active organization and
persist its ID. Horse and lesson updates also include the active organization in
their update predicate. Users without an organization remain in explicit legacy
read mode (`organization_id is null`) and cannot create tenant data.

## Live post-adoption personas

The transactional, read-only simulator passed for:

- `admin@equivista.net`: one organization, one horse, ten analyses, four
  lessons, three plans, one membership, and two invoices;
- `trainer@demo.equivista.net`: one organization, one own membership, and four
  assigned lessons;
- outsider legacy rider: no organization, horse, analysis, lesson, membership,
  or invoice visibility.

The simulator sets both authenticated JWT role and subject claims and rolls back
without changing rows.

## Frontend evidence

- strict TypeScript: pass;
- production Vite build: pass (`PORT=4173 BASE_PATH=/`);
- `git diff --check`: pass;
- organization switching is a dependency of every tenant-scoped query, so
  changing the active organization triggers a refetch;
- tenant writes fail closed when no active organization is selected.

The TypeScript check, production Vite build, and `git diff --check` were rerun
successfully after the live Phase 0B.5 and Phase 0B.6 database deployments.

## Remaining database cleanup

The legacy `membership_plans` policy still uses deprecated `auth.role()` and
several pre-tenancy policies have advisor performance notices. Those policy
changes require a dedicated migration, rollback, disposable-branch persona
round trip, and separate approval before live deployment.
