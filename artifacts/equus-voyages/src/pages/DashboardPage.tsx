import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { LayoutDashboard } from 'lucide-react';

export default function DashboardPage() {
  const { t } = useTranslation();
  const { user, roles } = useAuth();

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <LayoutDashboard className="w-6 h-6 text-primary-600" />
        <h1 className="text-2xl font-bold text-gray-900">{t('nav.dashboard')}</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-cream-200 p-6">
          <h3 className="text-sm font-medium text-gray-500 mb-1">Welcome back</h3>
          <p className="text-lg font-semibold text-gray-900">{user?.email}</p>
          <p className="text-sm text-gray-500 mt-1 capitalize">
            {roles.map((r) => r.role_name.replace('_', ' ')).join(', ')}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-cream-200 p-6">
          <h3 className="text-sm font-medium text-gray-500 mb-1">System Status</h3>
          <p className="text-lg font-semibold text-success-700">Active</p>
          <p className="text-sm text-gray-500 mt-1">All systems operational</p>
        </div>

        <div className="bg-white rounded-xl border border-cream-200 p-6">
          <h3 className="text-sm font-medium text-gray-500 mb-1">Coming Soon</h3>
          <p className="text-lg font-semibold text-gray-900">Scheduling, Riders, Horses</p>
          <p className="text-sm text-gray-500 mt-1">Phases 2-5 will add full functionality</p>
        </div>
      </div>
    </div>
  );
}
