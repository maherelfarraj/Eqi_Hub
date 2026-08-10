import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import AppShell from "@/components/AppShell";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import AnalysisPage from "@/pages/AnalysisPage";
import AuthPage from "@/pages/AuthPage";
import BillingPage from "@/pages/BillingPage";
import DashboardPage from "@/pages/DashboardPage";
import HorsesPage from "@/pages/HorsesPage";
import LessonsPage from "@/pages/LessonsPage";
import MembershipPage from "@/pages/MembershipPage";
import PaymentsPage from "@/pages/PaymentsPage";
import ProgressPage from "@/pages/ProgressPage";
import SettingsPage from "@/pages/SettingsPage";
import "@/i18n";

function AppRoutes() {
  const { user, ready } = useAuth();
  const { i18n, t } = useTranslation();

  useEffect(() => {
    const language = i18n.resolvedLanguage ?? i18n.language;
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = language;
  }, [i18n.language, i18n.resolvedLanguage]);

  if (!ready) {
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-cream-50"
        role="status"
        aria-live="polite"
      >
        <div className="flex flex-col items-center gap-4">
          <div className="flex size-12 items-center justify-center rounded-full border border-primary-500 text-xl font-serif text-primary-600">
            E
          </div>
          <div className="size-8 animate-spin rounded-full border-2 border-primary-200 border-t-primary-500" />
          <span className="text-sm text-muted-foreground">
            {t("common.loading")}
          </span>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/auth/*" element={<AuthPage />} />
        <Route path="*" element={<Navigate to="/auth" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/progress" element={<ProgressPage />} />
        <Route path="/analysis" element={<AnalysisPage />} />
        <Route path="/analysis/:id" element={<AnalysisPage />} />
        <Route path="/lessons" element={<LessonsPage />} />
        <Route path="/horses" element={<HorsesPage />} />
        <Route path="/horses/:id" element={<HorsesPage />} />
        <Route path="/membership" element={<MembershipPage />} />
        <Route path="/payments" element={<PaymentsPage />} />
        <Route path="/payments/checkout" element={<PaymentsPage />} />
        <Route path="/billing" element={<BillingPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route index element={<Navigate to="/dashboard" replace />} />
      </Route>
      <Route path="/auth/update-password" element={<AuthPage />} />
      <Route path="/auth" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
