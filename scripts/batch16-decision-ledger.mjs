import { createHash } from "node:crypto";
const REQUIRED_ROLES = ["release-manager", "security-reviewer", "safety-reviewer"];
const REQUIRED_CODES = ["invalid-input", "readiness-unpinned", "quorum-incomplete", "veto-active", "validity-invalid", "evidence-incomplete", "release-enabled"];
const SENSITIVE_KEY = /(?:password|secret|token|api[_-]?key|credential|email|full[_-]?name|phone|user[_-]?id|medical)/i;
const object = (v) => v !== null && typeof v === "object" && !Array.isArray(v), hex = (v) => typeof v === "string" && /^[a-f0-9]{64}$/.test(v), ref = (v, p) => typeof v === "string" && new RegExp(`^${p}-[a-z0-9-]+$`).test(v);
function canonicalJson(v) { if (Array.isArray(v)) return `[${v.map(canonicalJson).join(",")}]`; if (object(v)) return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonicalJson(v[k])}`).join(",")}}`; return JSON.stringify(v); }
const sha256 = (v) => createHash("sha256").update(canonicalJson(v)).digest("hex");
function inspectSensitive(v, path, errors) { if (Array.isArray(v)) return v.forEach((x, i) => inspectSensitive(x, `${path}[${i}]`, errors)); if (!object(v)) return; for (const [k, x] of Object.entries(v)) { if (SENSITIVE_KEY.test(k)) errors.push(`${path}.${k} is sensitive`); inspectSensitive(x, `${path}.${k}`, errors); } }
export function buildBatch15ReadinessHash(manifest) { if (!object(manifest)) return null; const { readiness_hash: ignored, ...content } = manifest; return sha256(content); }
export function validateBatch16Config(config) {
  const errors = []; if (!object(config)) return ["config must be an object"];
  if (config.version !== 1 || config.batch !== 16 || config.mode !== "offline-decision-ledger" || config.status !== "in-progress") errors.push("Batch 16 identity is invalid");
  if (config.readiness_contract_version !== "release-readiness-v1" || config.decision_contract_version !== "go-no-go-ledger-v1") errors.push("contract versions are invalid");
  if (!hex(config.approved_batch15_readiness_hash)) errors.push("approved readiness must be pinned");
  if (!Array.isArray(config.rejection_codes)) errors.push("rejection_codes must be an array"); else REQUIRED_CODES.forEach((x) => { if (!config.rejection_codes.includes(x)) errors.push(`rejection_codes must include ${x}`); });
  const safety = config.safety ?? {}; for (const k of ["fail_closed", "readiness_pinned", "independent_quorum_required", "veto_binding", "expiry_required"]) if (safety[k] !== true) errors.push(`safety.${k} must equal true`);
  for (const k of ["production_data_allowed", "protected_access_allowed", "deployment_authorized", "canary_enabled", "user_traffic", "database_changes", "cohort_changes"]) if (safety[k] !== false) errors.push(`safety.${k} must equal false`);
  if (!Array.isArray(config.fixtures) || config.fixtures.length < 6) errors.push("fixtures are incomplete"); if (typeof config.evidence_ref !== "string" || !config.evidence_ref.startsWith("docs/")) errors.push("evidence_ref is invalid"); inspectSensitive(config, "config", errors); return errors;
}
function validReadiness(m, c) { return object(m) && m.readiness_contract_version === c.readiness_contract_version && m.release_authorized === false && hex(m.governance_hash) && hex(m.readiness_hash) && buildBatch15ReadinessHash(m) === m.readiness_hash && m.readiness_hash === c.approved_batch15_readiness_hash; }
export function evaluateDecisionLedger(input, config) {
  if (validateBatch16Config(config).length || !object(input) || !object(input.batch15_readiness) || !object(input.decision_record)) return { decision: "invalid", rejection_codes: ["invalid-input"], decision_manifest: null };
  const sensitive = []; inspectSensitive(input, "input", sensitive); if (sensitive.length) return { decision: "invalid", rejection_codes: ["invalid-input"], decision_manifest: null };
  const codes = [], record = input.decision_record, votes = record.votes; if (!validReadiness(input.batch15_readiness, config)) codes.push("readiness-unpinned");
  if (!Array.isArray(votes) || votes.length !== 3 || new Set(votes?.map((x) => x.reviewer_ref)).size !== 3 || REQUIRED_ROLES.some((role) => !votes?.some((x) => x.role === role && ["approve", "veto"].includes(x.vote) && ref(x.reviewer_ref, "reviewer") && ref(x.evidence_ref, "decision-evidence")))) codes.push("quorum-incomplete");
  if (Array.isArray(votes) && votes.some((x) => x.vote === "veto")) codes.push("veto-active");
  const start = Date.parse(record.reviewed_at), end = Date.parse(record.expires_at); if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || end - start > 86_400_000) codes.push("validity-invalid");
  if (!ref(record.decision_ref, "decision") || !Array.isArray(record.evidence_refs) || record.evidence_refs.length < 3 || record.evidence_refs.some((x) => !ref(x, "ledger-evidence"))) codes.push("evidence-incomplete");
  if (record.deployment_authorized !== false || record.canary_enabled !== false || record.user_traffic !== false) codes.push("release-enabled");
  if (codes.includes("veto-active") && codes.every((x) => x === "veto-active")) return { decision: "blocked", rejection_codes: codes, decision_manifest: null };
  if (codes.length) return { decision: "invalid", rejection_codes: [...new Set(codes)], decision_manifest: null };
  const evidence = { decision_contract_version: config.decision_contract_version, readiness_hash: input.batch15_readiness.readiness_hash, decision_record: structuredClone(record), release_authorized: false };
  return { decision: "review-complete", rejection_codes: [], decision_manifest: { ...evidence, decision_hash: sha256(evidence) } };
}
export const batch16Constants = { REQUIRED_CODES, REQUIRED_ROLES };
