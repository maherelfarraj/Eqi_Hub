import { lazy, Suspense, useEffect, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import AppShell from "@/components/AppShell";
import { ErrorBoundary } from "@/components/error-boundary";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import "@/i18n";

const AnalysisPage = lazy(() => import("@/pages/AnalysisPage"));
const AuthPage = lazy(() => import("@/pages/AuthPage"));
const BillingPage = lazy(() => import("@/pages/BillingPage"));
const DashboardPage = lazy(() => import("@/pages/DashboardPage"));
const GuardianViewPage = lazy(() => import("@/pages/GuardianViewPage"));
const HorsesPage = lazy(() => import("@/pages/HorsesPage"));
const LessonsPage = lazy(() => import("@/pages/LessonsPage"));
const LegalPage = lazy(() => import("@/pages/LegalPage"));
const MembershipPage = lazy(() => import("@/pages/MembershipPage"));
const NotFoundPage = lazy(() => import("@/pages/not-found"));
const OrganizationPage = lazy(() => import("@/pages/OrganizationPage"));
const PaymentsPage = lazy(() => import("@/pages/PaymentsPage"));
const ProgressPage = lazy(() => import("@/pages/ProgressPage"));
const SafetyPage = lazy(() => import("@/pages/SafetyPage"));
const SettingsPage = lazy(() => import("@/pages/SettingsPage"));

function RouteSkeleton({ fullScreen = false }: { fullScreen?: boolean }) {
  const { t } = useTranslation();

  return (
    <div
      className={`flex w-full items-center justify-center bg-cream-50 px-4 ${
        fullScreen ? "min-h-screen" : "min-h-[28rem]"
      }`}
      role="status"
      aria-live="polite"
    >
      <div className="w-full max-w-3xl animate-pulse rounded-2xl border border-cream-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex items-center gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-full border border-primary-300 bg-primary-50 font-serif text-xl text-primary-600">
            E
          </div>
          <div className="flex-1 space-y-2">
            <div className="h-3 w-28 rounded-full bg-primary-100" />
            <div className="h-6 w-2/3 rounded-full bg-cream-200" />
          </div>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className="h-28 rounded-2xl bg-cream-100" />
          <div className="h-28 rounded-2xl bg-cream-100" />
          <div className="h-28 rounded-2xl bg-cream-100" />
        </div>
        <span className="sr-only">{t("common.loading")}</span>
      </div>
    </div>
  );
}

function SuspendedPage({
  children,
  fullScreen = false,
}: {
  children: ReactNode;
  fullScreen?: boolean;
}) {
  return (
    <Suspense fallback={<RouteSkeleton fullScreen={fullScreen} />}>
      {children}
    </Suspense>
  );
}

function AppRoutes() {
  const { user, ready } = useAuth();
  const { i18n } = useTranslation();

  useEffect(() => {
    const language = i18n.resolvedLanguage ?? i18n.language;
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = language;
  }, [i18n.language, i18n.resolvedLanguage]);

  if (!ready) return <RouteSkeleton fullScreen />;

  if (!user) {
    return (
      <Routes>
        <Route path="/legal" element={<Navigate to="/legal/terms" replace />} />
        <Route
          path="/legal/:document"
          element={
            <SuspendedPage fullScreen>
              <LegalPage />
            </SuspendedPage>
          }
        />
        <Route
          path="/auth/*"
          element={
            <SuspendedPage fullScreen>
              <AuthPage />
            </SuspendedPage>
          }
        />
        <Route path="*" element={<Navigate to="/auth" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/legal" element={<Navigate to="/legal/terms" replace />} />
      <Route
        path="/legal/:document"
        element={
          <SuspendedPage fullScreen>
            <LegalPage />
          </SuspendedPage>
        }
      />
      <Route element={<AppShell />}>
        <Route
          path="/dashboard"
          element={
            <SuspendedPage>
              <DashboardPage />
            </SuspendedPage>
          }
        />
        <Route
          path="/progress"
          element={
            <SuspendedPage>
              <ProgressPage />
            </SuspendedPage>
          }
        />
        <Route
          path="/guardian"
          element={
            <SuspendedPage>
              <GuardianViewPage />
            </SuspendedPage>
          }
        />
        <Route
          path="/analysis"
          element={
            <SuspendedPage>
              <AnalysisPage />
            </SuspendedPage>
          }
        />
        <Route
          path="/analysis/:id"
          element={
            <SuspendedPage>
              <AnalysisPage />
            </SuspendedPage>
          }
        />
        <Route
          path="/lessons"
          element={
            <SuspendedPage>
              <LessonsPage />
            </SuspendedPage>
          }
        />
        <Route
          path="/horses"
          element={
            <SuspendedPage>
              <HorsesPage />
            </SuspendedPage>
          }
        />
        <Route
          path="/horses/:id"
          element={
            <SuspendedPage>
              <HorsesPage />
            </SuspendedPage>
          }
        />
        <Route
          path="/membership"
          element={
            <SuspendedPage>
              <MembershipPage />
            </SuspendedPage>
          }
        />
        <Route
          path="/payments"
          element={
            <SuspendedPage>
              <PaymentsPage />
            </SuspendedPage>
          }
        />
        <Route
          path="/payments/checkout"
          element={
            <SuspendedPage>
              <PaymentsPage />
            </SuspendedPage>
          }
        />
        <Route
          path="/billing"
          element={
            <SuspendedPage>
              <BillingPage />
            </SuspendedPage>
          }
        />
        <Route
          path="/safety"
          element={
            <SuspendedPage>
              <SafetyPage />
            </SuspendedPage>
          }
        />
        <Route
          path="/settings"
          element={
            <SuspendedPage>
              <SettingsPage />
            </SuspendedPage>
          }
        />
        <Route
          path="/organization"
          element={
            <SuspendedPage>
              <OrganizationPage />
            </SuspendedPage>
          }
        />
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route
          path="*"
          element={
            <SuspendedPage>
              <NotFoundPage />
            </SuspendedPage>
          }
        />
      </Route>
      <Route
        path="/auth/update-password"
        element={
          <SuspendedPage fullScreen>
            <AuthPage />
          </SuspendedPage>
        }
      />
      <Route path="/auth" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

function RoutedApp() {
  const location = useLocation();

  return (
    <ErrorBoundary resetKey={location.key}>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <RoutedApp />
    </BrowserRouter>
  );
}
