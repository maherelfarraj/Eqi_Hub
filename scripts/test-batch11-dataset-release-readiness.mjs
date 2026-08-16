import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { batch11Constants, buildBatch10Manifest, evaluateDatasetRelease, validateBatch11Config } from "./batch11-dataset-release-readiness.mjs";

const config = JSON.parse(await readFile(new URL("../intelligence/batch11-dataset-release-readiness.example.json", import.meta.url), "utf8"));
const source = config.fixtures.find((entry) => entry.fixture_ref === "release-synthetic-ready").input;
const fixture = (name) => {
  const raw = config.fixtures.find((entry) => entry.fixture_ref === name).input;
  if (!raw.source_fixture_ref) return structuredClone(raw);
  const input = structuredClone(source);
  if (raw.mutation === "remove-approval") input.release_approval = null;
  if (raw.mutation === "duplicate-content") input.rows[1].content_hash = input.rows[0].content_hash;
  if (raw.mutation === "partition-drift") input.rows[1].groups.horse_group_ref = input.rows[0].groups.horse_group_ref;
  return input;
};
const prepare = (input) => { if (input.batch10_manifest_hash === "GENERATE") input.batch10_manifest_hash = buildBatch10Manifest(input.rows); return input; };

test("accepts the committed Batch 11 package", () => assert.deepEqual(validateBatch11Config(config), []));
test("pins the four splits and six grouping keys", () => { assert.equal(batch11Constants.SPLITS.length, 4); assert.equal(batch11Constants.GROUP_KEYS.length, 6); });
test("produces a deterministic release manifest", () => { const a = evaluateDatasetRelease(prepare(fixture("release-synthetic-ready")), config); const bInput = prepare(fixture("release-synthetic-ready")); bInput.rows.reverse(); bInput.batch10_manifest_hash = buildBatch10Manifest(bInput.rows); const b = evaluateDatasetRelease(bInput, config); assert.equal(a.decision, "ready"); assert.equal(a.release_manifest.release_manifest_hash, b.release_manifest.release_manifest_hash); });
test("keeps model training disabled after readiness", () => assert.equal(evaluateDatasetRelease(prepare(fixture("release-synthetic-ready")), config).release_manifest.training_authorized, false));
test("requires human release approval", () => assert.equal(evaluateDatasetRelease(prepare(fixture("release-synthetic-approval")), config).decision, "approval-required"));
test("binds human approval evidence into the immutable release hash", () => { const input = prepare(fixture("release-synthetic-ready")); const first = evaluateDatasetRelease(input, config); input.release_approval.evidence_ref = "approval-evidence-synthetic-beta"; const second = evaluateDatasetRelease(input, config); assert.notEqual(first.release_manifest.release_manifest_hash, second.release_manifest.release_manifest_hash); });
test("rejects an unpinned Batch 10 manifest", () => { const input = prepare(fixture("release-synthetic-ready")); input.batch10_manifest_hash = "0".repeat(64); assert.ok(evaluateDatasetRelease(input, config).rejection_codes.includes("manifest-hash-mismatch")); });
test("rejects duplicate content across annotations", () => assert.ok(evaluateDatasetRelease(prepare(fixture("release-synthetic-duplicate")), config).rejection_codes.includes("duplicate-content")));
test("rejects related groups split across partitions", () => assert.ok(evaluateDatasetRelease(prepare(fixture("release-synthetic-partition")), config).rejection_codes.includes("partition-drift")));
test("rejects insufficient split coverage", () => { const input = prepare(fixture("release-synthetic-ready")); input.rows = input.rows.filter((row) => row.split !== "golden"); input.batch10_manifest_hash = buildBatch10Manifest(input.rows); assert.ok(evaluateDatasetRelease(input, config).rejection_codes.includes("coverage-insufficient")); });
test("rejects insufficient visibility", () => { const input = prepare(fixture("release-synthetic-ready")); input.rows.forEach((row) => { row.visible_keypoints = 0; }); input.batch10_manifest_hash = buildBatch10Manifest(input.rows); assert.ok(evaluateDatasetRelease(input, config).rejection_codes.includes("visibility-insufficient")); });
test("rejects missing Batch 10 lineage", () => { const input = prepare(fixture("release-synthetic-ready")); input.rows[0].window_lineage_ref = null; input.batch10_manifest_hash = buildBatch10Manifest(input.rows); assert.ok(evaluateDatasetRelease(input, config).rejection_codes.includes("batch10-lineage-missing")); });
test("canonicalizes row object key order", () => { const input = prepare(fixture("release-synthetic-ready")); const row = input.rows[0]; input.rows[0] = Object.fromEntries(Object.entries(row).reverse()); assert.equal(buildBatch10Manifest(input.rows), input.batch10_manifest_hash); });
test("rejects sensitive fields", () => { const unsafe = structuredClone(config); unsafe.api_token = "unsafe"; assert.ok(validateBatch11Config(unsafe).some((error) => error.includes("api_token"))); });
test("keeps production, deployment, database, and cohort changes disabled", () => { const unsafe = structuredClone(config); unsafe.safety.cohort_changes = true; unsafe.safety.deployment_changes = true; const errors = validateBatch11Config(unsafe); assert.ok(errors.some((e) => e.includes("cohort_changes")) && errors.some((e) => e.includes("deployment_changes"))); });
