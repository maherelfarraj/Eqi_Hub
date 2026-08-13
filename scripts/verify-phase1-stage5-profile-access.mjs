import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const repositoryRoot = resolve(import.meta.dirname, "..");
const migrationPath = resolve(
  repositoryRoot,
  "supabase/migrations/20260813222839_phase1_stage5_pilot_profile_access.sql",
);
const rollbackPath = resolve(
  repositoryRoot,
  "supabase/rollback/20260813222839_phase1_stage5_pilot_profile_access_rollback.sql",
);

export function validateStage5ProfileAccess(sql) {
  const errors = [];
  const required = [
    /create policy profiles_select_authorized/i,
    /from public\.coach_rider_assignments as assignment/i,
    /assignment\.coach_id = \(select auth\.uid\(\)\)/i,
    /assignment\.active/i,
    /array\['coach'\]/i,
    /from public\.organization_memberships as membership/i,
    /membership\.status = 'active'/i,
    /array\['academy_admin', 'stable_manager'\]/i,
    /from public\.guardian_riders as link/i,
    /link\.active/i,
  ];

  required.forEach((pattern) => {
    if (!pattern.test(sql)) errors.push(`missing required guard: ${pattern}`);
  });

  if (/auth\.role\s*\(/i.test(sql)) {
    errors.push("must not use deprecated auth.role()");
  }
  if (/create policy [\s\S]*? for (?:insert|update|delete|all)\b/i.test(sql)) {
    errors.push("Stage 5 must not create or replace write policies");
  }
  if (!/^begin;/im.test(sql) || !/commit;\s*$/i.test(sql)) {
    errors.push("migration must be transactional");
  }
  return errors;
}

if (process.argv[1] === import.meta.filename) {
  const [migration, rollback] = await Promise.all([
    readFile(migrationPath, "utf8"),
    readFile(rollbackPath, "utf8"),
  ]);
  const errors = validateStage5ProfileAccess(migration);
  if (!/create policy profiles_select_authorized/i.test(rollback)) {
    errors.push("rollback must restore the Stage 4 profile policy");
  }
  if (/coach_rider_assignments|organization_memberships/i.test(rollback)) {
    errors.push("rollback must not retain Stage 5 profile grants");
  }
  if (errors.length) throw new Error(errors.join("\n"));
  console.log(
    "Verified Stage 5 adds only active assigned-coach and organization-admin profile reads and includes rollback",
  );
}
