import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { batch13Constants, buildBatch12PreflightHash, evaluateExperimentEvidence, validateBatch13Config } from "./batch13-experiment-evaluation.mjs";

const config = JSON.parse(await readFile(new URL("../intelligence/batch13-experiment-evaluation.example.json", import.meta.url), "utf8"));
const source = config.fixtures.find((entry) => entry.fixture_ref === "evaluation-synthetic-ready").input;
const ready = () => structuredClone(source);

test("accepts the committed Batch 13 package", () => assert.deepEqual(validateBatch13Config(config), []));
test("pins validation, test, and golden evaluation splits", () => assert.deepEqual(batch13Constants.METRIC_SPLITS, ["validation", "test", "golden"]));
test("accepts deterministic synthetic evaluation evidence", () => assert.equal(evaluateExperimentEvidence(ready(), config).decision, "ready"));
test("produces deterministic evaluation evidence", () => assert.equal(evaluateExperimentEvidence(ready(), config).evaluation_manifest.evaluation_hash, evaluateExperimentEvidence(ready(), config).evaluation_manifest.evaluation_hash));
test("keeps promotion unauthorized", () => assert.equal(evaluateExperimentEvidence(ready(), config).evaluation_manifest.promotion_authorized, false));
test("recomputes the Batch 12 preflight hash", () => assert.equal(buildBatch12PreflightHash(ready().batch12_preflight), config.approved_batch12_preflight_hash));
test("rejects a rehashed substituted preflight", () => { const input = ready(); input.batch12_preflight.plan.seed += 1; input.batch12_preflight.reproducibility_hash = buildBatch12PreflightHash(input.batch12_preflight); assert.ok(evaluateExperimentEvidence(input, config).rejection_codes.includes("preflight-unpinned")); });
test("rejects incomplete artifact provenance", () => { const input = ready(); input.run.environment_hash = null; assert.ok(evaluateExperimentEvidence(input, config).rejection_codes.includes("provenance-incomplete")); });
test("rejects test data used for selection", () => { const input = ready(); input.run.model_selection_splits.push("test"); assert.ok(evaluateExperimentEvidence(input, config).rejection_codes.includes("holdout-leakage")); });
test("rejects weak quality metrics", () => { const input = ready(); input.run.metrics.golden.mean_error = 0.9; assert.ok(evaluateExperimentEvidence(input, config).rejection_codes.includes("quality-threshold-failed")); });
test("rejects validation-to-test overfit gap", () => { const input = ready(); input.run.metrics.validation.pck = 0.99; assert.ok(evaluateExperimentEvidence(input, config).rejection_codes.includes("overfit-threshold-failed")); });
test("changes evidence when metrics change", () => { const input = ready(); const first = evaluateExperimentEvidence(input, config); input.run.metrics.test.pck += 0.01; const second = evaluateExperimentEvidence(input, config); assert.notEqual(first.evaluation_manifest.evaluation_hash, second.evaluation_manifest.evaluation_hash); });
test("rejects real execution and inference", () => { const input = ready(); input.run.real_training = true; assert.ok(evaluateExperimentEvidence(input, config).rejection_codes.includes("execution-enabled")); });
test("rejects sensitive runtime fields", () => { const input = ready(); input.run.api_token = "unsafe"; assert.ok(evaluateExperimentEvidence(input, config).rejection_codes.includes("invalid-input")); });
test("keeps production, deployment, database, and cohort changes disabled", () => { const unsafe = structuredClone(config); unsafe.safety.deployment_changes = true; unsafe.safety.cohort_changes = true; const errors = validateBatch13Config(unsafe); assert.ok(errors.some((e) => e.includes("deployment_changes")) && errors.some((e) => e.includes("cohort_changes"))); });
