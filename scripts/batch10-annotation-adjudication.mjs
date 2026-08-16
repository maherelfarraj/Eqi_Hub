import { createHash } from "node:crypto";

const SPLITS = ["train", "validation", "test", "golden"];
const GROUP_KEYS = ["source_video_ref", "horse_group_ref", "rider_group_ref", "arena_group_ref", "camera_group_ref", "recording_session_ref"];
const OUTCOMES = ["accept", "correct", "exclude"];
const REQUIRED_CODES = ["invalid-input", "lineage-missing", "adjudication-required", "adjudicator-conflict", "correction-invalid", "batch9-rejected", "duplicate-evidence", "partition-drift"];
const SENSITIVE_KEY = /(?:password|secret|token|api[_-]?key|credential|email|full[_-]?name|phone|user[_-]?id|medical)/i;

const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const syntheticRef = (value, prefix) => typeof value === "string" && new RegExp(`^${prefix}-[a-z0-9-]+$`).test(value);
const hash = (value) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const lineage = (value) => typeof value === "string" && /^lineage-[a-f0-9]{24}$/.test(value);
const annotationEvidence = (value) => typeof value === "string" && /^annotation-evidence-[a-f0-9]{24}$/.test(value);

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (object(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

function digest(prefix, value) {
  return `${prefix}-${createHash("sha256").update(canonicalJson(value)).digest("hex").slice(0, 24)}`;
}

function inspectSensitive(value, path, errors) {
  if (Array.isArray(value)) return value.forEach((entry, index) => inspectSensitive(entry, `${path}[${index}]`, errors));
  if (!object(value)) return;
  for (const [key, entry] of Object.entries(value)) {
    if (SENSITIVE_KEY.test(key)) errors.push(`${path}.${key} must not contain sensitive or production data`);
    inspectSensitive(entry, `${path}.${key}`, errors);
  }
}

export function validateBatch10Config(config) {
  const errors = [];
  if (!object(config)) return ["config must be an object"];
  if (config.version !== 1) errors.push("version must equal 1");
  if (config.batch !== 10) errors.push("batch must equal 10");
  if (config.mode !== "offline-annotation-adjudication-export") errors.push("mode is invalid");
  if (config.status !== "in-progress") errors.push("status must equal in-progress");
  for (const [key, expected] of Object.entries({ dataset_version: "dataset-v1", skeleton_version: "horse-23-v1", annotation_guide_version: "annotation-guide-v1", export_contract_version: "export-v1" })) {
    if (config[key] !== expected) errors.push(`${key} must equal ${expected}`);
  }
  if (JSON.stringify(config.grouping_keys) !== JSON.stringify(GROUP_KEYS)) errors.push("grouping_keys must match the Batch 8 grouping contract");
  if (JSON.stringify(config.splits) !== JSON.stringify(SPLITS)) errors.push("splits must match the Batch 8 split contract");
  if (!Array.isArray(config.reason_codes) || config.reason_codes.length < 3 || new Set(config.reason_codes).size !== config.reason_codes.length || config.reason_codes.some((code) => !syntheticRef(code, "reason"))) errors.push("reason_codes must contain at least three unique stable reason references");
  if (!Array.isArray(config.rejection_codes)) errors.push("rejection_codes must be an array");
  else REQUIRED_CODES.forEach((code) => { if (!config.rejection_codes.includes(code)) errors.push(`rejection_codes must include ${code}`); });
  const safety = config.safety ?? {};
  for (const key of ["fail_closed", "immutable_lineage", "independent_adjudicator", "batch8_partition_pinned", "batch9_evidence_required"]) if (safety[key] !== true) errors.push(`safety.${key} must equal true`);
  for (const key of ["production_data_allowed", "user_visible_results", "model_training", "model_inference", "database_changes"]) if (safety[key] !== false) errors.push(`safety.${key} must equal false`);
  if (!Array.isArray(config.fixtures) || config.fixtures.length < 4) errors.push("fixtures must contain at least four synthetic adjudication cases");
  else {
    const refs = new Set(); const decisions = new Set();
    config.fixtures.forEach((fixture, index) => {
      if (!syntheticRef(fixture?.fixture_ref, "adjudication")) errors.push(`fixtures[${index}].fixture_ref must be synthetic`);
      if (refs.has(fixture?.fixture_ref)) errors.push(`fixtures[${index}].fixture_ref must be unique`);
      refs.add(fixture?.fixture_ref);
      if (!["exportable", "review-required", "excluded", "invalid"].includes(fixture?.expected_decision)) errors.push(`fixtures[${index}].expected_decision is invalid`);
      decisions.add(fixture?.expected_decision);
    });
    for (const decision of ["exportable", "review-required", "excluded", "invalid"]) if (!decisions.has(decision)) errors.push(`fixtures must include ${decision}`);
  }
  if (!Array.isArray(config.export_fixtures) || config.export_fixtures.length < 2) errors.push("export_fixtures must contain accepted and rejected cases");
  if (typeof config.evidence_ref !== "string" || !config.evidence_ref.startsWith("docs/")) errors.push("evidence_ref must reference committed documentation");
  inspectSensitive(config, "config", errors);
  return errors;
}

function validCorrection(correction, config) {
  if (!object(correction) || !syntheticRef(correction.correction_ref, "correction") || correction.skeleton_version !== config.skeleton_version || correction.keypoint_count !== 23 || !hash(correction.corrected_content_hash)) return false;
  const box = correction.bounding_box;
  return object(box) && [box.x_min, box.y_min, box.x_max, box.y_max].every((value) => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1) && box.x_min < box.x_max && box.y_min < box.y_max;
}

export function adjudicateAnnotation(input, config) {
  if (validateBatch10Config(config).length || !object(input)) return { decision: "invalid", rejection_codes: ["invalid-input"], evidence_ref: null };
  const codes = [];
  if (!syntheticRef(input.annotation_ref, "annotation") || !annotationEvidence(input.annotation_evidence_ref) || !Array.isArray(input.original_reviewer_refs) || input.original_reviewer_refs.length !== 2 || new Set(input.original_reviewer_refs).size !== 2 || input.original_reviewer_refs.some((ref) => !syntheticRef(ref, "reviewer"))) codes.push("invalid-input");
  if (!lineage(input.source_lineage_ref) || !lineage(input.window_lineage_ref)) codes.push("lineage-missing");
  if (!["accepted", "review-required", "rejected"].includes(input.batch9_decision)) codes.push("invalid-input");
  if (codes.length) return { decision: "invalid", rejection_codes: [...new Set(codes)], evidence_ref: null };
  if (input.batch9_decision === "rejected") return { decision: "excluded", rejection_codes: ["batch9-rejected"], evidence_ref: null };
  if (input.batch9_decision === "accepted") {
    if (input.adjudication !== null && input.adjudication !== undefined) return { decision: "invalid", rejection_codes: ["invalid-input"], evidence_ref: null };
    return { decision: "exportable", rejection_codes: [], evidence_ref: input.annotation_evidence_ref, corrected: false };
  }
  const adjudication = input.adjudication;
  if (!object(adjudication)) return { decision: "review-required", rejection_codes: ["adjudication-required"], evidence_ref: null };
  if (!syntheticRef(adjudication.adjudicator_ref, "adjudicator") || !OUTCOMES.includes(adjudication.outcome) || !config.reason_codes.includes(adjudication.reason_code)) return { decision: "invalid", rejection_codes: ["invalid-input"], evidence_ref: null };
  if (input.original_reviewer_refs.includes(adjudication.adjudicator_ref.replace(/^adjudicator-/, "reviewer-")) || input.original_reviewer_refs.includes(adjudication.adjudicator_ref)) return { decision: "invalid", rejection_codes: ["adjudicator-conflict"], evidence_ref: null };
  if (adjudication.outcome === "exclude") return { decision: "excluded", rejection_codes: [], evidence_ref: digest("adjudication-evidence", { input, outcome: "exclude" }), corrected: false };
  if (adjudication.outcome === "correct" && !validCorrection(adjudication.correction, config)) return { decision: "invalid", rejection_codes: ["correction-invalid"], evidence_ref: null };
  if (adjudication.outcome !== "correct" && adjudication.correction !== null && adjudication.correction !== undefined) return { decision: "invalid", rejection_codes: ["correction-invalid"], evidence_ref: null };
  return { decision: "exportable", rejection_codes: [], evidence_ref: digest("adjudication-evidence", { input, versions: { skeleton: config.skeleton_version, guide: config.annotation_guide_version } }), corrected: adjudication.outcome === "correct" };
}

function validGroups(groups) {
  return object(groups) && GROUP_KEYS.every((key) => syntheticRef(groups[key], key.replace(/_ref$/, "").replaceAll("_", "-")));
}

export function buildDatasetExport(items, config) {
  if (validateBatch10Config(config).length || !Array.isArray(items) || items.length === 0) return { decision: "invalid", rejection_codes: ["invalid-input"], rows: [], manifest_hash: null };
  const codes = [];
  const annotationRefs = new Set(); const evidenceRefs = new Set(); const partitionByGroup = new Map(); const rows = [];
  for (const item of items) {
    if (!object(item) || !SPLITS.includes(item.split) || !validGroups(item.groups)) { codes.push("invalid-input"); continue; }
    const result = adjudicateAnnotation(item.annotation, config);
    if (result.decision !== "exportable") { codes.push(result.decision === "review-required" ? "adjudication-required" : result.rejection_codes[0] ?? "invalid-input"); continue; }
    if (annotationRefs.has(item.annotation.annotation_ref) || evidenceRefs.has(result.evidence_ref)) codes.push("duplicate-evidence");
    annotationRefs.add(item.annotation.annotation_ref); evidenceRefs.add(result.evidence_ref);
    for (const key of GROUP_KEYS) {
      const group = `${key}:${item.groups[key]}`;
      if (partitionByGroup.has(group) && partitionByGroup.get(group) !== item.split) codes.push("partition-drift");
      partitionByGroup.set(group, item.split);
    }
    rows.push({ annotation_ref: item.annotation.annotation_ref, evidence_ref: result.evidence_ref, source_lineage_ref: item.annotation.source_lineage_ref, window_lineage_ref: item.annotation.window_lineage_ref, split: item.split, groups: item.groups, corrected: result.corrected });
  }
  if (codes.length) return { decision: "invalid", rejection_codes: [...new Set(codes)], rows: [], manifest_hash: null };
  rows.sort((left, right) => left.annotation_ref.localeCompare(right.annotation_ref));
  const manifest = { dataset_version: config.dataset_version, skeleton_version: config.skeleton_version, annotation_guide_version: config.annotation_guide_version, export_contract_version: config.export_contract_version, rows };
  return { decision: "exportable", rejection_codes: [], rows, manifest_hash: createHash("sha256").update(canonicalJson(manifest)).digest("hex") };
}

export const batch10Constants = { GROUP_KEYS, OUTCOMES, REQUIRED_CODES, SPLITS };
