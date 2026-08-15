export const REQUIRED_PERSONAS = [
  "rider",
  "guardian",
  "coach",
  "academy_admin",
];

export const REQUIRED_PUBLIC_CHECKS = [
  "auth",
  "safety",
  "security_headers",
];

export const EXIT_DECISIONS = ["continue", "extend", "hold"];

const SECRET_KEY = /(?:password|secret|token|api[_-]?key|private[_-]?key|credential)/i;
const PERSONAL_KEY = /(?:email|full[_-]?name|phone|address|account[_-]?ref|user[_-]?id)/i;
const PLACEHOLDER = /REPLACE_|PLACEHOLDER|TBD/i;

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function nextDate(value) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function rejectSensitiveKeys(value, path, errors) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) =>
      rejectSensitiveKeys(entry, `${path}[${index}]`, errors),
    );
    return;
  }
  if (!isObject(value)) return;
  for (const [key, entry] of Object.entries(value)) {
    if (SECRET_KEY.test(key) || PERSONAL_KEY.test(key)) {
      errors.push(`${path}.${key} must not store credentials or personal data`);
    }
    rejectSensitiveKeys(entry, `${path}.${key}`, errors);
  }
}

function requireText(value, path, errors, { template }) {
  if (typeof value !== "string" || value.trim() === "") {
    errors.push(`${path} must be a non-empty string`);
  } else if (!template && PLACEHOLDER.test(value)) {
    errors.push(`${path} still contains a placeholder`);
  }
}

function validateStatus(value, path, errors, { allowPending }) {
  const allowed = allowPending ? ["pending", "pass"] : ["pass"];
  if (!allowed.includes(value)) {
    errors.push(`${path} must be ${allowed.join(" or ")}`);
  }
}

export function validateStage6Observation(manifest, { template = false } = {}) {
  const errors = [];
  if (!isObject(manifest)) return ["manifest must be an object"];

  if (manifest.version !== 1) errors.push("version must equal 1");
  if (manifest.batch !== 5) errors.push("batch must equal 5");
  if (manifest.phase !== "1.6") errors.push('phase must equal "1.6"');
  if (manifest.environment !== "production-controlled-pilot") {
    errors.push('environment must equal "production-controlled-pilot"');
  }

  const expectedStatus = template ? "template" : ["observing", "complete"];
  if (template ? manifest.status !== expectedStatus : !expectedStatus.includes(manifest.status)) {
    errors.push(
      template
        ? 'template status must equal "template"'
        : 'status must equal "observing" or "complete"',
    );
  }

  const observing = !template && manifest.status === "observing";
  const allowPending = template || observing;

  if (!isDate(manifest.observation_start)) {
    errors.push("observation_start must be an ISO date");
  }
  if (!isDate(manifest.observation_end)) {
    errors.push("observation_end must be an ISO date");
  }
  if (isDate(manifest.observation_start) && isDate(manifest.observation_end)) {
    let expectedEnd = manifest.observation_start;
    for (let index = 1; index < 7; index += 1) expectedEnd = nextDate(expectedEnd);
    if (manifest.observation_end !== expectedEnd) {
      errors.push("observation_end must be six days after observation_start");
    }
  }

  if (!Array.isArray(manifest.cohort_roles)) {
    errors.push("cohort_roles must be an array");
  } else {
    if (manifest.cohort_roles.length !== REQUIRED_PERSONAS.length) {
      errors.push("cohort_roles must contain exactly four roles");
    }
    for (const role of REQUIRED_PERSONAS) {
      if (manifest.cohort_roles.filter((entry) => entry === role).length !== 1) {
        errors.push(`cohort_roles must contain exactly one ${role}`);
      }
    }
  }

  if (!isObject(manifest.thresholds)) {
    errors.push("thresholds must be an object");
  } else {
    const exact = {
      min_journey_success_rate_pct: 95,
      max_error_rate_pct: 5,
      max_video_processing_minutes: 10,
      max_cost_per_analysis_usd: 2,
      minimum_riding_analyses: 3,
      minimum_non_riding_rejections: 1,
    };
    for (const [key, value] of Object.entries(exact)) {
      if (manifest.thresholds[key] !== value) {
        errors.push(`thresholds.${key} must equal ${value}`);
      }
    }
  }

  if (!Array.isArray(manifest.days) || manifest.days.length !== 7) {
    errors.push("days must contain exactly seven entries");
  } else {
    manifest.days.forEach((day, index) => {
      const path = `days[${index}]`;
      if (!isObject(day)) {
        errors.push(`${path} must be an object`);
        return;
      }
      if (isDate(manifest.observation_start)) {
        let expected = manifest.observation_start;
        for (let cursor = 0; cursor < index; cursor += 1) expected = nextDate(expected);
        if (day.date !== expected) errors.push(`${path}.date must equal ${expected}`);
      }

      if (!isObject(day.public_checks)) {
        errors.push(`${path}.public_checks must be an object`);
      } else {
        for (const check of REQUIRED_PUBLIC_CHECKS) {
          validateStatus(day.public_checks[check], `${path}.public_checks.${check}`, errors, { allowPending });
        }
      }

      if (!isObject(day.persona_checks)) {
        errors.push(`${path}.persona_checks must be an object`);
      } else {
        for (const role of REQUIRED_PERSONAS) {
          validateStatus(day.persona_checks[role], `${path}.persona_checks.${role}`, errors, { allowPending });
        }
      }

      const publicStatuses = isObject(day.public_checks)
        ? REQUIRED_PUBLIC_CHECKS.map((check) => day.public_checks[check])
        : [];
      const personaStatuses = isObject(day.persona_checks)
        ? REQUIRED_PERSONAS.map((role) => day.persona_checks[role])
        : [];
      const dayPending = allowPending &&
        [...publicStatuses, ...personaStatuses].includes("pending");

      for (const [key, minimum, maximum] of [
        ["journey_success_rate_pct", 0, 100],
        ["application_error_rate_pct", 0, 100],
        ["max_video_processing_minutes", 0, 60],
        ["max_cost_per_analysis_usd", 0, 100],
      ]) {
        const value = day.metrics?.[key];
        if ((template || (observing && dayPending)) && value === null) continue;
        if (typeof value !== "number" || value < minimum || value > maximum) {
          errors.push(`${path}.metrics.${key} must be between ${minimum} and ${maximum}`);
        }
      }

      for (const key of ["riding_analyses_completed", "non_riding_rejections"]) {
        const value = day.ai_evidence?.[key];
        if (!Number.isInteger(value) || value < 0) {
          errors.push(`${path}.ai_evidence.${key} must be a non-negative integer`);
        }
      }

      if (!Array.isArray(day.incidents)) errors.push(`${path}.incidents must be an array`);
      if (!Array.isArray(day.support_events)) errors.push(`${path}.support_events must be an array`);
      if (observing && dayPending) {
        if (day.evidence_ref !== null && day.evidence_ref !== undefined) {
          requireText(day.evidence_ref, `${path}.evidence_ref`, errors, { template: false });
        }
      } else {
        requireText(day.evidence_ref, `${path}.evidence_ref`, errors, { template });
      }
    });
  }

  if (!isObject(manifest.exit_review)) {
    errors.push("exit_review must be an object");
  } else {
    if (template || observing) {
      if (manifest.exit_review.decision !== "pending") {
        errors.push(`${template ? "template" : "observing"} exit_review.decision must equal "pending"`);
      }
    } else if (manifest.status === "complete") {
      if (!EXIT_DECISIONS.includes(manifest.exit_review.decision)) {
        errors.push("complete exit_review.decision must be continue, extend, or hold");
      }
      requireText(manifest.exit_review.evidence_ref, "exit_review.evidence_ref", errors, { template });
    }
    if (!Array.isArray(manifest.exit_review.open_blockers)) {
      errors.push("exit_review.open_blockers must be an array");
    }
  }

  rejectSensitiveKeys(manifest, "manifest", errors);
  return errors;
}

