import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const [migration, hardeningMigration, page, hook, app, shell, persona, english, arabic] = await Promise.all([
  readFile(resolve(root, "supabase/migrations/20260826090000_staff_arena_academy_operations.sql"), "utf8"),
  readFile(resolve(root, "supabase/migrations/20260826110000_review_security_hardening.sql"), "utf8"),
  readFile(resolve(root, "artifacts/equus-voyages/src/pages/AcademyOperationsPage.tsx"), "utf8"),
  readFile(resolve(root, "artifacts/equus-voyages/src/hooks/use-academy-operations.ts"), "utf8"),
  readFile(resolve(root, "artifacts/equus-voyages/src/App.tsx"), "utf8"),
  readFile(resolve(root, "artifacts/equus-voyages/src/components/AppShell.tsx"), "utf8"),
  readFile(resolve(root, "artifacts/equus-voyages/src/lib/portal-persona.ts"), "utf8"),
  readFile(resolve(root, "artifacts/equus-voyages/src/i18n/en.json"), "utf8"),
  readFile(resolve(root, "artifacts/equus-voyages/src/i18n/ar.json"), "utf8"),
]);

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
for (const [workspaceName, workspaceFunction] of [
  ["Batch 6", migration.match(/create function public\.get_academy_operations_workspace[\s\S]*?\n\$\$;/)?.[0] ?? ""],
  ["forward hardening", hardeningMigration.match(/create or replace function public\.get_academy_operations_workspace[\s\S]*?\n\$\$;/)?.[0] ?? ""],
]) {
  for (const [relation, orderedField] of [
    ["academy_staff_profiles", "v.display_name_en"],
    ["academy_staff_shifts", "v.starts_at"],
    ["academy_facility_inspections", "v.inspected_at desc"],
    ["academy_maintenance_work_orders", "v.due_at nulls last"],
    ["academy_payroll_calculations", "v.period_end desc"],
    ["academy_commission_calculations", "v.period_end desc"],
  ]) {
    assert.match(
      workspaceFunction,
      new RegExp(`jsonb_agg\\(\\(to_jsonb\\(v\\) - 'private_note'\\) order by ${orderedField.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\) from public\\.${relation}\\b`),
      `${workspaceName} workspace must redact private_note before it enters the payload from ${relation}.`,
    );
  }
}
const workspaceFunction = migration.match(/create function public\.get_academy_operations_workspace[\s\S]*?\n\$\$;/)?.[0] ?? "";
for (const key of ["staffProfiles", "availability", "shifts", "leave", "coachAllocations", "resources", "bookings", "lessonCapacity", "inspections", "workOrders", "alerts", "payroll", "commissions"]) {
  assert.match(workspaceFunction, new RegExp(`'${key}'`), `Workspace must preserve the ${key} response key.`);
}
assert.match(hardeningMigration, /create or replace function public\.get_academy_operations_workspace/, "Forward hardening must correct already-applied Batch 6 databases.");

for (const section of [
  "Staff roster & availability",
  "Availability, shifts, leave & coach allocation",
  "Arenas & equipment",
  "Book an arena or equipment item",
  "Lesson capacity & bookings",
  "Inspections, work orders & alerts",
  "Approval-only payroll & commission calculations",
]) {
  assert.match(page, new RegExp(section.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `Dashboard must expose ${section}.`);
}
for (const localizedField of ["الاسم بالعربية", "المهام بالعربية", "ملاحظة بالعربية", "الغرض بالعربية", "النتائج بالعربية", "الإجراء بالعربية"]) {
  assert.match(page, new RegExp(localizedField), `Dashboard must expose the Arabic field ${localizedField}.`);
}
assert.match(page, /shift\.status !== "cancelled" && new Date\(shift\.ends_at\)\.getTime\(\) >= Date\.now\(\)/, "Upcoming-shift metric must not count completed shifts.");
for (const accessibleName of [
  "Availability starts at",
  "Shift starts at",
  "Booking starts at",
  "Lesson capacity",
  "Work order due date and time",
  "Payroll period start date",
  "Commission period start date",
]) {
  assert.match(page, new RegExp(`aria-label="${accessibleName}"`), `${accessibleName} must be exposed to assistive technology.`);
}
for (const rpc of [
  "get_academy_operations_access",
  "get_academy_operations_workspace",
  "upsert_academy_staff_profile",
  "upsert_academy_staff_availability",
  "upsert_academy_staff_shift",
  "upsert_academy_staff_leave",
  "upsert_academy_coach_allocation",
  "upsert_academy_resource",
  "upsert_academy_resource_booking",
  "upsert_academy_lesson_capacity",
  "upsert_academy_facility_inspection",
  "upsert_academy_maintenance_work_order",
  "create_academy_operations_alert",
  "upsert_academy_payroll_calculation",
  "upsert_academy_commission_calculation",
  "approve_academy_payroll_calculation",
  "approve_academy_commission_calculation",
]) {
  assert.match(hook, new RegExp(rpc), `Dashboard hook must call ${rpc}.`);
}
assert.match(app, /path="\/academy-operations"/, "Academy Operations must have a routed page.");
assert.match(shell, /path !== "\/academy-operations"[\s\S]*academyOperationsAccess\.data\?\.canManage/, "Navigation must be gated by the server-side manage decision.");
assert.match(persona, /"\/academy-operations"/, "Academy Operations must be within the academy-admin portal boundary.");
assert.equal(JSON.parse(english).translation.nav.academyOperations, "Academy Operations", "English navigation copy must exist.");
assert.equal(JSON.parse(arabic).translation.nav.academyOperations, "عمليات الأكاديمية", "Arabic navigation copy must exist.");
console.log("Staff, arena, and academy operations static controls verified.");