import { createHash } from "node:crypto";

export const batch7ReleaseIntegrityConstants = Object.freeze({
  requiredBatches: [3, 4, 5, 6],
  requiredRoles: [
    "rider",
    "guardian",
    "coach",
    "academy_admin",
    "stable_manager",
    "accountant",
    "platform_admin",
  ],
  requiredStages: ["static-contract", "isolated-policy", "route-boundary"],
  requiredDefaultOffModules: [
    "horse-welfare",
    "academy-operations",
    "competition-development",
    "video-release-3",
  ],
  requiredPrivacyAssertions: [
    "guardian-portal-excludes-private-staff-content",
    "coach-excludes-raw-safety-data",
    "academy-workspace-redacts-private-notes",
    "cross-tenant-access-denied",
  ],
});

const rootKeys = [
  "version",
  "release",
  "mode",
  "release_authorized",
  "safety",
  "stages",
  "batches",
  "default_off",
  "role_matrix",
  "privacy_assertions",
];
const safetyKeys = [
  "production_mutations_allowed",
  "feature_activation_allowed",
  "persona_changes_allowed",
  "financial_permission_changes_allowed",
  "payments_allowed",
  "sensitive_data_allowed",
];
const batchKeys = [
  "batch",
  "scope",
  "status",
  "source_ref",
  "commands",
  "boundaries",
];
const defaultOffKeys = ["module", "expected_enabled"];
const roleKeys = ["role", "batches", "allowed", "denied", "stage_results"];
const stageResultKeys = ["stage", "result", "evidence_kind"];
const sensitiveKey =
  /(?:password|token|secret|credential|email|phone|medical_answer|private_note|payment_method|account_id|user_id)/i;

const batchEvidence = Object.freeze({
  3: Object.freeze({
    scope: "guardian-view",
    source_ref: "docs/BATCH_3_GUARDIAN_VIEW.md",
    commands: [
      "node scripts/verify-guardian-view.mjs",
      "node --test scripts/test-guardian-view.mjs",
    ],
    boundaries: [
      "verified-link-only",
      "read-only-portal",
      "private-staff-content-excluded",
    ],
  }),
  4: Object.freeze({
    scope: "medical-waiver-readiness",
    source_ref: "docs/BATCH_4_MEDICAL_WAIVER_GATE.md",
    commands: [
      "node scripts/verify-medical-waiver-gate.mjs",
      "node --test scripts/test-medical-waiver-gate.mjs",
    ],
    boundaries: [
      "versioned-consent",
      "fail-closed-readiness",
      "role-limited-safety-data",
    ],
  }),
  5: Object.freeze({
    scope: "controlled-pilot-and-horse-welfare",
    source_ref: "docs/BATCH_5_CONTROLLED_PILOT_OBSERVATION.md",
    commands: [
      "pnpm verify:pilot",
      "node scripts/test-horse-welfare-stable-operations.mjs",
    ],
    boundaries: [
      "cohort-retired",
      "default-off-welfare",
      "authorized-staff-only",
    ],
  }),
  6: Object.freeze({
    scope: "feasibility-and-academy-operations",
    source_ref: "docs/BATCH_6_HORSE_RIDER_FEASIBILITY.md",
    commands: ["pnpm verify:batch6", "pnpm test:academy-operations"],
    boundaries: [
      "offline-only-feasibility",
      "default-off-operations",
      "approval-only-compensation",
    ],
  }),
});

