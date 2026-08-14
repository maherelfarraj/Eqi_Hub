import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

import { validateRiderDevelopmentFoundation } from "./verify-rider-development-foundation.mjs";

const repositoryRoot = resolve(import.meta.dirname, "..");
const [migration, rollback, acceptanceFixture] = await Promise.all([
  readFile(
    resolve(
      repositoryRoot,
      "supabase/migrations/20260814202204_rider_development_foundation.sql",
    ),
    "utf8",
  ),
  readFile(
    resolve(
      repositoryRoot,
      "supabase/rollback/20260814202204_rider_development_foundation_rollback.sql",
    ),
    "utf8",
  ),
  readFile(
    resolve(repositoryRoot, "tests/rls/batch_1_rider_development.sql"),
    "utf8",
  ),
]);

test("accepts the rider development foundation", () => {
  assert.deepEqual(validateRiderDevelopmentFoundation(migration, rollback), []);
});

test("uses unambiguous report variables and typed acceptance scores", () => {
  assert.match(migration, /v_report_id uuid;/i);
  assert.doesNotMatch(migration, /\n\s*report_id uuid;/i);
  assert.match(
    acceptanceFixture,
    /4::smallint,\s*4::smallint,\s*3::smallint,\s*jsonb_build_array\(/i,
  );
});

test("rejects guardian-visible drafts", () => {
  const unsafe = migration.replace(
    "    status = 'approved'\n    and private.can_read_rider(organization_id, rider_id)",
    "    status = status\n    and private.can_read_rider(organization_id, rider_id)",
  );
  assert.ok(
    validateRiderDevelopmentFoundation(unsafe, rollback).some((error) =>
      error.includes("status = 'approved'"),
    ),
  );
});

test("rejects inactive or expired coach assignments", () => {
  const withoutActive = migration.replace("and assignment.active", "");
  const withoutExpiry = migration.replace(
    "and (assignment.ends_on is null or assignment.ends_on >= current_date)",
    "",
  );
  assert.ok(
    validateRiderDevelopmentFoundation(withoutActive, rollback).some((error) =>
      error.includes("assignment\\.active"),
    ),
  );
  assert.ok(
    validateRiderDevelopmentFoundation(withoutExpiry, rollback).some((error) =>
      error.includes("ends_on"),
    ),
  );
});

test("rejects mutable approved reports", () => {
  const unsafe = migration.replace(
    "if old.status = 'approved' then",
    "if false then",
  );
  assert.ok(
    validateRiderDevelopmentFoundation(unsafe, rollback).some((error) =>
      error.includes("Approved reports are immutable"),
    ),
  );
});

test("rejects approval paths that do not finalize immutable evidence", () => {
  const withoutFinalizer = migration.replace(
    "create trigger lesson_development_reports_finalize",
    "create trigger removed_lesson_development_reports_finalize",
  );
  const mutableEvidence = migration.replaceAll(
    "Approved competency evidence is immutable",
    "Approved competency evidence may be edited",
  );
  assert.ok(
    validateRiderDevelopmentFoundation(withoutFinalizer, rollback).some(
      (error) => error.includes("lesson_development_reports_finalize"),
    ),
  );
  assert.ok(
    validateRiderDevelopmentFoundation(mutableEvidence, rollback).some(
      (error) => error.includes("Approved competency evidence is immutable"),
    ),
  );
});

test("rejects missing RLS and explicit Data API grants", () => {
  const withoutRls = migration.replace(
    "alter table public.lesson_development_reports enable row level security;",
    "",
  );
  const withoutGrant = migration.replace(
    "grant select, insert, update on public.lesson_development_reports to authenticated;",
    "",
  );
  assert.ok(
    validateRiderDevelopmentFoundation(withoutRls, rollback).some((error) =>
      error.includes("lesson_development_reports guard"),
    ),
  );
  assert.ok(
    validateRiderDevelopmentFoundation(withoutGrant, rollback).includes(
      "lesson reports require explicit Data API grants",
    ),
  );
});

test("rejects a missing foreign-key covering index", () => {
  const withoutIndex = migration.replace(
    /create index lesson_development_reports_coach_id_idx\s+on public\.lesson_development_reports \(coach_id\);/i,
    "",
  );
  assert.ok(
    validateRiderDevelopmentFoundation(withoutIndex, rollback).includes(
      "missing foreign-key index: lesson_development_reports_coach_id_idx",
    ),
  );
});

test("rejects deprecated auth.role and unconditional RLS", () => {
  assert.ok(
    validateRiderDevelopmentFoundation(
      `${migration}\nselect auth.role();`,
      rollback,
    ).includes("must not use deprecated auth.role()"),
  );
  assert.ok(
    validateRiderDevelopmentFoundation(
      `${migration}\ncreate policy unsafe on public.lesson_development_reports using (true);`,
      rollback,
    ).includes("RLS policies must not use unconditional access"),
  );
});
