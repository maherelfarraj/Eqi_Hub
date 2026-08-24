import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";

const root = resolve(import.meta.dirname, "..");
const dataDirectory = await mkdtemp(join(tmpdir(), "equivista-academy-pg-"));
const socketDirectory = await mkdtemp(join(tmpdir(), "equivista-academy-socket-"));
const initdb = (process.env.PATH ?? "").split(":").map((entry) => join(entry, "initdb")).find(existsSync);
if (!initdb) throw new Error("PostgreSQL initdb is required to validate the isolated Batch 6 migration.");

const postgresBin = dirname(initdb);
const pgCtl = join(postgresBin, "pg_ctl");
const psql = join(postgresBin, "psql");
const port = "55433";
const migration = resolve(root, "supabase/migrations/20260826090000_staff_arena_academy_operations.sql");
let started = false;

function run(command, args, input) {
  const result = spawnSync(command, args, { cwd: root, encoding: "utf8", input, timeout: 60_000 });
  if (result.status !== 0) throw new Error(`${command} failed.\n${result.stdout ?? ""}\n${result.stderr ?? ""}`);
  return result.stdout;
}

function runAsync(command, args, input) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (status) => resolve({ status, stdout, stderr }));
    if (input) child.stdin.end(input);
    else child.stdin.end();
  });
}

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

