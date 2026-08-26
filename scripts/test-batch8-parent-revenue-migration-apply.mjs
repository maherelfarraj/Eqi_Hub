import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";

const root = resolve(import.meta.dirname, "..");
const dataDirectory = await mkdtemp(join(tmpdir(), "equivista-batch8-pg-"));
const socketDirectory = await mkdtemp(
  join(tmpdir(), "equivista-batch8-socket-"),
);
const postgresBinDirectories = [
  ...(process.env.PATH ?? "").split(":"),
  process.env.PG_BIN_DIR,
  "/usr/lib/postgresql/18/bin",
  "/usr/lib/postgresql/17/bin",
  "/usr/lib/postgresql/16/bin",
  "/usr/lib/postgresql/15/bin",
  "/usr/lib/postgresql/14/bin",
  "/usr/local/pgsql/bin",
].filter(Boolean);
const initdb = postgresBinDirectories
  .map((entry) => join(entry, "initdb"))
  .find(existsSync);
if (!initdb) {
  throw new Error(
    "PostgreSQL initdb is required to validate the isolated Batch 8 migration.",
  );
}

const postgresBin = dirname(initdb);
const pgCtl = join(postgresBin, "pg_ctl");
const psql = join(postgresBin, "psql");
const port = "55438";
const migration = resolve(
  root,
  "supabase/migrations/20260826170000_batch8_parent_membership_revenue_operations.sql",
);
let started = false;

function execute(command, args, input, expectSuccess = true) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    input,
    timeout: 60_000,
  });
  if (expectSuccess && result.status !== 0) {
    throw new Error(
      `${command} failed.\n${result.stdout ?? ""}\n${result.stderr ?? ""}`,
    );
  }
  return result;
}

function run(command, args, input) {
  return execute(command, args, input, true).stdout;
}

