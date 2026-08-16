import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { batch9Constants, evaluateAnnotation, validateBatch9Config } from "./batch9-annotation-quality.mjs";

const config = JSON.parse(await readFile(new URL("../intelligence/batch9-annotation-quality.example.json", import.meta.url), "utf8"));
const fixture = (decision) => config.fixtures.find((entry) => entry.expected_decision === decision).input;

test("accepts the committed Batch 9 package", () => assert.deepEqual(validateBatch9Config(structuredClone(config)), []));
test("pins the complete ordered 23-point horse skeleton", () => assert.equal(batch9Constants.KEYPOINTS.length, 23));
test("accepts close double-reviewed annotations", () => {
  const result = evaluateAnnotation(structuredClone(fixture("accepted")), config);
  assert.equal(result.decision, "accepted");
  assert.match(result.evidence_ref, /^annotation-evidence-[a-f0-9]{24}$/);
});
test("returns deterministic evidence", () => assert.deepEqual(evaluateAnnotation(fixture("accepted"), config), evaluateAnnotation(fixture("accepted"), config)));
test("canonicalizes object and independent-review order", () => {
  const reordered = structuredClone(fixture("accepted"));
  reordered.bounding_box = Object.fromEntries(Object.entries(reordered.bounding_box).reverse());
  reordered.reviews.reverse();
  assert.equal(evaluateAnnotation(reordered, config).evidence_ref, evaluateAnnotation(fixture("accepted"), config).evidence_ref);
});
test("changes evidence when the bounding box changes", () => {
  const changed = structuredClone(fixture("accepted")); changed.bounding_box.x_min += 0.01;
  assert.notEqual(evaluateAnnotation(changed, config).evidence_ref, evaluateAnnotation(fixture("accepted"), config).evidence_ref);
});
test("routes excessive disagreement to review", () => assert.ok(evaluateAnnotation(fixture("review-required"), config).rejection_codes.includes("agreement-threshold")));
test("rejects a single reviewer", () => assert.ok(evaluateAnnotation(fixture("rejected"), config).rejection_codes.includes("single-review")));
test("rejects missing Batch 8 lineage", () => {
  const input = structuredClone(fixture("accepted")); input.window_lineage_ref = null;
  assert.ok(evaluateAnnotation(input, config).rejection_codes.includes("lineage-missing"));
});
test("rejects incomplete or reordered skeletons", () => {
  const input = structuredClone(fixture("accepted")); input.reviews[0].keypoints.reverse();
  assert.ok(evaluateAnnotation(input, config).rejection_codes.includes("incomplete-skeleton"));
});
test("requires null coordinates for outside-frame points", () => {
  const input = structuredClone(fixture("accepted"));
  input.reviews[0].keypoints[0] = { name: "poll", state: "outside-frame", x: 0.2, y: 0.2 };
  assert.ok(evaluateAnnotation(input, config).rejection_codes.includes("incomplete-skeleton"));
});
test("rejects duplicate reviewer references", () => {
  const input = structuredClone(fixture("accepted")); input.reviews[1].reviewer_ref = input.reviews[0].reviewer_ref;
  assert.ok(evaluateAnnotation(input, config).rejection_codes.includes("single-review"));
});
test("rejects personal identifiers and secrets", () => {
  const unsafe = structuredClone(config); unsafe.api_token = "unsafe"; unsafe.fixtures[0].email = "person@example.invalid";
  const errors = validateBatch9Config(unsafe);
  assert.ok(errors.some((error) => error.includes("api_token")) && errors.some((error) => error.includes("email")));
});
test("rejects duplicate fixture references", () => {
  const malformed = structuredClone(config); malformed.fixtures[1].fixture_ref = malformed.fixtures[0].fixture_ref;
  assert.ok(validateBatch9Config(malformed).some((error) => error.includes("must be unique")));
});
test("keeps production, inference, and database changes disabled", () => {
  const unsafe = structuredClone(config); unsafe.safety.production_data_allowed = true; unsafe.safety.model_inference = true;
  const errors = validateBatch9Config(unsafe);
  assert.ok(errors.some((error) => error.includes("production_data_allowed")) && errors.some((error) => error.includes("model_inference")));
});