try {
  run(initdb, ["--no-locale", "--encoding=UTF8", "--username=postgres", "-D", dataDirectory]);
  run(pgCtl, ["-D", dataDirectory, "-o", `-k ${socketDirectory} -p ${port}`, "-w", "-t", "10", "start"]);
  started = true;
  const connection = ["-X", "-v", "ON_ERROR_STOP=1", "-h", socketDirectory, "-p", port, "-U", "postgres", "-d", "postgres"];
  run(psql, connection, `
    create role anon; create role authenticated;
    create schema auth; create schema private; create extension if not exists pgcrypto;
    create table public.organizations (id uuid primary key);
    create table public.organization_memberships (organization_id uuid not null references public.organizations(id));
    create table public.profiles (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select '00000000-0000-0000-0000-000000000001'::uuid; $$;
    create function private.is_platform_admin() returns boolean language sql as $$ select false; $$;
    create function private.has_organization_role(uuid, text[]) returns boolean language sql as $$ select true; $$;
    set check_function_bodies = false;
  `);
  run(psql, [...connection, "-c", "set check_function_bodies = false;", "-f", migration]);
  const signature = run(psql, [...connection, "-Atc", "select pg_get_function_identity_arguments('public.upsert_academy_resource_booking'::regproc);"]).trim();
  assert.equal(signature, "p_organization_id uuid, p_booking_id uuid, p_resource_id uuid, p_staff_profile_id uuid, p_lesson_id uuid, p_status text, p_starts_at timestamp with time zone, p_ends_at timestamp with time zone, p_purpose_en text, p_purpose_ar text");
  const rls = run(psql, [...connection, "-Atc", "select relrowsecurity from pg_class where oid = 'public.academy_payroll_calculations'::regclass;"]).trim();
  assert.equal(rls, "t", "Payroll calculations must be protected by RLS.");
  run(psql, connection, `
    insert into public.organizations (id) values
      ('10000000-0000-0000-0000-000000000001'), ('20000000-0000-0000-0000-000000000001');
    insert into public.profiles (id) values
      ('00000000-0000-0000-0000-000000000001'),
      ('30000000-0000-0000-0000-000000000001'), ('40000000-0000-0000-0000-000000000001');
    insert into public.academy_operations_feature_flags (organization_id, enabled) values
      ('10000000-0000-0000-0000-000000000001', true), ('20000000-0000-0000-0000-000000000001', true);
    do $$
    declare b_staff uuid;
    begin
      b_staff := public.upsert_academy_staff_profile(
        '20000000-0000-0000-0000-000000000001', null, '40000000-0000-0000-0000-000000000001',
        'coach', 'Coach B', 'المدرب ب', true, null
      );
      begin
        perform public.upsert_academy_staff_profile(
          '10000000-0000-0000-0000-000000000001', b_staff, '30000000-0000-0000-0000-000000000001',
          'coach', 'Coach A', 'المدرب أ', true, null
        );
        raise exception 'cross-tenant staff profile update was not rejected';
      exception when insufficient_privilege then
        null;
      end;
    end;
    $$;
  `);
  run(psql, connection, `
    insert into public.academy_staff_profiles (
      id, organization_id, user_id, staff_type, display_name_en, display_name_ar, active, created_by, updated_by
    ) values (
      '50000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
      '30000000-0000-0000-0000-000000000001', 'coach', 'Concurrent Coach', 'مدرب متزامن', true,
      '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001'
    );
    insert into public.academy_resources (
      id, organization_id, resource_type, name_en, name_ar, capacity, active, created_by, updated_by
    ) values (
      '60000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
      'arena', 'Concurrent Arena', 'ساحة متزامنة', 10, true,
      '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001'
    );
  `);

  const concurrentShift = runAsync(psql, [...connection, "-c", `
    begin;
    insert into public.academy_staff_shifts (
      id, organization_id, staff_profile_id, status, starts_at, ends_at, duties_en, duties_ar, created_by, updated_by
    ) values (
      '70000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
      '50000000-0000-0000-0000-000000000001', 'scheduled', '2030-01-01T09:00:00Z', '2030-01-01T11:00:00Z',
      'Concurrent shift one', 'المناوبة الأولى', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001'
    );
    select pg_sleep(1);
    commit;
  `]);
  await wait(150);
  const overlappingShift = runAsync(psql, [...connection, "-c", `
    insert into public.academy_staff_shifts (
      id, organization_id, staff_profile_id, status, starts_at, ends_at, duties_en, duties_ar, created_by, updated_by
    ) values (
      '70000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001',
      '50000000-0000-0000-0000-000000000001', 'scheduled', '2030-01-01T10:00:00Z', '2030-01-01T12:00:00Z',
      'Concurrent shift two', 'المناوبة الثانية', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001'
    );
  `]);
  const shiftResults = await Promise.all([concurrentShift, overlappingShift]);
  assert.equal(shiftResults.filter((result) => result.status === 0).length, 1, "Concurrent overlapping staff shifts must accept exactly one insert.");

  const concurrentBooking = runAsync(psql, [...connection, "-c", `
    begin;
    insert into public.academy_resource_bookings (
      id, organization_id, resource_id, status, starts_at, ends_at, purpose_en, purpose_ar, created_by, updated_by
    ) values (
      '80000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
      '60000000-0000-0000-0000-000000000001', 'confirmed', '2030-01-02T09:00:00Z', '2030-01-02T11:00:00Z',
      'Concurrent booking one', 'الحجز الأول', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001'
    );
    select pg_sleep(1);
    commit;
  `]);
  await wait(150);
  const overlappingBooking = runAsync(psql, [...connection, "-c", `
    insert into public.academy_resource_bookings (
      id, organization_id, resource_id, status, starts_at, ends_at, purpose_en, purpose_ar, created_by, updated_by
    ) values (
      '80000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001',
      '60000000-0000-0000-0000-000000000001', 'confirmed', '2030-01-02T10:00:00Z', '2030-01-02T12:00:00Z',
      'Concurrent booking two', 'الحجز الثاني', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001'
    );
  `]);
  const bookingResults = await Promise.all([concurrentBooking, overlappingBooking]);
  assert.equal(bookingResults.filter((result) => result.status === 0).length, 1, "Concurrent overlapping resource bookings must accept exactly one insert.");
  console.log("Academy Operations migration applied successfully to an isolated temporary PostgreSQL instance.");
} finally {
  if (started) spawnSync(pgCtl, ["-D", dataDirectory, "-m", "immediate", "stop"], { encoding: "utf8" });
  await Promise.all([rm(dataDirectory, { recursive: true, force: true }), rm(socketDirectory, { recursive: true, force: true })]);
}