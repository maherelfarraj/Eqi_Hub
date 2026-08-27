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
import { resolveBatch8Access } from "@/lib/batch8-access";
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
  { path: "/dashboard", labelKey: "nav.dashboard", icon: LayoutDashboard, group: "today" },
  { path: "/guardian", labelKey: "nav.guardianView", icon: ShieldCheck, group: "today" },
  { path: "/lessons", labelKey: "nav.lessons", icon: CalendarDays, group: "training" },
  { path: "/horses", labelKey: "nav.horses", icon: Heart, group: "training" },
  { path: "/progress", labelKey: "nav.progress", icon: ChartNoAxesCombined, group: "training" },
  { path: "/competition-development", labelKey: "nav.competitionDevelopment", icon: Trophy, group: "training" },
  { path: "/analysis", labelKey: "nav.videoAnalysis", icon: Video, group: "training" },
  { path: "/video-review", labelKey: "nav.videoReview", icon: Video, group: "training" },
  { path: "/video-intelligence", labelKey: "nav.videoIntelligence", icon: Video, group: "training" },
  { path: "/stable-operations", labelKey: "nav.stableOperations", icon: Warehouse, group: "operations" },
  { path: "/horse-welfare", labelKey: "nav.horseWelfare", icon: HeartPulse, group: "operations" },
  { path: "/academy-operations", labelKey: "nav.academyOperations", icon: Building2, group: "operations" },
  { path: "/family-operations", labelKey: "nav.familyOperations", icon: UsersRound, group: "operations" },
  { path: "/revenue-operations", labelKey: "nav.revenueOperations", icon: Wallet, group: "operations" },
  { path: "/safety", labelKey: "nav.safety", icon: FileSignature, group: "operations" },
  { path: "/membership", labelKey: "nav.membership", icon: Sparkles, group: "account" },
  { path: "/payments", labelKey: "nav.payments", icon: CreditCard, group: "account" },
  { path: "/billing", labelKey: "nav.billing", icon: ReceiptText, group: "account" },
  { path: "/organization", labelKey: "nav.organization", icon: Building2, group: "account" },
  { path: "/settings", labelKey: "nav.settings", icon: Settings, group: "account" },
] as const;

