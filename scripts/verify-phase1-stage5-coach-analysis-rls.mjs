import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const repositoryRoot = resolve(import.meta.dirname, "..");
const migrationPath = resolve(
  repositoryRoot,
  "supabase/migrations/20260814163053_phase1_stage5_coach_analysis_rls.sql",
);
const rollbackPath = resolve(
  repositoryRoot,
  "supabase/rollback/20260814163053_phase1_stage5_coach_analysis_rls_rollback.sql",
);

function isTransactional(sql) {
  return /^\s*(?:--[^\n]*\n)*begin;/i.test(sql) && /commit;\s*$/i.test(sql);
}

export function validateCoachAnalysisRls(migration, rollback) {
  const errors = [];
  const requiredMigrationGuards = [
    /create or replace function private\.can_read_rider\s*\(/i,
    /p_rider_id = \(select auth\.uid\(\)\)/i,
    /from public\.guardian_riders as link/i,
    /link\.active/i,
    /from public\.coach_rider_assignments as assignment/i,
    /assignment\.organization_id = p_organization_id/i,
    /assignment\.coach_id = \(select auth\.uid\(\)\)/i,
    /assignment\.rider_id = p_rider_id/i,
    /assignment\.active/i,
    /private\.has_organization_role\([\s\S]*?assignment\.organization_id,[\s\S]*?array\['coach'\][\s\S]*?\)/i,
    /private\.is_platform_admin\(\)/i,
    /array\['academy_admin', 'stable_manager'\]/i,
    /security definer/i,
    /set search_path = ''/i,
    /revoke all on function private\.can_read_rider\(uuid, uuid\) from public, anon/i,
    /grant execute on function private\.can_read_rider\(uuid, uuid\) to authenticated/i,
  ];

  for (const guard of requiredMigrationGuards) {
    if (!guard.test(migration)) errors.push(`missing required guard: ${guard}`);
  }

  if (!isTransactional(migration))
    errors.push("migration must be transactional");
  if (!isTransactional(rollback)) errors.push("rollback must be transactional");
  if (/auth\.role\s*\(/i.test(`${migration}\n${rollback}`)) {
    errors.push("must not use deprecated auth.role()");
  }
  if (/create policy|alter policy|drop policy/i.test(migration)) {
    errors.push("migration must not replace any RLS policy");
  }
  if (
    /\b(?:insert|update|delete)\s+(?:into\s+|from\s+)?public\./i.test(migration)
  ) {
    errors.push("migration must not mutate application rows");
  }
  if (/from public\.coach_rider_assignments/i.test(rollback)) {
    errors.push("rollback must remove coach-assignment access");
  }

  const rollbackGuards = [
    /create or replace function private\.can_read_rider\s*\(/i,
    /from public\.guardian_riders as link/i,
    /link\.active/i,
    /private\.is_platform_admin\(\)/i,
    /array\['academy_admin', 'stable_manager'\]/i,
    /revoke all on function private\.can_read_rider\(uuid, uuid\) from public, anon/i,
    /grant execute on function private\.can_read_rider\(uuid, uuid\) to authenticated/i,
  ];
  for (const guard of rollbackGuards) {
    if (!guard.test(rollback)) errors.push(`rollback missing guard: ${guard}`);
  }

  return errors;
}

if (process.argv[1] === import.meta.filename) {
  const [migration, rollback] = await Promise.all([
    readFile(migrationPath, "utf8"),
    readFile(rollbackPath, "utf8"),
  ]);
  const errors = validateCoachAnalysisRls(migration, rollback);
  if (errors.length) throw new Error(errors.join("\n"));
  console.log(
    "Verified active coach-rider reads are added without changing write policies or existing access paths",
  );
}
