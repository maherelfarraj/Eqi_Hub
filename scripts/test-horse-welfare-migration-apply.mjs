import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const dataDirectory = await mkdtemp(join(tmpdir(), "equivista-welfare-pg-"));
const socketDirectory = await mkdtemp(join(tmpdir(), "equivista-welfare-socket-"));
const postgresBinDirectories = [
  ...(process.env.PATH ?? "").split(":"),
  process.env.PG_BIN_DIR,
  "/usr/lib/postgresql/18/bin",
  "/usr/lib/postgresql/17/bin",
  "/usr/lib/postgresql/16/bin",
  "/usr/lib/postgresql/15/bin",
  "/usr/lib/postgresql/14/bin",
  "/usr/lib/postgresql/13/bin",
  "/usr/lib/postgresql/12/bin",
  "/usr/local/pgsql/bin",
].filter(Boolean);
const initdb = postgresBinDirectories
  .map((entry) => join(entry, "initdb"))
  .find(existsSync);
if (!initdb) {
  throw new Error("PostgreSQL initdb is required to validate the isolated Batch 5 migration.");
}
const postgresBin = dirname(initdb);
const pgCtl = join(postgresBin, "pg_ctl");
const psql = join(postgresBin, "psql");
const port = "55432";
const targetMigration = resolve(
  root,
  "supabase/migrations/20260825090000_horse_welfare_stable_operations.sql",
);

let databaseStarted = false;

function run(command, args, input) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    input,
    timeout: 60_000,
  });
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed.\n${result.stdout ?? ""}\n${result.stderr ?? ""}`,
    );
  }
  return result.stdout;
}

try {
  run(initdb, ["--no-locale", "--encoding=UTF8", "--username=postgres", "-D", dataDirectory]);
  run(pgCtl, ["-D", dataDirectory, "-o", `-k ${socketDirectory} -p ${port}`, "-w", "-t", "10", "start"]);
  databaseStarted = true;

  const connectionArgs = ["-X", "-v", "ON_ERROR_STOP=1", "-h", socketDirectory, "-p", port, "-U", "postgres", "-d", "postgres"];
  run(
    psql,
    connectionArgs,
    `
      create role anon;
      create role authenticated;
      create schema auth;
      create schema private;
      create extension if not exists pgcrypto;
      create table public.organizations (id uuid primary key);
      create table public.organization_memberships (organization_id uuid not null references public.organizations(id));
      create table public.profiles (id uuid primary key);
      create table public.horses (
        id uuid primary key,
        organization_id uuid not null references public.organizations(id),
        unique (id, organization_id)
      );
      create function private.lock_horse_operation(uuid, uuid)
      returns void language sql as $$ select; $$;
      set check_function_bodies = false;
    `,
  );

  run(psql, [...connectionArgs, "-c", "set check_function_bodies = false;", "-f", targetMigration]);
  const signature = run(
    psql,
    [...connectionArgs, "-Atc", "select pg_get_function_identity_arguments('public.upsert_horse_clinical_schedule'::regproc);"],
  ).trim();
  assert.equal(
    signature,
    "p_organization_id uuid, p_horse_id uuid, p_schedule_id uuid, p_schedule_type text, p_status text, p_title_en text, p_title_ar text, p_provider_en text, p_provider_ar text, p_instructions_en text, p_instructions_ar text, p_due_at timestamp with time zone, p_medication_name_en text, p_medication_name_ar text, p_dosage_en text, p_dosage_ar text, p_private_note text",
    "The clinical-schedule RPC must be created with its full, grantable signature",
  );

  console.log("Horse Welfare migration applied successfully to an isolated temporary PostgreSQL instance.");
} finally {
  if (databaseStarted) {
    spawnSync(pgCtl, ["-D", dataDirectory, "-m", "immediate", "stop"], { encoding: "utf8" });
  }
  await Promise.all([
    rm(dataDirectory, { recursive: true, force: true }),
    rm(socketDirectory, { recursive: true, force: true }),
  ]);
}