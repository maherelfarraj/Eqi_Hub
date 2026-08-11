import { generateFeedback } from "./feedback.js";
import { extractFrames } from "./frames.js";
import { estimatePose } from "./pose.js";
import type { AnalysisJob, AnalysisResult } from "../types.js";

export async function runPipeline(job: AnalysisJob): Promise<AnalysisResult> {
  const frames = await extractFrames(job);
  const poses = await estimatePose(job, frames);
  return generateFeedback(job, poses);
}
