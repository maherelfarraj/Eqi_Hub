import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  batch7ReleaseIntegrityConstants,
  buildBatch7ReleaseEvidenceHash,
  evaluateBatch7ReleaseIntegrity,
  validateBatch7ReleaseIntegrity,
} from "./batch7-release-integrity.mjs";

const config = JSON.parse(
  await readFile(new URL("../intelligence/batch7-release-integrity.example.json", import.meta.url), "utf8"),
);
const ready = () => structuredClone(config);

test("accepts the committed Batch 7 release-integrity evidence", () => {
  assert.deepEqual(validateBatch7ReleaseIntegrity(ready()), []);
  assert.equal(evaluateBatch7ReleaseIntegrity(ready()).decision, "ready-for-review");
});

test("covers the required release roles and stages", () => {
  assert.deepEqual(batch7ReleaseIntegrityConstants.requiredRoles, [
    "rider",
    "guardian",
    "coach",
    "academy_admin",
    "stable_manager",
    "accountant",
    "platform_admin",
  ]);
  assert.deepEqual(batch7ReleaseIntegrityConstants.requiredStages, [
    "static-contract",
    "isolated-policy",
    "route-boundary",
  ]);
});

test("keeps release, production, activation, persona, finance, and payments disabled", () => {
  const input = ready();
  input.release_authorized = true;
  input.safety.feature_activation_allowed = true;
  input.safety.financial_permission_changes_allowed = true;
  assert.ok(validateBatch7ReleaseIntegrity(input).some((error) => error.includes("release must remain unauthorized")));
  assert.ok(validateBatch7ReleaseIntegrity(input).some((error) => error.includes("feature_activation_allowed")));
  assert.ok(validateBatch7ReleaseIntegrity(input).some((error) => error.includes("financial_permission_changes_allowed")));
});

test("rejects missing default-off evidence", () => {
  const input = ready();
  input.default_off[0].expected_enabled = true;
  assert.ok(validateBatch7ReleaseIntegrity(input).includes("default-off modules must remain disabled"));
});

test("rejects payroll, safety, guardian, and private-boundary widening", () => {
  const input = ready();
  input.role_matrix.find((entry) => entry.role === "accountant").denied = ["horse-welfare-operations"];
  input.role_matrix.find((entry) => entry.role === "coach").denied = ["payroll-approval"];
  input.role_matrix.find((entry) => entry.role === "guardian").allowed = ["permitted-approval"];
  input.role_matrix.find((entry) => entry.role === "rider").denied = ["staff-operations"];
  const errors = validateBatch7ReleaseIntegrity(input);
  assert.ok(errors.includes("accountant denied boundaries do not match approved contract"));
  assert.ok(errors.includes("coach denied boundaries do not match approved contract"));
  assert.ok(errors.includes("guardian allowed boundaries do not match approved contract"));
  assert.ok(errors.includes("rider denied boundaries do not match approved contract"));
});

test("rejects sensitive evidence fields", () => {
  const input = ready();
  input.api_token = "unsafe";
  assert.ok(validateBatch7ReleaseIntegrity(input).some((error) => error.includes("sensitive field is not allowed")));
});

test("fails closed for malformed, unapproved, and arbitrary evidence", () => {
  const malformed = ready();
  malformed.batches = {};
  assert.doesNotThrow(() => validateBatch7ReleaseIntegrity(malformed));
  assert.ok(validateBatch7ReleaseIntegrity(malformed).includes("batches must be an array"));

  const unapproved = ready();
  unapproved.extra = "unexpected";
  unapproved.batches[0].commands = ["echo unsafe"];
  unapproved.role_matrix[0].allowed.push("person@example.test");
  const errors = validateBatch7ReleaseIntegrity(unapproved);
  assert.ok(errors.includes("unknown field: $.extra"));
  assert.ok(errors.includes("Batch 3 commands do not match approved evidence"));
  assert.ok(errors.includes("rider allowed boundaries do not match approved contract"));
});

test("produces deterministic, mutation-sensitive release evidence", () => {
  const input = ready();
  const first = buildBatch7ReleaseEvidenceHash(input);
  const second = buildBatch7ReleaseEvidenceHash(input);
  assert.equal(first, second);
  input.privacy_assertions[0] = "guardian-portal-boundary-revised";
  assert.notEqual(first, buildBatch7ReleaseEvidenceHash(input));
});

test("keeps evaluated evidence detached from later input mutation", () => {
  const input = ready();
  const result = evaluateBatch7ReleaseIntegrity(input);
  input.batches[0].scope = "changed";
  assert.notEqual(result.release_evidence.batches[0].scope, "changed");
});