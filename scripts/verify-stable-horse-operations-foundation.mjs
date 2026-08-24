import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const migrationPath = resolve(
  root,
  "supabase/migrations/20260824100000_stable_horse_operations_foundation.sql",
);
const rollbackPath = resolve(
  root,
  "supabase/rollback/20260824100000_stable_horse_operations_foundation_rollback.sql",
);
const pagePath = resolve(
  root,
  "artifacts/equus-voyages/src/pages/StableOperationsPage.tsx",
);

function transactional(sql) {
  return /^\s*(?:--[^\n]*\n)*begin;/i.test(sql) && /commit;\s*$/i.test(sql);
}

export function validateStableHorseOperationsFoundation({
  migration,
  rollback,
  page,
}) {
  const errors = [];
  if (!transactional(migration)) errors.push("migration must be transactional");
  if (!transactional(rollback)) errors.push("rollback must be transactional");
  if (/auth\.role\s*\(/i.test(`${migration}\n${rollback}`)) {
    errors.push("must not use deprecated auth.role()");
  }
  if (
    /create policy [^\n]+\s*\non [^\n]+\s+for [^\n]+\s+to\s+(?:public|anon)\b/i.test(
      migration,
    )
  ) {
    errors.push("operational policies must not target public or anon");
  }
  if (/using\s*\(\s*true\s*\)|with check\s*\(\s*true\s*\)/i.test(migration)) {
    errors.push("operational RLS policies must not be unconditional");
  }

  for (const table of [
    "horse_operation_profiles",
    "horse_operation_holds",
    "horse_care_schedules",
    "stable_tasks",
    "horse_operation_audit_events",
  ]) {
    if (!new RegExp(`create table public\\.${table}\\s*\\(`, "i").test(migration)) {
      errors.push(`missing ${table} table`);
    }
    if (
      !new RegExp(
        `alter table public\\.${table} enable row level security;`,
        "i",
      ).test(migration)
    ) {
      errors.push(`${table} must enable RLS`);
    }
    if (!new RegExp(`drop table if exists public\\.${table};`, "i").test(rollback)) {
      errors.push(`${table} rollback is missing`);
    }
  }

  const requiredGuards = [
    [/ownership_type in \('academy', 'personal', 'guest'\)/, "ownership states are required"],
    [/availability_state text not null default 'unavailable'/, "availability must default fail-closed"],
    [/availability_approved boolean not null default false/, "availability approval must default fail-closed"],
    [/insert into public\.horse_operation_profiles[\s\S]*?'unavailable', false/, "existing horses must be backfilled as unapproved"],
    [/hold_type in \('rest', 'injury', 'veterinary', 'welfare'\)/, "welfare hold states are required"],
    [/care_type in \('veterinary', 'farrier', 'vaccination', 'routine_care'\)/, "care schedule types are required"],
    [/task_type in \('feeding', 'turnout', 'tack_equipment', 'safety_check', 'routine_care'\)/, "stable task types are required"],
    [/references public\.horses\(id, organization_id\) on delete set null \(horse_id\)/, "horse deletion must retain a stable task's organization scope"],
    [/create function public\.assert_horse_assignment_allowed/, "booking eligibility guard is required"],
    [/create trigger lessons_horse_operation_assignment_guard/, "lesson assignment trigger is required"],
    [/horse has an active welfare or care hold during this assignment/, "active holds must block assignments"],
    [/horse workload limit would be exceeded by this assignment/, "workload must block unsuitable assignments"],
    [/limited horse availability requires staff confirmation/, "limited assignments must require staff confirmation"],
    [/create function private\.lock_horse_operation/, "horse assignment checks must use a transaction-scoped per-horse lock"],
    [/pg_advisory_xact_lock/, "horse operation lock must be transaction-scoped"],
    [/perform private\.lock_horse_operation\(p_organization_id, p_horse_id\);/, "lesson assignments must acquire the horse operation lock"],
    [/create trigger horse_operation_profiles_prevent_delete/, "profiles must prevent deletion from bypassing eligibility"],
    [/horse operation profiles cannot be deleted; mark them unavailable and unapproved instead/, "profile deletion must fail closed"],
    [/if pg_trigger_depth\(\) > 1 then\s+return old;/, "profile delete guard must preserve canonical horse cascade cleanup"],
    [/horse operation profiles cannot be reassigned/, "profile identity must be immutable"],
    [/horse operation holds cannot be reassigned/, "hold identity must be immutable"],
    [/create trigger horse_operation_holds_prepare_delete/, "hold deletion must use the horse operation lock"],
    [/create trigger horses_horse_operation_status_lock/, "canonical horse status changes must use the horse operation lock"],
    [/private\.can_read_safe_horse_availability/, "safe availability access helper is required"],
    [/private\.can_guardian_access_rider/, "guardian safe output must use verified-link access"],
    [/create function public\.get_safe_horse_availability/, "curated safe availability output is required"],
    [/create function public\.get_stable_operations_roster/, "staff roster RPC is required for coach preview access"],
    [/grant execute on function public\.get_stable_operations_roster\(uuid\) to authenticated;/, "staff roster RPC must grant authenticated execution only"],
    [/safe_message text\n\)/, "safe availability output must stop at curated fields"],
    [/private_welfare_note text/, "private welfare notes are required"],
    [/private\.can_manage_stable_operations/, "staff permission helper is required"],
    [/array\['academy_admin', 'coach'\]/, "private operational access must be limited to academy admins and coaches"],
    [/create function private\.audit_horse_operation_change/, "append-only audit writer is required"],
    [/insert into public\.audit_events/, "generic audit events must be written"],
    [/'stable_operations\.' \|\| lower\(tg_op\),\s+v_generic_before,\s+v_generic_after/, "generic audit records must use sanitized operational snapshots"],
    [/'system',\s+\(select auth\.uid\(\)\),\s+case tg_table_name/, "generic audit records must use a canonical source value"],
    [/tg_table_name in \('horse_operation_profiles', 'horse_operation_holds', 'horse_care_schedules'\)/, "horse deletion cascade audit must cover every cascading operational record"],
    [/v_entity_id := v_horse_id;\s+end if;\s+v_horse_id := null;/, "horse deletion cascade audit must retain identity without a deleting horse foreign key"],
    [/tg_table_name = 'stable_tasks'[\s\S]*?and \(v_after ->> 'horse_id'\) is null[\s\S]*?v_horse_id := null;/, "horse deletion task audit must not restore a deleting horse foreign key"],
    [/horse_operation_audit_staff_select/, "audit client access must be select-only"],
    [/grant select on public\.horse_operation_audit_events to authenticated;/, "audit table must not grant client mutations"],
    [/revoke all on function private\.audit_horse_operation_change\(\) from public, anon, authenticated, service_role;/, "audit writer must be internal only"],
  ];
  for (const [pattern, message] of requiredGuards) {
    if (!pattern.test(migration)) errors.push(message);
  }
  const safeAvailabilityFunction =
    migration.match(/create function public\.get_safe_horse_availability[\s\S]*?\$\$;/i)?.[0] ?? "";
  if (/ownership_type|workload_limit_minutes_7d/i.test(safeAvailabilityFunction)) {
    errors.push("safe availability output must not expose internal ownership or workload configuration");
  }
  const operationalAuditFunction =
    migration.match(/create function private\.audit_horse_operation_change[\s\S]*?\$\$;/i)?.[0] ?? "";
  for (const [snapshot, source] of [
    ["v_generic_before", "v_before"],
    ["v_generic_after", "v_after"],
  ]) {
    const sanitizedSnapshot =
      operationalAuditFunction.match(
        new RegExp(`${snapshot} := ${source} - array\\[([\\s\\S]*?)\\];`),
      )?.[1] ?? "";
    if (
      !["private_operations_note", "private_welfare_note", "private_care_note", "private_task_note"].every(
        (field) => sanitizedSnapshot.includes(`'${field}'`),
      )
    ) {
      errors.push("generic audit records must remove every private operational note");
      break;
    }
  }
  if (
    !/when horse\.status <> 'active' then 'unavailable'/.test(safeAvailabilityFunction) ||
    !/when horse\.status <> 'active' then 'This horse is not active for lesson assignment\.'/.test(safeAvailabilityFunction)
  ) {
    errors.push("safe availability must mark non-active horses unavailable");
  }
  const staffRosterFunction =
    migration.match(/create function public\.get_stable_operations_roster[\s\S]*?\$\$;/i)?.[0] ?? "";
  if (!/private\.can_manage_stable_operations\(p_organization_id\)/.test(staffRosterFunction)) {
    errors.push("staff roster RPC must remain restricted to stable operations staff");
  }
  const profileAndHoldPrepares =
    migration.match(/create function private\.prepare_horse_operation_(?:profile|hold)\(\)[\s\S]*?\$\$;/gi) ?? [];
  if (
    profileAndHoldPrepares.length !== 2 ||
    profileAndHoldPrepares.some((body) => !/perform private\.lock_horse_operation\(new\.organization_id, new\.horse_id\);/i.test(body))
  ) {
    errors.push("profile and hold changes must acquire the horse operation lock");
  }
  const holdDeleteGuard =
    migration.match(/create function private\.prepare_horse_operation_hold_delete[\s\S]*?\$\$;/i)?.[0] ?? "";
  if (
    !/private\.can_manage_stable_operations\(old\.organization_id\)/.test(holdDeleteGuard) ||
    !/perform private\.lock_horse_operation\(old\.organization_id, old\.horse_id\);/.test(holdDeleteGuard)
  ) {
    errors.push("hold deletion must verify staff access and acquire the horse operation lock");
  }
  if (
    !/drop trigger if exists horse_operation_holds_prepare_delete/i.test(rollback) ||
    !/drop function if exists private\.prepare_horse_operation_hold_delete\(\)/i.test(rollback)
  ) {
    errors.push("hold delete guard rollback is missing");
  }
  const horseStatusLock =
    migration.match(/create function private\.lock_horse_operation_status_change[\s\S]*?\$\$;/i)?.[0] ?? "";
  if (
    !/new\.status is distinct from old\.status/.test(horseStatusLock) ||
    !/perform private\.lock_horse_operation\(old\.organization_id, old\.id\);/.test(horseStatusLock)
  ) {
    errors.push("canonical horse status changes must acquire the horse operation lock");
  }
  if (
    !/drop trigger if exists horses_horse_operation_status_lock/i.test(rollback) ||
    !/drop function if exists private\.lock_horse_operation_status_change\(\)/i.test(rollback)
  ) {
    errors.push("horse status lock rollback is missing");
  }
  if (!/drop trigger if exists horse_operation_profiles_prevent_delete/i.test(rollback)
    || !/drop function if exists private\.prevent_horse_operation_profile_delete\(\)/i.test(rollback)) {
    errors.push("profile delete guard rollback is missing");
  }

  if (
    /create policy horse_operation_audit_[\s\S]*?for\s+(?:insert|update|delete)/i.test(
      migration,
    )
  ) {
    errors.push("audit history must be append-only to clients");
  }
  if (!/preview|read-only/i.test(page)) {
    errors.push("UI must communicate the preview-only boundary");
  }
  if (/\.(?:insert|update|delete|upsert)\s*\(/.test(page)) {
    errors.push("preview UI must not perform operational mutations");
  }
  return errors;
}

const [migration, rollback, page] = await Promise.all([
  readFile(migrationPath, "utf8"),
  readFile(rollbackPath, "utf8"),
  readFile(pagePath, "utf8"),
]);
const errors = validateStableHorseOperationsFoundation({ migration, rollback, page });
if (errors.length) {
  throw new Error(
    `Stable & Horse Operations Foundation validation failed:\n- ${errors.join("\n- ")}`,
  );
}
console.log("Verified stable operations schema, RLS, safeguards, audit history, and read-only UI boundary");