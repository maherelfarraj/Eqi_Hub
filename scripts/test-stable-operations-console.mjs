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
    migration: migration.replaceAll("perform private.lock_horse_operation(p_organization_id, p_horse_id)", "lock removed"),
  }).join("\n"),
  /lock_horse_operation/,
);
assert.match(
  validateStableOperationsConsole({
    ...fixture,
    migration: migration.replace(
      "if not private.can_read_safe_horse_availability(p_organization_id, p_horse_id) then",
      "safe non-staff access removed",
    ),
  }).join("\n"),
  /safe non-staff availability access/,
);
assert.match(
  validateStableOperationsConsole({
    ...fixture,
    migration: migration.replace(
      "if not private.can_manage_stable_operations(p_organization_id) then\n    raise exception 'academy administrator or coach access required for assignment eligibility' using errcode = '42501';\n  end if;\n  perform private.lock_horse_operation(p_organization_id, p_horse_id);",
      "perform private.lock_horse_operation(p_organization_id, p_horse_id);\n  if not private.can_manage_stable_operations(p_organization_id) then\n    raise exception 'academy administrator or coach access required for assignment eligibility' using errcode = '42501';\n  end if;",
    ),
  }).join("\n"),
  /authorize before acquiring/,
);
assert.match(
  validateStableOperationsConsole({
    ...fixture,
    migration: migration.replace(
      "  if not exists (\n    select 1 from public.horses\n    where id = p_horse_id and organization_id = p_organization_id\n  ) then\n    raise exception 'horse operation profile must use a horse in its organization' using errcode = '23514';\n  end if;",
      "profile horse ownership validation removed",
    ),
  }).join("\n"),
  /profile upsert must verify/,
);
assert.match(
  validateStableOperationsConsole({
    ...fixture,
    migration: migration.replace(
      "left join public.horse_operation_profiles as profile",
      "join public.horse_operation_profiles as profile",
    ),
  }).join("\n"),
  /visible, fail-closed defaults/,
);
assert.match(
  validateStableOperationsConsole({
    ...fixture,
    page: page.replace(
      "useStableOperationsPreview(canManage)",
      "useStableOperationsPreview(!canManage)",
    ),
  }).join("\n"),
  /audience-safe rendering/,
);
assert.match(
  validateStableOperationsConsole({
    ...fixture,
    page: page.replaceAll(
      "setActionError(mutationError(err, t(\"stableOperations.errors.saveFailed\")));",
      "care completion error dropped",
    ),
  }).join("\n"),
  /care completion failures/,
);
assert.match(
  validateStableOperationsConsole({
    ...fixture,
    migration: migration.replace(
      "create or replace function public.assert_horse_assignment_allowed",
      "create function public.assert_horse_assignment_allowed",
    ).replace(
      "if p_organization_id is null or p_horse_id is null or p_starts_at is null",
      "from public.check_horse_assignment_eligibility",
    ),
  }).join("\n"),
  /safe non-staff availability access/,
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