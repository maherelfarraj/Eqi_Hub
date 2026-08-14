import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { validatePolicyConsolidation } from "./verify-consolidated-linked-guardian-policies.mjs";

const repositoryRoot = resolve(import.meta.dirname, "..");
const [migration, rollback] = await Promise.all([
  readFile(
    resolve(
      repositoryRoot,
      "supabase/migrations/20260814093936_consolidate_linked_guardian_select_policies.sql",
    ),
    "utf8",
  ),
  readFile(
    resolve(
      repositoryRoot,
      "supabase/rollback/20260814093936_consolidate_linked_guardian_select_policies_rollback.sql",
    ),
    "utf8",
  ),
]);

test("accepts the committed policy consolidation and rollback", () => {
  assert.deepEqual(validatePolicyConsolidation(migration, rollback), []);
});

test("rejects a missing per-command policy", () => {
  const unsafe = migration.replace(
    /create policy documents_delete_access[\s\S]*?\n\);\n/,
    "",
  );
  assert.ok(
    validatePolicyConsolidation(unsafe, rollback).includes(
      "documents must have exactly one delete policy",
    ),
  );
});

test("rejects linked guardian access in a write policy", () => {
  const unsafe = migration.replace(
    "with check ((select auth.uid()) = user_id);",
    "with check ((select private.can_access_horse(documents.horse_id)));",
  );
  assert.ok(
    validatePolicyConsolidation(unsafe, rollback).includes(
      "documents insert must not grant linked guardian access",
    ),
  );
});

test("rejects removal of the consolidated guardian SELECT guard", () => {
  const unsafe = migration.replace(
    "and (select private.can_access_horse(documents.horse_id))",
    "and false",
  );
  assert.ok(
    validatePolicyConsolidation(unsafe, rollback).includes(
      "documents SELECT must preserve linked guardian horse access",
    ),
  );
});

test("rejects deprecated auth.role authorization", () => {
  const unsafe = `${migration}\nselect auth.role();\n`;
  assert.ok(
    validatePolicyConsolidation(unsafe, rollback).includes(
      "must not use deprecated auth.role()",
    ),
  );
});

test("rejects incomplete rollback", () => {
  const unsafeRollback = rollback.replace(
    /create policy training_log_linked_guardian_select[\s\S]*?;\n/,
    "",
  );
  assert.ok(
    validatePolicyConsolidation(migration, unsafeRollback).includes(
      "training_log rollback must restore the former ALL and SELECT policies",
    ),
  );
});
