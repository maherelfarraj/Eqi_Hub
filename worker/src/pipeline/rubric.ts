export const CATEGORIES = [
  "Position",
  "Balance",
  "Timing",
  "Impulsion",
] as const;
export type Category = (typeof CATEGORIES)[number];

export interface RubricMetric {
  category: Category;
  score: number;
  evidence: string;
}

export interface RubricOutput {
  metrics: RubricMetric[];
  strengths: string[];
  improvements: string[];
  overallComment: string;
  isRidingContent: boolean;
}

export const RUBRIC_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "metrics",
    "strengths",
    "improvements",
    "overallComment",
    "isRidingContent",
  ],
  properties: {
    metrics: {
      type: "array",
      minItems: 4,
      maxItems: 4,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["category", "score", "evidence"],
        properties: {
          category: { type: "string", enum: [...CATEGORIES] },
          score: { type: "number", minimum: 0, maximum: 100 },
          evidence: { type: "string", minLength: 1 },
        },
      },
    },
    strengths: {
      type: "array",
      minItems: 1,
      maxItems: 3,
      items: { type: "string", minLength: 1 },
    },
    improvements: {
      type: "array",
      minItems: 1,
      maxItems: 3,
      items: { type: "string", minLength: 1 },
    },
    overallComment: { type: "string", minLength: 1 },
    isRidingContent: { type: "boolean" },
  },
} as const;

const DISCIPLINE_NOTES: Record<string, string> = {
  "Show jumping":
    "Judge two-point stability, release over fences, lower-leg anchor, " +
    "eye line to the next fence, and recovery after landing.",
  Dressage:
    "Judge seat depth, vertical shoulder-hip-heel alignment, quietness " +
    "of the aids, and stillness of the upper body.",
  Flatwork:
    "Judge classical basics across gaits: alignment, independent seat, " +
    "steady contact, and balanced transitions.",
};

export function rubricSystemPrompt(): string {
  return [
    "You are an FEI-level equestrian biomechanics judge evaluating the rider",
    "across a chronological sequence of frames from one riding session.",
    "Score Position, Balance, Timing, and Impulsion from 0 to 100.",
    "Score only what is visible. Cite a valid frame index as evidence for every",
    "category. Be honest, specific, and constructive. Never invent detail.",
    "If the images do not show a person riding a horse, set isRidingContent to",
    "false. Otherwise return all four unique categories, at least one strength,",
    "at least one improvement, and a concise overall comment.",
  ].join("\n");
}

export function rubricUserPrompt(
  discipline: string,
  frameCount: number,
  sessionDate: string,
): string {
  const note = DISCIPLINE_NOTES[discipline] ?? DISCIPLINE_NOTES.Flatwork;
  return [
    `Discipline: ${discipline}. ${note}`,
    `Session date: ${sessionDate}.`,
    `Evaluate ${frameCount} frames in order, from frame 0 to frame ${frameCount - 1}.`,
    "Return only the requested JSON object.",
  ].join("\n");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isExplicitNonRidingOutput(value: unknown): boolean {
  return isRecord(value) && value.isRidingContent === false;
}

/** Validates a riding-result payload and verifies every evidence frame. */
export function validateRubric(value: unknown, frameCount: number): string[] {
  if (!isRecord(value)) return ["output_not_object"];
  const errors: string[] = [];

  if (!Array.isArray(value.metrics)) {
    errors.push("metrics_not_array");
  } else {
    if (value.metrics.length !== CATEGORIES.length) {
      errors.push("metrics_wrong_length");
    }
    const seen = new Set<string>();
    for (const metricValue of value.metrics) {
      if (!isRecord(metricValue)) {
        errors.push("metric_not_object");
        continue;
      }
      const category = metricValue.category;
      if (
        typeof category !== "string" ||
        !(CATEGORIES as readonly string[]).includes(category)
      ) {
        errors.push(`bad_category:${String(category)}`);
      } else if (seen.has(category)) {
        errors.push(`duplicate_category:${category}`);
      } else {
        seen.add(category);
      }

      const score = metricValue.score;
      if (
        typeof score !== "number" ||
        !Number.isFinite(score) ||
        score < 0 ||
        score > 100
      ) {
        errors.push(`bad_score:${String(score)}`);
      }

      const evidence = metricValue.evidence;
      if (typeof evidence !== "string" || evidence.trim().length === 0) {
        errors.push("evidence_invalid");
      } else {
        const match = /\bframe\s+(\d+)\b/i.exec(evidence);
        const frameIndex = match?.[1] === undefined ? Number.NaN : Number(match[1]);
        if (
          !Number.isSafeInteger(frameIndex) ||
          frameIndex < 0 ||
          frameIndex >= frameCount
        ) {
          errors.push(`evidence_frame_invalid:${evidence}`);
        }
      }
    }
    for (const category of CATEGORIES) {
      if (!seen.has(category)) errors.push(`missing_category:${category}`);
    }
  }

  for (const key of ["strengths", "improvements"] as const) {
    const items = value[key];
    if (
      !Array.isArray(items) ||
      items.length === 0 ||
      items.length > 3 ||
      !items.every((item) => typeof item === "string" && item.trim().length > 0)
    ) {
      errors.push(`${key}_invalid`);
    }
  }
  if (
    typeof value.overallComment !== "string" ||
    value.overallComment.trim().length === 0
  ) {
    errors.push("overallComment_invalid");
  }
  if (value.isRidingContent !== true) {
    errors.push("isRidingContent_invalid");
  }
  return errors;
}
