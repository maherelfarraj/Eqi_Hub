import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateStage6Exit,
  validateStage6Observation,
} from "./phase1-stage6-observation.mjs";

function makeManifest({ template = false } = {}) {
  const start = new Date("2026-08-16T00:00:00Z");
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    return {
      date: date.toISOString().slice(0, 10),
      public_checks: {
        auth: template ? "pending" : "pass",
        safety: template ? "pending" : "pass",
        security_headers: template ? "pending" : "pass",
      },
      persona_checks: {
        rider: template ? "pending" : "pass",
        guardian: template ? "pending" : "pass",
        coach: template ? "pending" : "pass",
        academy_admin: template ? "pending" : "pass",
      },
      metrics: {
        journey_success_rate_pct: template ? null : 100,
        application_error_rate_pct: template ? null : 0,
        max_video_processing_minutes: template ? null : 1,
        max_cost_per_analysis_usd: template ? null : 0.01,
      },
      ai_evidence: {
        riding_analyses_completed: template ? 0 : index < 3 ? 1 : 0,
        non_riding_rejections: template ? 0 : index === 0 ? 1 : 0,
      },
      incidents: [],
      support_events: [],
      evidence_ref: template ? "REPLACE_WITH_PRIVATE_EVIDENCE_REFERENCE" : `evidence/day-${index + 1}`,
    };
  });

  return {
    version: 1,
    batch: 5,
    phase: "1.6",
    environment: "production-controlled-pilot",
    status: template ? "template" : "complete",
    observation_start: "2026-08-16",
    observation_end: "2026-08-22",
    cohort_roles: ["rider", "guardian", "coach", "academy_admin"],
    thresholds: {
      min_journey_success_rate_pct: 95,
      max_error_rate_pct: 5,
      max_video_processing_minutes: 10,
      max_cost_per_analysis_usd: 2,
      minimum_riding_analyses: 3,
      minimum_non_riding_rejections: 1,
    },
    days,
    exit_review: {
      decision: template ? "pending" : "continue",
      evidence_ref: template ? "REPLACE_WITH_EXIT_REVIEW_REFERENCE" : "evidence/exit-review",
      open_blockers: [],
    },
  };
}

test("accepts the committed template shape", () => {
  assert.deepEqual(validateStage6Observation(makeManifest({ template: true }), { template: true }), []);
});

test("accepts a complete seven-day observation and opens the exit gate", () => {
  const manifest = makeManifest();
  assert.deepEqual(validateStage6Observation(manifest), []);
  const result = evaluateStage6Exit(manifest);
  assert.equal(result.ready, true);
  assert.equal(result.decision, "continue");
  assert.deepEqual(result.totals, { riding: 3, rejected: 1 });
});

test("requires seven consecutive observation dates", () => {
  const manifest = makeManifest();
  manifest.days[4].date = "2026-08-25";
  assert.ok(validateStage6Observation(manifest).some((error) => error.includes("days[4].date")));
});

test("fails closed when a threshold is breached", () => {
  const manifest = makeManifest();
  manifest.days[2].metrics.application_error_rate_pct = 6;
  const result = evaluateStage6Exit(manifest);
  assert.equal(result.ready, false);
  assert.equal(result.decision, "hold");
  assert.ok(result.reasons.some((reason) => reason.includes("error rate")));
});

test("fails closed for an unresolved P0 or P1 incident", () => {
  const manifest = makeManifest();
  manifest.days[1].incidents.push({ severity: "P1", status: "open", evidence_ref: "incident/1" });
  const result = evaluateStage6Exit(manifest);
  assert.equal(result.ready, false);
  assert.ok(result.reasons.some((reason) => reason.includes("P0/P1")));
});

test("rejects credentials and personal identifiers anywhere in evidence", () => {
  const manifest = makeManifest();
  manifest.days[0].support_events.push({ email: "pilot@example.invalid" });
  manifest.days[1].support_events.push({ access_token: "never-store-this" });
  const errors = validateStage6Observation(manifest);
  assert.ok(errors.some((error) => error.includes("email")));
  assert.ok(errors.some((error) => error.includes("access_token")));
});

test("accepts completed past days and pending future days while observing", () => {
  const manifest = makeManifest();
  manifest.status = "observing";
  manifest.exit_review = {
    decision: "pending",
    evidence_ref: null,
    open_blockers: [],
  };

  for (const day of manifest.days.slice(2)) {
    for (const key of Object.keys(day.public_checks)) day.public_checks[key] = "pending";
    for (const key of Object.keys(day.persona_checks)) day.persona_checks[key] = "pending";
    for (const key of Object.keys(day.metrics)) day.metrics[key] = null;
    day.ai_evidence.riding_analyses_completed = 0;
    day.ai_evidence.non_riding_rejections = 0;
    day.evidence_ref = null;
  }

  assert.deepEqual(validateStage6Observation(manifest), []);
  assert.deepEqual(evaluateStage6Exit(manifest), {
    ready: false,
    decision: "pending",
    reasons: ["observation window incomplete"],
    totals: { riding: 2, rejected: 1 },
  });
});

test("complete status rejects pending checks and missing metrics", () => {
  const manifest = makeManifest();
  manifest.days[6].public_checks.auth = "pending";
  manifest.days[6].metrics.journey_success_rate_pct = null;
  const errors = validateStage6Observation(manifest);
  assert.ok(errors.some((error) => error.includes("public_checks.auth")));
  assert.ok(errors.some((error) => error.includes("journey_success_rate_pct")));
});

