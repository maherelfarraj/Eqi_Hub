import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const migrationPath = resolve(
  root,
  "supabase/migrations/20260822094500_batch21_academy_onboarding.sql",
);
const rollbackPath = resolve(
  root,
  "supabase/rollback/20260822094500_batch21_academy_onboarding_rollback.sql",
);

function transactional(sql) {
  return /^(?:\s|--[^\n]*\n)*begin;/i.test(sql) && /commit;\s*$/i.test(sql);
}

export function validateBatch21AcademyOnboarding(migration, rollback) {
  const errors = [];
  if (!transactional(migration)) errors.push("migration must be transactional");
  if (!transactional(rollback)) errors.push("rollback must be transactional");
  if (/auth\.role\s*\(/i.test(`${migration}\n${rollback}`))
    errors.push("must not use deprecated auth.role()");
  if (/auth\.admin|service_role_key|sb_secret_/i.test(migration))
    errors.push("migration must not create Auth users or contain server credentials");

  for (const table of [
    "academy_onboarding_batches",
    "academy_onboarding_invitations",
  ]) {
    if (!new RegExp(`create table public\\.${table} \\(`, "i").test(migration))
      errors.push(`missing ${table} table`);
    if (
      !new RegExp(
        `alter table public\\.${table} enable row level security;`,
        "i",
      ).test(migration)
    )
      errors.push(`missing ${table} RLS`);
    if (
      !new RegExp(
        `revoke all on public\\.${table} from public, anon, authenticated;`,
        "i",
      ).test(migration)
    )
      errors.push(`missing ${table} browser privilege revoke`);
    if (
      !new RegExp(
        `create policy ${table}_deny_direct_access[\\s\\S]*?on public\\.${table}[\\s\\S]*?as restrictive for all to authenticated[\\s\\S]*?using \\(false\\)[\\s\\S]*?with check \\(false\\);`,
        "i",
      ).test(migration)
    )
      errors.push(`missing ${table} explicit deny policy`);
    if (!new RegExp(`drop table if exists public\\.${table};`, "i").test(rollback))
      errors.push(`missing ${table} rollback`);
  }

  for (const wrapper of [
    "preview_academy_onboarding",
    "create_academy_onboarding_batch",
    "get_academy_onboarding_batches",
    "get_academy_onboarding_invitations",
    "claim_academy_onboarding_invitation",
    "revoke_academy_onboarding_invitation",
    "close_academy_onboarding_batch",
  ]) {
    const block =
      migration.match(
        new RegExp(`create function public\\.${wrapper}[\\s\\S]*?\\$function\\$;`, "i"),
      )?.[0] ?? "";
    if (!block) errors.push(`missing public wrapper: ${wrapper}`);
    else if (!/security invoker/i.test(block))
      errors.push(`${wrapper} must be security invoker`);
  }

  for (const implementation of [
    "batch21_validate_onboarding_entries",
    "batch21_create_onboarding_batch",
    "batch21_get_onboarding_batches",
    "batch21_get_onboarding_invitations",
    "batch21_claim_onboarding_invitation",
    "batch21_revoke_onboarding_invitation",
    "batch21_close_onboarding_batch",
  ]) {
    const block =
      migration.match(
        new RegExp(`create function private\\.${implementation}[\\s\\S]*?\\$function\\$;`, "i"),
      )?.[0] ?? "";
    if (!block) errors.push(`missing private implementation: ${implementation}`);
    else if (!/security definer[\s\S]*?set search_path = ''/i.test(block))
      errors.push(`${implementation} must be hardened security definer`);
  }

  const claimBlock =
    migration.match(
      /create function private\.batch21_claim_onboarding_invitation[\s\S]*?\$function\$;/i,
    )?.[0] ?? "";
  for (const [guard, message] of [
    [/extensions\.digest\(p_invite_token, 'sha256'\)/i, "tokens must be hashed"],
    [/auth\.jwt\(\)\s*->>\s*'email'/i, "claim must use the signed Auth email claim"],
    [/actor_email <> target\.email/i, "claim must match invited email"],
    [/invitation\.expires_at > now\(\)/i, "claim must enforce expiry"],
    [/batch\.status = 'active'/i, "claim must require active batch"],
    [/on conflict \(organization_id, user_id\) do update/i, "claim must activate membership atomically"],
    [/on conflict \(membership_id, role\) do nothing/i, "claim must assign roles idempotently"],
  ]) {
    if (!guard.test(claimBlock)) errors.push(message);
  }
  if (/select\s+lower\(email\)\s+into\s+actor_email\s+from\s+public\.profiles/i.test(claimBlock))
    errors.push("claim must not authorize against user-editable profile email");

  const createBlock =
    migration.match(
      /create function private\.batch21_create_onboarding_batch[\s\S]*?\$function\$;/i,
    )?.[0] ?? "";
  if (!/encode\(extensions\.digest\(invite_token, 'sha256'\), 'hex'\)/i.test(createBlock))
    errors.push("tokens must be hashed");

  if (!/jsonb_array_length\(p_entries\) < 1 or jsonb_array_length\(p_entries\) > 100/i.test(migration))
    errors.push("batch size must be bounded to 100");
  if (!/p_expires_in_days is null[\s\S]*?p_expires_in_days < 1[\s\S]*?p_expires_in_days > 30/i.test(migration))
    errors.push("invitation expiry must be bounded");
  if (!/academy_onboarding_invitations_pending_email_idx[\s\S]*?where status = 'pending'/i.test(migration))
    errors.push("pending invitations require an email uniqueness guard");
  if (!/academy_onboarding_invitations_batch_idx[\s\S]*?\(batch_id, organization_id, created_at\)/i.test(migration))
    errors.push("batch foreign key requires a covering composite index");
  if (!/onboarding\.batch_created/i.test(migration) || !/onboarding\.invitation_accepted/i.test(migration) || !/onboarding\.batch_closed/i.test(migration))
    errors.push("onboarding lifecycle must be audited");
  if (!/This migration creates no organizations, users, memberships, or invitations/i.test(migration))
    errors.push("migration must declare its zero-data behavior");

  const roleAllowlist =
    migration.match(
      /select 1 from unnest\(entry_roles\) as role\s+where role <> all\(array\[([\s\S]*?)\]::text\[\]\)/i,
    )?.[1] ?? "";
  if (!roleAllowlist)
    errors.push("missing batch-onboarding role allowlist");
  if (/['\"]academy_admin['\"]/i.test(roleAllowlist))
    errors.push("batch onboarding must not grant academy_admin");

  for (const dependency of [
    "extensions.gen_random_bytes(integer)",
    "extensions.digest(text,text)",
  ]) {
    if (!migration.includes(`to_regprocedure('${dependency}')`))
      errors.push(`missing Batch 21 preflight dependency: ${dependency}`);
  }

  return errors;
}

if (process.argv[1] === import.meta.filename) {
  const [migration, rollback] = await Promise.all([
    readFile(migrationPath, "utf8"),
    readFile(rollbackPath, "utf8"),
  ]);
  const errors = validateBatch21AcademyOnboarding(migration, rollback);
  if (errors.length) throw new Error(errors.join("\n"));
  console.log(
    "Verified Batch 21 bounded CSV onboarding, one-time claims, tenant isolation, audit controls, privileges, and rollback",
  );
}
