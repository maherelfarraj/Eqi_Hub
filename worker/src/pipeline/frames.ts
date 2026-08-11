import type { AnalysisJob, FrameSample } from "../types.js";

const FRAME_COUNT = 12;
const FRAME_INTERVAL_MS = 2_000;

export async function extractFrames(job: AnalysisJob): Promise<FrameSample[]> {
  // TODO(mp-3): replace deterministic sampling with ffmpeg frame extraction.
  return Array.from({ length: FRAME_COUNT }, (_, index) => ({
    index,
    timestampMs: index * FRAME_INTERVAL_MS,
    source: job.videoUrl,
  }));
}
