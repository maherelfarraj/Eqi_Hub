import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const migrationPath = resolve(
  root,
  "supabase/migrations/20260823090000_batch22_onboarding_operations.sql",
);
const rollbackPath = resolve(
  root,
  "supabase/rollback/20260823090000_batch22_onboarding_operations_rollback.sql",
);

function transactional(sql) {
  return /^(?:\s|--[^\n]*\n)*begin;/i.test(sql) && /commit;\s*$/i.test(sql);
}

export function validateBatch22OnboardingOperations(migration, rollback) {
  const errors = [];
  const combined = `${migration}\n${rollback}`;
  if (!transactional(migration)) errors.push("migration must be transactional");
  if (!transactional(rollback)) errors.push("rollback must be transactional");
  if (/auth\.role\s*\(/i.test(combined))
    errors.push("must not use deprecated auth.role()");
  if (/auth\.admin|service_role_key|sb_secret_/i.test(migration))
    errors.push(
      "migration must not contain Auth administration or server credentials",
    );
  if (
    !/This migration creates no organizations, users, memberships, invitations, or delivery jobs/i.test(
      migration,
    )
  )
    errors.push("migration must declare its zero-data behavior");

  for (const column of [
    "reissue_count",
    "last_reissued_at",
    "last_reissued_by",
  ]) {
    if (!new RegExp(`add column ${column}`, "i").test(migration))
      errors.push(`missing ${column} invitation operation column`);
    if (!new RegExp(`drop column if exists ${column}`, "i").test(rollback))
      errors.push(`rollback must remove ${column}`);
  }
  if (!/reissue_count between 0 and 5/i.test(migration))
    errors.push("replacement count must be bounded to five");
  if (!/academy_onboarding_invitations_last_reissued_by_idx/i.test(migration))
    errors.push("replacement actor foreign key must be indexed");

  for (const wrapper of [
    "get_academy_onboarding_invitations",
    "get_academy_onboarding_metrics",
    "get_academy_onboarding_activity",
    "reissue_academy_onboarding_invitation",
  ]) {
    const block =
      migration.match(
        new RegExp(
          `create function public\\.${wrapper}[\\s\\S]*?\\$function\\$;`,
          "i",
        ),
      )?.[0] ?? "";
    if (!block) errors.push(`missing public wrapper: ${wrapper}`);
    else if (!/security invoker/i.test(block))
      errors.push(`${wrapper} must be security invoker`);
    if (
      !new RegExp(`revoke all on function public\\.${wrapper}`, "i").test(
        migration,
      )
    )
      errors.push(`${wrapper} must revoke default execution`);
  }

  for (const implementation of [
    "batch22_get_onboarding_metrics",
    "batch22_get_onboarding_activity",
    "batch22_reissue_onboarding_invitation",
  ]) {
    const block =
      migration.match(
        new RegExp(
          `create function private\\.${implementation}[\\s\\S]*?\\$function\\$;`,
          "i",
        ),
      )?.[0] ?? "";
    if (!block)
      errors.push(`missing private implementation: ${implementation}`);
    else {
      if (!/security definer[\s\S]*?set search_path = ''/i.test(block))
        errors.push(`${implementation} must be a hardened security definer`);
      if (
        !/phase_0b2_is_organization_manager\(p_organization_id\)/i.test(block)
      )
        errors.push(
          `${implementation} must enforce organization-manager scope`,
        );
    }
  }

  const replacement =
    migration.match(
      /create function private\.batch22_reissue_onboarding_invitation[\s\S]*?\$function\$;/i,
    )?.[0] ?? "";
  for (const [guard, message] of [
    [/for update of invitation/i, "replacement must lock the invitation"],
    [
      /invitation\.status = 'pending'/i,
      "replacement must require pending status",
    ],
    [
      /invitation\.expires_at > now\(\)/i,
      "replacement must reject expired invitations",
    ],
    [/batch\.status = 'active'/i, "replacement must require an active batch"],
    [/target\.reissue_count >= 5/i, "replacement must enforce its maximum"],
    [/interval '5 minutes'/i, "replacement must enforce a cooldown"],
    [
      /extensions\.digest\(replacement_token, 'sha256'\)/i,
      "replacement token must be hashed",
    ],
    [/onboarding\.invitation_reissued/i, "replacement must be audited"],
  ]) {
    if (!guard.test(replacement)) errors.push(message);
  }
  const auditPayload =
    replacement.match(
      /'onboarding\.invitation_reissued',[\s\S]*?jsonb_build_object\(([\s\S]*?)\)\s*\n\s*\);/i,
    )?.[1] ?? "";
  if (!auditPayload) errors.push("replacement audit payload is missing");
  if (
    /invite_token|replacement_token|(?:^|[^a-z_])email(?:$|[^a-z_])|\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/i.test(
      auditPayload,
    )
  )
    errors.push("replacement audit must not contain email or token material");

  if (
    !/expiring_in_24_hours/i.test(migration) ||
    !/acceptance_rate/i.test(migration)
  )
    errors.push(
      "operational metrics must include expiry and acceptance signals",
    );
  if (
    !/event\.action in \([\s\S]*?onboarding\.invitation_reissued/i.test(
      migration,
    )
  )
    errors.push("activity feed must include the onboarding lifecycle");
  if (
    ![
      "get_academy_onboarding_metrics",
      "get_academy_onboarding_activity",
      "reissue_academy_onboarding_invitation",
    ].every((name) =>
      new RegExp(`drop function if exists public\\.${name}`, "i").test(
        rollback,
      ),
    )
  )
    errors.push("rollback must remove Batch 22 public operations");
  if (
    !/create function private\.batch21_get_onboarding_invitations/i.test(
      rollback,
    )
  )
    errors.push("rollback must restore the Batch 21 invitation reader");

  return errors;
}

if (process.argv[1] === import.meta.filename) {
  const [migration, rollback] = await Promise.all([
    readFile(migrationPath, "utf8"),
    readFile(rollbackPath, "utf8"),
  ]);
  const errors = validateBatch22OnboardingOperations(migration, rollback);
  if (errors.length) throw new Error(errors.join("\n"));
  console.log(
    "Verified Batch 22 tenant-scoped metrics, activity, token replacement, audit safety, privileges, and rollback",
  );
}
