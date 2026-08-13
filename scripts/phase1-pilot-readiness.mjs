export const REQUIRED_PERSONAS = ["rider", "parent", "coach", "academy_admin"];
export const REQUIRED_JOURNEYS = [
  "auth-session",
  "core-records",
  "lessons",
  "progress",
  "membership",
  "ai-analysis",
  "organization-admin",
  "notifications",
];

const OWNER_KEYS = ["pilot", "support", "monitoring", "incident", "rollback"];
const OPERATION_KEYS = [
  "support_channel",
  "monitoring_dashboard",
  "feedback_register",
  "incident_runbook",
  "rollback_runbook",
];
const PLACEHOLDER = /REPLACE_|PLACEHOLDER|TBD/i;
const SECRET_KEY = /(?:password|secret|token|api[_-]?key|private[_-]?key)/i;

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function requireText(value, path, errors, { allowPlaceholder }) {
  if (typeof value !== "string" || value.trim() === "") {
    errors.push(`${path} must be a non-empty string`);
  } else if (!allowPlaceholder && PLACEHOLDER.test(value)) {
    errors.push(`${path} still contains a placeholder`);
  }
}

function rejectSecretKeys(value, path, errors) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) =>
      rejectSecretKeys(entry, `${path}[${index}]`, errors),
    );
    return;
  }
  if (!isObject(value)) return;

  for (const [key, entry] of Object.entries(value)) {
    if (SECRET_KEY.test(key))
      errors.push(`${path}.${key} must not store secrets`);
    rejectSecretKeys(entry, `${path}.${key}`, errors);
  }
}

export function validatePilotManifest(manifest, { template = false } = {}) {
  const errors = [];
  if (!isObject(manifest)) return ["manifest must be an object"];

  if (manifest.version !== 1) errors.push("version must equal 1");
  if (manifest.phase !== "1.1") errors.push('phase must equal "1.1"');
  if (manifest.environment !== "production-controlled-pilot") {
    errors.push('environment must equal "production-controlled-pilot"');
  }
  if (template && manifest.status !== "template")
    errors.push('template status must equal "template"');
  if (!template && manifest.status !== "ready")
    errors.push('activation status must equal "ready"');

  if (!isObject(manifest.owners)) errors.push("owners must be an object");
  else
    OWNER_KEYS.forEach((key) =>
      requireText(manifest.owners[key], `owners.${key}`, errors, {
        allowPlaceholder: template,
      }),
    );

  if (!Array.isArray(manifest.personas))
    errors.push("personas must be an array");
  else {
    if (manifest.personas.length !== REQUIRED_PERSONAS.length) {
      errors.push(
        `personas must contain exactly ${REQUIRED_PERSONAS.length} entries`,
      );
    }
    const roles = manifest.personas.map((persona) => persona?.role);
    for (const role of REQUIRED_PERSONAS) {
      if (roles.filter((entry) => entry === role).length !== 1) {
        errors.push(`personas must contain exactly one ${role}`);
      }
    }
    manifest.personas.forEach((persona, index) => {
      if (!isObject(persona)) {
        errors.push(`personas[${index}] must be an object`);
        return;
      }
      requireText(
        persona.account_ref,
        `personas[${index}].account_ref`,
        errors,
        { allowPlaceholder: template },
      );
      if (!Array.isArray(persona.journeys) || persona.journeys.length === 0) {
        errors.push(`personas[${index}].journeys must not be empty`);
      } else {
        persona.journeys.forEach((journey) => {
          if (!REQUIRED_JOURNEYS.includes(journey)) {
            errors.push(
              `personas[${index}].journeys contains unknown journey ${journey}`,
            );
          }
        });
      }
    });
    const accountRefs = manifest.personas.map(
      (persona) => persona?.account_ref,
    );
    if (!template && new Set(accountRefs).size !== accountRefs.length) {
      errors.push("personas must use distinct account_ref values");
    }
  }

  if (!Array.isArray(manifest.journeys))
    errors.push("journeys must be an array");
  else {
    if (manifest.journeys.length !== REQUIRED_JOURNEYS.length) {
      errors.push(
        `journeys must contain exactly ${REQUIRED_JOURNEYS.length} entries`,
      );
    }
    const ids = manifest.journeys.map((journey) => journey?.id);
    for (const id of REQUIRED_JOURNEYS) {
      if (ids.filter((entry) => entry === id).length !== 1) {
        errors.push(`journeys must contain exactly one ${id}`);
      }
    }
    manifest.journeys.forEach((journey, index) => {
      requireText(journey?.evidence, `journeys[${index}].evidence`, errors, {
        allowPlaceholder: template,
      });
    });
  }

  if (!isObject(manifest.metrics)) errors.push("metrics must be an object");
  else {
    const ranges = {
      max_error_rate_pct: [0, 5],
      min_journey_success_rate_pct: [95, 100],
      max_video_processing_minutes: [1, 30],
      max_cost_per_analysis_usd: [0.01, 10],
      minimum_feedback_responses: [4, 1000],
    };
    for (const [key, [minimum, maximum]] of Object.entries(ranges)) {
      const value = manifest.metrics[key];
      if (typeof value !== "number" || value < minimum || value > maximum) {
        errors.push(`metrics.${key} must be between ${minimum} and ${maximum}`);
      }
    }
  }

  if (!isObject(manifest.operations))
    errors.push("operations must be an object");
  else
    OPERATION_KEYS.forEach((key) =>
      requireText(manifest.operations[key], `operations.${key}`, errors, {
        allowPlaceholder: template,
      }),
    );

  if (!isObject(manifest.rollback)) errors.push("rollback must be an object");
  else {
    for (const key of ["triggers", "actions"]) {
      if (
        !Array.isArray(manifest.rollback[key]) ||
        manifest.rollback[key].length === 0
      ) {
        errors.push(`rollback.${key} must not be empty`);
      }
    }
  }

  rejectSecretKeys(manifest, "manifest", errors);
  return errors;
}
