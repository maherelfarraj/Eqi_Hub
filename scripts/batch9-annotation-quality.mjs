import { createHash } from "node:crypto";

const KEYPOINTS = [
  "poll", "withers", "croup",
  "near-shoulder", "near-elbow", "near-knee", "near-front-fetlock", "near-front-hoof",
  "far-shoulder", "far-elbow", "far-knee", "far-front-fetlock", "far-front-hoof",
  "near-hip-origin", "near-stifle", "near-hock", "near-rear-fetlock", "near-rear-hoof",
  "far-hip-origin", "far-stifle", "far-hock", "far-rear-fetlock", "far-rear-hoof",
];
const STATES = ["visible", "occluded", "outside-frame", "not-applicable"];
const REQUIRED_CODES = ["invalid-input", "lineage-missing", "incomplete-skeleton", "single-review", "agreement-threshold", "state-ambiguity"];
const SENSITIVE_KEY = /(?:password|secret|token|api[_-]?key|credential|email|full[_-]?name|phone|user[_-]?id)/i;

const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const finite = (value) => typeof value === "number" && Number.isFinite(value);
const syntheticRef = (value, prefix) => typeof value === "string" && new RegExp(`^${prefix}-[a-z0-9-]+$`).test(value);
const lineageRef = (value) => typeof value === "string" && /^lineage-[a-f0-9]{24}$/.test(value);

function inspectSensitive(value, path, errors) {
  if (Array.isArray(value)) return value.forEach((entry, index) => inspectSensitive(entry, `${path}[${index}]`, errors));
  if (!object(value)) return;
  for (const [key, entry] of Object.entries(value)) {
    if (SENSITIVE_KEY.test(key)) errors.push(`${path}.${key} must not contain credentials or personal data`);
    inspectSensitive(entry, `${path}.${key}`, errors);
  }
}

export function validateBatch9Config(config) {
  const errors = [];
  if (!object(config)) return ["config must be an object"];
  if (config.version !== 1) errors.push("version must equal 1");
  if (config.batch !== 9) errors.push("batch must equal 9");
  if (config.mode !== "offline-horse-keypoint-annotation-quality") errors.push("mode is invalid");
  if (config.status !== "in-progress") errors.push("status must equal in-progress");
  if (config.skeleton_version !== "horse-23-v1") errors.push("skeleton_version must equal horse-23-v1");
  if (JSON.stringify(config.keypoints) !== JSON.stringify(KEYPOINTS)) errors.push("keypoints must match the ordered 23-point skeleton");
  if (JSON.stringify(config.visibility_states) !== JSON.stringify(STATES)) errors.push("visibility_states must match the stable state contract");
  if (!object(config.thresholds) || !finite(config.thresholds.max_normalized_disagreement) || config.thresholds.max_normalized_disagreement <= 0 || config.thresholds.max_normalized_disagreement > 0.25) errors.push("thresholds.max_normalized_disagreement must be within (0, 0.25]");
  if (!object(config.thresholds) || !finite(config.thresholds.minimum_state_agreement) || config.thresholds.minimum_state_agreement < 0.8 || config.thresholds.minimum_state_agreement > 1) errors.push("thresholds.minimum_state_agreement must be within [0.8, 1]");
  if (!Array.isArray(config.rejection_codes)) errors.push("rejection_codes must be an array");
  else REQUIRED_CODES.forEach((code) => { if (!config.rejection_codes.includes(code)) errors.push(`rejection_codes must include ${code}`); });
  const safety = config.safety ?? {};
  for (const key of ["fail_closed", "double_review_required", "batch8_lineage_required", "near_far_from_camera_view"]) if (safety[key] !== true) errors.push(`safety.${key} must equal true`);
  for (const key of ["production_data_allowed", "user_visible_results", "model_training", "model_inference", "database_changes"]) if (safety[key] !== false) errors.push(`safety.${key} must equal false`);
  if (!Array.isArray(config.fixtures) || config.fixtures.length < 3) errors.push("fixtures must contain at least three synthetic cases");
  else {
    const decisions = new Set();
    config.fixtures.forEach((fixture, index) => {
      if (!syntheticRef(fixture?.fixture_ref, "annotation")) errors.push(`fixtures[${index}].fixture_ref must be synthetic`);
      if (!["accepted", "review-required", "rejected"].includes(fixture?.expected_decision)) errors.push(`fixtures[${index}].expected_decision is invalid`);
      decisions.add(fixture?.expected_decision);
    });
    for (const decision of ["accepted", "review-required", "rejected"]) if (!decisions.has(decision)) errors.push(`fixtures must include ${decision}`);
  }
  if (typeof config.evidence_ref !== "string" || !config.evidence_ref.startsWith("docs/")) errors.push("evidence_ref must reference committed documentation");
  inspectSensitive(config, "config", errors);
  return errors;
}

