import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { batch12Constants, buildBatch11ReleaseHash, evaluateTrainingPreflight, validateBatch12Config } from "./batch12-training-preflight.mjs";

const config = JSON.parse(await readFile(new URL("../intelligence/batch12-training-preflight.example.json", import.meta.url), "utf8"));
const source = config.fixtures.find((entry) => entry.fixture_ref === "preflight-synthetic-ready").input;
const ready = () => structuredClone(source);

test("accepts the committed Batch 12 package", () => assert.deepEqual(validateBatch12Config(config), []));
test("pins all four split roles", () => assert.deepEqual(batch12Constants.SPLITS, ["train", "validation", "test", "golden"]));
test("accepts a deterministic offline preflight", () => assert.equal(evaluateTrainingPreflight(ready(), config).decision, "ready"));
test("produces deterministic reproducibility evidence", () => assert.equal(evaluateTrainingPreflight(ready(), config).preflight_manifest.reproducibility_hash, evaluateTrainingPreflight(ready(), config).preflight_manifest.reproducibility_hash));
test("keeps execution unauthorized", () => assert.equal(evaluateTrainingPreflight(ready(), config).preflight_manifest.execution_authorized, false));
test("recomputes the Batch 11 release hash", () => assert.equal(buildBatch11ReleaseHash(ready().batch11_release), ready().batch11_release.release_manifest_hash));
test("rejects altered release evidence", () => { const input = ready(); input.batch11_release.approval_evidence_ref = "approval-evidence-synthetic-beta"; assert.ok(evaluateTrainingPreflight(input, config).rejection_codes.includes("release-unpinned")); });
test("rejects a substituted release even when its self-hash is recomputed", () => { const input = ready(); input.batch11_release.statistics.row_count = 5; input.batch11_release.release_manifest_hash = buildBatch11ReleaseHash(input.batch11_release); assert.ok(evaluateTrainingPreflight(input, config).rejection_codes.includes("release-unpinned")); });
test("rejects golden data in training", () => { const input = ready(); input.plan.training_splits.push("golden"); assert.ok(evaluateTrainingPreflight(input, config).rejection_codes.includes("split-leakage")); });
test("rejects missing deterministic seed", () => { const input = ready(); input.plan.seed = null; assert.ok(evaluateTrainingPreflight(input, config).rejection_codes.includes("nondeterministic-plan")); });
test("changes evidence when a hyperparameter changes", () => { const input = ready(); const first = evaluateTrainingPreflight(input, config); input.plan.learning_rate = 0.0005; const second = evaluateTrainingPreflight(input, config); assert.notEqual(first.preflight_manifest.reproducibility_hash, second.preflight_manifest.reproducibility_hash); });
test("rejects resource ceiling breaches", () => { const input = ready(); input.plan.epochs = config.resource_limits.maximum_epochs + 1; assert.ok(evaluateTrainingPreflight(input, config).rejection_codes.includes("resource-limit-exceeded")); });
test("rejects execution or network enablement", () => { const input = ready(); input.plan.outbound_network = true; const codes = evaluateTrainingPreflight(input, config).rejection_codes; assert.ok(codes.includes("execution-enabled")); });
test("rejects sensitive fields", () => { const unsafe = structuredClone(config); unsafe.api_token = "unsafe"; assert.ok(validateBatch12Config(unsafe).some((error) => error.includes("api_token"))); });
test("rejects sensitive fields in runtime preflight input", () => { const input = ready(); input.plan.api_token = "unsafe"; assert.ok(evaluateTrainingPreflight(input, config).rejection_codes.includes("invalid-input")); });
test("keeps production, deployment, database, and cohort changes disabled", () => { const unsafe = structuredClone(config); unsafe.safety.database_changes = true; unsafe.safety.cohort_changes = true; const errors = validateBatch12Config(unsafe); assert.ok(errors.some((e) => e.includes("database_changes")) && errors.some((e) => e.includes("cohort_changes"))); });
