import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const repositoryRoot = resolve(import.meta.dirname, "..");
const migrationPath = resolve(
  repositoryRoot,
  "supabase/migrations/20260813204459_linked_persona_access.sql",
);
const rollbackPath = resolve(
  repositoryRoot,
  "supabase/rollback/20260813204459_linked_persona_access_rollback.sql",
);

export function validateLinkedPersonaMigration(sql) {
  const errors = [];
  const required = [
    /create or replace function private\.can_read_rider\s*\(/i,
    /create or replace function private\.can_access_horse\s*\(/i,
    /from public\.guardian_riders/i,
    /from public\.horse_access_assignments/i,
    /link\.active/i,
    /access\.active/i,
    /create policy lessons_select[\s\S]*private\.can_read_rider/i,
    /create policy analyses_select_participant[\s\S]*private\.can_read_rider/i,
    /create policy horses_select[\s\S]*private\.can_access_horse/i,
    /alter policy storage_user_read_own[\s\S]*bucket_id in \('videos', 'riding-analysis-videos'\)/i,
    /revoke all on function private\.can_read_rider\(uuid, uuid\) from public, anon/i,
    /grant execute on function private\.can_read_rider\(uuid, uuid\) to authenticated/i,
  ];

  required.forEach((pattern) => {
    if (!pattern.test(sql)) errors.push(`missing required guard: ${pattern}`);
  });

  if (/auth\.role\s*\(/i.test(sql)) {
    errors.push("must not use deprecated auth.role()");
  }
  if (/create policy [\s\S]*? for (?:insert|update|delete|all)\b/i.test(sql)) {
    errors.push("Stage 4 must not create or replace write policies");
  }
  if (!/^begin;/im.test(sql) || !/commit;\s*$/i.test(sql)) {
    errors.push("migration must be transactional");
  }
  return errors;
}

if (process.argv[1] === import.meta.filename) {
  const [migration, rollback] = await Promise.all([
    readFile(migrationPath, "utf8"),
    readFile(rollbackPath, "utf8"),
  ]);
  const errors = validateLinkedPersonaMigration(migration);
  if (!/drop function if exists private\.can_read_rider/i.test(rollback)) {
    errors.push("rollback must remove can_read_rider");
  }
  if (!/alter policy storage_user_read_own/i.test(rollback)) {
    errors.push("rollback must restore the Storage read policy");
  }
  if (errors.length) throw new Error(errors.join("\n"));
  console.log(
    "Verified linked-persona migration grants scoped guardian reads, uses canonical horse access, preserves write boundaries, and includes rollback",
  );
}
