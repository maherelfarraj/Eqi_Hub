import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { validateStableOperationsConsole } from "./verify-stable-operations-console.mjs";

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFile(resolve(root, path), "utf8");
const [migration, rollback, page, hook] = await Promise.all([
  read("supabase/migrations/20260824120000_stable_operations_console_daily_workflows.sql"),
  read("supabase/rollback/20260824120000_stable_operations_console_daily_workflows_rollback.sql"),
  read("artifacts/equus-voyages/src/pages/StableOperationsPage.tsx"),
  read("artifacts/equus-voyages/src/hooks/use-stable-operations-console.ts"),
]);
const fixture = { migration, rollback, page, hook };

assert.deepEqual(validateStableOperationsConsole(fixture), []);
assert.match(
  validateStableOperationsConsole({
    ...fixture,
    migration: migration.replace("p_exclude_lesson_id uuid default null", "lesson exclusion removed"),
  }).join("\n"),
  /p_exclude_lesson_id/,
);
assert.match(
  validateStableOperationsConsole({
    ...fixture,
    migration: migration.replace("perform private.lock_horse_operation(p_organization_id, p_horse_id)", "lock removed"),
  }).join("\n"),
  /lock_horse_operation/,
);
assert.match(
  validateStableOperationsConsole({
    ...fixture,
    migration: migration.replace("released or expired horse operation holds are immutable", "closed holds can reopen"),
  }).join("\n"),
  /closed holds must be immutable/,
);
assert.match(
  validateStableOperationsConsole({
    ...fixture,
    page: `${page}\nvoid supabase.from("stable_tasks").insert({});`,
  }).join("\n"),
  /direct mutations/,
);
console.log("Verified Batch 2 workflow guard regression cases");