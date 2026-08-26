import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  batch7ReleaseIntegrityConstants,
  buildBatch7ReleaseEvidenceHash,
  evaluateBatch7ReleaseIntegrity,
  validateBatch7ReleaseIntegrity,
} from "./batch7-release-integrity.mjs";

const config = JSON.parse(
  await readFile(
    new URL(
      "../intelligence/batch7-release-integrity.example.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const ready = () => structuredClone(config);

test("accepts the committed Batch 7 release-integrity evidence", () => {
  assert.deepEqual(validateBatch7ReleaseIntegrity(ready()), []);
  assert.equal(
    evaluateBatch7ReleaseIntegrity(ready()).decision,
    "ready-for-review",
  );
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
  assert.ok(
    validateBatch7ReleaseIntegrity(input).some((error) =>
      error.includes("release must remain unauthorized"),
    ),
  );
  assert.ok(
    validateBatch7ReleaseIntegrity(input).some((error) =>
      error.includes("feature_activation_allowed"),
    ),
  );
  assert.ok(
    validateBatch7ReleaseIntegrity(input).some((error) =>
      error.includes("financial_permission_changes_allowed"),
    ),
  );
});

test("rejects missing default-off evidence", () => {
  const input = ready();
  input.default_off[0].expected_enabled = true;
  assert.ok(
    validateBatch7ReleaseIntegrity(input).includes(
      "default-off modules must remain disabled",
    ),
  );
});

test("rejects payroll, safety, guardian, and private-boundary widening", () => {
  const input = ready();
  input.role_matrix.find((entry) => entry.role === "accountant").denied = [
    "horse-welfare-operations",
  ];
  input.role_matrix.find((entry) => entry.role === "coach").denied = [
    "payroll-approval",
  ];
  input.role_matrix.find((entry) => entry.role === "guardian").allowed = [
    "permitted-approval",
  ];
  input.role_matrix.find((entry) => entry.role === "rider").denied = [
    "staff-operations",
  ];
  const errors = validateBatch7ReleaseIntegrity(input);
  assert.ok(
    errors.includes(
      "accountant denied boundaries do not match approved contract",
    ),
  );
  assert.ok(
    errors.includes("coach denied boundaries do not match approved contract"),
  );
  assert.ok(
    errors.includes(
      "guardian allowed boundaries do not match approved contract",
    ),
  );
  assert.ok(
    errors.includes("rider denied boundaries do not match approved contract"),
  );
});

test("rejects sensitive evidence fields", () => {
  const input = ready();
  input.api_token = "unsafe";
  assert.ok(
    validateBatch7ReleaseIntegrity(input).some((error) =>
      error.includes("sensitive field is not allowed"),
    ),
  );
});

test("fails closed for malformed, unapproved, and arbitrary evidence", () => {
  const malformed = ready();
  malformed.batches = {};
  assert.doesNotThrow(() => validateBatch7ReleaseIntegrity(malformed));
  assert.ok(
    validateBatch7ReleaseIntegrity(malformed).includes(
      "batches must be an array",
    ),
  );

  const unapproved = ready();
  unapproved.extra = "unexpected";
  unapproved.batches[0].commands = ["echo unsafe"];
  unapproved.role_matrix[0].allowed.push("person@example.test");
  const errors = validateBatch7ReleaseIntegrity(unapproved);
  assert.ok(errors.includes("unknown field: $.extra"));
  assert.ok(errors.includes("Batch 3 commands do not match approved evidence"));
  assert.ok(
    errors.includes("rider allowed boundaries do not match approved contract"),
  );
});

test("rejects inherited approval keys and string-coerced batch identifiers", () => {
  const inheritedRole = ready();
  inheritedRole.role_matrix[0].role = "constructor";
  assert.doesNotThrow(() => validateBatch7ReleaseIntegrity(inheritedRole));
  assert.ok(
    validateBatch7ReleaseIntegrity(inheritedRole).includes(
      "role is not approved: constructor",
    ),
  );

  const stringBatches = ready();
  for (const batch of stringBatches.batches) batch.batch = String(batch.batch);
  const errors = validateBatch7ReleaseIntegrity(stringBatches);
  assert.ok(errors.includes("Batch 3 is not an approved release record"));
  assert.ok(
    errors.includes("evidence must cover Batches 3 through 6 exactly once"),
  );
});

test("requires one unique result for every role stage", () => {
  const input = ready();
  input.role_matrix[0].stage_results[2] = structuredClone(
    input.role_matrix[0].stage_results[0],
  );
  const errors = validateBatch7ReleaseIntegrity(input);
  assert.ok(errors.includes("rider repeats a stage"));
  assert.ok(
    errors.includes("rider must have synthetic evidence for every stage"),
  );
});

test("CLI reports malformed evidence without an unhandled stack trace", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "batch7-release-integrity-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const evidencePath = join(directory, "malformed-evidence.json");
  await writeFile(evidencePath, '{"version":', "utf8");
  const verifierPath = fileURLToPath(
    new URL("./verify-batch7-release-integrity.mjs", import.meta.url),
  );
  const result = spawnSync(process.execPath, [verifierPath, evidencePath], {
    encoding: "utf8",
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /validation could not evaluate/);
  assert.match(result.stderr, /malformed-evidence\.json/);
  assert.doesNotMatch(result.stderr, /\n\s+at /);
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
