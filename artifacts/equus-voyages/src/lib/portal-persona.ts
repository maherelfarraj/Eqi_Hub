export type PortalPersona = "guardian" | "academy_admin" | "default";

const guardianNavigationPaths = new Set(["/guardian", "/safety", "/settings"]);
const academyAdminNavigationPaths = new Set([
  "/dashboard",
  "/lessons",
  "/horses",
  "/safety",
  "/billing",
  "/organization",
  "/settings",
]);

export function resolvePortalPersona(
  activeOrganizationRoles: readonly string[] = [],
): PortalPersona {
  if (activeOrganizationRoles.includes("academy_admin")) {
    return "academy_admin";
  }
  if (activeOrganizationRoles.includes("guardian")) {
    return "guardian";
  }
  return "default";
}

export function isNavigationPathVisible(
  persona: PortalPersona,
  path: string,
  hasGuardianRole: boolean,
): boolean {
  if (persona === "guardian") return guardianNavigationPaths.has(path);
  if (persona === "academy_admin") {
    return academyAdminNavigationPaths.has(path);
  }
  if (path === "/guardian") return hasGuardianRole;
  return true;
}

export function portalRedirect(
  persona: PortalPersona,
  pathname: string,
): string | null {
  if (persona !== "guardian") return null;
  return guardianNavigationPaths.has(pathname) ? null : "/guardian";
}
