import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { validateStage5ProfileAccess } from "./verify-phase1-stage5-profile-access.mjs";

const migration = await readFile(
  resolve(
    import.meta.dirname,
    "../supabase/migrations/20260813222839_phase1_stage5_pilot_profile_access.sql",
  ),
  "utf8",
);

test("accepts the committed Stage 5 profile-access migration", () => {
  assert.deepEqual(validateStage5ProfileAccess(migration), []);
});

test("rejects inactive coach assignments", () => {
  const unsafe = migration.replace("and assignment.active", "");
  assert.ok(
    validateStage5ProfileAccess(unsafe).some((error) =>
      error.includes("assignment\\.active"),
    ),
  );
});

test("rejects inactive organization memberships", () => {
  const unsafe = migration.replace("and membership.status = 'active'", "");
  assert.ok(
    validateStage5ProfileAccess(unsafe).some((error) =>
      error.includes("membership\\.status"),
    ),
  );
});

test("rejects missing coach role verification", () => {
  const unsafe = migration.replace("array['coach']", "array['rider']");
  assert.ok(
    validateStage5ProfileAccess(unsafe).some((error) =>
      error.includes("array\\['coach'\\]"),
    ),
  );
});

test("rejects write policies", () => {
  const unsafe = `${migration}\ncreate policy profile_write on public.profiles for update to authenticated using (true);\n`;
  assert.ok(
    validateStage5ProfileAccess(unsafe).includes(
      "Stage 5 must not create or replace write policies",
    ),
  );
});

test("rejects non-transactional migration text", () => {
  const unsafe = migration.replace(/^begin;/m, "").replace(/commit;\s*$/i, "");
  assert.ok(
    validateStage5ProfileAccess(unsafe).includes(
      "migration must be transactional",
    ),
  );
});
