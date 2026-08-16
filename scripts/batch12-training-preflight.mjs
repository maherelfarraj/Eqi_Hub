import { createHash } from "node:crypto";

const SPLITS = ["train", "validation", "test", "golden"];
const REQUIRED_CODES = ["invalid-input", "release-unpinned", "split-leakage", "nondeterministic-plan", "resource-limit-exceeded", "execution-enabled"];
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

export function validateBatch12Config(config) {
  const errors = [];
  if (!object(config)) return ["config must be an object"];
  if (config.version !== 1 || config.batch !== 12 || config.mode !== "offline-training-experiment-preflight" || config.status !== "in-progress") errors.push("Batch 12 identity is invalid");
  if (config.release_contract_version !== "dataset-release-v1" || config.experiment_contract_version !== "training-preflight-v1") errors.push("contract versions are invalid");
  if (!hex(config.approved_batch11_release_hash)) errors.push("approved_batch11_release_hash must pin an approved release");
  if (!Array.isArray(config.rejection_codes)) errors.push("rejection_codes must be an array"); else REQUIRED_CODES.forEach((code) => { if (!config.rejection_codes.includes(code)) errors.push(`rejection_codes must include ${code}`); });
  const limits = config.resource_limits;
  if (!object(limits) || !finite(limits.maximum_gpu_hours) || limits.maximum_gpu_hours <= 0 || !finite(limits.maximum_cpu_hours) || limits.maximum_cpu_hours <= 0 || !Number.isInteger(limits.maximum_epochs) || limits.maximum_epochs < 1) errors.push("resource_limits are invalid");
  const safety = config.safety ?? {};
  for (const key of ["fail_closed", "batch11_release_pinned", "split_isolation_required", "deterministic_reproducibility_required"]) if (safety[key] !== true) errors.push(`safety.${key} must equal true`);
  for (const key of ["production_data_allowed", "training_execution", "model_inference", "outbound_network", "deployment_changes", "database_changes", "cohort_changes"]) if (safety[key] !== false) errors.push(`safety.${key} must equal false`);
  if (!Array.isArray(config.fixtures) || config.fixtures.length < 5) errors.push("fixtures must cover ready and all fail-closed decisions");
  if (typeof config.evidence_ref !== "string" || !config.evidence_ref.startsWith("docs/")) errors.push("evidence_ref must reference documentation");
  inspectSensitive(config, "config", errors);
  return errors;
}

export function buildBatch11ReleaseHash(releaseManifest) {
  if (!object(releaseManifest)) return null;
  const { release_manifest_hash: ignored, ...content } = releaseManifest;
  return sha256(content);
}

function validRelease(release) {
  if (!object(release) || release.dataset_version !== "dataset-v1" || release.release_contract_version !== "dataset-release-v1" || !hex(release.batch10_manifest_hash) || release.training_authorized !== false || !ref(release.approver_ref, "approver") || !ref(release.approval_evidence_ref, "approval-evidence") || !hex(release.release_manifest_hash)) return false;
  const stats = release.statistics;
  return object(stats) && Number.isInteger(stats.row_count) && stats.row_count >= 4 && object(stats.split_counts) && SPLITS.every((split) => Number.isInteger(stats.split_counts[split]) && stats.split_counts[split] >= 1) && Number.isInteger(stats.unique_horse_groups) && stats.unique_horse_groups >= 1 && finite(stats.visible_fraction) && stats.visible_fraction >= 0 && stats.visible_fraction <= 1 && buildBatch11ReleaseHash(release) === release.release_manifest_hash;
}

function validPlan(plan) {
  return object(plan) && ref(plan.experiment_ref, "experiment") && ref(plan.architecture_ref, "architecture") && plan.objective === "keypoint-localization" && Number.isInteger(plan.seed) && plan.seed >= 0 && Number.isInteger(plan.epochs) && plan.epochs >= 1 && Number.isInteger(plan.batch_size) && plan.batch_size >= 1 && finite(plan.learning_rate) && plan.learning_rate > 0 && Array.isArray(plan.augmentations) && plan.augmentations.length > 0 && new Set(plan.augmentations).size === plan.augmentations.length && plan.augmentations.every((entry) => ref(entry, "augmentation")) && object(plan.resources) && finite(plan.resources.gpu_hours) && plan.resources.gpu_hours >= 0 && finite(plan.resources.cpu_hours) && plan.resources.cpu_hours >= 0 && plan.execution_enabled === false && plan.outbound_network === false;
}

export function evaluateTrainingPreflight(input, config) {
  if (validateBatch12Config(config).length || !object(input) || !object(input.batch11_release) || !object(input.plan)) return { decision: "invalid", rejection_codes: ["invalid-input"], preflight_manifest: null };
  const sensitiveErrors = [];
  inspectSensitive(input, "input", sensitiveErrors);
  if (sensitiveErrors.length) return { decision: "invalid", rejection_codes: ["invalid-input"], preflight_manifest: null };
  const codes = [];
  if (!validRelease(input.batch11_release) || input.batch11_release.release_manifest_hash !== config.approved_batch11_release_hash) codes.push("release-unpinned");
  const plan = input.plan;
  if (!validPlan(plan)) codes.push("nondeterministic-plan");
  const splitSets = [plan.training_splits, plan.validation_splits, plan.holdout_splits];
  if (splitSets.some((set) => !Array.isArray(set) || set.some((split) => !SPLITS.includes(split))) || JSON.stringify(plan.training_splits) !== JSON.stringify(["train"]) || JSON.stringify(plan.validation_splits) !== JSON.stringify(["validation"]) || JSON.stringify(plan.holdout_splits) !== JSON.stringify(["test", "golden"]) || new Set(splitSets.flat()).size !== SPLITS.length) codes.push("split-leakage");
  if (object(plan.resources) && (plan.resources.gpu_hours > config.resource_limits.maximum_gpu_hours || plan.resources.cpu_hours > config.resource_limits.maximum_cpu_hours || plan.epochs > config.resource_limits.maximum_epochs)) codes.push("resource-limit-exceeded");
  if (plan.execution_enabled !== false || plan.outbound_network !== false) codes.push("execution-enabled");
  if (codes.length) return { decision: "invalid", rejection_codes: [...new Set(codes)], preflight_manifest: null };
  const evidence = { experiment_contract_version: config.experiment_contract_version, dataset_release_hash: input.batch11_release.release_manifest_hash, plan, execution_authorized: false };
  return { decision: "ready", rejection_codes: [], preflight_manifest: { ...evidence, reproducibility_hash: sha256(evidence) } };
}

export const batch12Constants = { REQUIRED_CODES, SPLITS };
