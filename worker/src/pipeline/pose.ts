import type { AnalysisJob, FrameSample, NormalizedPoint, PoseSample } from "../types.js";

function hash(value: string): number {
  let result = 2_166_136_261;
  for (const character of value) {
    result ^= character.charCodeAt(0);
    result = Math.imul(result, 16_777_619);
  }
  return result >>> 0;
}

function normalized(seed: number, offset: number, min: number, span: number): number {
  const value = ((seed >>> (offset % 24)) & 0xff) / 255;
  return Number((min + value * span).toFixed(4));
}

function point(seed: number, offset: number, baseY: number): NormalizedPoint {
  return {
    x: normalized(seed, offset, 0.35, 0.3),
    y: normalized(seed, offset + 5, baseY, 0.08),
    confidence: normalized(seed, offset + 11, 0.91, 0.08),
  };
}

export async function estimatePose(
  job: AnalysisJob,
  frames: FrameSample[],
): Promise<PoseSample[]> {
  // TODO(mp-3): replace normalized deterministic points with the pose model.
  return frames.map((frame) => {
    const seed = hash(`${job.id}:${job.discipline}:${frame.index}`);
    return {
      timestampMs: frame.timestampMs,
      points: {
        shoulder: point(seed, 1, 0.2),
        hip: point(seed, 7, 0.45),
        knee: point(seed, 13, 0.63),
        heel: point(seed, 19, 0.79),
      },
    };
  });
}
