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
import '@/i18n';
import { supabase } from '@/lib/supabase';

function InvitationAcceptor() {
  const { user, refreshRoles } = useAuth();

  useEffect(() => {
    if (!user) return;
    const token = sessionStorage.getItem('invitation_token');
    if (!token) return;

    (async () => {
      const { error } = await supabase.rpc('accept_invitation', { token_input: token });
      if (!error) {
        sessionStorage.removeItem('invitation_token');
        await refreshRoles();
      }
    })();
  }, [user, refreshRoles]);

  return null;
}

function AppRoutes() {
  const { user, roles, loading } = useAuth();
  const { i18n } = useTranslation();

  useEffect(() => {
    document.documentElement.dir = i18n.language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);

  if (loading) {
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

  // If user has no roles, show bootstrap page
  if (roles.length === 0) {
    return (
      <>
        <InvitationAcceptor />
        <Routes>
          <Route path="/bootstrap" element={<BootstrapPage />} />
          <Route path="*" element={<Navigate to="/bootstrap" replace />} />
        </Routes>
      </>
    );
  }

  const hasRole = (name: string) => roles.some((r) => r.role_name === name);
  const isManager = hasRole('owner') || hasRole('school_manager');

  return (
    <>
      <InvitationAcceptor />
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/settings" element={isManager ? <SettingsPage /> : <Navigate to="/dashboard" replace />} />
          <Route path="/users" element={isManager ? <UsersPage /> : <Navigate to="/dashboard" replace />} />
          <Route path="/audit-log" element={isManager ? <AuditLogPage /> : <Navigate to="/dashboard" replace />} />
          {/* Placeholder routes for future phases */}
          <Route path="/schedule" element={<PlaceholderPage title="Schedule" />} />
          <Route path="/riders" element={<PlaceholderPage title="Riders" />} />
          <Route path="/horses" element={<PlaceholderPage title="Horses" />} />
          <Route path="/stable" element={<PlaceholderPage title="Stable Operations" />} />
          <Route path="/billing" element={<PlaceholderPage title="Billing" />} />
          <Route path="/staff" element={<PlaceholderPage title="Staff" />} />
          <Route index element={<Navigate to="/dashboard" replace />} />
        </Route>
        <Route path="/auth" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </>
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
