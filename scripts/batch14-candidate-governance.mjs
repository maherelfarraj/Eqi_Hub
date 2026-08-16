import { createHash } from "node:crypto";

const REQUIRED_REVIEW_ROLES = ["ml-reviewer", "safety-reviewer"];
const REQUIRED_PROHIBITIONS = ["diagnosis", "injury-prediction", "veterinary-advice", "user-visible-results", "automated-decisions"];
const REQUIRED_CODES = ["invalid-input", "evaluation-unpinned", "model-card-incomplete", "risk-review-incomplete", "reviewer-conflict", "rollback-incomplete", "release-enabled"];
const SENSITIVE_KEY = /(?:password|secret|token|api[_-]?key|credential|email|full[_-]?name|phone|user[_-]?id|medical)/i;
const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const ref = (value, prefix) => typeof value === "string" && new RegExp(`^${prefix}-[a-z0-9-]+$`).test(value);
const hex = (value) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (object(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
const sha256 = (value) => createHash("sha256").update(canonicalJson(value)).digest("hex");

function inspectSensitive(value, path, errors) {
  if (Array.isArray(value)) return value.forEach((entry, index) => inspectSensitive(entry, `${path}[${index}]`, errors));
  if (!object(value)) return;
  for (const [key, entry] of Object.entries(value)) { if (SENSITIVE_KEY.test(key)) errors.push(`${path}.${key} must not contain sensitive or production data`); inspectSensitive(entry, `${path}.${key}`, errors); }
}

export function validateBatch14Config(config) {
  const errors = [];
  if (!object(config)) return ["config must be an object"];
  if (config.version !== 1 || config.batch !== 14 || config.mode !== "offline-candidate-governance" || config.status !== "in-progress") errors.push("Batch 14 identity is invalid");
  if (config.evaluation_contract_version !== "experiment-evaluation-v1" || config.governance_contract_version !== "candidate-governance-v1") errors.push("contract versions are invalid");
  if (!hex(config.approved_batch13_evaluation_hash)) errors.push("approved_batch13_evaluation_hash must pin approved evidence");
  if (!Array.isArray(config.rejection_codes)) errors.push("rejection_codes must be an array"); else REQUIRED_CODES.forEach((code) => { if (!config.rejection_codes.includes(code)) errors.push(`rejection_codes must include ${code}`); });
  const safety = config.safety ?? {};
  for (const key of ["fail_closed", "batch13_evaluation_pinned", "independent_review_required", "rollback_required"]) if (safety[key] !== true) errors.push(`safety.${key} must equal true`);
  for (const key of ["production_data_allowed", "shadow_release", "deployment_authorized", "user_visible_results", "database_changes", "cohort_changes"]) if (safety[key] !== false) errors.push(`safety.${key} must equal false`);
  if (!Array.isArray(config.fixtures) || config.fixtures.length < 6) errors.push("fixtures must cover all governance boundaries");
  if (typeof config.evidence_ref !== "string" || !config.evidence_ref.startsWith("docs/")) errors.push("evidence_ref must reference documentation");
  inspectSensitive(config, "config", errors); return errors;
}

export function buildBatch13EvaluationHash(manifest) {
  if (!object(manifest)) return null;
  const { evaluation_hash: ignored, ...content } = manifest; return sha256(content);
}

function validEvaluation(manifest, config) {
  return object(manifest) && manifest.evaluation_contract_version === config.evaluation_contract_version && hex(manifest.preflight_hash) && object(manifest.run) && manifest.run.execution_mode === "synthetic-dry-run" && manifest.promotion_authorized === false && hex(manifest.evaluation_hash) && buildBatch13EvaluationHash(manifest) === manifest.evaluation_hash && manifest.evaluation_hash === config.approved_batch13_evaluation_hash;
}

export function evaluateCandidateGovernance(input, config) {
  if (validateBatch14Config(config).length || !object(input) || !object(input.batch13_evaluation) || !object(input.model_card)) return { decision: "invalid", rejection_codes: ["invalid-input"], governance_manifest: null };
  const sensitiveErrors = []; inspectSensitive(input, "input", sensitiveErrors); if (sensitiveErrors.length) return { decision: "invalid", rejection_codes: ["invalid-input"], governance_manifest: null };
  const codes = []; const card = input.model_card;
  if (!validEvaluation(input.batch13_evaluation, config)) codes.push("evaluation-unpinned");
  if (!ref(card.candidate_ref, "candidate") || card.intended_use !== "offline-research-only" || !Array.isArray(card.limitations) || card.limitations.length < 3 || card.limitations.some((item) => !ref(item, "limitation")) || !Array.isArray(card.prohibited_uses) || REQUIRED_PROHIBITIONS.some((item) => !card.prohibited_uses.includes(item))) codes.push("model-card-incomplete");
  if (!Array.isArray(card.risks) || card.risks.length < 3 || card.risks.some((risk) => !object(risk) || !ref(risk.risk_ref, "risk") || !["low", "medium", "high"].includes(risk.severity) || !ref(risk.mitigation_ref, "mitigation"))) codes.push("risk-review-incomplete");
  const reviews = card.reviews;
  if (!Array.isArray(reviews) || reviews.length !== 2 || new Set(reviews?.map((review) => review.reviewer_ref)).size !== 2 || REQUIRED_REVIEW_ROLES.some((role) => !reviews?.some((review) => review.role === role && review.approved === true && ref(review.reviewer_ref, "reviewer") && ref(review.evidence_ref, "review-evidence")))) codes.push("reviewer-conflict");
  if (!object(card.rollback) || !Array.isArray(card.rollback.triggers) || card.rollback.triggers.length < 3 || card.rollback.triggers.some((trigger) => !ref(trigger, "rollback-trigger")) || card.rollback.action !== "disable-and-quarantine" || card.rollback.owner_role !== "safety-reviewer") codes.push("rollback-incomplete");
  if (card.shadow_release !== false || card.deployment_authorized !== false || card.user_visible_results !== false) codes.push("release-enabled");
  if (codes.length) return { decision: "invalid", rejection_codes: [...new Set(codes)], governance_manifest: null };
  const evidence = { governance_contract_version: config.governance_contract_version, evaluation_hash: input.batch13_evaluation.evaluation_hash, model_card: card, release_authorized: false };
  return { decision: "ready", rejection_codes: [], governance_manifest: { ...evidence, governance_hash: sha256(evidence) } };
}

export const batch14Constants = { REQUIRED_CODES, REQUIRED_PROHIBITIONS, REQUIRED_REVIEW_ROLES };
