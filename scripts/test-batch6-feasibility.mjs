import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { validateBatch6Feasibility } from "./batch6-feasibility.mjs";

const fixture = JSON.parse(await readFile(new URL("../intelligence/batch6-feasibility.example.json", import.meta.url), "utf8"));
const copy = () => structuredClone(fixture);

test("accepts the committed offline feasibility package", () => {
  assert.deepEqual(validateBatch6Feasibility(copy()), []);
});

test("fails closed when user-visible results are enabled", () => {
  const manifest = copy();
  manifest.safety.user_visible_results = true;
  assert.ok(validateBatch6Feasibility(manifest).some((error) => error.includes("user_visible_results")));
});

test("prohibits diagnostic and injury-prediction language", () => {
  const manifest = copy();
  manifest.safety.medical_diagnosis = "allowed";
  manifest.safety.injury_prediction = "allowed";
  const errors = validateBatch6Feasibility(manifest);
  assert.ok(errors.some((error) => error.includes("medical_diagnosis")));
  assert.ok(errors.some((error) => error.includes("injury_prediction")));
});

test("requires evidence and human review for every finding", () => {
  const manifest = copy();
  manifest.findings[0].evidence_required = false;
  manifest.findings[1].human_review = "optional";
  const errors = validateBatch6Feasibility(manifest);
  assert.ok(errors.some((error) => error.includes("evidence_required")));
  assert.ok(errors.some((error) => error.includes("human_review")));
});

test("requires fail-closed capture rejection reasons", () => {
  const manifest = copy();
  manifest.capture.reject_when = ["severe-blur"];
  assert.ok(validateBatch6Feasibility(manifest).some((error) => error.includes("subject-out-of-frame")));
});

test("keeps production data and production results disabled", () => {
  const manifest = copy();
  manifest.governance.production_data_allowed = true;
  assert.ok(validateBatch6Feasibility(manifest).some((error) => error.includes("production_data_allowed")));
});

test("rejects credentials and personal identifiers", () => {
  const manifest = copy();
  manifest.golden_set.cases[0].email = "person@example.invalid";
  manifest.governance.api_token = "never-store-this";
  const errors = validateBatch6Feasibility(manifest);
  assert.ok(errors.some((error) => error.includes("email")));
  assert.ok(errors.some((error) => error.includes("api_token")));
});

test("requires isolated golden-set split boundaries", () => {
  const manifest = copy();
  manifest.golden_set.split_boundaries = ["video"];
  assert.ok(validateBatch6Feasibility(manifest).some((error) => error.includes("horse")));
});
