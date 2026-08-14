import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

import { validateCoachAnalysisRls } from "./verify-phase1-stage5-coach-analysis-rls.mjs";

const repositoryRoot = resolve(import.meta.dirname, "..");
const [migration, rollback] = await Promise.all([
  readFile(
    resolve(
      repositoryRoot,
      "supabase/migrations/20260814163053_phase1_stage5_coach_analysis_rls.sql",
    ),
    "utf8",
  ),
  readFile(
    resolve(
      repositoryRoot,
      "supabase/rollback/20260814163053_phase1_stage5_coach_analysis_rls_rollback.sql",
    ),
    "utf8",
  ),
]);

test("accepts the scoped coach analysis RLS migration", () => {
  assert.deepEqual(validateCoachAnalysisRls(migration, rollback), []);
});

test("rejects inactive coach assignments", () => {
  const unsafe = migration.replace("and assignment.active", "");
  assert.ok(
    validateCoachAnalysisRls(unsafe, rollback).some((error) =>
      error.includes("assignment\\.active"),
    ),
  );
});

test("rejects coach access without an active coach role", () => {
  const unsafe = migration.replace(
    /\s+and private\.has_organization_role\([\s\S]*?array\['coach'\]\s+\)/,
    "",
  );
  assert.ok(
    validateCoachAnalysisRls(unsafe, rollback).some((error) =>
      error.includes("has_organization_role"),
    ),
  );
});

test("rejects cross-organization assignment matching", () => {
  const unsafe = migration.replace(
    "where assignment.organization_id = p_organization_id",
    "where true",
  );
  assert.ok(
    validateCoachAnalysisRls(unsafe, rollback).some((error) =>
      error.includes("assignment\\.organization_id"),
    ),
  );
});

test("rejects changed write policies", () => {
  const unsafe = `${migration}\ncreate policy unsafe_update on public.video_analyses for update to authenticated using (true);\n`;
  assert.ok(
    validateCoachAnalysisRls(unsafe, rollback).includes(
      "migration must not replace any RLS policy",
    ),
  );
});

test("rejects a rollback that retains coach-assignment access", () => {
  const unsafeRollback = rollback.replace(
    "or private.is_platform_admin()",
    `or exists (
      select 1 from public.coach_rider_assignments
    )
    or private.is_platform_admin()`,
  );
  assert.ok(
    validateCoachAnalysisRls(migration, unsafeRollback).includes(
      "rollback must remove coach-assignment access",
    ),
  );
});
