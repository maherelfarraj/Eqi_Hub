import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const repositoryRoot = resolve(import.meta.dirname, "..");
const migrationPath = resolve(
  repositoryRoot,
  "supabase/migrations/20260814093936_consolidate_linked_guardian_select_policies.sql",
);
const rollbackPath = resolve(
  repositoryRoot,
  "supabase/rollback/20260814093936_consolidate_linked_guardian_select_policies_rollback.sql",
);

const affectedTables = ["documents", "health_records", "training_log"];
const commands = ["select", "insert", "update", "delete"];

function policyStatements(sql) {
  return [
    ...sql.matchAll(
      /create policy\s+([a-z0-9_]+)\s+on public\.([a-z0-9_]+)\s+for (select|insert|update|delete|all)\s+to authenticated\s+([\s\S]*?);/gi,
    ),
  ].map((match) => ({
    name: match[1].toLowerCase(),
    table: match[2].toLowerCase(),
    command: match[3].toLowerCase(),
    statement: match[0],
  }));
}

function isTransactional(sql) {
  return /^\s*(?:--[^\n]*\n)*begin;/i.test(sql) && /commit;\s*$/i.test(sql);
}

export function validatePolicyConsolidation(migration, rollback) {
  const errors = [];
  const migrationPolicies = policyStatements(migration);
  const rollbackPolicies = policyStatements(rollback);

  if (!isTransactional(migration))
    errors.push("migration must be transactional");
  if (!isTransactional(rollback)) errors.push("rollback must be transactional");
  if (/auth\.role\s*\(/i.test(`${migration}\n${rollback}`)) {
    errors.push("must not use deprecated auth.role()");
  }

  for (const table of affectedTables) {
    const tablePolicies = migrationPolicies.filter(
      (policy) => policy.table === table,
    );
    const tableRollbackPolicies = rollbackPolicies.filter(
      (policy) => policy.table === table,
    );

    for (const command of commands) {
      const matchingPolicies = tablePolicies.filter(
        (policy) => policy.command === command,
      );
      if (matchingPolicies.length !== 1) {
        errors.push(`${table} must have exactly one ${command} policy`);
      }
    }

    if (tablePolicies.some((policy) => policy.command === "all")) {
      errors.push(`${table} must not retain an ALL policy`);
    }

    const selectPolicy = tablePolicies.find(
      (policy) => policy.command === "select",
    );
    if (!selectPolicy?.statement.includes("private.can_access_horse")) {
      errors.push(`${table} SELECT must preserve linked guardian horse access`);
    }

    const widenedWritePolicy = tablePolicies.find(
      (policy) =>
        policy.command !== "select" &&
        policy.statement.includes("private.can_access_horse"),
    );
    if (widenedWritePolicy) {
      errors.push(
        `${table} ${widenedWritePolicy.command} must not grant linked guardian access`,
      );
    }

    if (
      !new RegExp(
        `drop policy if exists ${table}_linked_guardian_select`,
        "i",
      ).test(migration)
    ) {
      errors.push(
        `${table} must drop the duplicate linked guardian SELECT policy`,
      );
    }

    if (
      !tableRollbackPolicies.some(
        (policy) =>
          policy.name === `${table}_access` && policy.command === "all",
      ) ||
      !tableRollbackPolicies.some(
        (policy) =>
          policy.name === `${table}_linked_guardian_select` &&
          policy.command === "select",
      )
    ) {
      errors.push(
        `${table} rollback must restore the former ALL and SELECT policies`,
      );
    }
  }

  const requiredWriteGuards = [
    /create policy documents_insert_access[\s\S]*with check\s*\(\(select auth\.uid\(\)\) = user_id\)/i,
    /create policy documents_update_access[\s\S]*horse\.owner_id = \(select auth\.uid\(\)\)[\s\S]*with check\s*\(\(select auth\.uid\(\)\) = user_id\)/i,
    /create policy health_records_(?:insert|update|delete)_access[\s\S]*horse\.owner_id = \(select auth\.uid\(\)\)/i,
    /create policy training_log_insert_access[\s\S]*author_id = \(select auth\.uid\(\)\)/i,
    /create policy training_log_update_access[\s\S]*from public\.horse_riders[\s\S]*with check\s*\(author_id = \(select auth\.uid\(\)\)\)/i,
    /create policy training_log_delete_access[\s\S]*from public\.horse_riders/i,
  ];

  for (const guard of requiredWriteGuards) {
    if (!guard.test(migration))
      errors.push(`missing preserved write guard: ${guard}`);
  }

  return errors;
}

if (process.argv[1] === import.meta.filename) {
  const [migration, rollback] = await Promise.all([
    readFile(migrationPath, "utf8"),
    readFile(rollbackPath, "utf8"),
  ]);
  const errors = validatePolicyConsolidation(migration, rollback);
  if (errors.length) throw new Error(errors.join("\n"));
  console.log(
    "Verified linked-guardian SELECT consolidation preserves all write boundaries and rollback",
  );
}