const navigationGroups = ["today", "training", "operations", "account"] as const;

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
  const videoRelease2Access = useVideoRelease2Access();
  const competitionDevelopmentAccess = useCompetitionDevelopmentAccess();
  const horseWelfareAccess = useHorseWelfareAccess();
  const academyOperationsAccess = useAcademyOperationsAccess();
  const batch8Access = resolveBatch8Access(
    activeOrganization?.roles,
    hasRole("platform_admin"),
  );
  const redirectPath =
    location.pathname === "/revenue-operations" && batch8Access.revenue
      ? null
      : portalRedirect(portalPersona, location.pathname);

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
    <div className="flex min-h-screen bg-cream-50 text-espresso font-sans selection:bg-primary-200 selection:text-primary-900">
      <aside
        id="app-navigation"
        className={`fixed inset-y-0 start-0 z-50 flex h-screen w-72 flex-col border-e border-primary-800 bg-primary-900 text-cream-50 transition-transform duration-300 ease-out lg:sticky ${sidebarOpen ? "translate-x-0 shadow-2xl lg:shadow-none" : closedDrawerClass}`}
        aria-label={t("app.name")}
      >
        <div className="flex items-center justify-between border-b border-primary-800 px-6 py-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-primary-700 bg-primary-800 font-serif text-lg text-cream-50 shadow-sm">
              E
            </div>
            <div className="min-w-0">
              <p className="truncate font-serif text-xl leading-none text-white tracking-tight">
                {t("app.name")}
              </p>
              <p className="mt-1.5 truncate text-[0.65rem] font-bold uppercase tracking-[0.18em] text-primary-300">
                {t("app.tagline")}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="rounded-lg p-2 text-primary-300 transition-colors hover:bg-primary-800 hover:text-white lg:hidden"
            aria-label={t("common.closeNavigation", { defaultValue: "Close navigation" })}
          >
            <X className="size-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto p-4 scrollbar-thin">
          {navigationGroups.map((group) => {
            const items = navigation.filter(
              ({ path, group: itemGroup }) =>
                itemGroup === group &&
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
                  Boolean(
                    videoRelease2Access.data?.canManage ||
                      videoRelease2Access.data?.canViewApproved,
                  )) &&
                (path !== "/competition-development" ||
                  Boolean(
                    competitionDevelopmentAccess.data?.canManage ||
                      competitionDevelopmentAccess.data?.canView ||
                      (hasRole("guardian") &&
                        competitionDevelopmentAccess.data?.enabled),
                  )) &&
                (path !== "/horse-welfare" ||
                  Boolean(horseWelfareAccess.data?.canManage)) &&
                (path !== "/academy-operations" ||
                  Boolean(academyOperationsAccess.data?.canManage)) &&
                (path !== "/family-operations" || batch8Access.family) &&
                (path !== "/revenue-operations" || batch8Access.revenue) &&
                ((path === "/revenue-operations" && batch8Access.revenue) ||
                  isNavigationPathVisible(
                    portalPersona,
                    path,
                    hasRole("guardian"),
                  )),
            );

            if (!items.length) return null;

            return (
              <section key={group} aria-labelledby={`nav-group-${group}`}>
                <p
                  id={`nav-group-${group}`}
                  className="mb-2 px-3.5 text-[0.6rem] font-bold uppercase tracking-[0.18em] text-primary-400"
                >
                  {t(`navGroups.${group}`)}
                </p>
                <div className="space-y-1">
                  {items.map(({ path, labelKey, icon: Icon }) => (
                    <NavLink
                      key={path}
                      to={path}
                      onClick={() => setSidebarOpen(false)}
                      className={({ isActive }) =>
                        `group flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-all ${
                          isActive
                            ? "bg-primary-800 text-white shadow-sm"
                            : "text-primary-100 hover:bg-primary-800/50 hover:text-white"
                        }`
                      }
                    >
                      <Icon
                        className="size-[1.125rem] shrink-0 text-primary-300 transition-colors"
                        aria-hidden="true"
                      />
                      <span>{t(labelKey)}</span>
                    </NavLink>
                  ))}
                </div>
              </section>
            );
          })}
        </nav>

        <div className="space-y-2 border-t border-primary-800 p-4">
          <div className="rounded-lg border border-primary-800 bg-primary-800/50 px-3.5 py-3">
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.15em] text-primary-300">
              {t("common.secureAccount", { defaultValue: "Secure Account" })}
            </p>
            <p className="mt-1.5 truncate text-sm font-medium text-cream-50">
              {user?.email}
            </p>
            {activeOrganization ? (
              <p className="mt-1 truncate text-xs text-primary-200">
                {activeOrganization.name}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={toggleLanguage}
            className="flex w-full items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium text-primary-100 transition-colors hover:bg-primary-800 hover:text-white"
          >
            <Globe2 className="size-4 text-primary-400" />
            {isRtl ? t("common.english", { defaultValue: "English" }) : t("common.arabic", { defaultValue: "العربية" })}
          </button>
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className="flex w-full items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium text-error-400 transition-colors hover:bg-error-500/10 hover:text-error-300"
          >
            <LogOut className="size-4" aria-hidden="true" />
            {signingOut ? t("auth.signingOut", { defaultValue: "Signing out..." }) : t("auth.signOut", { defaultValue: "Sign out" })}
          </button>
          {signOutError ? (
            <p className="px-3.5 text-xs text-error-400" role="alert">
              {t("auth.errors.signOutFailed", { defaultValue: "Failed to sign out" })}
            </p>
          ) : null}
        </div>
      </aside>

      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-espresso/40 backdrop-blur-sm lg:hidden transition-opacity"
          onClick={() => setSidebarOpen(false)}
          aria-label={t("common.closeNavigation", { defaultValue: "Close navigation" })}
        />
      )}

      <div className="min-w-0 flex-1 flex flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-cream-200 bg-cream-50/80 backdrop-blur-md px-4 py-3 lg:px-8 lg:py-5">
          <div className="flex items-center gap-4 w-full lg:w-auto justify-between lg:justify-start">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-controls="app-navigation"
              aria-expanded={sidebarOpen}
              className="rounded-lg border border-cream-200 bg-white p-2 text-espresso shadow-sm lg:hidden hover:bg-cream-100 transition-colors"
              aria-label={t("common.openNavigation", { defaultValue: "Open navigation" })}
            >
              <Menu className="size-5" />
            </button>

            <span className="font-serif text-xl text-espresso lg:hidden">
              {t("app.name")}
            </span>

            <div className="hidden lg:flex flex-col">
              <p className="text-[0.65rem] font-bold uppercase tracking-[0.15em] text-primary-600">
                {t("app.orientation", { defaultValue: "Today at the Academy" })}
              </p>
              <p className="mt-0.5 text-sm font-medium text-text-secondary">
                {new Intl.DateTimeFormat(i18n.language, { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date())}
              </p>
            </div>

            <span className="size-9 lg:hidden" aria-hidden="true" />
          </div>

          <div className="hidden lg:flex items-center gap-3">
            {activeOrganization && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-cream-200 shadow-sm">
                <Building2 className="size-3.5 text-primary-500" />
                <span className="text-xs font-bold uppercase tracking-wide text-espresso">{activeOrganization.name}</span>
              </div>
            )}
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
