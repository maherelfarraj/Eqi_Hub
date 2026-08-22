export const academyOnboardingRoles = [
  "coach",
  "rider",
  "guardian",
  "horse_owner",
  "stable_manager",
  "accountant",
  "competition_manager",
];

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseCsvRows(source) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quoted) {
      if (character === '"' && source[index + 1] === '"') {
        value += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        value += character;
      }
    } else if (character === '"' && value.length === 0) {
      quoted = true;
    } else if (character === ",") {
      row.push(value);
      value = "";
    } else if (character === "\n") {
      row.push(value.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      value = "";
    } else {
      value += character;
    }
  }

  if (quoted) throw new Error("CSV contains an unterminated quoted value");
  if (value.length > 0 || row.length > 0) {
    row.push(value.replace(/\r$/, ""));
    rows.push(row);
  }
  return rows.filter((candidate) => candidate.some((cell) => cell.trim()));
}

function escapeCsv(value) {
  const text = String(value ?? "");
  const spreadsheetSafe = /^[\t\r\n ]*[=+\-@]/.test(text) ? `'${text}` : text;
  return /[",\r\n]/.test(spreadsheetSafe)
    ? `"${spreadsheetSafe.replaceAll('"', '""')}"`
    : spreadsheetSafe;
}

export function parseAcademyOnboardingCsv(source) {
  const errors = [];
  let rows;
  try {
    rows = parseCsvRows(String(source ?? "").replace(/^\uFEFF/, ""));
  } catch (error) {
    return {
      entries: [],
      errors: [{ row: 0, field: "file", message: error.message }],
    };
  }

  if (rows.length === 0) {
    return {
      entries: [],
      errors: [{ row: 0, field: "file", message: "CSV is empty" }],
    };
  }

  const headers = rows[0].map((header) => header.trim().toLowerCase());
  const indexes = Object.fromEntries(
    ["email", "full_name", "roles"].map((header) => [
      header,
      headers.indexOf(header),
    ]),
  );
  for (const [header, index] of Object.entries(indexes)) {
    if (index < 0) {
      errors.push({
        row: 1,
        field: "file",
        message: `Missing required ${header} header`,
      });
    }
  }
  if (errors.length) return { entries: [], errors };

  if (rows.length - 1 > 100) {
    errors.push({
      row: 0,
      field: "file",
      message: "A batch may contain at most 100 people",
    });
  }

  const seen = new Set();
  const entries = rows.slice(1, 101).map((cells, index) => {
    const rowNumber = index + 2;
    const email = (cells[indexes.email] ?? "").trim().toLowerCase();
    const fullName = (cells[indexes.full_name] ?? "").trim();
    const roles = Array.from(
      new Set(
        (cells[indexes.roles] ?? "")
          .split(/[|;]/)
          .map((role) => role.trim().toLowerCase())
          .filter(Boolean),
      ),
    ).sort();

    if (!emailPattern.test(email) || email.length > 254) {
      errors.push({
        row: rowNumber,
        field: "email",
        message: "Enter a valid email address",
      });
    } else if (seen.has(email)) {
      errors.push({
        row: rowNumber,
        field: "email",
        message: "Email is duplicated in this file",
      });
    } else {
      seen.add(email);
    }

    if (fullName.length < 2 || fullName.length > 160) {
      errors.push({
        row: rowNumber,
        field: "full_name",
        message: "Full name must contain 2 to 160 characters",
      });
    }
    if (roles.length === 0) {
      errors.push({
        row: rowNumber,
        field: "roles",
        message: "At least one role is required",
      });
    }
    const unsupported = roles.filter(
      (role) => !academyOnboardingRoles.includes(role),
    );
    if (unsupported.length) {
      errors.push({
        row: rowNumber,
        field: "roles",
        message: `Unsupported role: ${unsupported.join(", ")}`,
      });
    }

    return { email, fullName, roles };
  });

  return { entries, errors };
}

export function academyOnboardingTemplateCsv() {
  return [
    "email,full_name,roles",
    "rider@example.com,Example Rider,rider",
    "guardian@example.com,Example Guardian,guardian",
    "coach@example.com,Example Coach,coach",
  ].join("\n");
}

export function academyInvitationExportCsv(invitations, origin) {
  const header = [
    "email",
    "full_name",
    "roles",
    "invite_url",
    "expires_at",
  ];
  const rows = invitations.map((invitation) => [
    invitation.email,
    invitation.fullName,
    invitation.roles.join("|"),
    `${origin.replace(/\/$/, "")}/auth?invite=${invitation.inviteToken}`,
    invitation.expiresAt,
  ]);
  return [header, ...rows]
    .map((row) => row.map(escapeCsv).join(","))
    .join("\n");
}
