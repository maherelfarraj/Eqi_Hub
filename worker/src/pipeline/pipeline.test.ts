import assert from "node:assert/strict";
import test from "node:test";
import { runPipeline } from "./index.js";
import type { AnalysisJob } from "../types.js";

const job: AnalysisJob = {
  id: "44444444-4444-4444-4444-444444444407",
  title: "Show jumping — singles 1.00m",
  discipline: "Show jumping",
  videoUrl: "rider/example.mp4",
  createdAt: "2026-08-11T00:00:00.000Z",
};

test("pipeline output is deterministic and matches the hook contract", async () => {
  const first = await runPipeline(job);
  const second = await runPipeline(job);

  assert.deepEqual(first, second);
  assert.equal(first.metrics.length, 4);
  assert.ok(first.score >= 68 && first.score <= 90);
  assert.deepEqual(
    first.metrics.map((metric) => metric.category),
    ["Position", "Balance", "Timing", "Impulsion"],
  );
  assert.equal(first.aiFeedback.strengths.length, 1);
  assert.equal(first.aiFeedback.improvements.length, 1);
});
