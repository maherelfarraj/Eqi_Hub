import { createHash } from "node:crypto";

const SPLITS = ["train", "validation", "test", "golden"];
const GROUP_KEYS = ["source_video_ref", "horse_group_ref", "rider_group_ref", "arena_group_ref", "camera_group_ref", "recording_session_ref"];
const REQUIRED_CODES = ["invalid-input", "batch10-lineage-missing", "manifest-hash-mismatch", "duplicate-content", "partition-drift", "coverage-insufficient", "visibility-insufficient", "release-approval-required"];
const SENSITIVE_KEY = /(?:password|secret|token|api[_-]?key|credential|email|full[_-]?name|phone|user[_-]?id|medical)/i;

const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const finite = (value) => typeof value === "number" && Number.isFinite(value);
const ref = (value, prefix) => typeof value === "string" && new RegExp(`^${prefix}-[a-z0-9-]+$`).test(value);
const hex = (value, length) => typeof value === "string" && new RegExp(`^[a-f0-9]{${length}}$`).test(value);

export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (object(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

const sha256 = (value) => createHash("sha256").update(canonicalJson(value)).digest("hex");

function inspectSensitive(value, path, errors) {
  if (Array.isArray(value)) return value.forEach((entry, index) => inspectSensitive(entry, `${path}[${index}]`, errors));
  if (!object(value)) return;
  for (const [key, entry] of Object.entries(value)) {
    if (SENSITIVE_KEY.test(key)) errors.push(`${path}.${key} must not contain sensitive or production data`);
    inspectSensitive(entry, `${path}.${key}`, errors);
  }
}

export function validateBatch11Config(config) {
  const errors = [];
  if (!object(config)) return ["config must be an object"];
  if (config.version !== 1 || config.batch !== 11 || config.mode !== "offline-dataset-release-readiness" || config.status !== "in-progress") errors.push("Batch 11 identity is invalid");
  for (const [key, expected] of Object.entries({ dataset_version: "dataset-v1", batch10_export_contract_version: "export-v1", release_contract_version: "dataset-release-v1" })) if (config[key] !== expected) errors.push(`${key} must equal ${expected}`);
  if (JSON.stringify(config.splits) !== JSON.stringify(SPLITS)) errors.push("splits must match the Batch 8–10 contract");
  if (JSON.stringify(config.grouping_keys) !== JSON.stringify(GROUP_KEYS)) errors.push("grouping_keys must match the Batch 8–10 contract");
  const thresholds = config.thresholds;
  if (!object(thresholds) || !Number.isInteger(thresholds.minimum_rows_per_split) || thresholds.minimum_rows_per_split < 1 || !finite(thresholds.minimum_visible_fraction) || thresholds.minimum_visible_fraction < 0 || thresholds.minimum_visible_fraction > 1 || !Number.isInteger(thresholds.minimum_unique_horse_groups) || thresholds.minimum_unique_horse_groups < 1) errors.push("thresholds are invalid");
  if (!Array.isArray(config.rejection_codes)) errors.push("rejection_codes must be an array");
  else REQUIRED_CODES.forEach((code) => { if (!config.rejection_codes.includes(code)) errors.push(`rejection_codes must include ${code}`); });
  const safety = config.safety ?? {};
  for (const key of ["fail_closed", "batch10_manifest_pinned", "partition_integrity_required", "duplicate_content_rejected", "human_release_approval_required"]) if (safety[key] !== true) errors.push(`safety.${key} must equal true`);
  for (const key of ["production_data_allowed", "model_training", "model_inference", "deployment_changes", "database_changes", "cohort_changes"]) if (safety[key] !== false) errors.push(`safety.${key} must equal false`);
  if (!Array.isArray(config.fixtures) || config.fixtures.length < 4) errors.push("fixtures must include ready, approval, coverage, and integrity cases");
  if (typeof config.evidence_ref !== "string" || !config.evidence_ref.startsWith("docs/")) errors.push("evidence_ref must reference documentation");
  inspectSensitive(config, "config", errors);
  return errors;
}

function validRow(row) {
  return object(row) && ref(row.annotation_ref, "annotation") && /^(?:annotation|adjudication)-evidence-[a-f0-9]{24}$/.test(row.evidence_ref) && /^lineage-[a-f0-9]{24}$/.test(row.source_lineage_ref) && /^lineage-[a-f0-9]{24}$/.test(row.window_lineage_ref) && SPLITS.includes(row.split) && object(row.groups) && GROUP_KEYS.every((key) => ref(row.groups[key], key.replace(/_ref$/, "").replaceAll("_", "-"))) && hex(row.content_hash, 64) && Number.isInteger(row.visible_keypoints) && row.visible_keypoints >= 0 && row.visible_keypoints <= 23;
}

export function buildBatch10Manifest(rows) {
  const sorted = structuredClone(rows).sort((a, b) => a.annotation_ref.localeCompare(b.annotation_ref));
  return sha256({ dataset_version: "dataset-v1", export_contract_version: "export-v1", rows: sorted });
}

export function evaluateDatasetRelease(input, config) {
  if (validateBatch11Config(config).length || !object(input) || !Array.isArray(input.rows) || input.rows.length === 0) return { decision: "invalid", rejection_codes: ["invalid-input"], release_manifest: null };
  const codes = [];
  if (!hex(input.batch10_manifest_hash, 64) || input.batch10_manifest_hash !== buildBatch10Manifest(input.rows)) codes.push("manifest-hash-mismatch");
  if (input.rows.some((row) => !validRow(row))) codes.push("batch10-lineage-missing");
  const content = new Set(); const annotations = new Set(); const partitionByGroup = new Map();
  const counts = Object.fromEntries(SPLITS.map((split) => [split, 0]));
  const horseGroups = new Set(); let visible = 0;
  for (const row of input.rows) {
    if (!validRow(row)) continue;
    if (content.has(row.content_hash) || annotations.has(row.annotation_ref)) codes.push("duplicate-content");
    content.add(row.content_hash); annotations.add(row.annotation_ref); counts[row.split] += 1; visible += row.visible_keypoints; horseGroups.add(row.groups.horse_group_ref);
    for (const key of GROUP_KEYS) {
      const group = `${key}:${row.groups[key]}`;
      if (partitionByGroup.has(group) && partitionByGroup.get(group) !== row.split) codes.push("partition-drift");
      partitionByGroup.set(group, row.split);
    }
  }
  if (SPLITS.some((split) => counts[split] < config.thresholds.minimum_rows_per_split) || horseGroups.size < config.thresholds.minimum_unique_horse_groups) codes.push("coverage-insufficient");
  const visibleFraction = input.rows.length ? visible / (input.rows.length * 23) : 0;
  if (visibleFraction < config.thresholds.minimum_visible_fraction) codes.push("visibility-insufficient");
  if (codes.length) return { decision: "invalid", rejection_codes: [...new Set(codes)], release_manifest: null };
  const statistics = { row_count: input.rows.length, split_counts: counts, unique_horse_groups: horseGroups.size, visible_fraction: Number(visibleFraction.toFixed(6)) };
  const release = { dataset_version: config.dataset_version, release_contract_version: config.release_contract_version, batch10_manifest_hash: input.batch10_manifest_hash, statistics };
  const candidate = { ...release, training_authorized: false };
  if (!object(input.release_approval) || input.release_approval.approved !== true || !ref(input.release_approval.approver_ref, "approver") || !ref(input.release_approval.evidence_ref, "approval-evidence")) return { decision: "approval-required", rejection_codes: ["release-approval-required"], release_manifest: { ...candidate, release_manifest_hash: sha256(candidate) } };
  const approved = { ...candidate, approver_ref: input.release_approval.approver_ref, approval_evidence_ref: input.release_approval.evidence_ref };
  return { decision: "ready", rejection_codes: [], release_manifest: { ...approved, release_manifest_hash: sha256(approved) } };
}

export const batch11Constants = { GROUP_KEYS, REQUIRED_CODES, SPLITS };