try {
  run(initdb, [
    "--no-locale",
    "--encoding=UTF8",
    "--username=postgres",
    "-D",
    dataDirectory,
  ]);
  run(pgCtl, [
    "-D",
    dataDirectory,
    "-o",
    `-c listen_addresses='' -k ${socketDirectory} -p ${port}`,
    "-w",
    "-t",
    "10",
    "start",
  ]);
  started = true;

  const connection = [
    "-X",
    "-v",
    "ON_ERROR_STOP=1",
    "-h",
    socketDirectory,
    "-p",
    port,
    "-U",
    "postgres",
    "-d",
    "postgres",
  ];

  run(
    psql,
    connection,
    `
      create role anon;
      create role authenticated;
      create schema auth;
      create schema private;
      create extension if not exists pgcrypto;

      create table public.organizations (
        id uuid primary key
      );
      create table public.profiles (
        id uuid primary key,
        full_name text
      );
      create table public.organization_memberships (
        id uuid primary key default gen_random_uuid(),
        organization_id uuid not null references public.organizations(id),
        user_id uuid not null references public.profiles(id),
        status text not null default 'active',
        unique (organization_id, user_id)
      );
      create table public.test_organization_roles (
        organization_id uuid not null references public.organizations(id),
        user_id uuid not null references public.profiles(id),
        role text not null,
        primary key (organization_id, user_id, role)
      );
      create table public.guardian_riders (
        organization_id uuid not null references public.organizations(id),
        guardian_id uuid not null references public.profiles(id),
        rider_id uuid not null references public.profiles(id),
        active boolean not null default true,
        relationship_type text not null default 'parent',
        verification_status text not null default 'verified',
        can_view_financials boolean not null default false,
        access_expires_at timestamptz,
        adulthood_review_on date,
        primary key (organization_id, guardian_id, rider_id)
      );
      create table public.membership_plans (
        id uuid primary key,
        organization_id uuid not null references public.organizations(id),
        unique (id, organization_id)
      );
      create table public.lessons (
        id uuid primary key,
        organization_id uuid not null references public.organizations(id),
        rider_id uuid not null,
        foreign key (organization_id, rider_id)
          references public.organization_memberships(organization_id, user_id),
        unique (id, organization_id)
      );
      create table public.invoices (
        id uuid primary key,
        organization_id uuid not null references public.organizations(id),
        user_id uuid not null references public.profiles(id),
        number text not null,
        status text not null,
        currency text not null,
        total_cents integer not null,
        issue_date date not null,
        due_date date
      );
      create table public.audit_events (
        id uuid primary key default gen_random_uuid(),
        organization_id uuid,
        source text not null,
        actor_user_id uuid,
        entity_type text not null,
        entity_id uuid,
        action text not null,
        before_data jsonb,
        after_data jsonb,
        occurred_at timestamptz not null
      );

      create function auth.uid()
      returns uuid language sql stable
      as $$
        select nullif(
          current_setting('request.jwt.claim.sub', true), ''
        )::uuid;
      $$;

      create function private.is_platform_admin()
      returns boolean language sql stable security definer
      set search_path = ''
      as $$
        select coalesce(
          current_setting('app.platform_admin', true) = 'true',
          false
        );
      $$;

      create function private.has_organization_role(
        p_organization_id uuid,
        p_roles text[]
      )
      returns boolean language sql stable security definer
      set search_path = ''
      as $$
        select exists (
          select 1
          from public.test_organization_roles as role_assignment
          where role_assignment.organization_id = p_organization_id
            and role_assignment.user_id = (select auth.uid())
            and role_assignment.role = any (p_roles)
        );
      $$;

      create function private.can_guardian_access_rider(
        p_organization_id uuid,
        p_guardian_id uuid,
        p_rider_id uuid
      )
      returns boolean language sql stable security definer
      set search_path = ''
      as $$
        select
          p_guardian_id = (select auth.uid())
          and exists (
            select 1
            from public.guardian_riders as guardian_link
            where guardian_link.organization_id = p_organization_id
              and guardian_link.guardian_id = p_guardian_id
              and guardian_link.rider_id = p_rider_id
              and guardian_link.active
              and guardian_link.verification_status = 'verified'
              and (
                guardian_link.access_expires_at is null
                or guardian_link.access_expires_at > now()
              )
              and (
                guardian_link.adulthood_review_on is null
                or guardian_link.adulthood_review_on > current_date
              )
          );
      $$;
    `,
  );

  run(psql, [...connection, "-f", migration]);

  run(
    psql,
    connection,
    `
      grant usage on schema public, private, auth to authenticated;
      grant select, insert, update, delete on all tables in schema public
        to authenticated;

      insert into public.organizations (id) values
        ('10000000-0000-0000-0000-000000000001'),
        ('20000000-0000-0000-0000-000000000001');

      insert into public.profiles (id, full_name) values
        ('30000000-0000-0000-0000-000000000001', 'Academy Admin'),
        ('30000000-0000-0000-0000-000000000002', 'Accountant'),
        ('30000000-0000-0000-0000-000000000003', 'Financial Guardian'),
        ('30000000-0000-0000-0000-000000000004', 'Restricted Guardian'),
        ('30000000-0000-0000-0000-000000000005', 'Batch Eight Rider'),
        ('30000000-0000-0000-0000-000000000006', 'Unrelated Guardian'),
        ('30000000-0000-0000-0000-000000000007', 'Other Tenant Rider'),
        ('30000000-0000-0000-0000-000000000008', 'Readiness Reviewer');

      insert into public.organization_memberships (
        organization_id, user_id
      ) values
        ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001'),
        ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002'),
        ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000003'),
        ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000004'),
        ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000005'),
        ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000006'),
        ('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000007');

      insert into public.test_organization_roles (
        organization_id, user_id, role
      ) values
        ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'academy_admin'),
        ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', 'accountant'),
        ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000003', 'guardian'),
        ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000004', 'guardian'),
        ('10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000006', 'guardian');

      insert into public.guardian_riders (
        organization_id,
        guardian_id,
        rider_id,
        relationship_type,
        verification_status,
        can_view_financials
      ) values
        (
          '10000000-0000-0000-0000-000000000001',
          '30000000-0000-0000-0000-000000000003',
          '30000000-0000-0000-0000-000000000005',
          'parent',
          'verified',
          true
        ),
        (
          '10000000-0000-0000-0000-000000000001',
          '30000000-0000-0000-0000-000000000004',
          '30000000-0000-0000-0000-000000000005',
          'parent',
          'verified',
          false
        );

      insert into public.batch8_feature_readiness (
        organization_id,
        readiness_status,
        enabled,
        reviewed_by,
        reviewed_at
      ) values (
        '10000000-0000-0000-0000-000000000001',
        'ready',
        true,
        '30000000-0000-0000-0000-000000000008',
        now()
      );

      insert into public.batch8_family_accounts (
        id, organization_id, display_name, created_by
      ) values
        (
          '40000000-0000-0000-0000-000000000001',
          '10000000-0000-0000-0000-000000000001',
          'Batch Eight Family',
          '30000000-0000-0000-0000-000000000001'
        ),
        (
          '40000000-0000-0000-0000-000000000002',
          '10000000-0000-0000-0000-000000000001',
          'Duplicate Link Guard Family',
          '30000000-0000-0000-0000-000000000001'
        );

      insert into public.batch8_family_account_riders (
        id,
        organization_id,
        family_account_id,
        guardian_id,
        rider_id,
        added_by
      ) values
        (
          '41000000-0000-0000-0000-000000000001',
          '10000000-0000-0000-0000-000000000001',
          '40000000-0000-0000-0000-000000000001',
          '30000000-0000-0000-0000-000000000003',
          '30000000-0000-0000-0000-000000000005',
          '30000000-0000-0000-0000-000000000001'
        ),
        (
          '41000000-0000-0000-0000-000000000002',
          '10000000-0000-0000-0000-000000000001',
          '40000000-0000-0000-0000-000000000001',
          '30000000-0000-0000-0000-000000000004',
          '30000000-0000-0000-0000-000000000005',
          '30000000-0000-0000-0000-000000000001'
        );

      insert into public.batch8_membership_packages (
        id,
        organization_id,
        family_account_id,
        rider_id,
        package_name,
        currency,
        status,
        starts_on,
        renewal_on,
        freeze_limit,
        missed_lesson_rule,
        waitlist_rule,
        makeup_credit_rule,
        created_by
      ) values (
        '50000000-0000-0000-0000-000000000001',
        '10000000-0000-0000-0000-000000000001',
        '40000000-0000-0000-0000-000000000001',
        '30000000-0000-0000-0000-000000000005',
        'Development Monthly',
        'USD',
        'active',
        current_date - 30,
        current_date + 30,
        2,
        'credit_if_academy_cancelled',
        'manual_offer',
        'eligible_exception',
        '30000000-0000-0000-0000-000000000001'
      );

      insert into public.lessons (id, organization_id, rider_id) values
        (
          '60000000-0000-0000-0000-000000000001',
          '10000000-0000-0000-0000-000000000001',
          '30000000-0000-0000-0000-000000000005'
        ),
        (
          '60000000-0000-0000-0000-000000000002',
          '10000000-0000-0000-0000-000000000001',
          '30000000-0000-0000-0000-000000000005'
        ),
        (
          '60000000-0000-0000-0000-000000000003',
          '10000000-0000-0000-0000-000000000001',
          '30000000-0000-0000-0000-000000000003'
        );
      insert into public.invoices (
        id,
        organization_id,
        user_id,
        number,
        status,
        currency,
        total_cents,
        issue_date,
        due_date
      ) values
        (
          '70000000-0000-0000-0000-000000000001',
          '10000000-0000-0000-0000-000000000001',
          '30000000-0000-0000-0000-000000000005',
          'INV-B8-001',
          'overdue',
          'USD',
          15000,
          current_date - 20,
          current_date - 10
        ),
        (
          '70000000-0000-0000-0000-000000000002',
          '10000000-0000-0000-0000-000000000001',
          '30000000-0000-0000-0000-000000000005',
          'INV-B8-002',
          'open',
          'EUR',
          5000,
          current_date - 2,
          current_date + 12
        );

      insert into public.batch8_attendance_exceptions (
        id,
        organization_id,
        membership_package_id,
        rider_id,
        lesson_id,
        exception_type,
        review_status,
        credit_eligible,
        idempotency_key,
        reason,
        occurred_at,
        reviewed_by,
        reviewed_at
      ) values (
        '80000000-0000-0000-0000-000000000001',
        '10000000-0000-0000-0000-000000000001',
        '50000000-0000-0000-0000-000000000001',
        '30000000-0000-0000-0000-000000000005',
        '60000000-0000-0000-0000-000000000001',
        'academy_cancelled',
        'approved',
        true,
        'batch8:exception:0001',
        'Academy cancellation approved for a make-up credit',
        now() - interval '1 day',
        '30000000-0000-0000-0000-000000000001',
        now() - interval '12 hours'
      );

      insert into public.batch8_waitlist_entries (
        id,
        organization_id,
        membership_package_id,
        rider_id,
        requested_for,
        status,
        priority,
        idempotency_key,
        reason,
        created_by
      ) values (
        '81000000-0000-0000-0000-000000000001',
        '10000000-0000-0000-0000-000000000001',
        '50000000-0000-0000-0000-000000000001',
        '30000000-0000-0000-0000-000000000005',
        current_date + 14,
        'queued',
        100,
        'batch8:waitlist:0001',
        'Requested an eligible future lesson',
        '30000000-0000-0000-0000-000000000001'
      );

      insert into public.batch8_payment_link_intents (
        id,
        organization_id,
        family_account_id,
        rider_id,
        invoice_id,
        status,
        amount_cents,
        currency,
        processor,
        captured_cents,
        idempotency_key,
        requested_by,
        prepared_at,
        expires_at
      ) values (
        '82000000-0000-0000-0000-000000000001',
        '10000000-0000-0000-0000-000000000001',
        '40000000-0000-0000-0000-000000000001',
        '30000000-0000-0000-0000-000000000005',
        '70000000-0000-0000-0000-000000000001',
        'prepared',
        15000,
        'USD',
        'none',
        0,
        'batch8:payment-link:0001',
        '30000000-0000-0000-0000-000000000001',
        now(),
        now() + interval '7 days'
      );

      insert into public.batch8_collection_cases (
        id,
        organization_id,
        family_account_id,
        rider_id,
        invoice_id,
        payment_link_intent_id,
        status,
        risk_level,
        opened_at,
        next_review_at,
        created_by
      ) values (
        '83000000-0000-0000-0000-000000000001',
        '10000000-0000-0000-0000-000000000001',
        '40000000-0000-0000-0000-000000000001',
        '30000000-0000-0000-0000-000000000005',
        '70000000-0000-0000-0000-000000000001',
        '82000000-0000-0000-0000-000000000001',
        'link_prepared',
        'medium',
        now() - interval '10 days',
        now() + interval '1 day',
        '30000000-0000-0000-0000-000000000001'
      );

      insert into public.batch8_renewal_signals (
        id,
        organization_id,
        membership_package_id,
        rider_id,
        renewal_on,
        risk_level,
        reason_code,
        status,
        generated_at
      ) values (
        '84000000-0000-0000-0000-000000000001',
        '10000000-0000-0000-0000-000000000001',
        '50000000-0000-0000-0000-000000000001',
        '30000000-0000-0000-0000-000000000005',
        current_date + 30,
        'high',
        'missed_lessons',
        'open',
        now()
      );

      insert into public.batch8_revenue_daily (
        organization_id,
        business_date,
        currency,
        collected_cents,
        outstanding_cents,
        overdue_cents,
        active_memberships,
        renewals_next_30_days,
        high_risk_renewals,
        generated_at,
        generated_by
      ) values
        (
          '10000000-0000-0000-0000-000000000001',
          current_date,
          'USD',
          450000,
          15000,
          15000,
          1,
          1,
          1,
          now(),
          '30000000-0000-0000-0000-000000000001'
        ),
        (
          '10000000-0000-0000-0000-000000000001',
          current_date,
          'EUR',
          220000,
          5000,
          0,
          1,
          0,
          0,
          now(),
          '30000000-0000-0000-0000-000000000001'
        );
    `,
  );

  const queryAs = (userId, sql) => {
    const output = run(
      psql,
      [...connection, "-At"],
      `
        select set_config('request.jwt.claim.sub', '${userId}', false);
        set role authenticated;
        ${sql}
      `,
    );
    return output.trim().split("\n").at(-1) ?? "";
  };

  const failAs = (userId, sql) =>
    execute(
      psql,
      [...connection, "-At"],
      `
        select set_config('request.jwt.claim.sub', '${userId}', false);
        set role authenticated;
        ${sql}
      `,
      false,
    );

  const admin = "30000000-0000-0000-0000-000000000001";
  const accountant = "30000000-0000-0000-0000-000000000002";
  const financialGuardian = "30000000-0000-0000-0000-000000000003";
  const restrictedGuardian = "30000000-0000-0000-0000-000000000004";
  const unrelatedGuardian = "30000000-0000-0000-0000-000000000006";
  const otherTenantRider = "30000000-0000-0000-0000-000000000007";
  const organization = "10000000-0000-0000-0000-000000000001";
  const otherOrganization = "20000000-0000-0000-0000-000000000001";
  const membership = "50000000-0000-0000-0000-000000000001";

  assert.equal(
    queryAs(
      financialGuardian,
      `select public.get_batch8_availability('${organization}');`,
    ),
    "t",
    "A member of a ready organization must see Batch 8 as available.",
  );
  assert.equal(
    queryAs(
      otherTenantRider,
      `select public.get_batch8_availability('${otherOrganization}');`,
    ),
    "f",
    "A member of an unready organization must receive a typed disabled result.",
  );
  assert.notEqual(
    failAs(
      admin,
      `select public.get_batch8_availability('${otherOrganization}');`,
    ).status,
    0,
    "Availability must not reveal another organization's readiness.",
  );

  const financialFamily = JSON.parse(
    queryAs(
      financialGuardian,
      `select public.get_batch8_family_operations('${organization}')::text;`,
    ),
  );
  assert.equal(financialFamily.riders.length, 1);
  assert.equal(financialFamily.riders[0].financialAccess, true);
  assert.deepEqual(
    financialFamily.riders[0].financials.map(
      ({ currency, outstandingBalance, overdueAmount }) => ({
        currency,
        outstandingBalance,
        overdueAmount,
      }),
    ),
    [
      { currency: "EUR", outstandingBalance: 5000, overdueAmount: 0 },
      { currency: "USD", outstandingBalance: 15000, overdueAmount: 15000 },
    ],
    "Guardian rider balances must remain separated by currency.",
  );
  assert.deepEqual(
    financialFamily.familySummary.balances.map(
      ({ currency, outstandingBalance }) => ({
        currency,
        outstandingBalance,
      }),
    ),
    [
      { currency: "EUR", outstandingBalance: 5000 },
      { currency: "USD", outstandingBalance: 15000 },
    ],
    "Family totals must remain separated by currency.",
  );

  const restrictedFamily = JSON.parse(
    queryAs(
      restrictedGuardian,
      `select public.get_batch8_family_operations('${organization}')::text;`,
    ),
  );
  assert.equal(restrictedFamily.riders.length, 1);
  assert.equal(restrictedFamily.riders[0].financialAccess, false);
  assert.deepEqual(restrictedFamily.riders[0].financials, []);
  assert.deepEqual(restrictedFamily.familySummary.balances, []);

  const unrelatedFamily = JSON.parse(
    queryAs(
      unrelatedGuardian,
      `select public.get_batch8_family_operations('${organization}')::text;`,
    ),
  );
  assert.deepEqual(unrelatedFamily.riders, []);

  const revenue = JSON.parse(
    queryAs(
      accountant,
      `select public.get_batch8_revenue_operations('${organization}')::text;`,
    ),
  );
  assert.deepEqual(
    revenue.summaries.map(({ currency, outstanding, overdue }) => ({
      currency,
      outstanding,
      overdue,
    })),
    [
      { currency: "EUR", outstanding: 5000, overdue: 0 },
      { currency: "USD", outstanding: 15000, overdue: 15000 },
    ],
    "Revenue snapshots must include every currency for the latest business date.",
  );

  const duplicateLink = execute(
    psql,
    [...connection, "-v", "ON_ERROR_STOP=1"],
    `
      insert into public.batch8_family_account_riders (
        id,
        organization_id,
        family_account_id,
        guardian_id,
        rider_id,
        added_by
      ) values (
        '41000000-0000-0000-0000-000000000099',
        '${organization}',
        '40000000-0000-0000-0000-000000000002',
        '${financialGuardian}',
        '30000000-0000-0000-0000-000000000005',
        '${admin}'
      );
    `,
    false,
  );
  assert.notEqual(
    duplicateLink.status,
    0,
    "A guardian/rider pair must not be linked to multiple family accounts.",
  );
  assert.match(
    duplicateLink.stderr,
    /batch8_family_account_riders_one_family_unique/,
  );
  assert.notEqual(
    failAs(
      financialGuardian,
      `select public.get_batch8_revenue_operations('${organization}');`,
    ).status,
    0,
    "Guardians must not access the staff revenue RPC.",
  );
  assert.notEqual(
    failAs(
      admin,
      `select public.get_batch8_revenue_operations('${otherOrganization}');`,
    ).status,
    0,
    "An absent readiness row must keep Batch 8 disabled.",
  );

  assert.notEqual(
    failAs(
      admin,
      `
        select public.record_batch8_attendance_exception(
          '${membership}',
          '60000000-0000-0000-0000-000000000003',
          'academy_cancelled',
          'A different rider lesson must fail closed',
          'batch8:exception:cross-rider:0001',
          now()
        );
      `,
    ).status,
    0,
    "Attendance exceptions must belong to the membership rider's lesson.",
  );

  const recordedException = queryAs(
    admin,
    `
      select public.record_batch8_attendance_exception(
        '${membership}',
        '60000000-0000-0000-0000-000000000002',
        'academy_cancelled',
        'Academy cancellation requires deterministic review',
        'batch8:exception:record:0002',
        now()
      );
    `,
  );
  const retriedRecordedException = queryAs(
    admin,
    `
      select public.record_batch8_attendance_exception(
        '${membership}',
        '60000000-0000-0000-0000-000000000002',
        'academy_cancelled',
        'Academy cancellation requires deterministic review',
        'batch8:exception:record:0002',
        now()
      );
    `,
  );
  assert.equal(recordedException, retriedRecordedException);

  const reviewedExceptionEvent = queryAs(
    admin,
    `
      select public.review_batch8_attendance_exception(
        '${recordedException}',
        'approved',
        true,
        'Eligible academy cancellation approved for credit',
        'batch8:exception:review:0002',
        now()
      );
    `,
  );
  const retriedReviewedExceptionEvent = queryAs(
    admin,
    `
      select public.review_batch8_attendance_exception(
        '${recordedException}',
        'approved',
        true,
        'Eligible academy cancellation approved for credit',
        'batch8:exception:review:0002',
        now()
      );
    `,
  );
  assert.equal(reviewedExceptionEvent, retriedReviewedExceptionEvent);

  const waitlistEntry = queryAs(
    admin,
    `
      select public.create_batch8_waitlist_entry(
        '${membership}',
        current_date + 20,
        50,
        'Eligible rider requested a future lesson',
        'batch8:waitlist:create:0002',
        now()
      );
    `,
  );
  const retriedWaitlistEntry = queryAs(
    admin,
    `
      select public.create_batch8_waitlist_entry(
        '${membership}',
        current_date + 20,
        50,
        'Eligible rider requested a future lesson',
        'batch8:waitlist:create:0002',
        now()
      );
    `,
  );
  assert.equal(waitlistEntry, retriedWaitlistEntry);

  const waitlistOfferEvent = queryAs(
    admin,
    `
      select public.apply_batch8_waitlist_transition(
        '${waitlistEntry}',
        'offered',
        'An eligible lesson place is available',
        'batch8:waitlist:offer:0002',
        now(),
        now() + interval '1 day'
      );
    `,
  );
  const retriedWaitlistOfferEvent = queryAs(
    admin,
    `
      select public.apply_batch8_waitlist_transition(
        '${waitlistEntry}',
        'offered',
        'An eligible lesson place is available',
        'batch8:waitlist:offer:0002',
        now(),
        now() + interval '1 day'
      );
    `,
  );
  assert.equal(waitlistOfferEvent, retriedWaitlistOfferEvent);

  const waitlistAcceptedEvent = queryAs(
    admin,
    `
      select public.apply_batch8_waitlist_transition(
        '${waitlistEntry}',
        'accepted',
        'Guardian accepted the available lesson place',
        'batch8:waitlist:accept:0002',
        now(),
        null
      );
    `,
  );
  const retriedWaitlistAcceptedEvent = queryAs(
    admin,
    `
      select public.apply_batch8_waitlist_transition(
        '${waitlistEntry}',
        'accepted',
        'Guardian accepted the available lesson place',
        'batch8:waitlist:accept:0002',
        now(),
        null
      );
    `,
  );
  assert.equal(waitlistAcceptedEvent, retriedWaitlistAcceptedEvent);
  assert.equal(
    queryAs(
      admin,
      `select status from public.batch8_waitlist_entries where id = '${waitlistEntry}';`,
    ),
    "accepted",
  );

  const frozenEvent = queryAs(
    admin,
    `
      select public.apply_batch8_membership_transition(
        '${membership}',
        'frozen',
        'Guardian requested an approved temporary freeze',
        'batch8:transition:freeze:0001',
        now(),
        current_date + 7
      );
    `,
  );
  const retriedFrozenEvent = queryAs(
    admin,
    `
      select public.apply_batch8_membership_transition(
        '${membership}',
        'frozen',
        'Guardian requested an approved temporary freeze',
        'batch8:transition:freeze:0001',
        now(),
        current_date + 7
      );
    `,
  );
  assert.equal(frozenEvent, retriedFrozenEvent);
  assert.equal(
    queryAs(
      admin,
      `
        select status || ':' || freeze_count
        from public.batch8_membership_packages
        where id = '${membership}';
      `,
    ),
    "frozen:1",
  );
  assert.notEqual(
    failAs(
      admin,
      `
        select public.apply_batch8_membership_transition(
          '${membership}',
          'past_due',
          'Invalid transition must fail closed',
          'batch8:transition:invalid:0001',
          now(),
          null
        );
      `,
    ).status,
    0,
  );

  assert.notEqual(
    failAs(
      admin,
      `
        select public.issue_batch8_makeup_credit(
          '80000000-0000-0000-0000-000000000001',
          1,
          now() + interval '30 days',
          'A credit cannot predate the approved review',
          'batch8:credit:early:0001',
          now() - interval '13 hours'
        );
      `,
    ).status,
    0,
    "A credit grant must not predate its approved review.",
  );
  assert.notEqual(
    failAs(
      admin,
      `
        select public.issue_batch8_makeup_credit(
          '80000000-0000-0000-0000-000000000001',
          1,
          now() + interval '30 days',
          'A future credit grant must fail closed',
          'batch8:credit:future:0001',
          now() + interval '10 minutes'
        );
      `,
    ).status,
    0,
    "A credit grant must not be future-dated beyond the allowed skew.",
  );

  const creditId = queryAs(
    admin,
    `
      select public.issue_batch8_makeup_credit(
        '80000000-0000-0000-0000-000000000001',
        1,
        now() + interval '30 days',
        'Approved academy cancellation make-up credit',
        'batch8:credit:issue:0001',
        now()
      );
    `,
  );
  const retriedCreditId = queryAs(
    admin,
    `
      select public.issue_batch8_makeup_credit(
        '80000000-0000-0000-0000-000000000001',
        1,
        now() + interval '30 days',
        'Approved academy cancellation make-up credit',
        'batch8:credit:issue:0001',
        now()
      );
    `,
  );
  assert.equal(creditId, retriedCreditId);

  assert.notEqual(
    failAs(
      admin,
      `
        select public.consume_batch8_makeup_credit(
          '${membership}',
          'Consumption cannot predate the credit grant',
          'batch8:credit:consume-early:0001',
          now() - interval '1 minute'
        );
      `,
    ).status,
    0,
    "Credit consumption must not predate the selected credit grant.",
  );
  assert.notEqual(
    failAs(
      admin,
      `
        select public.consume_batch8_makeup_credit(
          '${membership}',
          'Future consumption must fail closed',
          'batch8:credit:consume-future:0001',
          now() + interval '10 minutes'
        );
      `,
    ).status,
    0,
    "Credit consumption must not be future-dated beyond the allowed skew.",
  );

  const consumedEvent = queryAs(
    admin,
    `
      select public.consume_batch8_makeup_credit(
        '${membership}',
        'Applied to an eligible replacement lesson',
        'batch8:credit:consume:0001',
        now()
      );
    `,
  );
  const retriedConsumedEvent = queryAs(
    admin,
    `
      select public.consume_batch8_makeup_credit(
        '${membership}',
        'Applied to an eligible replacement lesson',
        'batch8:credit:consume:0001',
        now()
      );
    `,
  );
  assert.equal(consumedEvent, retriedConsumedEvent);
  assert.equal(
    queryAs(
      admin,
      `select remaining_units from public.batch8_makeup_credits where id = '${creditId}';`,
    ),
    "0",
  );

  assert.equal(
    queryAs(
      financialGuardian,
      "select count(*) from public.batch8_membership_events;",
    ),
    "0",
    "Guardians must not receive raw lifecycle reasons or metadata.",
  );
  assert.equal(
    queryAs(
      financialGuardian,
      "select count(*) from public.batch8_collection_cases;",
    ),
    "0",
    "Guardians must receive only redacted financial aggregates.",
  );

  assert.notEqual(
    failAs(
      admin,
      `
        insert into public.batch8_family_accounts (
          organization_id, display_name
        ) values ('${organization}', 'Direct write must fail');
      `,
    ).status,
    0,
    "Authenticated clients must not have a direct Batch 8 insert policy.",
  );

  assert.notEqual(
    execute(
      psql,
      connection,
      `
        update public.batch8_membership_events
        set reason = 'History rewrite'
        where id = '${frozenEvent}';
      `,
      false,
    ).status,
    0,
    "Membership history must be append-only even for privileged database roles.",
  );

  assert.notEqual(
    execute(
      psql,
      connection,
      `
        insert into public.batch8_payment_link_intents (
          organization_id,
          family_account_id,
          rider_id,
          invoice_id,
          status,
          amount_cents,
          currency,
          processor,
          captured_cents,
          idempotency_key
        ) values (
          '${organization}',
          '40000000-0000-0000-0000-000000000001',
          '30000000-0000-0000-0000-000000000005',
          '70000000-0000-0000-0000-000000000001',
          'draft',
          15000,
          'USD',
          'stripe',
          15000,
          'batch8:payment-link:reject:0001'
        );
      `,
      false,
    ).status,
    0,
    "Payment-link foundations must reject processors and captured amounts.",
  );

  console.log(
    "Batch 8 Parent Revenue migration applied and passed isolated PostgreSQL boundary tests.",
  );
} finally {
  if (started) {
    spawnSync(
      pgCtl,
      ["-D", dataDirectory, "-m", "immediate", "stop"],
      { encoding: "utf8" },
    );
  }
  await Promise.all([
    rm(dataDirectory, { recursive: true, force: true }),
    rm(socketDirectory, { recursive: true, force: true }),
  ]);
}