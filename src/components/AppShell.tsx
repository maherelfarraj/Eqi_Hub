import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import {
  LayoutDashboard,
  Calendar,
  Users,
  Heart,
  Warehouse,
  DollarSign,
  UserCog,
  Settings,
  UserPlus,
  FileText,
  LogOut,
  Menu,
  X,
  Languages,
  ChevronDown,
} from 'lucide-react';

interface NavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
  roles: string[];
}

export default function AppShell() {
  const { t, i18n } = useTranslation();
  const { user, roles, signOut, hasRole } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [langMenuOpen, setLangMenuOpen] = useState(false);

  const navItems: NavItem[] = [
    { path: '/dashboard', label: t('nav.dashboard'), icon: <LayoutDashboard className="w-5 h-5" />, roles: ['owner', 'school_manager', 'receptionist', 'instructor', 'stable_manager', 'groom', 'veterinarian', 'accountant', 'adult_rider', 'parent_guardian'] },
    { path: '/schedule', label: t('nav.schedule'), icon: <Calendar className="w-5 h-5" />, roles: ['owner', 'school_manager', 'receptionist', 'instructor', 'adult_rider', 'parent_guardian'] },
    { path: '/riders', label: t('nav.riders'), icon: <Users className="w-5 h-5" />, roles: ['owner', 'school_manager', 'receptionist', 'instructor'] },
    { path: '/horses', label: t('nav.horses'), icon: <Heart className="w-5 h-5" />, roles: ['owner', 'school_manager', 'instructor', 'stable_manager', 'groom', 'veterinarian'] },
    { path: '/stable', label: t('nav.stable'), icon: <Warehouse className="w-5 h-5" />, roles: ['owner', 'school_manager', 'stable_manager', 'groom'] },
    { path: '/billing', label: t('nav.billing'), icon: <DollarSign className="w-5 h-5" />, roles: ['owner', 'school_manager', 'receptionist', 'accountant'] },
    { path: '/staff', label: t('nav.staff'), icon: <UserCog className="w-5 h-5" />, roles: ['owner', 'school_manager'] },
    { path: '/users', label: t('nav.users'), icon: <UserPlus className="w-5 h-5" />, roles: ['owner', 'school_manager'] },
    { path: '/settings', label: t('nav.settings'), icon: <Settings className="w-5 h-5" />, roles: ['owner', 'school_manager'] },
    { path: '/audit-log', label: t('nav.auditLog'), icon: <FileText className="w-5 h-5" />, roles: ['owner', 'school_manager'] },
  ];

  const visibleNav = navItems.filter((item) =>
    item.roles.some((role) => hasRole(role))
  );

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const toggleLang = (lang: string) => {
    i18n.changeLanguage(lang);
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
    setLangMenuOpen(false);
  };

  return (
    <div className="min-h-screen flex bg-cream-50">
      {/* Sidebar overlay on mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 start-0 z-50 w-64 bg-white border-e border-cream-200 transform transition-transform duration-200 lg:translate-x-0 lg:static lg:z-auto ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full rtl:translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between p-4 border-b border-cream-200">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary-500 flex items-center justify-center">
              <span className="text-white font-bold text-sm">P&R</span>
            </div>
            <span className="font-semibold text-gray-900">{t('app.name')}</span>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-gray-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="p-3 space-y-1 flex-1 overflow-y-auto">
          {visibleNav.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-600 hover:bg-cream-100 hover:text-gray-900'
                }`
              }
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-cream-200">
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-error-50 hover:text-error-700 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            {t('auth.signOut')}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-white border-b border-cream-200 px-4 py-3 flex items-center justify-between">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-gray-600">
            <Menu className="w-6 h-6" />
          </button>

          <div className="flex items-center gap-2 ms-auto">
            {/* Language switcher */}
            <div className="relative">
              <button
                onClick={() => setLangMenuOpen(!langMenuOpen)}
                className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-cream-100 transition-colors"
              >
                <Languages className="w-4 h-4" />
                <span>{i18n.language === 'ar' ? '\u0627\u0644\u0639\u0631\u0628\u064a\u0629' : 'EN'}</span>
                <ChevronDown className="w-3 h-3" />
              </button>
              {langMenuOpen && (
                <div className="absolute end-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-cream-200 py-1 min-w-[120px]">
                  <button onClick={() => toggleLang('en')} className="w-full px-3 py-2 text-start text-sm hover:bg-cream-50">
                    {t('common.english')}
                  </button>
                  <button onClick={() => toggleLang('ar')} className="w-full px-3 py-2 text-start text-sm hover:bg-cream-50">
                    {t('common.arabic')}
                  </button>
                </div>
              )}
            </div>

            {/* User info */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-cream-50">
              <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                <span className="text-primary-700 text-xs font-medium">
                  {user?.email?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="hidden sm:block">
                <p className="text-sm font-medium text-gray-900 truncate max-w-[150px]">
                  {user?.email}
                </p>
                <p className="text-xs text-gray-500 capitalize">
                  {roles.map((r) => r.role_name.replace('_', ' ')).join(', ')}
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
