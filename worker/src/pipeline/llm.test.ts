import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { type TestContext } from "node:test";
import type { AnalysisJob } from "../types.js";
import type { PipelineConfig } from "./config-llm.js";
import type { RealFrame } from "./ffmpeg.js";
import { analyzeWithLLM, estimateCostUsd, LLMUnavailableError } from "./llm.js";
import { PipelineValidationError } from "./storage.js";

const cfg: PipelineConfig = {
  mode: "llm",
  provider: "openai",
  apiKey: "test-key",
  model: "gpt-4o-mini",
  maxRetries: 2,
  timeoutMs: 5_000,
  maxVideoBytes: 1,
};

const job: AnalysisJob = {
  id: "test-analysis",
  title: "Test ride",
  discipline: "Show jumping",
  videoUrl: "rider/clip.mp4",
  createdAt: "2026-08-12T00:00:00.000Z",
};

const validOutput = {
  metrics: [
    { category: "Position", score: 82, evidence: "frame 0: aligned" },
    { category: "Balance", score: 78, evidence: "frame 0: steady" },
    { category: "Timing", score: 74, evidence: "frame 0: prepared" },
    { category: "Impulsion", score: 86, evidence: "frame 0: forward" },
  ],
  strengths: ["Strong lower leg"],
  improvements: ["Earlier release"],
  overallComment: "Good round.",
  isRidingContent: true,
};

async function makeFrames(context: TestContext): Promise<RealFrame[]> {
  const directory = await mkdtemp(join(tmpdir(), "equivista-llm-test-"));
  context.after(async () => rm(directory, { recursive: true, force: true }));
  const filePath = join(directory, "frame-0.jpg");
  await writeFile(filePath, Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
  return [{ index: 0, timestampMs: 1_000, filePath }];
}

function openAIResponse(content: string): Response {
  return new Response(
    JSON.stringify({
      choices: [{ message: { content } }],
      usage: { prompt_tokens: 1_000, completion_tokens: 100 },
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

test("OpenAI request uses strict schema and returns validated output", async (context) => {
  const frames = await makeFrames(context);
  const requestBodies: Record<string, unknown>[] = [];
  const fetchImpl = (async (_input: string | URL | Request, init?: RequestInit) => {
    requestBodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
    return openAIResponse(JSON.stringify(validOutput));
  }) as typeof fetch;
  const logs: Record<string, unknown>[] = [];

  const output = await analyzeWithLLM(job, frames, cfg, {
    fetchImpl,
    sleepImpl: async () => undefined,
    logAnalysis: (entry) => logs.push(entry),
  });

  assert.equal(output.metrics.length, 4);
  assert.equal(logs.length, 1);
  assert.equal(logs[0]?.estimatedCostUsd, 0.00021);
  const responseFormat = requestBodies[0]?.response_format as Record<string, unknown>;
  assert.equal(responseFormat.type, "json_schema");
  const jsonSchema = responseFormat.json_schema as Record<string, unknown>;
  assert.equal(jsonSchema.strict, true);
});

test("not-riding result fails immediately even with empty coaching arrays", async (context) => {
  const frames = await makeFrames(context);
  let calls = 0;
  const notRiding = {
    metrics: [],
    strengths: [],
    improvements: [],
    overallComment: "No horse or rider visible.",
    isRidingContent: false,
  };
  const fetchImpl = (async () => {
    calls += 1;
    return openAIResponse(JSON.stringify(notRiding));
  }) as typeof fetch;

  await assert.rejects(
    analyzeWithLLM(job, frames, cfg, {
      fetchImpl,
      sleepImpl: async () => undefined,
      logAnalysis: () => undefined,
    }),
    (error: unknown) =>
      error instanceof PipelineValidationError &&
      error.reason === "not_riding_content",
  );
  assert.equal(calls, 1);
});

test("bad JSON retries without a real network call", async (context) => {
  const frames = await makeFrames(context);
  let calls = 0;
  const fetchImpl = (async () => {
    calls += 1;
    return openAIResponse("not json");
  }) as typeof fetch;

  await assert.rejects(
    analyzeWithLLM(job, frames, cfg, {
      fetchImpl,
      sleepImpl: async () => undefined,
      logAnalysis: () => undefined,
    }),
    LLMUnavailableError,
  );
  assert.equal(calls, cfg.maxRetries + 1);
});

test("missing key is rejected before calling a provider", async (context) => {
  const frames = await makeFrames(context);
  await assert.rejects(
    analyzeWithLLM(job, frames, { ...cfg, apiKey: null }),
    (error: unknown) =>
      error instanceof LLMUnavailableError &&
      error.message === "llm_api_key_missing",
  );
});

test("cost estimate stays null for unknown provider pricing", () => {
  assert.equal(
    estimateCostUsd(
      { ...cfg, provider: "anthropic" },
      { promptTokens: 1_000, completionTokens: 100 },
    ),
    null,
  );
});
