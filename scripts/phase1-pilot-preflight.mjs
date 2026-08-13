import { REQUIRED_PERSONAS } from "./phase1-pilot-readiness.mjs";

const RELATIONSHIPS = [
  "active_guardian_rider_links",
  "active_coach_rider_links",
  "active_horse_access_assignments",
];
const SECRET_KEY = /(?:password|secret|token|api[_-]?key|private[_-]?key)/i;
const PLACEHOLDER = /REPLACE_|PLACEHOLDER|TBD/i;

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isNonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0;
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
    if (SECRET_KEY.test(key)) {
      errors.push(`${path}.${key} must not store secrets`);
    }
    rejectSecretKeys(entry, `${path}.${key}`, errors);
  }
}

export function validateProductionPreflight(
  snapshot,
  { template = false } = {},
) {
  const errors = [];
  if (!isObject(snapshot)) return ["preflight snapshot must be an object"];

  if (snapshot.version !== 1) errors.push("version must equal 1");
  if (snapshot.environment !== "production-controlled-pilot") {
    errors.push('environment must equal "production-controlled-pilot"');
  }
  if (
    typeof snapshot.observed_at !== "string" ||
    Number.isNaN(Date.parse(snapshot.observed_at))
  ) {
    errors.push("observed_at must be an ISO-8601 timestamp");
  }

  if (!isObject(snapshot.totals)) errors.push("totals must be an object");
  else {
    for (const key of [
      "auth_users",
      "confirmed_auth_users",
      "profiles",
      "active_memberships",
    ]) {
      if (!isNonNegativeInteger(snapshot.totals[key])) {
        errors.push(`totals.${key} must be a non-negative integer`);
      }
    }
  }

  if (
    !Array.isArray(snapshot.organizations) ||
    snapshot.organizations.length === 0
  ) {
    errors.push("organizations must contain at least one entry");
  } else {
    snapshot.organizations.forEach((organization, index) => {
      const path = `organizations[${index}]`;
      if (!isObject(organization)) {
        errors.push(`${path} must be an object`);
        return;
      }
      if (
        typeof organization.organization_ref !== "string" ||
        organization.organization_ref.trim() === "" ||
        (!template && PLACEHOLDER.test(organization.organization_ref))
      ) {
        errors.push(`${path}.organization_ref must identify the organization`);
      }
      if (!isNonNegativeInteger(organization.active_members)) {
        errors.push(`${path}.active_members must be a non-negative integer`);
      }
      if (!isNonNegativeInteger(organization.distinct_required_role_users)) {
        errors.push(
          `${path}.distinct_required_role_users must be a non-negative integer`,
        );
      }
      if (!isObject(organization.roles))
        errors.push(`${path}.roles must be an object`);
      else {
        REQUIRED_PERSONAS.forEach((role) => {
          if (!isNonNegativeInteger(organization.roles[role])) {
            errors.push(`${path}.roles.${role} must be a non-negative integer`);
          }
        });
      }
      if (!isObject(organization.relationships)) {
        errors.push(`${path}.relationships must be an object`);
      } else {
        RELATIONSHIPS.forEach((relationship) => {
          if (!isNonNegativeInteger(organization.relationships[relationship])) {
            errors.push(
              `${path}.relationships.${relationship} must be a non-negative integer`,
            );
          }
        });
      }
    });
  }

  rejectSecretKeys(snapshot, "snapshot", errors);
  return errors;
}

export function evaluateProductionPreflight(snapshot, options = {}) {
  const errors = validateProductionPreflight(snapshot, options);
  if (errors.length > 0) return { status: "invalid", errors, blockers: [] };

  const blockers = [];
  if (snapshot.totals.confirmed_auth_users < REQUIRED_PERSONAS.length) {
    blockers.push("fewer than four confirmed Auth users are available");
  }
  if (snapshot.totals.profiles < REQUIRED_PERSONAS.length) {
    blockers.push("fewer than four application profiles are available");
  }

  const candidates = snapshot.organizations.filter((organization) => {
    return (
      organization.active_members >= REQUIRED_PERSONAS.length &&
      organization.distinct_required_role_users >= REQUIRED_PERSONAS.length &&
      REQUIRED_PERSONAS.every((role) => organization.roles[role] >= 1) &&
      RELATIONSHIPS.every(
        (relationship) => organization.relationships[relationship] >= 1,
      )
    );
  });

  if (candidates.length === 0) {
    if (
      !snapshot.organizations.some(
        (organization) =>
          organization.active_members >= REQUIRED_PERSONAS.length,
      )
    ) {
      blockers.push("no organization has four active members");
    }
    if (
      !snapshot.organizations.some(
        (organization) =>
          organization.distinct_required_role_users >= REQUIRED_PERSONAS.length,
      )
    ) {
      blockers.push(
        "no organization assigns the required roles to four distinct users",
      );
    }
    REQUIRED_PERSONAS.forEach((role) => {
      if (
        !snapshot.organizations.some(
          (organization) => organization.roles[role] >= 1,
        )
      ) {
        blockers.push(`no organization has active ${role} role coverage`);
      }
    });
    RELATIONSHIPS.forEach((relationship) => {
      if (
        !snapshot.organizations.some(
          (organization) => organization.relationships[relationship] >= 1,
        )
      ) {
        blockers.push(`no organization has ${relationship}`);
      }
    });
  }

  return {
    status: blockers.length === 0 ? "ready" : "hold",
    errors: [],
    blockers,
    candidate_organization_refs: candidates.map(
      (organization) => organization.organization_ref,
    ),
  };
}
