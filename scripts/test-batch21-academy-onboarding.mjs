import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { validateBatch21AcademyOnboarding } from "./verify-batch21-academy-onboarding.mjs";

const root = resolve(import.meta.dirname, "..");
const [migration, rollback, acceptance] = await Promise.all([
  readFile(resolve(root, "supabase/migrations/20260822094500_batch21_academy_onboarding.sql"), "utf8"),
  readFile(resolve(root, "supabase/rollback/20260822094500_batch21_academy_onboarding_rollback.sql"), "utf8"),
  readFile(resolve(root, "tests/rls/batch_21_academy_onboarding.sql"), "utf8"),
]);

test("accepts the Batch 21 onboarding controls", () => {
  assert.deepEqual(validateBatch21AcademyOnboarding(migration, rollback), []);
});

test("rejects plaintext invitation tokens", () => {
  const unsafe = migration.replace(
    "encode(extensions.digest(invite_token, 'sha256'), 'hex')",
    "invite_token",
  );
  assert.ok(
    validateBatch21AcademyOnboarding(unsafe, rollback).includes(
      "tokens must be hashed",
    ),
  );
});

test("rejects an email ownership bypass", () => {
  const unsafe = migration.replace("if actor_email <> target.email then", "if false then");
  assert.ok(
    validateBatch21AcademyOnboarding(unsafe, rollback).includes(
      "claim must match invited email",
    ),
  );
});

test("acceptance covers isolation, one-time use, and secret-free audit", () => {
  for (const guard of [
    "rider previewed academy onboarding",
    "academy admin crossed tenant boundary",
    "direct invitation table read was allowed",
    "wrong email claimed invitation",
    "invitation token was reusable",
    "pending invitation survived batch closure",
    "onboarding audit leaked email or token",
  ]) {
    assert.match(acceptance, new RegExp(guard));
  }
});
