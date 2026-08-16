export const ALLOWED_DECISIONS = ["supported", "shadow-only", "unsupported"];
export const REQUIRED_SPLIT_BOUNDARIES = ["video", "horse", "rider", "arena", "session"];

const SENSITIVE_KEY = /(?:password|secret|token|api[_-]?key|credential|email|full[_-]?name|phone|user[_-]?id)/i;

function object(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
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

function exact(value, expected, path, errors) {
  if (value !== expected) errors.push(`${path} must equal ${JSON.stringify(expected)}`);
}

export function validateBatch6Feasibility(manifest) {
  const errors = [];
  if (!object(manifest)) return ["manifest must be an object"];

  exact(manifest.version, 1, "version", errors);
  exact(manifest.batch, 6, "batch", errors);
  exact(manifest.mode, "offline-feasibility", "mode", errors);
  exact(manifest.status, "accepted", "status", errors);

  if (!Array.isArray(manifest.supported_matrix) || manifest.supported_matrix.length < 3) {
    errors.push("supported_matrix must contain at least three decisions");
  } else {
    const decisions = new Set();
    manifest.supported_matrix.forEach((entry, index) => {
      if (!object(entry)) return errors.push(`supported_matrix[${index}] must be an object`);
      if (!["discipline", "exercise", "camera_view"].every((key) => typeof entry[key] === "string" && entry[key])) {
        errors.push(`supported_matrix[${index}] must identify discipline, exercise, and camera_view`);
      }
      if (!ALLOWED_DECISIONS.includes(entry.decision)) errors.push(`supported_matrix[${index}].decision is invalid`);
      decisions.add(entry.decision);
    });
    for (const decision of ALLOWED_DECISIONS) {
      if (!decisions.has(decision)) errors.push(`supported_matrix must include a ${decision} decision`);
    }
  }

  const capture = manifest.capture;
  if (!object(capture)) errors.push("capture must be an object");
  else {
    if (!Number.isFinite(capture.minimum_fps) || capture.minimum_fps < 24) errors.push("capture.minimum_fps must be at least 24");
    if (!Number.isFinite(capture.recommended_jump_fps) || capture.recommended_jump_fps < 60) errors.push("capture.recommended_jump_fps must be at least 60");
    if (!Number.isFinite(capture.minimum_height_px) || capture.minimum_height_px < 720) errors.push("capture.minimum_height_px must be at least 720");
    for (const subject of ["horse", "rider"]) {
      if (!capture.required_visibility?.includes(subject)) errors.push(`capture.required_visibility must include ${subject}`);
    }
    for (const reason of ["subject-out-of-frame", "severe-blur", "unstable-camera", "jump-plane-not-visible"]) {
      if (!capture.reject_when?.includes(reason)) errors.push(`capture.reject_when must include ${reason}`);
    }
  }

  if (!Array.isArray(manifest.findings) || manifest.findings.length === 0) errors.push("findings must be a non-empty array");
  else manifest.findings.forEach((finding, index) => {
    if (!object(finding)) return errors.push(`findings[${index}] must be an object`);
    if (typeof finding.minimum_confidence !== "number" || finding.minimum_confidence < 0.8 || finding.minimum_confidence > 1) {
      errors.push(`findings[${index}].minimum_confidence must be between 0.8 and 1`);
    }
    exact(finding.evidence_required, true, `findings[${index}].evidence_required`, errors);
    exact(finding.human_review, "required", `findings[${index}].human_review`, errors);
  });

  const safety = manifest.safety ?? {};
  exact(safety.medical_diagnosis, "prohibited", "safety.medical_diagnosis", errors);
  exact(safety.injury_prediction, "prohibited", "safety.injury_prediction", errors);
  exact(safety.veterinary_language, "review-required", "safety.veterinary_language", errors);
  exact(safety.low_confidence_result, "unavailable", "safety.low_confidence_result", errors);
  exact(safety.user_visible_results, false, "safety.user_visible_results", errors);

  const governance = manifest.governance ?? {};
  for (const key of ["consent_required", "guardian_consent_for_minors", "dataset_use_opt_in", "deletion_supported", "retention_policy_required"]) {
    exact(governance[key], true, `governance.${key}`, errors);
  }
  exact(governance.commercial_license_review, "required", "governance.commercial_license_review", errors);
  exact(governance.production_data_allowed, false, "governance.production_data_allowed", errors);

  const golden = manifest.golden_set ?? {};
  exact(golden.metadata_only, true, "golden_set.metadata_only", errors);
  exact(golden.synthetic_ids_only, true, "golden_set.synthetic_ids_only", errors);
  exact(golden.untouched_test_partition, true, "golden_set.untouched_test_partition", errors);
  for (const boundary of REQUIRED_SPLIT_BOUNDARIES) {
    if (!golden.split_boundaries?.includes(boundary)) errors.push(`golden_set.split_boundaries must include ${boundary}`);
  }
  if (!Array.isArray(golden.cases) || golden.cases.length < 3) errors.push("golden_set.cases must contain at least three synthetic cases");
  else {
    const refs = new Set();
    for (const [index, entry] of golden.cases.entries()) {
      if (!object(entry) || !/^golden-[a-z0-9-]+$/.test(entry.case_ref ?? "")) errors.push(`golden_set.cases[${index}].case_ref must be a synthetic golden reference`);
      if (refs.has(entry.case_ref)) errors.push(`golden_set.cases[${index}].case_ref must be unique`);
      refs.add(entry.case_ref);
      if (!["eligible", "shadow-only", "rejected"].includes(entry.expected)) errors.push(`golden_set.cases[${index}].expected is invalid`);
    }
  }

  if (typeof manifest.evidence_ref !== "string" || !manifest.evidence_ref.startsWith("docs/")) errors.push("evidence_ref must reference committed documentation");
  rejectSensitiveKeys(manifest, "manifest", errors);
  return errors;
}
