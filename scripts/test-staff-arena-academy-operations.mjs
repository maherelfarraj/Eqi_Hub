import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const migration = await readFile(resolve(root, "supabase/migrations/20260826090000_staff_arena_academy_operations.sql"), "utf8");

for (const relation of [
  "academy_staff_profiles", "academy_staff_shifts", "academy_staff_leave", "academy_resource_bookings",
  "academy_lesson_capacity_controls", "academy_facility_inspections", "academy_maintenance_work_orders",
  "academy_payroll_calculations", "academy_commission_calculations", "academy_operations_audit_events",
]) {
  assert.match(migration, new RegExp(`alter table public\\.${relation} enable row level security`), `${relation} must enable RLS`);
  assert.match(migration, new RegExp(`revoke all on table public\\.${relation} from anon, authenticated`), `${relation} must revoke direct client access`);
}
assert.match(migration, /enabled boolean not null default false/, "The feature must default off.");
assert.match(migration, /array\['academy_admin', 'accountant'\]/, "Compensation access must use existing financial roles.");
assert.match(migration, /only academy administrators may approve payroll calculations/, "Payroll approval must be explicitly gated.");
assert.match(migration, /only academy administrators may approve commission calculations/, "Commission approval must be explicitly gated.");
assert.match(migration, /approved payroll calculations are immutable/, "Approved payroll must be immutable.");
assert.match(migration, /approved commission calculations are immutable/, "Approved commission must be immutable.");
assert.match(migration, /only submitted payroll calculations may be approved/, "Payroll approvals must have a protected transition.");
assert.match(migration, /only submitted commission calculations may be approved/, "Commission approvals must have a protected transition.");
assert.match(migration, /academy_payroll_calculations where id = v_id and organization_id = p_organization_id for update/, "Payroll mutation must lock an existing record before evaluating approval state.");
assert.match(migration, /academy_commission_calculations where id = v_id and organization_id = p_organization_id for update/, "Commission mutation must lock an existing record before evaluating approval state.");
assert.match(migration, /create extension if not exists btree_gist/, "Concurrent scheduling controls require GiST equality support.");
assert.match(migration, /academy_staff_shifts_no_overlapping_active_ranges/, "Staff shifts must have a database-enforced overlap constraint.");
assert.match(migration, /academy_resource_bookings_no_overlapping_active_ranges/, "Resource bookings must have a database-enforced overlap constraint.");
assert.match(migration, /create function private\.lock_academy_staff_schedule/, "Shift and approved leave decisions must serialize per staff member.");
assert.match(migration, /perform private\.lock_academy_staff_schedule\(p_organization_id, p_staff_profile_id\);/, "Shift and approved leave mutations must take the schedule lock before checking conflicts.");
assert.match(migration, /resource booking conflicts with an existing booking/, "Bookings must be conflict-checked server-side.");
assert.match(migration, /staff shift conflicts with approved leave/, "Shifts must be checked against approved leave.");
assert.match(migration, /confirmed lesson count exceeds capacity/, "Capacity must be enforced server-side.");
assert.match(migration, /academy operations record belongs to a different organization/, "ID-based upserts must reject cross-tenant records.");
for (const entity of ["staff_profile", "availability", "shift", "leave", "coach_allocation", "resource", "booking", "inspection", "work_order", "payroll_calculation", "commission_calculation"]) {
  assert.match(migration, new RegExp(`assert_academy_operation_record_organization\\(p_organization_id, '${entity}'`), `${entity} mutation must check record ownership.`);
}
assert.match(migration, /foreign key \(staff_profile_id, organization_id\)/, "Bookings must reference organization-scoped staff profiles.");
assert.doesNotMatch(migration, /\b(create payment|create payout|payment provider|stripe)\b/i, "Batch 6 must not process payments.");
console.log("Staff, arena, and academy operations static controls verified.");