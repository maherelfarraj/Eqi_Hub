import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  LayoutDashboard, Calendar, Users, Heart, Shield, Wallet,
  UserCog, Settings, ScrollText, LogOut, Menu, X, Globe,
} from 'lucide-react';

export default function AppShell() {
  const { t } = useTranslation();
  const { user, roles, signOut } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { i18n } = useTranslation();

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const toggleLanguage = () => {
    const newLang = i18n.language === 'ar' ? 'en' : 'ar';
    i18n.changeLanguage(newLang);
  };

  const hasRole = (name: string) => roles.some((r) => r.role_name === name);
  const isStaff = hasRole('owner') || hasRole('school_manager') || hasRole('receptionist') || hasRole('instructor') || hasRole('stable_manager') || hasRole('groom') || hasRole('veterinarian') || hasRole('accountant');

  const navItems = [
    { path: '/dashboard', label: t('nav.dashboard'), icon: <LayoutDashboard className="w-5 h-5" />, roles: ['owner', 'school_manager', 'receptionist', 'instructor', 'stable_manager', 'groom', 'veterinarian', 'accountant', 'adult_rider', 'parent_guardian', 'junior_rider'] },
    { path: '/schedule', label: t('nav.schedule'), icon: <Calendar className="w-5 h-5" />, roles: ['owner', 'school_manager', 'receptionist', 'instructor', 'adult_rider', 'parent_guardian', 'junior_rider'] },
    { path: '/riders', label: t('nav.riders'), icon: <Users className="w-5 h-5" />, roles: ['owner', 'school_manager', 'receptionist', 'instructor'] },
    { path: '/riders', label: 'My Children', icon: <Users className="w-5 h-5" />, roles: ['parent_guardian'] },
    { path: '/horses', label: t('nav.horses'), icon: <Heart className="w-5 h-5" />, roles: ['owner', 'school_manager', 'receptionist', 'instructor', 'stable_manager', 'groom', 'veterinarian'] },
    { path: '/stable', label: t('nav.stable'), icon: <Shield className="w-5 h-5" />, roles: ['owner', 'school_manager', 'stable_manager', 'groom'] },
    { path: '/billing', label: t('nav.billing'), icon: <Wallet className="w-5 h-5" />, roles: ['owner', 'school_manager', 'accountant', 'receptionist'] },
    { path: '/staff', label: t('nav.staff'), icon: <UserCog className="w-5 h-5" />, roles: ['owner', 'school_manager'] },
    { path: '/users', label: t('nav.users'), icon: <Users className="w-5 h-5" />, roles: ['owner', 'school_manager'] },
    { path: '/settings', label: t('nav.settings'), icon: <Settings className="w-5 h-5" />, roles: ['owner', 'school_manager'] },
    { path: '/audit-log', label: t('nav.auditLog'), icon: <ScrollText className="w-5 h-5" />, roles: ['owner', 'school_manager'] },
  ];

  const visibleNavItems = navItems.filter((item) => item.roles.some((r) => roles.some((ur) => ur.role_name === r)));

  return (
    <div className="min-h-screen bg-cream-50 flex">
      {/* Sidebar */}
      <aside className={`fixed lg:sticky top-0 left-0 h-screen w-64 bg-white border-e border-cream-200 flex flex-col z-50 transition-transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="flex items-center justify-between p-4 border-b border-cream-200">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center">
              <span className="text-white text-sm font-bold">P&R</span>
            </div>
            <span className="font-semibold text-gray-900">{t('app.name')}</span>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-gray-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {visibleNavItems.map((item) => (
            <NavLink
              key={item.path + item.label}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-primary-50 text-primary-700' : 'text-gray-600 hover:bg-cream-50 hover:text-gray-900'
                }`
              }
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-cream-200 space-y-2">
          <button onClick={toggleLanguage} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-cream-50 w-full">
            <Globe className="w-4 h-4" />
            {i18n.language === 'ar' ? 'English' : 'العربية'}
          </button>
          <button onClick={handleSignOut} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-error-600 hover:bg-error-50 w-full">
            <LogOut className="w-4 h-4" />
            {t('auth.signOut')}
          </button>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/20 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main content */}
      <div className="flex-1 min-w-0">
        <header className="lg:hidden sticky top-0 bg-white border-b border-cream-200 px-4 py-3 flex items-center justify-between z-30">
          <button onClick={() => setSidebarOpen(true)} className="text-gray-600">
            <Menu className="w-6 h-6" />
          </button>
          <span className="font-semibold text-gray-900">{t('app.name')}</span>
          <div className="w-6" />
        </header>

        <main className="p-4 lg:p-6 max-w-7xl mx-auto">
          <div className="mb-4 hidden lg:flex items-center justify-end">
            <span className="text-sm text-gray-500">{user?.email}</span>
          </div>
          <div className="lg:mb-0">
            {/* Page content rendered via routes */}
          </div>
        </main>
      </div>
    </div>
  );
}
