import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { evaluateCaptureQuality, validateBatch7Config } from "./batch7-capture-quality.mjs";

const config = JSON.parse(await readFile(new URL("../intelligence/batch7-capture-quality.example.json", import.meta.url), "utf8"));
const metadata = { source_timestamps: true, variable_frame_rate: true, original_aspect_ratio: true, source_resolution: true };
const good = { exercise: "flatwork", fps: 60, width_px: 1920, height_px: 1080, horse_visibility: 0.99, rider_visibility: 0.99, blur_score: 120, luminance: 110, camera_motion: 0.02, side_angle_degrees: 8, jump_plane_visible: false, metadata_preserved: metadata };

test("accepts the committed offline capture-quality package", () => assert.deepEqual(validateBatch7Config(structuredClone(config)), []));
test("accepts suitable flatwork without warnings", () => assert.deepEqual(evaluateCaptureQuality(good, config), { decision: "eligible", rejection_codes: [], warnings: [] }));
test("keeps 30 FPS jumping in shadow mode", () => {
  const result = evaluateCaptureQuality({ ...good, exercise: "jumping", fps: 30, jump_plane_visible: true }, config);
  assert.equal(result.decision, "shadow-only");
  assert.deepEqual(result.warnings, ["reduced-jump-timing-confidence"]);
});
test("accepts suitable 60 FPS jumping", () => assert.equal(evaluateCaptureQuality({ ...good, exercise: "jumping", jump_plane_visible: true }, config).decision, "eligible"));
test("rejects low frame rate before processing", () => assert.deepEqual(evaluateCaptureQuality({ ...good, fps: 20 }, config).rejection_codes, ["frame-rate-too-low"]));
test("reports all deterministic capture failures", () => {
  const result = evaluateCaptureQuality({ ...good, exercise: "jumping", width_px: 640, height_px: 360, horse_visibility: 0.5, rider_visibility: 0.5, blur_score: 10, luminance: 20, camera_motion: 0.2, side_angle_degrees: 40, jump_plane_visible: false }, config);
  assert.equal(result.decision, "rejected");
  for (const code of ["resolution-too-low", "horse-not-fully-visible", "rider-not-fully-visible", "severe-blur", "lighting-too-dark", "unstable-camera", "view-not-side-on", "jump-plane-not-visible"]) assert.ok(result.rejection_codes.includes(code));
});
test("rejects overexposed footage", () => assert.ok(evaluateCaptureQuality({ ...good, luminance: 240 }, config).rejection_codes.includes("lighting-too-bright")));
test("fails closed when source metadata is not preserved", () => assert.deepEqual(evaluateCaptureQuality({ ...good, metadata_preserved: { ...metadata, source_timestamps: false } }, config).rejection_codes, ["metadata-not-preserved"]));
test("rejects malformed measurements without throwing", () => {
  assert.doesNotThrow(() => evaluateCaptureQuality({ ...good, fps: "60" }, config));
  assert.deepEqual(evaluateCaptureQuality({ ...good, fps: "60" }, config).rejection_codes, ["invalid-measurements"]);
});
test("rejects impossible normalized measurements", () => {
  for (const measurements of [
    { ...good, horse_visibility: 1.1 },
    { ...good, rider_visibility: -0.1 },
    { ...good, camera_motion: -0.1 },
    { ...good, luminance: 300 },
    { ...good, width_px: 1920.5 },
  ]) {
    assert.deepEqual(evaluateCaptureQuality(measurements, config).rejection_codes, ["invalid-measurements"]);
  }
});
test("rejects unsafe production and user-visible configuration", () => {
  const unsafe = structuredClone(config);
  unsafe.safety.production_data_allowed = true;
  unsafe.safety.user_visible_results = true;
  const errors = validateBatch7Config(unsafe);
  assert.ok(errors.some((error) => error.includes("production_data_allowed")));
  assert.ok(errors.some((error) => error.includes("user_visible_results")));
});
test("rejects identifiers and credentials in fixtures", () => {
  const unsafe = structuredClone(config);
  unsafe.fixtures[0].email = "person@example.invalid";
  unsafe.api_token = "do-not-store";
  const errors = validateBatch7Config(unsafe);
  assert.ok(errors.some((error) => error.includes("email")));
  assert.ok(errors.some((error) => error.includes("api_token")));
});
test("requires synthetic fixtures for every decision", () => {
  const malformed = structuredClone(config);
  malformed.fixtures = malformed.fixtures.slice(0, 2);
  const errors = validateBatch7Config(malformed);
  assert.ok(errors.some((error) => error.includes("at least three")));
});
test("requires every emitted rejection code to be declared", () => {
  const malformed = structuredClone(config);
  malformed.rejection_codes = malformed.rejection_codes.filter((code) => code !== "metadata-not-preserved");
  assert.ok(validateBatch7Config(malformed).some((error) => error.includes("metadata-not-preserved")));
});
