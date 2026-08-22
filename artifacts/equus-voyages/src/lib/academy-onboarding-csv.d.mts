export interface AcademyOnboardingEntry {
  email: string;
  fullName: string;
  roles: string[];
}

export interface AcademyOnboardingCsvError {
  row: number;
  field: string;
  message: string;
}

export const academyOnboardingRoles: string[];
export function parseAcademyOnboardingCsv(source: string): {
  entries: AcademyOnboardingEntry[];
  errors: AcademyOnboardingCsvError[];
};
export function academyOnboardingTemplateCsv(): string;
export function academyInvitationExportCsv(
  invitations: Array<{
    email: string;
    fullName: string;
    roles: string[];
    inviteToken: string;
    expiresAt: string;
  }>,
  origin: string,
): string;
