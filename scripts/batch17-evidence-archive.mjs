import { createHash } from "node:crypto";
const REQUIRED_CUSTODIANS = ["records-manager", "safety-reviewer"];
const REQUIRED_CODES = ["invalid-input", "decision-unpinned", "bundle-incomplete", "custody-incomplete", "verification-failed", "retention-invalid", "mutation-enabled"];
const SENSITIVE_KEY = /(?:password|secret|token|api[_-]?key|credential|email|full[_-]?name|phone|user[_-]?id|medical)/i;
const object = (v) => v !== null && typeof v === "object" && !Array.isArray(v), hex = (v) => typeof v === "string" && /^[a-f0-9]{64}$/.test(v), ref = (v, p) => typeof v === "string" && new RegExp(`^${p}-[a-z0-9-]+$`).test(v);
function canonicalJson(v) { if (Array.isArray(v)) return `[${v.map(canonicalJson).join(",")}]`; if (object(v)) return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonicalJson(v[k])}`).join(",")}}`; return JSON.stringify(v); }
const sha256 = (v) => createHash("sha256").update(canonicalJson(v)).digest("hex");
function inspectSensitive(v, p, e) { if (Array.isArray(v)) return v.forEach((x, i) => inspectSensitive(x, `${p}[${i}]`, e)); if (!object(v)) return; for (const [k, x] of Object.entries(v)) { if (SENSITIVE_KEY.test(k)) e.push(`${p}.${k} is sensitive`); inspectSensitive(x, `${p}.${k}`, e); } }
export function buildBatch16DecisionHash(m) { if (!object(m)) return null; const { decision_hash: ignored, ...content } = m; return sha256(content); }
export function validateBatch17Config(config) {
  const e = []; if (!object(config)) return ["config must be an object"];
  if (config.version !== 1 || config.batch !== 17 || config.mode !== "offline-evidence-archive" || config.status !== "in-progress") e.push("Batch 17 identity is invalid");
  if (config.decision_contract_version !== "go-no-go-ledger-v1" || config.archive_contract_version !== "evidence-archive-v1") e.push("contract versions are invalid"); if (!hex(config.approved_batch16_decision_hash)) e.push("approved decision must be pinned");
  if (!Array.isArray(config.rejection_codes)) e.push("rejection_codes must be an array"); else REQUIRED_CODES.forEach((x) => { if (!config.rejection_codes.includes(x)) e.push(`rejection_codes must include ${x}`); });
  const s = config.safety ?? {}; for (const k of ["fail_closed", "decision_pinned", "independent_custody_required", "verification_required", "append_only"]) if (s[k] !== true) e.push(`safety.${k} must equal true`);
  for (const k of ["production_data_allowed", "protected_access_allowed", "external_upload", "deletion_enabled", "deployment_authorized", "database_changes", "cohort_changes"]) if (s[k] !== false) e.push(`safety.${k} must equal false`);
  if (!Array.isArray(config.fixtures) || config.fixtures.length < 6) e.push("fixtures are incomplete"); if (typeof config.evidence_ref !== "string" || !config.evidence_ref.startsWith("docs/")) e.push("evidence_ref is invalid"); inspectSensitive(config, "config", e); return e;
}
function validDecision(m, c) { return object(m) && m.decision_contract_version === c.decision_contract_version && m.release_authorized === false && hex(m.readiness_hash) && hex(m.decision_hash) && buildBatch16DecisionHash(m) === m.decision_hash && m.decision_hash === c.approved_batch16_decision_hash; }
export function evaluateEvidenceArchive(input, config) {
  if (validateBatch17Config(config).length || !object(input) || !object(input.batch16_decision) || !object(input.archive_plan)) return { decision: "invalid", rejection_codes: ["invalid-input"], archive_manifest: null };
  const sensitive = []; inspectSensitive(input, "input", sensitive); if (sensitive.length) return { decision: "invalid", rejection_codes: ["invalid-input"], archive_manifest: null };
  const codes = [], p = input.archive_plan; if (!validDecision(input.batch16_decision, config)) codes.push("decision-unpinned");
  if (!ref(p.archive_ref, "archive") || p.format !== "deterministic-json-v1" || !Array.isArray(p.content_hashes) || p.content_hashes.length < 3 || new Set(p.content_hashes ?? []).size !== p.content_hashes?.length || p.content_hashes.some((x) => !hex(x))) codes.push("bundle-incomplete");
  const custodians = p.custodians; if (!Array.isArray(custodians) || custodians.length !== 2 || new Set(custodians?.map((x) => x.custodian_ref)).size !== 2 || REQUIRED_CUSTODIANS.some((role) => !custodians?.some((x) => x.role === role && x.accepted === true && ref(x.custodian_ref, "custodian") && ref(x.evidence_ref, "custody-evidence")))) codes.push("custody-incomplete");
  if (!Array.isArray(p.verifications) || p.verifications.length < 2 || new Set(p.verifications?.map((x) => x.receipt_ref)).size !== p.verifications?.length || p.verifications.some((x) => !object(x) || x.method !== "sha256-recompute" || x.passed !== true || !ref(x.receipt_ref, "verification-receipt"))) codes.push("verification-failed");
  if (!Number.isInteger(p.retention_days) || p.retention_days < 30 || p.retention_days > 3650) codes.push("retention-invalid");
  if (p.append_only !== true || p.external_upload !== false || p.deletion_enabled !== false || p.deployment_authorized !== false || p.user_traffic !== false) codes.push("mutation-enabled");
  if (codes.length) return { decision: "invalid", rejection_codes: [...new Set(codes)], archive_manifest: null };
  const evidence = { archive_contract_version: config.archive_contract_version, decision_hash: input.batch16_decision.decision_hash, archive_plan: structuredClone(p), release_authorized: false };
  return { decision: "sealed", rejection_codes: [], archive_manifest: { ...evidence, archive_hash: sha256(evidence) } };
}
export const batch17Constants = { REQUIRED_CODES, REQUIRED_CUSTODIANS };
