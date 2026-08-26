export type Batch8Surface = "family" | "revenue";

export const batch8ClientEnabled =
  import.meta.env.VITE_BATCH8_ENABLED === "true";

export function resolveBatch8Access(
  activeOrganizationRoles: readonly string[] = [],
  isPlatformAdmin = false,
) {
  return {
    family:
      batch8ClientEnabled && activeOrganizationRoles.includes("guardian"),
    revenue:
      batch8ClientEnabled &&
      (activeOrganizationRoles.includes("academy_admin") ||
        activeOrganizationRoles.includes("accountant") ||
        isPlatformAdmin),
  } satisfies Record<Batch8Surface, boolean>;
}