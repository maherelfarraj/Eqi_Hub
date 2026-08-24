import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { validateStableHorseOperationsFoundation } from "./verify-stable-horse-operations-foundation.mjs";

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

const [migration, rollback, page] = await Promise.all([
  readFile(migrationPath, "utf8"),
  readFile(rollbackPath, "utf8"),
  readFile(pagePath, "utf8"),
]);
const fixture = { migration, rollback, page };

assert.deepEqual(validateStableHorseOperationsFoundation(fixture), []);
assert.match(
  validateStableHorseOperationsFoundation({
    ...fixture,
    migration: migration.replace("availability_approved boolean not null default false", "availability_approved boolean not null default true"),
  }).join("\n"),
  /availability approval must default fail-closed/,
);
assert.match(
  validateStableHorseOperationsFoundation({
    ...fixture,
    migration: migration.replace("horse has an active welfare or care hold during this assignment", "hold check removed"),
  }).join("\n"),
  /active holds must block assignments/,
);
assert.match(
  validateStableHorseOperationsFoundation({
    ...fixture,
    migration: migration.replace("horse workload limit would be exceeded by this assignment", "workload check removed"),
  }).join("\n"),
  /workload must block unsuitable assignments/,
);
assert.match(
  validateStableHorseOperationsFoundation({
    ...fixture,
    migration: migration.replace("pg_advisory_xact_lock", "advisory lock removed"),
  }).join("\n"),
  /transaction-scoped/,
);
assert.match(
  validateStableHorseOperationsFoundation({
    ...fixture,
    migration: migration.replace(
      "perform private.lock_horse_operation(new.organization_id, new.horse_id);",
      "profile lock removed",
    ),
  }).join("\n"),
  /profile and hold changes must acquire the horse operation lock/,
);
assert.match(
  validateStableHorseOperationsFoundation({
    ...fixture,
    migration: migration.replace("horse operation profiles cannot be deleted; mark them unavailable and unapproved instead", "profile deletion allowed"),
  }).join("\n"),
  /profile deletion must fail closed/,
);
assert.match(
  validateStableHorseOperationsFoundation({
    ...fixture,
    migration: migration.replace("if pg_trigger_depth() > 1 then\n    return old;", "cascade cleanup blocked"),
  }).join("\n"),
  /preserve canonical horse cascade cleanup/,
);
assert.match(
  validateStableHorseOperationsFoundation({
    ...fixture,
    migration: migration.replace(
      "v_entity_id := v_horse_id;\n    end if;\n    v_horse_id := null;",
      "cascade audit keeps deleting horse foreign key",
    ),
  }).join("\n"),
  /cascade audit must retain identity without a deleting horse foreign key/,
);
assert.match(
  validateStableHorseOperationsFoundation({
    ...fixture,
    migration: migration.replace(
      "'horse_operation_profiles', 'horse_operation_holds', 'horse_care_schedules'",
      "'horse_operation_profiles'",
    ),
  }).join("\n"),
  /must cover every cascading operational record/,
);
assert.match(
  validateStableHorseOperationsFoundation({
    ...fixture,
    migration: migration.replace("limited horse availability requires staff confirmation", "limited assignment bypassed"),
  }).join("\n"),
  /limited assignments must require staff confirmation/,
);
assert.match(
  validateStableHorseOperationsFoundation({
    ...fixture,
    migration: migration.replace(
      "  horse_name text,\n  availability_state text,",
      "  horse_name text,\n  ownership_type text,\n  availability_state text,\n  workload_limit_minutes_7d integer,",
    ),
  }).join("\n"),
  /must not expose internal ownership or workload configuration/,
);
assert.match(
  validateStableHorseOperationsFoundation({
    ...fixture,
    migration: migration.replace("insert into public.horse_operation_profiles", "profile backfill removed"),
  }).join("\n"),
  /existing horses must be backfilled as unapproved/,
);
assert.match(
  validateStableHorseOperationsFoundation({
    ...fixture,
    migration: migration.replace("private.can_guardian_access_rider", "guardian check removed"),
  }).join("\n"),
  /guardian safe output must use verified-link access/,
);
assert.match(
  validateStableHorseOperationsFoundation({
    ...fixture,
    page: `${page}\nvoid supabase.from("stable_tasks").insert({});`,
  }).join("\n"),
  /must not perform operational mutations/,
);
console.log("Verified stable operations regression guards reject fail-open, privacy, workload, and mutation variants");