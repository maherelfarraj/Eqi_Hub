import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Navigate,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  CalendarDays,
  ChartNoAxesCombined,
  Building2,
  CreditCard,
  Globe2,
  Heart,
  HeartPulse,
  FileSignature,
  ShieldCheck,
  LayoutDashboard,
  LogOut,
  Menu,
  ReceiptText,
  Settings,
  Sparkles,
  Trophy,
  Video,
  Warehouse,
  X,
  UsersRound,
  Wallet,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  isNavigationPathVisible,
  portalRedirect,
  resolvePortalPersona,
} from "@/lib/portal-persona";

import { useVideoRelease2Access } from "@/hooks/use-video-release-2";
import { useCompetitionDevelopmentAccess } from "@/hooks/use-competition-development";
import { useHorseWelfareAccess } from "@/hooks/use-horse-welfare";
import { useAcademyOperationsAccess } from "@/hooks/use-academy-operations";

const navigation = [
  { path: "/dashboard", labelKey: "nav.dashboard", icon: LayoutDashboard },
  { path: "/progress", labelKey: "nav.progress", icon: ChartNoAxesCombined },
  { path: "/guardian", labelKey: "nav.guardianView", icon: ShieldCheck },
  { path: "/safety", labelKey: "nav.safety", icon: FileSignature },
  { path: "/analysis", labelKey: "nav.videoAnalysis", icon: Video },
  { path: "/video-review", labelKey: "nav.videoReview", icon: Video },
  { path: "/video-intelligence", labelKey: "nav.videoIntelligence", icon: Video },
  { path: "/competition-development", labelKey: "nav.competitionDevelopment", icon: Trophy },
  { path: "/lessons", labelKey: "nav.lessons", icon: CalendarDays },
  { path: "/horses", labelKey: "nav.horses", icon: Heart },
  { path: "/stable-operations", labelKey: "nav.stableOperations", icon: Warehouse },
  { path: "/horse-welfare", labelKey: "nav.horseWelfare", icon: HeartPulse },
  { path: "/academy-operations", labelKey: "nav.academyOperations", icon: Building2 },
  { path: "/family-operations", labelKey: "nav.familyOperations", icon: UsersRound },
  { path: "/revenue-operations", labelKey: "nav.revenueOperations", icon: Wallet },
  { path: "/membership", labelKey: "nav.membership", icon: Sparkles },
  { path: "/payments", labelKey: "nav.payments", icon: CreditCard },
  { path: "/billing", labelKey: "nav.billing", icon: ReceiptText },
  { path: "/organization", labelKey: "nav.organization", icon: Building2 },
  { path: "/settings", labelKey: "nav.settings", icon: Settings },
] as const;

