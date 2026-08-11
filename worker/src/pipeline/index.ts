import { logger } from "../logger.js";
import type { AnalysisJob, AnalysisResult } from "../types.js";
import { loadPipelineConfig, type PipelineConfig } from "./config-llm.js";
import { generateFeedback, mapRubricToResult } from "./feedback.js";
import { cleanupTempFiles, extractRealFrames, type RealFrame } from "./ffmpeg.js";
import { extractFrames } from "./frames.js";
import { analyzeWithLLM, LLMUnavailableError } from "./llm.js";
import { estimatePose } from "./pose.js";
import { downloadVideo, PipelineValidationError } from "./storage.js";

interface PipelineDependencies {
  loadConfig: () => PipelineConfig;
  runStub: (job: AnalysisJob) => Promise<AnalysisResult>;
  download: (
    analysisId: string,
    storagePath: string | null,
    cfg: PipelineConfig,
  ) => Promise<string>;
  extract: (analysisId: string, videoPath: string) => Promise<RealFrame[]>;
  analyze: (
    job: AnalysisJob,
    frames: RealFrame[],
    cfg: PipelineConfig,
  ) => ReturnType<typeof analyzeWithLLM>;
  cleanup: (videoPath: string | null, frames: RealFrame[]) => Promise<void>;
  logFallback: (context: Record<string, unknown>) => void;
}

/** Original deterministic pipeline, retained for rollback and transient fallback. */
async function runStubPipeline(job: AnalysisJob): Promise<AnalysisResult> {
  const frames = await extractFrames(job);
  const poses = await estimatePose(job, frames);
  return generateFeedback(job, poses);
}

const defaults: PipelineDependencies = {
  loadConfig: () => loadPipelineConfig(process.env),
  runStub: runStubPipeline,
  download: downloadVideo,
  extract: extractRealFrames,
  analyze: analyzeWithLLM,
  cleanup: cleanupTempFiles,
  logFallback: (context) => logger.error("llm_fallback", context),
};

export function createPipelineRunner(
  overrides: Partial<PipelineDependencies> = {},
): (job: AnalysisJob) => Promise<AnalysisResult> {
  const dependencies: PipelineDependencies = { ...defaults, ...overrides };

  return async (job: AnalysisJob): Promise<AnalysisResult> => {
    const cfg = dependencies.loadConfig();
    if (cfg.mode === "stub") return dependencies.runStub(job);

    let videoPath: string | null = null;
    let frames: RealFrame[] = [];
    try {
      try {
        videoPath = await dependencies.download(job.id, job.videoUrl, cfg);
        frames = await dependencies.extract(job.id, videoPath);
        const rubric = await dependencies.analyze(job, frames, cfg);
        return mapRubricToResult(rubric);
      } finally {
        await dependencies.cleanup(videoPath, frames);
      }
    } catch (error) {
      if (error instanceof PipelineValidationError) throw error;
      dependencies.logFallback({
        analysisId: job.id,
        error: error instanceof Error ? error.message : String(error),
        isUnavailable: error instanceof LLMUnavailableError,
      });
      const fallback = await dependencies.runStub(job);
      if (
        fallback.metrics.length === 0 ||
        fallback.aiFeedback.strengths.length === 0 ||
        fallback.aiFeedback.improvements.length === 0
      ) {
        throw new Error("Stub fallback returned an incomplete analysis");
      }
      return fallback;
    }
  };
}

const defaultRunner = createPipelineRunner();

export async function runPipeline(job: AnalysisJob): Promise<AnalysisResult> {
  return defaultRunner(job);
}
