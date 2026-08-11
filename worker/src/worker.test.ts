import assert from "node:assert/strict";
import test from "node:test";
import { AnalysisWorker } from "./worker.js";
import { PipelineValidationError } from "./pipeline/storage.js";
import type {
  AnalysisJob,
  AnalysisResult,
  JobRepository,
  WorkerLogger,
} from "./types.js";

const job: AnalysisJob = {
  id: "analysis-1",
  title: "Test ride",
  discipline: "Flatwork",
  videoUrl: null,
  createdAt: "2026-08-11T00:00:00.000Z",
};

const result: AnalysisResult = {
  score: 80,
  metrics: [
    { category: "Position", score: 80 },
    { category: "Balance", score: 80 },
    { category: "Timing", score: 80 },
    { category: "Impulsion", score: 80 },
  ],
  aiFeedback: { strengths: ["Stable position"], improvements: ["Earlier aids"] },
};

class FakeRepository implements JobRepository {
  completed: AnalysisResult | null = null;
  failed = false;

  async listUploaded(): Promise<AnalysisJob[]> {
    return [job];
  }

  async claim(): Promise<AnalysisJob> {
    return job;
  }

  async complete(_id: string, completed: AnalysisResult): Promise<void> {
    this.completed = completed;
  }

  async fail(): Promise<void> {
    this.failed = true;
  }
}

const silentLogger: WorkerLogger = { info: () => undefined, error: () => undefined };

test("poll claims and completes an uploaded analysis", async () => {
  const repository = new FakeRepository();
  const worker = new AnalysisWorker(repository, silentLogger, async () => result);

  const summary = await worker.poll();

  assert.deepEqual(summary, { discovered: 1, claimed: 1, analyzed: 1, failed: 0 });
  assert.deepEqual(repository.completed, result);
  assert.equal(repository.failed, false);
});

test("poll marks the analysis failed when the pipeline throws", async () => {
  const repository = new FakeRepository();
  const worker = new AnalysisWorker(repository, silentLogger, async () => {
    throw new Error("pipeline error");
  });

  const summary = await worker.poll();

  assert.deepEqual(summary, { discovered: 1, claimed: 1, analyzed: 0, failed: 1 });
  assert.equal(repository.completed, null);
  assert.equal(repository.failed, true);
});

test("non-riding content is failed without completing metrics", async () => {
  const repository = new FakeRepository();
  const worker = new AnalysisWorker(repository, silentLogger, async () => {
    throw new PipelineValidationError("not_riding_content");
  });

  const summary = await worker.poll();

  assert.deepEqual(summary, { discovered: 1, claimed: 1, analyzed: 0, failed: 1 });
  assert.equal(repository.completed, null);
  assert.equal(repository.failed, true);
});
