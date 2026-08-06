import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import AppShell from '@/components/AppShell';
import AuthPage from '@/pages/AuthPage';
import BootstrapPage from '@/pages/BootstrapPage';
import DashboardPage from '@/pages/DashboardPage';
import SettingsPage from '@/pages/SettingsPage';
import UsersPage from '@/pages/UsersPage';
import AuditLogPage from '@/pages/AuditLogPage';
import RidersListPage from '@/pages/RidersListPage';
import RiderDetailPage from '@/pages/RiderDetailPage';
import RiderFormPage from '@/pages/RiderFormPage';
import ParentPortalPage from '@/pages/ParentPortalPage';
import '@/i18n';

function AppRoutes() {
  const { user, roles, ready } = useAuth();
  const { i18n } = useTranslation();

  useEffect(() => {
    document.documentElement.dir = i18n.language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream-50">
        <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route path="*" element={<Navigate to="/auth" replace />} />
      </Routes>
    );
  }

  if (roles.length === 0) {
    return (
      <Routes>
        <Route path="/bootstrap" element={<BootstrapPage />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="*" element={<Navigate to="/auth" replace />} />
      </Routes>
    );
  }

  const hasRole = (name: string) => roles.some((r) => r.role_name === name);
  const isManager = hasRole('owner') || hasRole('school_manager');
  const isStaff = hasRole('owner') || hasRole('school_manager') || hasRole('receptionist') || hasRole('instructor');
  const isParent = hasRole('parent_guardian');

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/settings" element={isManager ? <SettingsPage /> : <Navigate to="/dashboard" replace />} />
        <Route path="/users" element={isManager ? <UsersPage /> : <Navigate to="/dashboard" replace />} />
        <Route path="/audit-log" element={isManager ? <AuditLogPage /> : <Navigate to="/dashboard" replace />} />
        <Route path="/schedule" element={<PlaceholderPage title="Schedule" />} />
        <Route path="/riders" element={isStaff ? <RidersListPage /> : isParent ? <ParentPortalPage /> : <Navigate to="/dashboard" replace />} />
        <Route path="/riders/new" element={isStaff ? <RiderFormPage /> : <Navigate to="/dashboard" replace />} />
        <Route path="/riders/:id" element={isStaff ? <RiderDetailPage /> : isParent ? <ParentPortalPage /> : <Navigate to="/dashboard" replace />} />
        <Route path="/riders/:id/edit" element={isStaff ? <RiderFormPage /> : <Navigate to="/dashboard" replace />} />
        <Route path="/horses" element={<PlaceholderPage title="Horses" />} />
        <Route path="/stable" element={<PlaceholderPage title="Stable Operations" />} />
        <Route path="/billing" element={<PlaceholderPage title="Billing" />} />
        <Route path="/staff" element={<PlaceholderPage title="Staff" />} />
        <Route index element={<Navigate to="/dashboard" replace />} />
      </Route>
      <Route path="/auth" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">{title}</h2>
        <p className="text-gray-500">Coming in a later phase</p>
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
