# Stable & Horse Operations Foundation

## Scope and release boundary

This foundation adds tenant-scoped operational records for horses, assignment availability, workload limits, welfare/care holds, routine care schedules, stable tasks, due-state visibility, and append-only audit history.

The browser route is deliberately preview-only. It reads existing horse information and presents operational scenarios without creating, updating, deleting, booking, or assigning operational records. This release does not apply a production migration, write production data, publish or deploy a service, change pilot personas, analyze medical/soundness data, or integrate external systems.

## State model

- A horse profile declares **academy**, **personal**, or **guest** ownership.
- Operational availability is **available**, **limited**, or **unavailable**. New and backfilled profiles default to unavailable and require explicit staff approval before they can be assigned.
- **Limited** availability requires an explicit staff-confirmed assignment; riders cannot self-confirm it.
- Operational profiles and holds remain attached to their original horse. Direct profile deletion is blocked; staff must explicitly mark it unavailable and unapproved instead. Canonical horse removal retains its existing database cascade cleanup.
- Holds are **rest**, **injury**, **veterinary**, or **welfare** holds. An active overlapping hold blocks a lesson assignment.
- Care schedules support veterinary, farrier, vaccination, and routine-care due dates. Scheduled items that pass their due date are visible as overdue in the operations summary.
- Stable tasks support feeding, turnout, tack/equipment, safety checks, and routine care. Open or in-progress tasks that pass their due time are operationally overdue.
- The lesson trigger and reusable `assert_horse_assignment_allowed` function both apply the active-hold and rolling seven-day workload checks. The current canonical assignment surface is `public.lessons`; any future booking surface must call the same function before confirming a horse assignment. The incompatible legacy `academy_id` lesson schema is intentionally not reintroduced.

## Permission and privacy matrix

| Role | Private operational profile, holds, care, tasks, audit | Safe approved horse availability |
| --- | --- | --- |
| Academy Admin | Read and manage | Read |
| Coach | Read and manage | Read |
| Rider | No direct private-table access | Only horses assigned to the rider |
| Guardian | No direct private-table access | Only horses attached to a verified guardian/rider link |

Private welfare, care, and task notes never appear in the curated availability function. The safe output contains only horse identity, the approval-gated availability state, and a short staff-curated availability message; internal ownership and workload configuration are not audience fields. All operational tables and helpers are organization-scoped; policies fail closed for any role outside the matrix.

## Audit behavior

Changes to profiles, holds, schedules, and tasks write both the generic `audit_events` stream and a dedicated private `horse_operation_audit_events` history. When a canonical horse is deleted, its operational profile, hold, and care-schedule cascades retain private audit records without live horse foreign keys; linked stable tasks retain their organization scope and become unassigned. Authenticated clients can only select the dedicated history through the staff policy; they cannot insert, update, or delete audit rows.

The preview reads the private roster through a dedicated staff-only RPC for Academy Admins and Coaches. Riders and guardians never query the canonical horse roster from this surface; they receive only the existing curated availability RPC output.

## Validation and rollback

Run:

```sh
pnpm verify:supabase
pnpm --filter @workspace/equus-voyages typecheck
pnpm --filter @workspace/equus-voyages build
pnpm --filter @workspace/equus-voyages test:server
```

The Supabase validation chain checks the ordered migration ledger, structural schema contract, RLS, private-note boundary, guardian-safe output, workload/hold guards, audit immutability, rollback coverage, and the preview-only UI boundary.

To reverse only this foundation in a non-production environment, use `supabase/rollback/20260824100000_stable_horse_operations_foundation_rollback.sql`. The rollback removes this foundation's trigger, helpers, policies, and tables only; it intentionally does not alter canonical horses, lessons, or legacy health records.