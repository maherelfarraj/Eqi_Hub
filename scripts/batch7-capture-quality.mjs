const DECISIONS = new Set(["eligible", "shadow-only", "rejected"]);
const EXERCISES = new Set(["flatwork", "jumping"]);
const REQUIRED_REJECTION_CODES = [
  "invalid-measurements",
  "frame-rate-too-low",
  "resolution-too-low",
  "horse-not-fully-visible",
  "rider-not-fully-visible",
  "severe-blur",
  "lighting-too-dark",
  "lighting-too-bright",
  "unstable-camera",
  "view-not-side-on",
  "jump-plane-not-visible",
  "metadata-not-preserved",
];
const SENSITIVE_KEY = /(?:password|secret|token|api[_-]?key|credential|email|full[_-]?name|phone|user[_-]?id)/i;

function object(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function finite(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function validMeasurements(measurements) {
  return (
    finite(measurements.fps) && measurements.fps > 0 &&
    Number.isInteger(measurements.width_px) && measurements.width_px > 0 &&
    Number.isInteger(measurements.height_px) && measurements.height_px > 0 &&
    finite(measurements.horse_visibility) && measurements.horse_visibility >= 0 && measurements.horse_visibility <= 1 &&
    finite(measurements.rider_visibility) && measurements.rider_visibility >= 0 && measurements.rider_visibility <= 1 &&
    finite(measurements.blur_score) && measurements.blur_score >= 0 &&
    finite(measurements.luminance) && measurements.luminance >= 0 && measurements.luminance <= 255 &&
    finite(measurements.camera_motion) && measurements.camera_motion >= 0 && measurements.camera_motion <= 1 &&
    finite(measurements.side_angle_degrees) && Math.abs(measurements.side_angle_degrees) <= 180
  );
}

function rejectSensitiveKeys(value, path, errors) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => rejectSensitiveKeys(entry, `${path}[${index}]`, errors));
    return;
  }
  if (!object(value)) return;
  for (const [key, entry] of Object.entries(value)) {
    if (SENSITIVE_KEY.test(key)) errors.push(`${path}.${key} must not contain credentials or personal data`);
    rejectSensitiveKeys(entry, `${path}.${key}`, errors);
  }
}

export function validateBatch7Config(config) {
  const errors = [];
  if (!object(config)) return ["config must be an object"];
  if (config.version !== 1) errors.push("version must equal 1");
  if (config.batch !== 7) errors.push("batch must equal 7");
  if (config.mode !== "offline-capture-preflight") errors.push("mode must equal offline-capture-preflight");
  if (config.status !== "accepted") errors.push("status must equal accepted");

  const t = config.thresholds;
  if (!object(t)) errors.push("thresholds must be an object");
  else {
    if (!finite(t.minimum_fps) || t.minimum_fps < 24) errors.push("thresholds.minimum_fps must be at least 24");
    if (!finite(t.recommended_jump_fps) || t.recommended_jump_fps < 60) errors.push("thresholds.recommended_jump_fps must be at least 60");
    if (!finite(t.minimum_width_px) || t.minimum_width_px < 1280) errors.push("thresholds.minimum_width_px must be at least 1280");
    if (!finite(t.minimum_height_px) || t.minimum_height_px < 720) errors.push("thresholds.minimum_height_px must be at least 720");
    if (!finite(t.minimum_subject_visibility) || t.minimum_subject_visibility < 0.9 || t.minimum_subject_visibility > 1) errors.push("thresholds.minimum_subject_visibility must be between 0.9 and 1");
    if (!finite(t.minimum_blur_score) || t.minimum_blur_score <= 0) errors.push("thresholds.minimum_blur_score must be positive");
    if (!finite(t.minimum_luminance) || !finite(t.maximum_luminance) || t.minimum_luminance >= t.maximum_luminance) errors.push("luminance thresholds must be finite and ordered");
    if (!finite(t.maximum_camera_motion) || t.maximum_camera_motion <= 0 || t.maximum_camera_motion > 1) errors.push("thresholds.maximum_camera_motion must be between 0 and 1");
    if (!finite(t.maximum_side_angle_degrees) || t.maximum_side_angle_degrees <= 0 || t.maximum_side_angle_degrees > 45) errors.push("thresholds.maximum_side_angle_degrees must be between 0 and 45");
  }

  const requiredMetadata = ["source_timestamps", "variable_frame_rate", "original_aspect_ratio", "source_resolution"];
  if (!Array.isArray(config.required_metadata)) errors.push("required_metadata must be an array");
  else requiredMetadata.forEach((key) => {
    if (!config.required_metadata.includes(key)) errors.push(`required_metadata must include ${key}`);
  });

  if (!Array.isArray(config.rejection_codes)) errors.push("rejection_codes must be an array");
  else REQUIRED_REJECTION_CODES.forEach((code) => {
    if (!config.rejection_codes.includes(code)) errors.push(`rejection_codes must include ${code}`);
  });
  if (!Array.isArray(config.warnings) || !config.warnings.includes("reduced-jump-timing-confidence")) errors.push("warnings must include reduced-jump-timing-confidence");

  const safety = config.safety ?? {};
  for (const key of ["fail_closed", "human_review_for_shadow"]) if (safety[key] !== true) errors.push(`safety.${key} must equal true`);
  for (const key of ["user_visible_results", "production_data_allowed", "expensive_processing_on_rejection"]) if (safety[key] !== false) errors.push(`safety.${key} must equal false`);

  if (!Array.isArray(config.fixtures) || config.fixtures.length < 3) errors.push("fixtures must contain at least three synthetic cases");
  else {
    const refs = new Set();
    const decisions = new Set();
    config.fixtures.forEach((fixture, index) => {
      if (!object(fixture)) return errors.push(`fixtures[${index}] must be an object`);
      if (!/^capture-[a-z0-9-]+$/.test(fixture.fixture_ref ?? "")) errors.push(`fixtures[${index}].fixture_ref must be synthetic`);
      if (refs.has(fixture.fixture_ref)) errors.push(`fixtures[${index}].fixture_ref must be unique`);
      refs.add(fixture.fixture_ref);
      if (!EXERCISES.has(fixture.exercise)) errors.push(`fixtures[${index}].exercise is invalid`);
      if (!DECISIONS.has(fixture.expected_decision)) errors.push(`fixtures[${index}].expected_decision is invalid`);
      decisions.add(fixture.expected_decision);
    });
    DECISIONS.forEach((decision) => {
      if (!decisions.has(decision)) errors.push(`fixtures must include a ${decision} decision`);
    });
  }

  if (typeof config.evidence_ref !== "string" || !config.evidence_ref.startsWith("docs/")) errors.push("evidence_ref must reference committed documentation");
  rejectSensitiveKeys(config, "config", errors);
  return errors;
}

