import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import { Settings, Loader2, Save } from 'lucide-react';

interface AppSetting {
  id: string;
  key: string;
  value: any;
}

export default function SettingsPage() {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<AppSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [timezone, setTimezone] = useState('Asia/Amman');
  const [currency, setCurrency] = useState('JOD');
  const [dateFormat, setDateFormat] = useState('DD/MM/YYYY');
  const [taxRate, setTaxRate] = useState('16');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    const { data, error: fetchError } = await supabase
      .from('app_settings')
      .select('*')
      .is('branch_id', null);

    if (fetchError) {
      setError(fetchError.message);
    } else if (data) {
      setSettings(data);
      data.forEach((s) => {
        const val = typeof s.value === 'string' ? s.value : JSON.stringify(s.value);
        const cleanVal = val.replace(/^"|"$/g, '');
        switch (s.key) {
          case 'timezone': setTimezone(cleanVal); break;
          case 'currency': setCurrency(cleanVal); break;
          case 'date_format': setDateFormat(cleanVal); break;
          case 'tax_rate': setTaxRate(String(parseFloat(cleanVal) * 100)); break;
        }
      });
    }
    setLoading(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    const updates = [
      { key: 'timezone', value: JSON.stringify(timezone) },
      { key: 'currency', value: JSON.stringify(currency) },
      { key: 'date_format', value: JSON.stringify(dateFormat) },
      { key: 'tax_rate', value: parseFloat(taxRate) / 100 },
    ];

    for (const upd of updates) {
      const existing = settings.find((s) => s.key === upd.key);
      if (existing) {
        const { error: updError } = await supabase
          .from('app_settings')
          .update({ value: upd.value })
          .eq('id', existing.id);
        if (updError) {
          setError(updError.message);
          setSaving(false);
          return;
        }
      }
    }

    setSuccess(t('settings.saved'));
    setSaving(false);
    await fetchSettings();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Settings className="w-6 h-6 text-primary-600" />
        <h1 className="text-2xl font-bold text-gray-900">{t('settings.title')}</h1>
      </div>

      <div className="max-w-xl">
        <form onSubmit={handleSave} className="bg-white rounded-xl border border-cream-200 p-6 space-y-5">
          {error && <div className="p-3 rounded-lg bg-error-50 text-error-700 text-sm">{error}</div>}
          {success && <div className="p-3 rounded-lg bg-success-50 text-success-700 text-sm">{success}</div>}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.timezone')}</label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            >
              <option value="Asia/Amman">Asia/Amman</option>
              <option value="Asia/Riyadh">Asia/Riyadh</option>
              <option value="Asia/Dubai">Asia/Dubai</option>
              <option value="Europe/London">Europe/London</option>
              <option value="America/New_York">America/New_York</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.currency')}</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            >
              <option value="JOD">JOD - Jordanian Dinar</option>
              <option value="USD">USD - US Dollar</option>
              <option value="EUR">EUR - Euro</option>
              <option value="GBP">GBP - British Pound</option>
              <option value="SAR">SAR - Saudi Riyal</option>
              <option value="AED">AED - UAE Dirham</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.dateFormat')}</label>
            <select
              value={dateFormat}
              onChange={(e) => setDateFormat(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            >
              <option value="DD/MM/YYYY">DD/MM/YYYY</option>
              <option value="MM/DD/YYYY">MM/DD/YYYY</option>
              <option value="YYYY-MM-DD">YYYY-MM-DD</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.taxRate')}</label>
            <div className="relative">
              <input
                type="number"
                value={taxRate}
                onChange={(e) => setTaxRate(e.target.value)}
                min="0"
                max="100"
                step="0.1"
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
              />
              <span className="absolute end-4 top-1/2 -translate-y-1/2 text-gray-400">%</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-primary-500 text-white font-medium hover:bg-primary-600 disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {t('common.save')}
          </button>
        </form>
      </div>
    </div>
  );
}
