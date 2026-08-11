import type { AnalysisJob, AnalysisMetric, AnalysisResult, PoseSample } from "../types.js";

function hash(value: string): number {
  let result = 0;
  for (const character of value) {
    result = (Math.imul(result, 31) + character.charCodeAt(0)) >>> 0;
  }
  return result;
}

function boundedScore(seed: number, offset: number): number {
  return 68 + ((seed >>> offset) % 23);
}

const strengthCopy: Record<AnalysisMetric["category"], string> = {
  Position: "Stable upper-body position through the sampled sequence",
  Balance: "Balanced alignment remains consistent across transitions",
  Timing: "Movement timing is coordinated with the horse's rhythm",
  Impulsion: "Forward energy stays consistent through the exercise",
};

const improvementCopy: Record<AnalysisMetric["category"], string> = {
  Position: "Keep the shoulders stacked over the hips",
  Balance: "Stabilize the lower leg before each transition",
  Timing: "Prepare aids one stride earlier",
  Impulsion: "Maintain the same forward intent after each transition",
};

export async function generateFeedback(
  job: AnalysisJob,
  poses: PoseSample[],
): Promise<AnalysisResult> {
  if (poses.length === 0) {
    throw new Error("Pose pipeline returned no samples");
  }

  // TODO(mp-3): replace deterministic scores and copy with model inference.
  const seed = hash(`${job.id}:${job.title}:${job.discipline}:${poses.length}`);
  const metrics: AnalysisMetric[] = [
    { category: "Position", score: boundedScore(seed, 0) },
    { category: "Balance", score: boundedScore(seed, 5) },
    { category: "Timing", score: boundedScore(seed, 10) },
    { category: "Impulsion", score: boundedScore(seed, 15) },
  ];

  const ranked = [...metrics].sort((a, b) => b.score - a.score);
  const strongest = ranked[0];
  const weakest = ranked.at(-1);
  if (!strongest || !weakest) {
    throw new Error("Analysis metrics could not be ranked");
  }

  const score = Math.round(
    metrics.reduce((total, metric) => total + metric.score, 0) / metrics.length,
  );

  return {
    score,
    metrics,
    aiFeedback: {
      strengths: [strengthCopy[strongest.category]],
      improvements: [improvementCopy[weakest.category]],
    },
  };
}