export function evaluateStage6Exit(manifest) {
  const validationErrors = validateStage6Observation(manifest);
  if (validationErrors.length > 0) {
    return { ready: false, decision: "hold", reasons: validationErrors };
  }

  const reasons = [];
  const totals = manifest.days.reduce(
    (state, day) => ({
      riding: state.riding + day.ai_evidence.riding_analyses_completed,
      rejected: state.rejected + day.ai_evidence.non_riding_rejections,
    }),
    { riding: 0, rejected: 0 },
  );

  if (manifest.status === "observing") {
    return {
      ready: false,
      decision: "pending",
      reasons: ["observation window incomplete"],
      totals,
    };
  }

  for (const day of manifest.days) {
    if (day.metrics.journey_success_rate_pct < manifest.thresholds.min_journey_success_rate_pct) {
      reasons.push(`${day.date}: journey success below threshold`);
    }
    if (day.metrics.application_error_rate_pct > manifest.thresholds.max_error_rate_pct) {
      reasons.push(`${day.date}: application error rate above threshold`);
    }
    if (day.metrics.max_video_processing_minutes > manifest.thresholds.max_video_processing_minutes) {
      reasons.push(`${day.date}: video processing time above threshold`);
    }
    if (day.metrics.max_cost_per_analysis_usd > manifest.thresholds.max_cost_per_analysis_usd) {
      reasons.push(`${day.date}: analysis cost above threshold`);
    }
    if (day.incidents.some((incident) => ["P0", "P1"].includes(incident.severity) && incident.status !== "resolved")) {
      reasons.push(`${day.date}: unresolved P0/P1 incident`);
    }
  }

  if (totals.riding < manifest.thresholds.minimum_riding_analyses) {
    reasons.push("insufficient completed riding analyses");
  }
  if (totals.rejected < manifest.thresholds.minimum_non_riding_rejections) {
    reasons.push("insufficient non-riding rejection evidence");
  }
  if (manifest.exit_review.open_blockers.length > 0) reasons.push("exit review has open blockers");

  return {
    ready: reasons.length === 0 && manifest.status === "complete",
    decision: reasons.length === 0 ? manifest.exit_review.decision : "hold",
    reasons,
    totals,
  };
}
