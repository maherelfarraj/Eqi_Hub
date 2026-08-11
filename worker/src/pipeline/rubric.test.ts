import assert from "node:assert/strict";
import test from "node:test";
import {
  isExplicitNonRidingOutput,
  rubricUserPrompt,
  validateRubric,
  type RubricOutput,
} from "./rubric.js";

const valid: RubricOutput = {
  metrics: [
    { category: "Position", score: 80, evidence: "frame 0: aligned" },
    { category: "Balance", score: 76, evidence: "frame 1: steady" },
    { category: "Timing", score: 71, evidence: "frame 2: aids slightly late" },
    { category: "Impulsion", score: 84, evidence: "frame 3: forward energy" },
  ],
  strengths: ["Forward energy stays consistent"],
  improvements: ["Prepare aids one stride earlier"],
  overallComment: "Solid session with clear forward intent.",
  isRidingContent: true,
};

test("validateRubric accepts a complete frame-cited result", () => {
  assert.deepEqual(validateRubric(valid, 4), []);
});

test("validateRubric rejects malformed output and duplicate categories", () => {
  assert.ok(validateRubric("nope", 4).includes("output_not_object"));
  const bad = structuredClone(valid);
  bad.metrics[1] = { ...bad.metrics[0]! };
  const errors = validateRubric(bad, 4);
  assert.ok(errors.includes("duplicate_category:Position"));
  assert.ok(errors.includes("missing_category:Balance"));
});

test("validateRubric rejects scores and evidence outside the sampled frames", () => {
  const bad = structuredClone(valid);
  bad.metrics[0]!.score = 140;
  bad.metrics[1]!.evidence = "frame 12: steady";
  const errors = validateRubric(bad, 4);
  assert.ok(errors.some((error) => error.startsWith("bad_score")));
  assert.ok(errors.some((error) => error.startsWith("evidence_frame_invalid")));
});

test("non-riding gate is recognized before coaching-array validation", () => {
  assert.equal(
    isExplicitNonRidingOutput({
      metrics: [],
      strengths: [],
      improvements: [],
      overallComment: "Not a riding video",
      isRidingContent: false,
    }),
    true,
  );
});

test("discipline prompt includes discipline, frame range, and session date", () => {
  const prompt = rubricUserPrompt("Dressage", 4, "2026-08-12");
  assert.match(prompt, /Dressage/);
  assert.match(prompt, /frame 0 to frame 3/);
  assert.match(prompt, /2026-08-12/);
});
