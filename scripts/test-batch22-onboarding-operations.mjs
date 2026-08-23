import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { validateBatch22OnboardingOperations } from "./verify-batch22-onboarding-operations.mjs";

const root = resolve(import.meta.dirname, "..");
const [migration, hardening, rollback, acceptance] = await Promise.all([
  readFile(
    resolve(
      root,
      "supabase/migrations/20260823090000_batch22_onboarding_operations.sql",
    ),
    "utf8",
  ),
  readFile(
    resolve(
      root,
      "supabase/migrations/20260823100000_batch22_onboarding_operations_hardening.sql",
    ),
    "utf8",
  ),
  readFile(
    resolve(
      root,
      "supabase/rollback/20260823090000_batch22_onboarding_operations_rollback.sql",
    ),
    "utf8",
  ),
  readFile(
    resolve(root, "tests/rls/batch_22_onboarding_operations.sql"),
    "utf8",
  ),
]);

test("accepts the Batch 22 onboarding operations controls", () => {
  assert.deepEqual(
    validateBatch22OnboardingOperations(migration, rollback),
    [],
  );
});

test("rejects plaintext replacement tokens", () => {
  const unsafe = migration.replace(
    "encode(extensions.digest(replacement_token, 'sha256'), 'hex')",
    "replacement_token",
  );
  assert.ok(
    validateBatch22OnboardingOperations(unsafe, rollback).includes(
      "replacement token must be hashed",
    ),
  );
});

test("rejects unbounded replacement generation", () => {
  const unsafe = migration.replace(
    "if target.reissue_count >= 5 then",
    "if false then",
  );
  assert.ok(
    validateBatch22OnboardingOperations(unsafe, rollback).includes(
      "replacement must enforce its maximum",
    ),
  );
});

test("acceptance covers isolation, rotation, cooldown, and secret-free audit", () => {
  for (const guard of [
    "rider read onboarding metrics",
    "rider read onboarding activity",
    "rider read onboarding invitations",
    "rider replaced onboarding invitation",
    "replacement token did not rotate",
    "old invitation token remained valid",
    "replacement cooldown was bypassed",
    "replacement audit leaked email or token",
  ]) {
    assert.match(acceptance, new RegExp(guard));
  }
});

test("follow-up migration preserves replacement history without blocking profile retirement", () => {
  assert.match(hardening, /on delete set null/i);
  assert.match(
    hardening,
    /reissue_count > 0 and last_reissued_at is not null/i,
  );
  assert.doesNotMatch(
    hardening,
    /insert into (?:auth\.)?users|insert into public\.academy_onboarding/i,
  );
});
