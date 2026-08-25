export type PortalPersona = "guardian" | "academy_admin" | "default";

const guardianNavigationPaths = new Set([
  "/guardian",
  "/competition-development",
  "/safety",
  "/video-review",
  "/stable-operations",
  "/settings",
]);
const academyAdminNavigationPaths = new Set([
  "/dashboard",
  "/competition-development",
  "/video-review",
  "/lessons",
  "/horses",
  "/stable-operations",
  "/horse-welfare",
  "/academy-operations",
  "/safety",
  "/billing",
  "/organization",
  "/settings",
]);
const guardianVideoReviewDetailPath = /^\/video-review\/[^/]+$/;

function isGuardianPortalPath(pathname: string): boolean {
  return (
    guardianNavigationPaths.has(pathname) ||
    guardianVideoReviewDetailPath.test(pathname)
  );
}

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
  if (persona === "guardian") return isGuardianPortalPath(path);
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
  return isGuardianPortalPath(pathname) ? null : "/guardian";
}
