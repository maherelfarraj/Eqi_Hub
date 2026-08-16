import { createHash } from "node:crypto";

const ROLES = ["program-owner", "audit-reviewer"];
const CODES = ["invalid-input", "attestation-unpinned", "evidence-incomplete", "findings-open", "approval-incomplete", "retention-invalid", "release-enabled"];
const SENSITIVE = /(?:password|secret|token|api[_-]?key|credential|email|phone|user[_-]?id|medical)/i;
const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const hex = (value) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const ref = (value, prefix) => typeof value === "string" && new RegExp(`^${prefix}-[a-z0-9-]+$`).test(value);

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (object(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
const hash = (value) => createHash("sha256").update(canonicalJson(value)).digest("hex");

function scan(value, path, errors) {
  if (Array.isArray(value)) return value.forEach((item, index) => scan(item, `${path}[${index}]`, errors));
  if (!object(value)) return;
  for (const [key, item] of Object.entries(value)) {
    if (SENSITIVE.test(key)) errors.push(`${path}.${key} is sensitive`);
    scan(item, `${path}.${key}`, errors);
  }
}

export function buildBatch19AttestationHash(manifest) {
  if (!object(manifest)) return null;
  const { attestation_hash: ignored, ...content } = manifest;
  return hash(content);
}

export function validateBatch20Config(config) {
  const errors = [];
  if (!object(config)) return ["config must be an object"];
  if (config.version !== 1 || config.batch !== 20 || config.mode !== "offline-program-closeout" || config.status !== "in-progress") errors.push("Batch 20 identity is invalid");
  if (config.attestation_contract_version !== "continuity-attestation-v1" || config.closeout_contract_version !== "program-closeout-v1") errors.push("contracts invalid");
  if (!hex(config.approved_batch19_attestation_hash)) errors.push("attestation must be pinned");
  if (!Array.isArray(config.rejection_codes)) errors.push("codes invalid");
  else CODES.forEach((code) => { if (!config.rejection_codes.includes(code)) errors.push(`missing ${code}`); });
  const safety = config.safety ?? {};
  for (const key of ["fail_closed", "attestation_pinned", "independent_approval_required"]) if (safety[key] !== true) errors.push(`safety.${key} must equal true`);
  for (const key of ["production_data_allowed", "deployment_authorized", "database_changes", "cohort_changes"]) if (safety[key] !== false) errors.push(`safety.${key} must equal false`);
  if (!Array.isArray(config.fixtures) || config.fixtures.length < 7) errors.push("fixtures incomplete");
  if (typeof config.evidence_ref !== "string" || !config.evidence_ref.startsWith("docs/")) errors.push("evidence_ref is invalid");
  scan(config, "config", errors);
  return errors;
}

function validAttestation(manifest, config) {
  return object(manifest) && manifest.attestation_contract_version === config.attestation_contract_version && manifest.release_authorized === false && hex(manifest.recovery_hash) && hex(manifest.attestation_hash) && buildBatch19AttestationHash(manifest) === manifest.attestation_hash && manifest.attestation_hash === config.approved_batch19_attestation_hash;
}

export function evaluateProgramCloseout(input, config) {
  if (validateBatch20Config(config).length || !object(input) || !object(input.batch19_attestation) || !object(input.closeout)) return { decision: "invalid", rejection_codes: ["invalid-input"], closeout_manifest: null };
  const sensitiveErrors = [];
  scan(input, "input", sensitiveErrors);
  if (sensitiveErrors.length) return { decision: "invalid", rejection_codes: ["invalid-input"], closeout_manifest: null };
  const errors = [], closeout = input.closeout;
  if (!validAttestation(input.batch19_attestation, config)) errors.push("attestation-unpinned");
  if (!Array.isArray(closeout.evidence_hashes) || closeout.evidence_hashes.length < 3 || new Set(closeout.evidence_hashes ?? []).size !== closeout.evidence_hashes?.length || closeout.evidence_hashes.some((value) => !hex(value))) errors.push("evidence-incomplete");
  if (closeout.unresolved_findings !== 0) errors.push("findings-open");
  const approvals = closeout.approvals;
  if (!Array.isArray(approvals) || approvals.length !== 2 || new Set(approvals?.map((approval) => approval.approver_ref)).size !== 2 || ROLES.some((role) => !approvals?.some((approval) => approval.role === role && approval.approved === true && ref(approval.approver_ref, "approver") && ref(approval.evidence_ref, "closeout-evidence")))) errors.push("approval-incomplete");
  if (!Number.isInteger(closeout.retention_days) || closeout.retention_days < 365 || closeout.retention_days > 3650) errors.push("retention-invalid");
  if (closeout.disposition !== "archived-not-released" || closeout.release_authorized !== false || closeout.deployment_authorized !== false || closeout.writeback !== false) errors.push("release-enabled");
  if (errors.length) return { decision: "invalid", rejection_codes: [...new Set(errors)], closeout_manifest: null };
  const manifest = { closeout_contract_version: config.closeout_contract_version, attestation_hash: input.batch19_attestation.attestation_hash, closeout: structuredClone(closeout), release_authorized: false };
  return { decision: "closed", rejection_codes: [], closeout_manifest: { ...manifest, closeout_hash: hash(manifest) } };
}

export const batch20Constants = { ROLES, CODES };
