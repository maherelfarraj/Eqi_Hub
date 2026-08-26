import assert from "node:assert/strict";
import test from "node:test";
import {
  SUPABASE_GITHUB_APP_ID,
  SUPABASE_PREVIEW_CHECK_NAME,
  evaluateSupabasePreviewCheck,
} from "./supabase-preview-check.mjs";

const check = (overrides = {}) => ({
  name: SUPABASE_PREVIEW_CHECK_NAME,
  status: "completed",
  conclusion: "success",
  app: { id: SUPABASE_GITHUB_APP_ID },
  ...overrides,
});

test("accepts only the successful Supabase App preview", () => {
  assert.deepEqual(evaluateSupabasePreviewCheck({ check_runs: [check()] }), {
    state: "success",
    code: "expected-supabase-preview-succeeded",
  });
});

test("rejects a successful same-name check from another GitHub App", () => {
  assert.deepEqual(evaluateSupabasePreviewCheck({ check_runs: [check({ app: { id: 15368 } })] }), {
    state: "waiting",
    code: "missing-expected-supabase-preview",
  });
});

test("waits for the expected Supabase App check and blocks failed conclusions", () => {
  assert.equal(evaluateSupabasePreviewCheck({ check_runs: [check({ status: "in_progress", conclusion: null })] }).state, "waiting");
  assert.deepEqual(evaluateSupabasePreviewCheck({ check_runs: [check({ conclusion: "cancelled" })] }), {
    state: "blocked",
    code: "expected-supabase-preview-cancelled",
  });
});

test("rejects ambiguous expected-app previews", () => {
  assert.deepEqual(evaluateSupabasePreviewCheck({ check_runs: [check(), check()] }), {
    state: "blocked",
    code: "ambiguous-expected-supabase-preview",
  });
});