export default function AppShell() {
  const { t, i18n } = useTranslation();
  const { user, signOut, activeOrganization, organizations, hasRole } =
    useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState(false);
  const isRtl = (i18n.resolvedLanguage ?? i18n.language) === "ar";
  const portalPersona = resolvePortalPersona(activeOrganization?.roles);
  const redirectPath = portalRedirect(portalPersona, location.pathname);
  const videoRelease2Access = useVideoRelease2Access();
  const competitionDevelopmentAccess = useCompetitionDevelopmentAccess();
  const horseWelfareAccess = useHorseWelfareAccess();
  const academyOperationsAccess = useAcademyOperationsAccess();
  const batch8Enabled = import.meta.env.VITE_BATCH8_ENABLED === "true";
  const activeOrganizationRoles = activeOrganization?.roles ?? [];
  const isPlatformAdmin = hasRole("platform_admin");
  const canAccessBatch8Family =
    batch8Enabled && activeOrganizationRoles.includes("guardian");
  const canAccessBatch8Revenue =
    batch8Enabled &&
    (activeOrganizationRoles.includes("academy_admin") ||
      activeOrganizationRoles.includes("accountant") ||
      isPlatformAdmin);

  const handleSignOut = async () => {
    setSigningOut(true);
    setSignOutError(false);
    try {
      await signOut();
      setSidebarOpen(false);
      navigate("/auth", { replace: true });
    } catch {
      setSignOutError(true);
    } finally {
      setSigningOut(false);
    }
  };

  const toggleLanguage = async () => {
    await i18n.changeLanguage(isRtl ? "en" : "ar");
  };

  const closedDrawerClass = isRtl
    ? "translate-x-full lg:translate-x-0"
    : "-translate-x-full lg:translate-x-0";

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!sidebarOpen) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSidebarOpen(false);
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [sidebarOpen]);

  if (redirectPath) return <Navigate to={redirectPath} replace />;

  return (
    <div className="flex min-h-screen bg-cream-50 text-espresso">
      <aside
        id="app-navigation"
        className={`fixed inset-y-0 start-0 z-50 flex h-screen w-72 flex-col border-e border-cream-200 bg-cream-100 transition-transform duration-200 ease-out lg:sticky ${sidebarOpen ? "translate-x-0" : closedDrawerClass}`}
        aria-label={t("app.name")}
      >
        <div className="flex items-center justify-between border-b border-cream-200 px-5 py-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full border border-primary-500 bg-white font-serif text-lg text-primary-600 shadow-sm">
              E
            </div>
            <div className="min-w-0">
              <p className="truncate font-serif text-xl leading-none text-espresso">
                {t("app.name")}
              </p>
              <p className="mt-1 truncate text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-primary-600">
                {t("app.tagline")}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-white hover:text-espresso lg:hidden"
            aria-label={t("common.closeNavigation")}
          >
            <X className="size-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-4">
          {navigation
            .filter(
              ({ path }) =>
                (path !== "/organization" ||
                  organizations.length > 0 ||
                  hasRole("platform_admin")) &&
                (path !== "/safety" ||
                  hasRole("rider") ||
                  hasRole("guardian") ||
                  hasRole("academy_admin") ||
                  hasRole("stable_manager") ||
                  hasRole("platform_admin")) &&
                (path !== "/video-intelligence" ||
                  Boolean(videoRelease2Access.data?.canManage || videoRelease2Access.data?.canViewApproved)) &&
                (path !== "/competition-development" ||
                  Boolean(
                    competitionDevelopmentAccess.data?.canManage ||
                      competitionDevelopmentAccess.data?.canView ||
                      (hasRole("guardian") && competitionDevelopmentAccess.data?.enabled),
                  )) &&
                (path !== "/horse-welfare" ||
                  Boolean(horseWelfareAccess.data?.canManage)) &&
                 (path !== "/academy-operations" ||
                   Boolean(academyOperationsAccess.data?.canManage)) &&
                 (path !== "/family-operations" || canAccessBatch8Family) &&
                  (path !== "/revenue-operations" ||
                    canAccessBatch8Revenue) &&
                isNavigationPathVisible(
                  portalPersona,
                  path,
                  hasRole("guardian"),
                ),
            )
            .map(({ path, labelKey, icon: Icon }) => (
              <NavLink
                key={path}
                to={path}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `group flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-semibold transition-colors ${
                    isActive
                      ? "border border-cream-200 bg-white text-primary-700 shadow-sm"
                      : "border border-transparent text-text-secondary hover:border-cream-200 hover:bg-white/70 hover:text-espresso"
                  }`
                }
              >
                <Icon
                  className="size-5 shrink-0 text-primary-500"
                  aria-hidden="true"
                />
                <span>{t(labelKey)}</span>
              </NavLink>
            ))}
        </nav>

        <div className="space-y-2 border-t border-cream-200 p-4">
          <div className="rounded-xl border border-cream-200 bg-white/70 px-3.5 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary-600">
              {t("common.secureAccount")}
            </p>
            <p className="mt-1 truncate text-sm text-text-secondary">
              {user?.email}
            </p>
            {activeOrganization ? (
              <p className="mt-1 truncate text-xs font-semibold text-primary-700">
                {activeOrganization.name}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={toggleLanguage}
            className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-white hover:text-espresso"
          >
            <Globe2 className="size-4 text-primary-500" />
            {isRtl ? t("common.english") : t("common.arabic")}
          </button>
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-error-500 transition-colors hover:bg-error-50"
          >
            <LogOut className="size-4" aria-hidden="true" />
            {signingOut ? t("auth.signingOut") : t("auth.signOut")}
          </button>
          {signOutError ? (
            <p className="px-3.5 text-xs text-error-700" role="alert">
              {t("auth.errors.signOutFailed")}
            </p>
          ) : null}
        </div>
      </aside>

      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-espresso/20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-label={t("common.closeNavigation")}
        />
      )}

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-cream-200 bg-cream-50 px-4 py-3 lg:hidden">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            aria-controls="app-navigation"
            aria-expanded={sidebarOpen}
            className="rounded-full border border-cream-200 bg-white p-2 text-espresso shadow-sm"
            aria-label={t("common.openNavigation")}
          >
            <Menu className="size-5" />
          </button>
          <span className="font-serif text-xl text-espresso">
            {t("app.name")}
          </span>
          <span className="size-9" aria-hidden="true" />
        </header>

        <main className="mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
