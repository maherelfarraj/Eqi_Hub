import { createHash } from "node:crypto";

const METRIC_SPLITS = ["validation", "test", "golden"];
const REQUIRED_CODES = ["invalid-input", "preflight-unpinned", "provenance-incomplete", "holdout-leakage", "quality-threshold-failed", "overfit-threshold-failed", "execution-enabled"];
const SENSITIVE_KEY = /(?:password|secret|token|api[_-]?key|credential|email|full[_-]?name|phone|user[_-]?id|medical)/i;
const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const finite = (value) => typeof value === "number" && Number.isFinite(value);
const ref = (value, prefix) => typeof value === "string" && new RegExp(`^${prefix}-[a-z0-9-]+$`).test(value);
const hex = (value) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);

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

export function validateBatch13Config(config) {
  const errors = [];
  if (!object(config)) return ["config must be an object"];
  if (config.version !== 1 || config.batch !== 13 || config.mode !== "offline-synthetic-experiment-evaluation" || config.status !== "in-progress") errors.push("Batch 13 identity is invalid");
  if (config.preflight_contract_version !== "training-preflight-v1" || config.evaluation_contract_version !== "experiment-evaluation-v1") errors.push("contract versions are invalid");
  if (!hex(config.approved_batch12_preflight_hash)) errors.push("approved_batch12_preflight_hash must pin an approved preflight");
  const thresholds = config.thresholds;
  if (!object(thresholds) || !finite(thresholds.minimum_pck) || thresholds.minimum_pck <= 0 || thresholds.minimum_pck > 1 || !finite(thresholds.maximum_mean_error) || thresholds.maximum_mean_error <= 0 || !finite(thresholds.maximum_validation_test_gap) || thresholds.maximum_validation_test_gap < 0 || !Number.isInteger(thresholds.minimum_samples_per_split) || thresholds.minimum_samples_per_split < 1) errors.push("thresholds are invalid");
  if (!Array.isArray(config.rejection_codes)) errors.push("rejection_codes must be an array"); else REQUIRED_CODES.forEach((code) => { if (!config.rejection_codes.includes(code)) errors.push(`rejection_codes must include ${code}`); });
  const safety = config.safety ?? {};
  for (const key of ["fail_closed", "batch12_preflight_pinned", "holdouts_sealed", "artifact_provenance_required"]) if (safety[key] !== true) errors.push(`safety.${key} must equal true`);
  for (const key of ["production_data_allowed", "real_training", "model_inference", "user_visible_results", "deployment_changes", "database_changes", "cohort_changes"]) if (safety[key] !== false) errors.push(`safety.${key} must equal false`);
  if (!Array.isArray(config.fixtures) || config.fixtures.length < 6) errors.push("fixtures must cover ready and all fail-closed decisions");
  if (typeof config.evidence_ref !== "string" || !config.evidence_ref.startsWith("docs/")) errors.push("evidence_ref must reference documentation");
  inspectSensitive(config, "config", errors);
  return errors;
}

export function buildBatch12PreflightHash(manifest) {
  if (!object(manifest)) return null;
  const { reproducibility_hash: ignored, ...content } = manifest;
  return sha256(content);
}

function validPreflight(manifest, config) {
  return object(manifest) && manifest.experiment_contract_version === config.preflight_contract_version && hex(manifest.dataset_release_hash) && object(manifest.plan) && Number.isInteger(manifest.plan.seed) && manifest.execution_authorized === false && hex(manifest.reproducibility_hash) && buildBatch12PreflightHash(manifest) === manifest.reproducibility_hash && manifest.reproducibility_hash === config.approved_batch12_preflight_hash;
}

function validMetrics(metrics) {
  return object(metrics) && METRIC_SPLITS.every((split) => object(metrics[split]) && finite(metrics[split].pck) && metrics[split].pck >= 0 && metrics[split].pck <= 1 && finite(metrics[split].mean_error) && metrics[split].mean_error >= 0 && Number.isInteger(metrics[split].sample_count) && metrics[split].sample_count >= 0);
}

export function evaluateExperimentEvidence(input, config) {
  if (validateBatch13Config(config).length || !object(input) || !object(input.batch12_preflight) || !object(input.run)) return { decision: "invalid", rejection_codes: ["invalid-input"], evaluation_manifest: null };
  const sensitiveErrors = []; inspectSensitive(input, "input", sensitiveErrors);
  if (sensitiveErrors.length) return { decision: "invalid", rejection_codes: ["invalid-input"], evaluation_manifest: null };
  const codes = []; const run = input.run;
  if (!validPreflight(input.batch12_preflight, config)) codes.push("preflight-unpinned");
  if (!ref(run.run_ref, "run") || run.execution_mode !== "synthetic-dry-run" || run.seed !== input.batch12_preflight.plan?.seed || !hex(run.artifact_hash) || !hex(run.environment_hash) || !hex(run.dependency_lock_hash) || !validMetrics(run.metrics)) codes.push("provenance-incomplete");
  if (JSON.stringify(run.model_selection_splits) !== JSON.stringify(["validation"]) || JSON.stringify(run.sealed_holdout_splits) !== JSON.stringify(["test", "golden"])) codes.push("holdout-leakage");
  if (run.real_training !== false || run.model_inference !== false || run.user_visible_results !== false) codes.push("execution-enabled");
  if (validMetrics(run.metrics)) {
    if (METRIC_SPLITS.some((split) => run.metrics[split].pck < config.thresholds.minimum_pck || run.metrics[split].mean_error > config.thresholds.maximum_mean_error || run.metrics[split].sample_count < config.thresholds.minimum_samples_per_split)) codes.push("quality-threshold-failed");
    if (Math.abs(run.metrics.validation.pck - run.metrics.test.pck) > config.thresholds.maximum_validation_test_gap) codes.push("overfit-threshold-failed");
  }
  if (codes.length) return { decision: "invalid", rejection_codes: [...new Set(codes)], evaluation_manifest: null };
  const evidence = { evaluation_contract_version: config.evaluation_contract_version, preflight_hash: input.batch12_preflight.reproducibility_hash, run, promotion_authorized: false };
  return { decision: "ready", rejection_codes: [], evaluation_manifest: { ...evidence, evaluation_hash: sha256(evidence) } };
}

export const batch13Constants = { METRIC_SPLITS, REQUIRED_CODES };