function validateReview(review) {
  if (!object(review) || !syntheticRef(review.reviewer_ref, "reviewer") || !Array.isArray(review.keypoints)) return false;
  if (review.keypoints.length !== KEYPOINTS.length) return false;
  return review.keypoints.every((point, index) => {
    if (!object(point) || point.name !== KEYPOINTS[index] || !STATES.includes(point.state)) return false;
    const coordinateRequired = point.state === "visible" || point.state === "occluded";
    return coordinateRequired
      ? finite(point.x) && point.x >= 0 && point.x <= 1 && finite(point.y) && point.y >= 0 && point.y <= 1
      : point.x === null && point.y === null;
  });
}

export function evaluateAnnotation(input, config) {
  if (validateBatch9Config(config).length || !object(input)) return { decision: "rejected", rejection_codes: ["invalid-input"], metrics: null, evidence_ref: null };
  const codes = [];
  if (!syntheticRef(input.frame_ref, "frame") || !syntheticRef(input.window_ref, "window") || !object(input.bounding_box)) codes.push("invalid-input");
  if (!lineageRef(input.source_lineage_ref) || !lineageRef(input.window_lineage_ref)) codes.push("lineage-missing");
  const box = input.bounding_box ?? {};
  if (![box.x_min, box.y_min, box.x_max, box.y_max].every((value) => finite(value) && value >= 0 && value <= 1) || !(box.x_min < box.x_max && box.y_min < box.y_max)) codes.push("invalid-input");
  if (!Array.isArray(input.reviews) || input.reviews.length !== 2 || new Set(input.reviews?.map((review) => review?.reviewer_ref)).size !== 2) codes.push("single-review");
  if (Array.isArray(input.reviews) && input.reviews.some((review) => !validateReview(review))) codes.push("incomplete-skeleton");
  if (codes.length) return { decision: "rejected", rejection_codes: [...new Set(codes)], metrics: null, evidence_ref: null };

  const [left, right] = input.reviews;
  let stateMatches = 0;
  const distances = [];
  for (let index = 0; index < KEYPOINTS.length; index += 1) {
    const a = left.keypoints[index]; const b = right.keypoints[index];
    if (a.state === b.state) stateMatches += 1;
    if (["visible", "occluded"].includes(a.state) && ["visible", "occluded"].includes(b.state)) distances.push(Math.hypot(a.x - b.x, a.y - b.y));
  }
  const metrics = {
    state_agreement: stateMatches / KEYPOINTS.length,
    mean_normalized_disagreement: distances.length ? distances.reduce((sum, value) => sum + value, 0) / distances.length : null,
    compared_coordinates: distances.length,
  };
  if (metrics.state_agreement < config.thresholds.minimum_state_agreement) codes.push("state-ambiguity");
  if (metrics.mean_normalized_disagreement === null || metrics.mean_normalized_disagreement > config.thresholds.max_normalized_disagreement) codes.push("agreement-threshold");
  const digest = createHash("sha256").update(JSON.stringify({ source: input.source_lineage_ref, window: input.window_lineage_ref, frame: input.frame_ref, reviews: input.reviews })).digest("hex").slice(0, 24);
  return { decision: codes.length ? "review-required" : "accepted", rejection_codes: codes, metrics, evidence_ref: `annotation-evidence-${digest}` };
}

export const batch9Constants = { KEYPOINTS, STATES, REQUIRED_CODES };
