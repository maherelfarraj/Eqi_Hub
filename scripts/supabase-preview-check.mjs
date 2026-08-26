export const SUPABASE_GITHUB_APP_ID = 330661;
export const SUPABASE_PREVIEW_CHECK_NAME = "Supabase Preview";

export function evaluateSupabasePreviewCheck(payload) {
  const checks = Array.isArray(payload?.check_runs) ? payload.check_runs : [];
  const matching = checks.filter(
    (check) => check?.name === SUPABASE_PREVIEW_CHECK_NAME && check?.app?.id === SUPABASE_GITHUB_APP_ID,
  );
  if (matching.length === 0) {
    return { state: "waiting", code: "missing-expected-supabase-preview" };
  }
  if (matching.length > 1) {
    return { state: "blocked", code: "ambiguous-expected-supabase-preview" };
  }

  const [check] = matching;
  if (check.status !== "completed") {
    return { state: "waiting", code: "expected-supabase-preview-pending" };
  }
  if (check.conclusion !== "success") {
    return { state: "blocked", code: `expected-supabase-preview-${check.conclusion ?? "without-conclusion"}` };
  }
  return { state: "success", code: "expected-supabase-preview-succeeded" };
}