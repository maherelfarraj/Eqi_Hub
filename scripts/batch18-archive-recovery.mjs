import { createHash } from "node:crypto";
const REQUIRED_OPERATORS = ["records-manager", "audit-reviewer"];
const REQUIRED_CODES = ["invalid-input", "archive-unpinned", "scope-mismatch", "operator-conflict", "recovery-incomplete", "time-budget-exceeded", "mutation-enabled"];
const SENSITIVE_KEY = /(?:password|secret|token|api[_-]?key|credential|email|full[_-]?name|phone|user[_-]?id|medical)/i;
const object = (v) => v !== null && typeof v === "object" && !Array.isArray(v), hex = (v) => typeof v === "string" && /^[a-f0-9]{64}$/.test(v), ref = (v, p) => typeof v === "string" && new RegExp(`^${p}-[a-z0-9-]+$`).test(v);
function canonicalJson(v) { if (Array.isArray(v)) return `[${v.map(canonicalJson).join(",")}]`; if (object(v)) return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonicalJson(v[k])}`).join(",")}}`; return JSON.stringify(v); }
const sha256 = (v) => createHash("sha256").update(canonicalJson(v)).digest("hex");
function inspectSensitive(v, p, e) { if (Array.isArray(v)) return v.forEach((x, i) => inspectSensitive(x, `${p}[${i}]`, e)); if (!object(v)) return; for (const [k, x] of Object.entries(v)) { if (SENSITIVE_KEY.test(k)) e.push(`${p}.${k} is sensitive`); inspectSensitive(x, `${p}.${k}`, e); } }
export function buildBatch17ArchiveHash(m) { if (!object(m)) return null; const { archive_hash: ignored, ...content } = m; return sha256(content); }
export function validateBatch18Config(config) {
  const e = []; if (!object(config)) return ["config must be an object"];
  if (config.version !== 1 || config.batch !== 18 || config.mode !== "offline-archive-recovery" || config.status !== "in-progress") e.push("Batch 18 identity is invalid");
  if (config.archive_contract_version !== "evidence-archive-v1" || config.recovery_contract_version !== "archive-recovery-v1") e.push("contract versions are invalid"); if (!hex(config.approved_batch17_archive_hash)) e.push("approved archive must be pinned");
  if (!Array.isArray(config.rejection_codes)) e.push("rejection_codes must be an array"); else REQUIRED_CODES.forEach((x) => { if (!config.rejection_codes.includes(x)) e.push(`rejection_codes must include ${x}`); });
  const s = config.safety ?? {}; for (const k of ["fail_closed", "archive_pinned", "independent_operators_required", "hash_verification_required"]) if (s[k] !== true) e.push(`safety.${k} must equal true`);
  for (const k of ["production_data_allowed", "protected_access_allowed", "external_download", "destructive_restore", "writeback", "deployment_authorized", "database_changes", "cohort_changes"]) if (s[k] !== false) e.push(`safety.${k} must equal false`);
  if (!Array.isArray(config.fixtures) || config.fixtures.length < 6) e.push("fixtures are incomplete"); if (typeof config.evidence_ref !== "string" || !config.evidence_ref.startsWith("docs/")) e.push("evidence_ref is invalid"); inspectSensitive(config, "config", e); return e;
}
function validArchive(m, c) { return object(m) && m.archive_contract_version === c.archive_contract_version && m.release_authorized === false && hex(m.decision_hash) && hex(m.archive_hash) && buildBatch17ArchiveHash(m) === m.archive_hash && m.archive_hash === c.approved_batch17_archive_hash; }
const sameSet = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && new Set(a).size === a.length && [...a].sort().join() === [...b].sort().join();
export function evaluateArchiveRecovery(input, config) {
  if (validateBatch18Config(config).length || !object(input) || !object(input.batch17_archive) || !object(input.recovery_plan)) return { decision: "invalid", rejection_codes: ["invalid-input"], recovery_manifest: null };
  const sensitive = []; inspectSensitive(input, "input", sensitive); if (sensitive.length) return { decision: "invalid", rejection_codes: ["invalid-input"], recovery_manifest: null };
  const codes = [], p = input.recovery_plan, expected = input.batch17_archive.archive_plan?.content_hashes; if (!validArchive(input.batch17_archive, config)) codes.push("archive-unpinned");
  if (!ref(p.drill_ref, "drill") || p.mode !== "offline-tabletop" || !sameSet(p.requested_hashes, expected)) codes.push("scope-mismatch");
  const operators = p.operators; if (!Array.isArray(operators) || operators.length !== 2 || new Set(operators?.map((x) => x.operator_ref)).size !== 2 || REQUIRED_OPERATORS.some((role) => !operators?.some((x) => x.role === role && x.approved === true && ref(x.operator_ref, "operator") && ref(x.evidence_ref, "operator-evidence")))) codes.push("operator-conflict");
  const recovered = p.recovered_objects; if (!Array.isArray(recovered) || !sameSet(recovered?.map((x) => x.content_hash), expected) || recovered.some((x) => !object(x) || x.verified !== true || x.method !== "sha256-recompute" || x.recomputed_hash !== x.content_hash)) codes.push("recovery-incomplete");
  if (!Number.isInteger(p.duration_minutes) || p.duration_minutes < 1 || p.duration_minutes > 60) codes.push("time-budget-exceeded");
  if (p.external_download !== false || p.destructive_restore !== false || p.writeback !== false || p.production_mount !== false || p.deployment_authorized !== false) codes.push("mutation-enabled");
  if (codes.length) return { decision: "invalid", rejection_codes: [...new Set(codes)], recovery_manifest: null };
  const evidence = { recovery_contract_version: config.recovery_contract_version, archive_hash: input.batch17_archive.archive_hash, recovery_plan: structuredClone(p), release_authorized: false };
  return { decision: "recovered", rejection_codes: [], recovery_manifest: { ...evidence, recovery_hash: sha256(evidence) } };
}
export const batch18Constants = { REQUIRED_CODES, REQUIRED_OPERATORS };