export function evaluateCaptureQuality(measurements, config) {
  if (validateBatch7Config(config).length) return { decision: "rejected", rejection_codes: ["invalid-measurements"], warnings: [] };
  if (!object(measurements) || !EXERCISES.has(measurements.exercise)) return { decision: "rejected", rejection_codes: ["invalid-measurements"], warnings: [] };

  if (!validMeasurements(measurements)) return { decision: "rejected", rejection_codes: ["invalid-measurements"], warnings: [] };

  const t = config.thresholds;
  const rejection_codes = [];
  if (measurements.fps < t.minimum_fps) rejection_codes.push("frame-rate-too-low");
  if (measurements.width_px < t.minimum_width_px || measurements.height_px < t.minimum_height_px) rejection_codes.push("resolution-too-low");
  if (measurements.horse_visibility < t.minimum_subject_visibility) rejection_codes.push("horse-not-fully-visible");
  if (measurements.rider_visibility < t.minimum_subject_visibility) rejection_codes.push("rider-not-fully-visible");
  if (measurements.blur_score < t.minimum_blur_score) rejection_codes.push("severe-blur");
  if (measurements.luminance < t.minimum_luminance) rejection_codes.push("lighting-too-dark");
  if (measurements.luminance > t.maximum_luminance) rejection_codes.push("lighting-too-bright");
  if (measurements.camera_motion > t.maximum_camera_motion) rejection_codes.push("unstable-camera");
  if (Math.abs(measurements.side_angle_degrees) > t.maximum_side_angle_degrees) rejection_codes.push("view-not-side-on");
  if (measurements.exercise === "jumping" && measurements.jump_plane_visible !== true) rejection_codes.push("jump-plane-not-visible");

  const preserved = measurements.metadata_preserved;
  if (!object(preserved) || config.required_metadata.some((key) => preserved[key] !== true)) rejection_codes.push("metadata-not-preserved");
  if (rejection_codes.length) return { decision: "rejected", rejection_codes, warnings: [] };

  const warnings = [];
  if (measurements.exercise === "jumping" && measurements.fps < t.recommended_jump_fps) warnings.push("reduced-jump-timing-confidence");
  return { decision: warnings.length ? "shadow-only" : "eligible", rejection_codes: [], warnings };
}
