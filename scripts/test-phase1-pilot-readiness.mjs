import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { validatePilotManifest } from "./phase1-pilot-readiness.mjs";

const example = JSON.parse(
  await readFile(
    new URL("../pilot/phase1-pilot.example.json", import.meta.url),
    "utf8",
  ),
);

test("accepts the committed non-secret template", () => {
  assert.deepEqual(validatePilotManifest(example, { template: true }), []);
});

test("rejects activation while owners and accounts are placeholders", () => {
  const errors = validatePilotManifest({ ...example, status: "ready" });
  assert.ok(errors.some((error) => error.includes("placeholder")));
});

test("rejects a missing required persona and journey", () => {
  const invalid = structuredClone(example);
  invalid.personas = invalid.personas.filter(
    (persona) => persona.role !== "parent",
  );
  invalid.journeys = invalid.journeys.filter(
    (journey) => journey.id !== "notifications",
  );
  const errors = validatePilotManifest(invalid, { template: true });
  assert.ok(errors.includes("personas must contain exactly one parent"));
  assert.ok(errors.includes("journeys must contain exactly one notifications"));
});

test("rejects extra personas, unknown journeys, and reused activation accounts", () => {
  const invalid = structuredClone(example);
  invalid.status = "ready";
  Object.keys(invalid.owners).forEach((key) => {
    invalid.owners[key] = `${key}-owner`;
  });
  invalid.personas.forEach((persona, index) => {
    persona.account_ref = `account-${index}`;
  });
  invalid.personas.push({
    role: "observer",
    account_ref: "account-0",
    journeys: ["unapproved-journey"],
  });
  invalid.journeys.push({
    id: "unapproved-journey",
    evidence: "evidence-ref",
  });
  invalid.journeys.forEach((journey) => {
    journey.evidence = `evidence/${journey.id}`;
  });
  invalid.operations.support_channel = "support-ref";
  invalid.operations.monitoring_dashboard = "monitoring-ref";
  invalid.operations.feedback_register = "feedback-ref";
  const errors = validatePilotManifest(invalid);
  assert.ok(errors.includes("personas must contain exactly 4 entries"));
  assert.ok(errors.some((error) => error.includes("unknown journey")));
  assert.ok(errors.includes("personas must use distinct account_ref values"));
  assert.ok(errors.includes("journeys must contain exactly 8 entries"));
});

test("rejects secret-shaped fields", () => {
  const invalid = structuredClone(example);
  invalid.operations.api_token = "must-not-be-committed";
  const errors = validatePilotManifest(invalid, { template: true });
  assert.ok(errors.some((error) => error.includes("must not store secrets")));
});

test("rejects unsafe success and cost thresholds", () => {
  const invalid = structuredClone(example);
  invalid.metrics.max_error_rate_pct = 20;
  invalid.metrics.max_cost_per_analysis_usd = 0;
  const errors = validatePilotManifest(invalid, { template: true });
  assert.ok(errors.some((error) => error.includes("max_error_rate_pct")));
  assert.ok(
    errors.some((error) => error.includes("max_cost_per_analysis_usd")),
  );
});