const roleEvidence = Object.freeze({
  rider: Object.freeze({
    batches: [3, 4],
    allowed: ["own-readiness-status", "own-approved-feedback"],
    denied: ["staff-operations", "private-staff-content", "cross-tenant"],
  }),
  guardian: Object.freeze({
    batches: [3, 4],
    allowed: ["verified-linked-read-only", "permitted-approval"],
    denied: ["unrelated-rider", "private-staff-content", "staff-operations"],
  }),
  coach: Object.freeze({
    batches: [4, 5, 6],
    allowed: ["assigned-rider-development", "horse-welfare-operations"],
    denied: ["raw-safety-data", "payroll-approval", "cross-tenant"],
  }),
  academy_admin: Object.freeze({
    batches: [3, 4, 5, 6],
    allowed: ["academy-operations", "payroll-approval", "safety-review"],
    denied: ["direct-payment-processing"],
  }),
  stable_manager: Object.freeze({
    batches: [5, 6],
    allowed: ["horse-welfare-operations", "academy-operations"],
    denied: ["payroll-approval", "raw-safety-data"],
  }),
  accountant: Object.freeze({
    batches: [6],
    allowed: ["compensation-view"],
    denied: [
      "payroll-approval",
      "horse-welfare-operations",
      "private-staff-content",
    ],
  }),
  platform_admin: Object.freeze({
    batches: [3, 4, 5, 6],
    allowed: ["existing-administration-exception", "safety-review"],
    denied: ["direct-payment-processing"],
  }),
});

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function sameItems(values, expected) {
  return (
    Array.isArray(values) &&
    Array.isArray(expected) &&
    values.length === expected.length &&
    values.every(
      (value) => typeof value === "string" || typeof value === "number",
    ) &&
    expected.every(
      (value) => typeof value === "string" || typeof value === "number",
    ) &&
    [...values]
      .map((value) => `${typeof value}:${value}`)
      .sort()
      .join("\u0000") ===
      [...expected]
        .map((value) => `${typeof value}:${value}`)
        .sort()
        .join("\u0000")
  );
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function validateObjectKeys(value, keys, path, errors) {
  if (!isRecord(value)) {
    errors.push(`${path} must be an object`);
    return false;
  }
  for (const key of Object.keys(value)) {
    if (!keys.includes(key)) errors.push(`unknown field: ${path}.${key}`);
  }
  for (const key of keys) {
    if (!Object.hasOwn(value, key))
      errors.push(`missing field: ${path}.${key}`);
  }
  return true;
}

function findSensitiveKey(value, path = "$") {
  if (!isRecord(value) && !Array.isArray(value)) return null;
  for (const [key, nested] of Object.entries(value)) {
    const nestedPath = `${path}.${key}`;
    if (sensitiveKey.test(key)) return nestedPath;
    const found = findSensitiveKey(nested, nestedPath);
    if (found) return found;
  }
  return null;
}

export function buildBatch7ReleaseEvidenceHash(config) {
  return createHash("sha256").update(stableStringify(config)).digest("hex");
}

export function validateBatch7ReleaseIntegrity(config) {
  const errors = [];
  if (!validateObjectKeys(config, rootKeys, "$", errors)) return errors;
  if (config.version !== 1) errors.push("version must be 1");
  if (config.release !== "batch-7-release-integrity")
    errors.push("release must identify Batch 7 release integrity");
  if (config.mode !== "synthetic-release-evidence")
    errors.push("mode must remain synthetic-release-evidence");
  if (config.release_authorized !== false)
    errors.push("release must remain unauthorized");

  if (validateObjectKeys(config.safety, safetyKeys, "$.safety", errors)) {
    for (const key of safetyKeys) {
      if (config.safety[key] !== false)
        errors.push(`safety.${key} must remain false`);
    }
  }

  if (
    !sameItems(config.stages, batch7ReleaseIntegrityConstants.requiredStages)
  ) {
    errors.push("all staged acceptance phases are required");
  }

  if (!Array.isArray(config.batches)) {
    errors.push("batches must be an array");
  } else {
    const seenBatches = new Set();
    for (const [index, batch] of config.batches.entries()) {
      if (!validateObjectKeys(batch, batchKeys, `$.batches[${index}]`, errors))
        continue;
      if (
        typeof batch.batch !== "number" ||
        !Object.hasOwn(batchEvidence, batch.batch)
      ) {
        errors.push(`Batch ${batch.batch} is not an approved release record`);
        continue;
      }
      if (seenBatches.has(batch.batch))
        errors.push(`Batch ${batch.batch} is duplicated`);
      seenBatches.add(batch.batch);
      const expected = batchEvidence[batch.batch];
      if (batch.status !== "accepted")
        errors.push(`Batch ${batch.batch} is not accepted`);
      if (batch.scope !== expected.scope)
        errors.push(
          `Batch ${batch.batch} scope does not match approved evidence`,
        );
      if (batch.source_ref !== expected.source_ref)
        errors.push(
          `Batch ${batch.batch} source reference does not match approved evidence`,
        );
      if (!sameItems(batch.commands, expected.commands))
        errors.push(
          `Batch ${batch.batch} commands do not match approved evidence`,
        );
      if (!sameItems(batch.boundaries, expected.boundaries))
        errors.push(
          `Batch ${batch.batch} boundaries do not match approved evidence`,
        );
    }
    if (
      !sameItems(
        [...seenBatches],
        batch7ReleaseIntegrityConstants.requiredBatches,
      )
    ) {
      errors.push("evidence must cover Batches 3 through 6 exactly once");
    }
  }

  if (!Array.isArray(config.default_off)) {
    errors.push("default_off must be an array");
  } else {
    const seenModules = new Set();
    for (const [index, entry] of config.default_off.entries()) {
      if (
        !validateObjectKeys(
          entry,
          defaultOffKeys,
          `$.default_off[${index}]`,
          errors,
        )
      )
        continue;
      if (seenModules.has(entry.module))
        errors.push(`default-off module is duplicated: ${entry.module}`);
      seenModules.add(entry.module);
      if (entry.expected_enabled !== false)
        errors.push("default-off modules must remain disabled");
    }
    if (
      !sameItems(
        [...seenModules],
        batch7ReleaseIntegrityConstants.requiredDefaultOffModules,
      )
    ) {
      errors.push("all default-off modules must be recorded");
    }
  }

  if (!Array.isArray(config.role_matrix)) {
    errors.push("role_matrix must be an array");
  } else {
    const seenRoles = new Set();
    for (const [index, role] of config.role_matrix.entries()) {
      if (
        !validateObjectKeys(role, roleKeys, `$.role_matrix[${index}]`, errors)
      )
        continue;
      const expected =
        typeof role.role === "string" && Object.hasOwn(roleEvidence, role.role)
          ? roleEvidence[role.role]
          : null;
      if (!expected) {
        errors.push(`role is not approved: ${role.role}`);
        continue;
      }
      if (seenRoles.has(role.role))
        errors.push(`role is duplicated: ${role.role}`);
      seenRoles.add(role.role);
      if (!sameItems(role.batches, expected.batches))
        errors.push(
          `${role.role} batch coverage does not match approved contract`,
        );
      if (!sameItems(role.allowed, expected.allowed))
        errors.push(
          `${role.role} allowed boundaries do not match approved contract`,
        );
      if (!sameItems(role.denied, expected.denied))
        errors.push(
          `${role.role} denied boundaries do not match approved contract`,
        );
      if (!Array.isArray(role.stage_results)) {
        errors.push(`${role.role} stage results must be an array`);
        continue;
      }
      const seenStages = new Set();
      for (const [stageIndex, result] of role.stage_results.entries()) {
        if (
          !validateObjectKeys(
            result,
            stageResultKeys,
            `$.role_matrix[${index}].stage_results[${stageIndex}]`,
            errors,
          )
        )
          continue;
        if (
          !batch7ReleaseIntegrityConstants.requiredStages.includes(result.stage)
        )
          errors.push(`${role.role} has an unknown stage`);
        if (seenStages.has(result.stage))
          errors.push(`${role.role} repeats a stage`);
        seenStages.add(result.stage);
        if (
          result.result !== "covered" ||
          result.evidence_kind !== "synthetic"
        ) {
          errors.push(
            `${role.role} must have synthetic evidence for every stage`,
          );
        }
      }
      if (
        !sameItems(
          [...seenStages],
          batch7ReleaseIntegrityConstants.requiredStages,
        )
      ) {
        errors.push(
          `${role.role} must have synthetic evidence for every stage`,
        );
      }
    }
    if (
      !sameItems([...seenRoles], batch7ReleaseIntegrityConstants.requiredRoles)
    ) {
      errors.push("role matrix must cover each required role exactly once");
    }
  }

  if (
    !sameItems(
      config.privacy_assertions,
      batch7ReleaseIntegrityConstants.requiredPrivacyAssertions,
    )
  ) {
    errors.push("all privacy assertions must be recorded");
  }

  const sensitivePath = findSensitiveKey(config);
  if (sensitivePath)
    errors.push(`sensitive field is not allowed: ${sensitivePath}`);
  return errors;
}

export function evaluateBatch7ReleaseIntegrity(config) {
  const rejection_codes = validateBatch7ReleaseIntegrity(config);
  return {
    decision: rejection_codes.length === 0 ? "ready-for-review" : "blocked",
    rejection_codes,
    release_evidence: {
      release_authorized: false,
      evidence_hash: buildBatch7ReleaseEvidenceHash(config),
      stages: structuredClone(
        Array.isArray(config?.stages) ? config.stages : [],
      ),
      batches: structuredClone(
        Array.isArray(config?.batches) ? config.batches : [],
      ),
    },
  };
}
