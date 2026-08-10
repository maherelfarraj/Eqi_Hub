import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { Shield, Loader2 } from 'lucide-react';

export default function BootstrapPage() {
  const { t } = useTranslation();
  const { session, refreshRoles } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleBootstrap = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bootstrap-owner`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
        }
      );
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || t('auth.bootstrapFailed'));
      } else {
        setSuccess(true);
        await refreshRoles();
      }
    } catch {
      setError(t('auth.bootstrapFailed'));
    }
    setLoading(false);
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream-50 px-4">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-success-500 mb-4">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('auth.bootstrapSuccess')}</h1>
          <p className="text-gray-600">Redirecting to dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-cream-50 px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-xl shadow-lg border border-cream-200 p-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary-100 mb-6">
            <Shield className="w-8 h-8 text-primary-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">{t('auth.bootstrap')}</h2>
          <p className="text-gray-600 mb-6">{t('auth.bootstrapDesc')}</p>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-error-50 text-error-700 text-sm">
              {error}
            </div>
          )}

          <button
            onClick={handleBootstrap}
            disabled={loading}
            className="w-full py-3 rounded-lg bg-primary-500 text-white font-medium hover:bg-primary-600 disabled:opacity-50 transition-colors inline-flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-5 h-5 animate-spin" />}
            {loading ? t('common.loading') : t('auth.bootstrap')}
          </button>
        </div>
      </div>
    </div>
  );
}
