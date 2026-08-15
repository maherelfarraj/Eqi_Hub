import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const migrationPath = resolve(
  root,
  "supabase/migrations/20260815135957_batch4_medical_waiver_gate.sql",
);
const rollbackPath = resolve(
  root,
  "supabase/rollback/20260815135957_batch4_medical_waiver_gate_rollback.sql",
);

const tables = [
  "rider_safety_profiles",
  "compliance_document_templates",
  "rider_compliance_submissions",
  "compliance_signature_receipts",
  "compliance_audit_events",
];

function transactional(sql) {
  return /^\s*(?:--[^\n]*\n)*begin;/i.test(sql) && /commit;\s*$/i.test(sql);
}

export function validateMedicalWaiverGate(migration, rollback) {
  const errors = [];
  if (!transactional(migration)) errors.push("migration must be transactional");
  if (!transactional(rollback)) errors.push("rollback must be transactional");
  if (/auth\.role\s*\(/i.test(`${migration}\n${rollback}`))
    errors.push("must not use deprecated auth.role()");
  if (/(?<![.\w])digest\s*\(/i.test(migration))
    errors.push("pgcrypto digest() must be schema-qualified");
  if ((migration.match(/extensions\.digest\s*\(/gi) ?? []).length < 2)
    errors.push("all Batch 4 pgcrypto digest() calls must use extensions.digest()");
  if (/using\s*\(\s*true\s*\)|with check\s*\(\s*true\s*\)/i.test(migration))
    errors.push("RLS policies must not be unconditional");

  for (const table of tables) {
    for (const [label, guard, source] of [
      [
        "create",
        new RegExp(`create table public\\.${table}\\s*\\(`, "i"),
        migration,
      ],
      [
        "RLS",
        new RegExp(
          `alter table public\\.${table} enable row level security;`,
          "i",
        ),
        migration,
      ],
      [
        "revoke",
        new RegExp(
          `revoke all on table public\\.${table} from public, anon, authenticated;`,
          "i",
        ),
        migration,
      ],
      [
        "grant",
        new RegExp(
          `grant select on table public\\.${table} to authenticated;`,
          "i",
        ),
        migration,
      ],
      [
        "rollback",
        new RegExp(`drop table if exists public\\.${table};`, "i"),
        rollback,
      ],
    ]) {
      if (!guard.test(source)) errors.push(`missing ${table} ${label} guard`);
    }
  }

  const guards = [
    [/date_of_birth date not null/, "date of birth is required"],
    [/content_hash text not null/, "versioned document hash is required"],
    [
      /requires_guardian_when_minor boolean not null/,
      "minor guardian rule is required",
    ],
    [/private\.rider_is_minor/, "minor calculation helper is required"],
    [
      /coalesce\([\s\S]*?true[\s\S]*?\);/,
      "missing birth date must fail closed",
    ],
    [
      /private\.can_read_rider_compliance/,
      "restricted compliance read helper is required",
    ],
    [
      /link\.legal_authority[\s\S]*?link\.relationship_type <> 'supporter'/,
      "supporters must not read or establish medical compliance",
    ],
    [/private\.rider_compliance_ready/, "readiness helper is required"],
    [
      /count\(distinct template\.document_type\)[\s\S]*?\) = 3/,
      "readiness requires all three active document types",
    ],
    [
      /signature\.document_hash = template\.content_hash/,
      "readiness must bind the signed document hash",
    ],
    [
      /submission\.template_version = template\.version/,
      "readiness must bind the active template version",
    ],
    [
      /submission\.valid_until > p_at/,
      "expired signatures must fail readiness",
    ],
    [
      /submission\.minor_at_signing = private\.rider_is_minor/,
      "birth-date corrections must invalidate the wrong signer capacity",
    ],
    [
      /medical_review_status in \('not_required', 'approved'\)/,
      "pending medical review must fail readiness",
    ],
    [
      /A verified legal guardian must sign for a minor/,
      "minor self-signing must be rejected",
    ],
    [
      /An adult rider must sign their own document/,
      "adult signature ownership is required",
    ],
    [
      /create trigger compliance_signature_immutable/,
      "signature receipts must be immutable",
    ],
    [
      /create trigger compliance_audit_immutable/,
      "audit events must be immutable",
    ],
    [
      /create trigger lessons_require_compliance/,
      "lesson readiness trigger is required",
    ],
    [
      /create trigger memberships_require_compliance/,
      "renewal readiness trigger is required",
    ],
    [
      /create function public\.get_rider_compliance_portal/,
      "compliance portal RPC is required",
    ],
    [
      /create function public\.sign_compliance_document/,
      "signature RPC is required",
    ],
    [
      /create function public\.review_medical_declaration/,
      "medical review RPC is required",
    ],
    [
      /create function public\.get_compliance_admin_summary/,
      "admin summary RPC is required",
    ],
    [
      /Batch 4 rollback refused: compliance evidence exists/,
      "rollback must preserve compliance evidence",
    ],
  ];
  for (const [guard, message] of guards)
    if (!guard.test(`${migration}\n${rollback}`)) errors.push(message);

  for (const index of [
    "rider_safety_profiles_rider_id_idx",
    "compliance_templates_published_by_idx",
    "rider_compliance_rider_id_idx",
    "rider_compliance_template_idx",
    "rider_compliance_medical_reviewer_idx",
    "compliance_signature_rider_id_idx",
    "compliance_signature_signer_idx",
    "compliance_audit_rider_id_idx",
    "compliance_audit_actor_idx",
    "compliance_audit_submission_idx",
  ]) {
    if (
      !new RegExp(`create index ${index}\\s+on public\\.`, "i").test(migration)
    )
      errors.push(`missing foreign-key index: ${index}`);
  }
  if (
    !/create index rider_compliance_template_idx\s+on public\.rider_compliance_submissions\s*\(template_id,\s*organization_id\);/i.test(
      migration,
    )
  )
    errors.push("rider compliance template foreign key requires a composite index");

  const portal =
    migration.match(
      /create function public\.get_rider_compliance_portal[\s\S]*?\$\$;/i,
    )?.[0] ?? "";
  if (
    /lesson_development_private_notes|provider_token|payment_method/i.test(
      portal,
    )
  )
    errors.push(
      "compliance portal must not couple to private coach notes or payment credentials",
    );

  return errors;
}

if (process.argv[1] === import.meta.filename) {
  const [migration, rollback] = await Promise.all([
    readFile(migrationPath, "utf8"),
    readFile(rollbackPath, "utf8"),
  ]);
  const errors = validateMedicalWaiverGate(migration, rollback);
  if (errors.length) throw new Error(errors.join("\n"));
  console.log(
    "Verified versioned compliance documents, guardian signatures, immutable receipts, readiness gates, RLS, grants, indexes, and guarded rollback",
  );
}
