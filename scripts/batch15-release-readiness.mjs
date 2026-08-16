import { createHash } from "node:crypto";

const REQUIRED_ROLES = ["release-manager", "security-reviewer", "safety-reviewer"];
const REQUIRED_CODES = ["invalid-input", "governance-unpinned", "approvals-incomplete", "monitoring-incomplete", "rollback-rehearsal-incomplete", "release-enabled"];
const SENSITIVE_KEY = /(?:password|secret|token|api[_-]?key|credential|email|full[_-]?name|phone|user[_-]?id|medical)/i;
const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const ref = (value, prefix) => typeof value === "string" && new RegExp(`^${prefix}-[a-z0-9-]+$`).test(value);
const hex = (value) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
function canonicalJson(value) { if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`; if (object(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`; return JSON.stringify(value); }
const sha256 = (value) => createHash("sha256").update(canonicalJson(value)).digest("hex");
function inspectSensitive(value, path, errors) { if (Array.isArray(value)) return value.forEach((entry, index) => inspectSensitive(entry, `${path}[${index}]`, errors)); if (!object(value)) return; for (const [key, entry] of Object.entries(value)) { if (SENSITIVE_KEY.test(key)) errors.push(`${path}.${key} must not contain sensitive or production data`); inspectSensitive(entry, `${path}.${key}`, errors); } }

export function buildBatch14GovernanceHash(manifest) { if (!object(manifest)) return null; const { governance_hash: ignored, ...content } = manifest; return sha256(content); }
export function validateBatch15Config(config) {
  const errors = []; if (!object(config)) return ["config must be an object"];
  if (config.version !== 1 || config.batch !== 15 || config.mode !== "offline-release-readiness" || config.status !== "in-progress") errors.push("Batch 15 identity is invalid");
  if (config.governance_contract_version !== "candidate-governance-v1" || config.readiness_contract_version !== "release-readiness-v1") errors.push("contract versions are invalid");
  if (!hex(config.approved_batch14_governance_hash)) errors.push("approved_batch14_governance_hash must pin approved evidence");
  if (!Array.isArray(config.rejection_codes)) errors.push("rejection_codes must be an array"); else REQUIRED_CODES.forEach((code) => { if (!config.rejection_codes.includes(code)) errors.push(`rejection_codes must include ${code}`); });
  const safety = config.safety ?? {}; for (const key of ["fail_closed", "batch14_governance_pinned", "independent_approvals_required", "rollback_rehearsal_required"]) if (safety[key] !== true) errors.push(`safety.${key} must equal true`);
  for (const key of ["production_data_allowed", "protected_access_allowed", "production_endpoints", "canary_enabled", "deployment_authorized", "user_traffic", "database_changes", "cohort_changes"]) if (safety[key] !== false) errors.push(`safety.${key} must equal false`);
  if (!Array.isArray(config.fixtures) || config.fixtures.length < 6) errors.push("fixtures must cover all readiness boundaries");
  if (typeof config.evidence_ref !== "string" || !config.evidence_ref.startsWith("docs/")) errors.push("evidence_ref must reference documentation"); inspectSensitive(config, "config", errors); return errors;
}
function validGovernance(manifest, config) { return object(manifest) && manifest.governance_contract_version === config.governance_contract_version && manifest.release_authorized === false && hex(manifest.evaluation_hash) && hex(manifest.governance_hash) && buildBatch14GovernanceHash(manifest) === manifest.governance_hash && manifest.governance_hash === config.approved_batch14_governance_hash; }
export function evaluateReleaseReadiness(input, config) {
  if (validateBatch15Config(config).length || !object(input) || !object(input.batch14_governance) || !object(input.readiness_plan)) return { decision: "invalid", rejection_codes: ["invalid-input"], readiness_manifest: null };
  const sensitive = []; inspectSensitive(input, "input", sensitive); if (sensitive.length) return { decision: "invalid", rejection_codes: ["invalid-input"], readiness_manifest: null };
  const codes = [], plan = input.readiness_plan; if (!validGovernance(input.batch14_governance, config)) codes.push("governance-unpinned");
  const approvals = plan.approvals; if (!Array.isArray(approvals) || approvals.length !== 3 || new Set(approvals?.map((x) => x.reviewer_ref)).size !== 3 || REQUIRED_ROLES.some((role) => !approvals?.some((x) => x.role === role && x.approved === true && ref(x.reviewer_ref, "reviewer") && ref(x.evidence_ref, "approval-evidence")))) codes.push("approvals-incomplete");
  const monitoring = plan.monitoring; if (!object(monitoring) || monitoring.fail_closed !== true || monitoring.production_endpoints !== false || monitoring.escalation_role !== "safety-reviewer" || !Array.isArray(monitoring.signals) || monitoring.signals.length < 3 || monitoring.signals.some((x) => !ref(x, "signal"))) codes.push("monitoring-incomplete");
  const rollback = plan.rollback_rehearsal; if (!object(rollback) || rollback.execution_mode !== "table-top" || rollback.passed !== true || rollback.owner_role !== "release-manager" || !Array.isArray(rollback.scenarios) || rollback.scenarios.length < 3 || rollback.scenarios.some((x) => !ref(x, "scenario"))) codes.push("rollback-rehearsal-incomplete");
  if (!ref(plan.change_ref, "change") || plan.canary_enabled !== false || plan.deployment_authorized !== false || plan.user_traffic !== false || plan.change_window_booked !== false) codes.push("release-enabled");
  if (codes.length) return { decision: "invalid", rejection_codes: [...new Set(codes)], readiness_manifest: null };
  const evidence = { readiness_contract_version: config.readiness_contract_version, governance_hash: input.batch14_governance.governance_hash, readiness_plan: structuredClone(plan), release_authorized: false };
  return { decision: "ready-for-review", rejection_codes: [], readiness_manifest: { ...evidence, readiness_hash: sha256(evidence) } };
}
export const batch15Constants = { REQUIRED_CODES, REQUIRED_ROLES };
