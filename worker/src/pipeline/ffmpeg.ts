import { execFile } from "node:child_process";
import { unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { PipelineValidationError } from "./storage.js";

const run = promisify(execFile);

export interface RealFrame {
  index: number;
  timestampMs: number;
  filePath: string;
}

function safeAnalysisId(analysisId: string): string {
  return analysisId.replace(/[^a-zA-Z0-9-]/g, "_");
}

async function probeDurationSeconds(videoPath: string): Promise<number> {
  try {
    const { stdout } = await run("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      videoPath,
    ]);
    const seconds = Number(stdout.trim());
    if (!Number.isFinite(seconds) || seconds <= 0) {
      throw new Error("invalid duration");
    }
    return seconds;
  } catch {
    throw new PipelineValidationError("video_unreadable");
  }
}

export function frameTimestampsForDuration(durationSeconds: number): number[] {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return [];
  const count = Math.min(12, Math.max(4, Math.floor(durationSeconds / 2)));
  const interval = durationSeconds / (count + 1);
  return Array.from(
    { length: count },
    (_unused, index) => Math.round(interval * (index + 1) * 1000),
  );
}

/** Extracts four to twelve chronological JPEG frames, capped at 768px wide. */
export async function extractRealFrames(
  analysisId: string,
  videoPath: string,
): Promise<RealFrame[]> {
  const duration = await probeDurationSeconds(videoPath);
  const timestamps = frameTimestampsForDuration(duration);
  const frames: RealFrame[] = [];
  const safeId = safeAnalysisId(analysisId);

  for (const [index, timestampMs] of timestamps.entries()) {
    const filePath = join(tmpdir(), `equivista-${safeId}-frame-${index}.jpg`);
    try {
      await run("ffmpeg", [
        "-nostdin",
        "-loglevel",
        "error",
        "-ss",
        (timestampMs / 1000).toFixed(3),
        "-i",
        videoPath,
        "-frames:v",
        "1",
        "-q:v",
        "3",
        "-vf",
        "scale='min(768,iw)':-2",
        "-y",
        filePath,
      ]);
    } catch (error) {
      await Promise.allSettled([
        unlink(filePath),
        ...frames.map((frame) => unlink(frame.filePath)),
      ]);
      const message = error instanceof Error ? error.message : String(error);
      throw new PipelineValidationError(`frame_extract_failed:${message}`);
    }
    frames.push({ index, timestampMs, filePath });
  }
  return frames;
}

/** Best-effort cleanup limited to the explicit files created for this job. */
export async function cleanupTempFiles(
  videoPath: string | null,
  frames: RealFrame[],
): Promise<void> {
  const targets = [
    ...(videoPath ? [videoPath] : []),
    ...frames.map((frame) => frame.filePath),
  ];
  await Promise.allSettled(targets.map((target) => unlink(target)));
}
