import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { evaluateVideoSegmentation, planDatasetSplits, validateBatch8Config } from "./batch8-video-segmentation.mjs";

const config = JSON.parse(await readFile(new URL("../intelligence/batch8-video-segmentation.example.json", import.meta.url), "utf8"));
const accepted = config.fixtures.filter((fixture) => fixture.expected_decision === "accepted").map((fixture) => fixture.input);
const good = accepted[0];

test("accepts the committed Batch 8 package", () => assert.deepEqual(validateBatch8Config(structuredClone(config)), []));
test("produces deterministic window and source lineage", () => {
  const first = evaluateVideoSegmentation(structuredClone(good), config);
  const second = evaluateVideoSegmentation(structuredClone(good), config);
  assert.deepEqual(first, second);
  assert.match(first.lineage_ref, /^lineage-[a-f0-9]{24}$/);
  assert.match(first.windows[0].lineage_ref, /^lineage-[a-f0-9]{24}$/);
});
test("canonicalizes object key order before hashing lineage", () => {
  const reordered = structuredClone(good);
  reordered.groups = Object.fromEntries(Object.entries(reordered.groups).reverse());
  assert.equal(evaluateVideoSegmentation(reordered, config).lineage_ref, evaluateVideoSegmentation(good, config).lineage_ref);
});
test("changes lineage when validated timing evidence changes", () => {
  const changed = structuredClone(good);
  changed.candidate_windows[0].takeoff_timestamp_ms += 100;
  const baseline = evaluateVideoSegmentation(good, config);
  const result = evaluateVideoSegmentation(changed, config);
  assert.notEqual(result.lineage_ref, baseline.lineage_ref);
  assert.notEqual(result.windows[0].lineage_ref, baseline.windows[0].lineage_ref);
});
test("changes lineage when preserved source metadata changes", () => {
  const changed = structuredClone(good);
  changed.timestamps_ms.splice(2, 0, 750);
  const baseline = evaluateVideoSegmentation(good, config);
  const result = evaluateVideoSegmentation(changed, config);
  assert.notEqual(result.lineage_ref, baseline.lineage_ref);
  assert.notEqual(result.windows[0].lineage_ref, baseline.windows[0].lineage_ref);
});
test("keeps related horse clips in the same split", () => {
  const result = planDatasetSplits(structuredClone(accepted), config);
  assert.equal(result.decision, "accepted");
  assert.equal(result.assignments[0].split, result.assignments[1].split);
});
test("keeps transitively related clips in one connected component", () => {
  const third = structuredClone(good);
  third.video_ref = "video-synthetic-transitive";
  third.groups = {
    ...third.groups,
    source_video_ref: "source-video-transitive",
    horse_group_ref: "horse-group-transitive",
    rider_group_ref: accepted[1].groups.rider_group_ref,
    recording_session_ref: "recording-session-transitive"
  };
  const result = planDatasetSplits([...structuredClone(accepted), third], config);
  assert.equal(new Set(result.assignments.map((assignment) => assignment.split)).size, 1);
});
test("rejects duplicate source manifests as dataset leakage", () => {
  const result = planDatasetSplits([structuredClone(good), structuredClone(good)], config);
  assert.deepEqual(result, { decision: "rejected", rejection_codes: ["dataset-leakage"], assignments: [] });
});
test("rejects non-monotonic timestamps", () => {
  const input = structuredClone(good);
  input.timestamps_ms[4] = input.timestamps_ms[3];
  assert.ok(evaluateVideoSegmentation(input, config).rejection_codes.includes("timestamps-not-monotonic"));
});
test("rejects malformed and non-finite timestamps", () => {
  for (const timestamps_ms of [[0, "500", 1000], [0, Number.NaN, 1000], [0, -1, 1000]]) {
    const input = { ...structuredClone(good), timestamps_ms };
    assert.ok(evaluateVideoSegmentation(input, config).rejection_codes.includes("invalid-input"));
  }
});
test("rejects windows outside source bounds", () => {
  const input = structuredClone(good);
  input.candidate_windows[0].end_timestamp_ms = 6000;
  assert.ok(evaluateVideoSegmentation(input, config).rejection_codes.includes("window-out-of-bounds"));
});
test("rejects unordered jump phases", () => {
  const input = structuredClone(good);
  input.candidate_windows[0].landing_timestamp_ms = input.candidate_windows[0].takeoff_timestamp_ms;
  assert.ok(evaluateVideoSegmentation(input, config).rejection_codes.includes("window-order-invalid"));
});
test("requires three strides before and two after", () => {
  const result = evaluateVideoSegmentation(config.fixtures[2].input, config);
  assert.deepEqual(result.rejection_codes, ["insufficient-context"]);
});
test("rejects overlapping candidate windows", () => {
  const input = structuredClone(good);
  input.candidate_windows.push({ ...input.candidate_windows[0], window_ref: "window-primary-two", fence_ref: "fence-primary-two", start_timestamp_ms: 4000, takeoff_timestamp_ms: 4200, landing_timestamp_ms: 4400, end_timestamp_ms: 5000 });
  assert.ok(evaluateVideoSegmentation(input, config).rejection_codes.includes("overlapping-windows"));
});
test("rejects footage rejected by Batch 7", () => {
  const input = { ...structuredClone(good), capture_decision: "rejected" };
  assert.deepEqual(evaluateVideoSegmentation(input, config).rejection_codes, ["capture-not-eligible"]);
});
test("fails closed when source metadata is not preserved", () => {
  const input = structuredClone(good);
  input.metadata.source_timestamps = false;
  assert.deepEqual(evaluateVideoSegmentation(input, config).rejection_codes, ["metadata-not-preserved"]);
});
test("rejects personal identifiers and secrets", () => {
  const unsafe = structuredClone(config);
  unsafe.fixtures[0].email = "person@example.invalid";
  unsafe.api_token = "do-not-store";
  const errors = validateBatch8Config(unsafe);
  assert.ok(errors.some((error) => error.includes("email")));
  assert.ok(errors.some((error) => error.includes("api_token")));
});
test("requires fail-closed offline safety boundaries", () => {
  const unsafe = structuredClone(config);
  unsafe.safety.production_data_allowed = true;
  unsafe.safety.model_inference = true;
  const errors = validateBatch8Config(unsafe);
  assert.ok(errors.some((error) => error.includes("production_data_allowed")));
  assert.ok(errors.some((error) => error.includes("model_inference")));
});
test("requires every stable rejection code", () => {
  const malformed = structuredClone(config);
  malformed.rejection_codes = malformed.rejection_codes.filter((code) => code !== "dataset-leakage");
  assert.ok(validateBatch8Config(malformed).some((error) => error.includes("dataset-leakage")));
});
