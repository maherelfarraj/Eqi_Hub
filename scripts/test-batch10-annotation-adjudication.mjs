import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { adjudicateAnnotation, batch10Constants, buildDatasetExport, validateBatch10Config } from "./batch10-annotation-adjudication.mjs";

const config = JSON.parse(await readFile(new URL("../intelligence/batch10-annotation-adjudication.example.json", import.meta.url), "utf8"));
const fixture = (decision) => config.fixtures.find((entry) => entry.expected_decision === decision).input;
const exportFixture = (decision) => config.export_fixtures.find((entry) => entry.expected_decision === decision).items;

test("accepts the committed Batch 10 package", () => assert.deepEqual(validateBatch10Config(structuredClone(config)), []));
test("pins the Batch 8 partitions and grouping contract", () => {
  assert.deepEqual(batch10Constants.SPLITS, ["train", "validation", "test", "golden"]);
  assert.equal(batch10Constants.GROUP_KEYS.length, 6);
});
test("passes accepted Batch 9 evidence through unchanged", () => {
  const input = fixture("exportable"); const result = adjudicateAnnotation(input, config);
  assert.equal(result.decision, "exportable"); assert.equal(result.evidence_ref, input.annotation_evidence_ref); assert.equal(result.corrected, false);
});
test("requires adjudication for review-required evidence", () => assert.deepEqual(adjudicateAnnotation(fixture("review-required"), config).rejection_codes, ["adjudication-required"]));
test("excludes rejected Batch 9 evidence", () => assert.deepEqual(adjudicateAnnotation(fixture("excluded"), config).rejection_codes, ["batch9-rejected"]));
test("rejects an invalid correction", () => assert.ok(adjudicateAnnotation(fixture("invalid"), config).rejection_codes.includes("correction-invalid")));
test("accepts a complete correction with new immutable evidence", () => {
  const input = structuredClone(fixture("invalid")); input.adjudication.correction.content.keypoints.push(structuredClone(input.annotation_content.keypoints.at(-1)));
  const result = adjudicateAnnotation(input, config);
  assert.equal(result.decision, "exportable"); assert.equal(result.corrected, true); assert.match(result.evidence_ref, /^adjudication-evidence-[a-f0-9]{24}$/);
});
test("canonicalizes correction object key order", () => {
  const input = structuredClone(fixture("invalid")); input.adjudication.correction.content.keypoints.push(structuredClone(input.annotation_content.keypoints.at(-1)));
  const reordered = structuredClone(input); reordered.adjudication.correction.content.bounding_box = Object.fromEntries(Object.entries(reordered.adjudication.correction.content.bounding_box).reverse());
  assert.equal(adjudicateAnnotation(input, config).evidence_ref, adjudicateAnnotation(reordered, config).evidence_ref);
});
test("rejects an original reviewer as adjudicator", () => {
  const input = structuredClone(fixture("invalid")); input.adjudication.adjudicator_ref = "adjudicator-synthetic-alpha";
  assert.ok(adjudicateAnnotation(input, config).rejection_codes.includes("adjudicator-conflict"));
});
test("rejects missing Batch 8 lineage", () => {
  const input = structuredClone(fixture("exportable")); input.window_lineage_ref = null;
  assert.ok(adjudicateAnnotation(input, config).rejection_codes.includes("lineage-missing"));
});
test("builds a deterministic immutable export", () => {
  const first = buildDatasetExport(exportFixture("exportable"), config); const second = buildDatasetExport(structuredClone(exportFixture("exportable")).reverse(), config);
  assert.equal(first.decision, "exportable"); assert.equal(first.rows.length, 2); assert.equal(first.rows[0].content.keypoints.length, 23); assert.match(first.manifest_hash, /^[a-f0-9]{64}$/); assert.equal(first.manifest_hash, second.manifest_hash);
});
test("rejects incomplete ordered annotation content", () => {
  const input = structuredClone(fixture("exportable")); input.annotation_content.keypoints.pop();
  assert.ok(adjudicateAnnotation(input, config).rejection_codes.includes("invalid-input"));
});
test("rejects duplicate annotation evidence", () => {
  const items = structuredClone(exportFixture("exportable")); items[1].annotation.annotation_ref = items[0].annotation.annotation_ref;
  assert.ok(buildDatasetExport(items, config).rejection_codes.includes("duplicate-evidence"));
});
test("rejects partition drift across related sources", () => assert.ok(buildDatasetExport(exportFixture("invalid"), config).rejection_codes.includes("partition-drift")));
test("fails an export closed when adjudication remains unresolved", () => {
  const items = structuredClone(exportFixture("exportable")); items[0].annotation = structuredClone(fixture("review-required"));
  assert.ok(buildDatasetExport(items, config).rejection_codes.includes("adjudication-required"));
});
test("rejects sensitive fields anywhere in the package", () => {
  const unsafe = structuredClone(config); unsafe.fixtures[0].medical_note = "unsafe"; unsafe.api_token = "unsafe";
  const errors = validateBatch10Config(unsafe); assert.ok(errors.some((error) => error.includes("medical_note")) && errors.some((error) => error.includes("api_token")));
});
test("keeps production, inference, and database changes disabled", () => {
  const unsafe = structuredClone(config); unsafe.safety.production_data_allowed = true; unsafe.safety.model_inference = true;
  const errors = validateBatch10Config(unsafe); assert.ok(errors.some((error) => error.includes("production_data_allowed")) && errors.some((error) => error.includes("model_inference")));
});
