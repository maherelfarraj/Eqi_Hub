import assert from "node:assert/strict";
import test from "node:test";
import type { PipelineConfig } from "./config-llm.js";
import { createPipelineRunner } from "./index.js";
import { LLMUnavailableError } from "./llm.js";
import { PipelineValidationError } from "./storage.js";
import type { AnalysisJob, AnalysisResult } from "../types.js";

const job: AnalysisJob = {
  id: "44444444-4444-4444-4444-444444444407",
  title: "Show jumping — singles 1.00m",
  discipline: "Show jumping",
  videoUrl: "rider/example.mp4",
  createdAt: "2026-08-11T00:00:00.000Z",
};

const stubConfig: PipelineConfig = {
  mode: "stub",
  provider: "openai",
  apiKey: null,
  model: "gpt-4o-mini",
  maxRetries: 2,
  timeoutMs: 120_000,
  maxVideoBytes: 300 * 1024 * 1024,
};

const fallbackResult: AnalysisResult = {
  score: 79,
  metrics: [
    { category: "Position", score: 80 },
    { category: "Balance", score: 78 },
    { category: "Timing", score: 76 },
    { category: "Impulsion", score: 82 },
  ],
  aiFeedback: {
    strengths: ["Stable position"],
    improvements: ["Prepare earlier"],
  },
};

test("stub pipeline output is deterministic and matches the hook contract", async () => {
  const run = createPipelineRunner({ loadConfig: () => stubConfig });
  const first = await run(job);
  const second = await run(job);

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

test("transient LLM failure falls back to a complete deterministic result", async () => {
  let cleanupCalls = 0;
  let fallbackLogs = 0;
  const run = createPipelineRunner({
    loadConfig: () => ({ ...stubConfig, mode: "llm", apiKey: "test" }),
    download: async () => "/tmp/test.mp4",
    extract: async () => [
      { index: 0, timestampMs: 1_000, filePath: "/tmp/frame.jpg" },
    ],
    analyze: async () => {
      throw new LLMUnavailableError("temporary outage");
    },
    cleanup: async () => {
      cleanupCalls += 1;
    },
    runStub: async () => fallbackResult,
    logFallback: () => {
      fallbackLogs += 1;
    },
  });

  const result = await run(job);

  assert.deepEqual(result, fallbackResult);
  assert.equal(result.metrics.length, 4);
  assert.ok(result.aiFeedback.strengths.length > 0);
  assert.ok(result.aiFeedback.improvements.length > 0);
  assert.equal(cleanupCalls, 1);
  assert.equal(fallbackLogs, 1);
});

test("not-riding validation failure never falls back to metrics", async () => {
  let stubCalls = 0;
  const run = createPipelineRunner({
    loadConfig: () => ({ ...stubConfig, mode: "llm", apiKey: "test" }),
    download: async () => "/tmp/test.mp4",
    extract: async () => [
      { index: 0, timestampMs: 1_000, filePath: "/tmp/frame.jpg" },
    ],
    analyze: async () => {
      throw new PipelineValidationError("not_riding_content");
    },
    cleanup: async () => undefined,
    runStub: async () => {
      stubCalls += 1;
      return fallbackResult;
    },
  });

  await assert.rejects(
    run(job),
    (error: unknown) =>
      error instanceof PipelineValidationError &&
      error.reason === "not_riding_content",
  );
  assert.equal(stubCalls, 0);
});
