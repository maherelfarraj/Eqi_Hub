import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import { FileText, Loader2, ChevronDown, ChevronUp } from 'lucide-react';

interface AuditEntry {
  id: string;
  actor_id: string;
  action: string;
  table_name: string;
  record_id: string | null;
  before: any;
  after: any;
  created_at: string;
}

export default function AuditLogPage() {
  const { t } = useTranslation();
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    const { data, error: fetchError } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (fetchError) {
      setError(fetchError.message);
    } else {
      setLogs(data || []);
    }
    setLoading(false);
  };

  const formatAction = (action: string) => {
    return action.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
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
        <FileText className="w-6 h-6 text-primary-600" />
        <h1 className="text-2xl font-bold text-gray-900">{t('audit.title')}</h1>
      </div>

      {error && <div className="mb-4 p-3 rounded-lg bg-error-50 text-error-700 text-sm">{error}</div>}

      <div className="bg-white rounded-xl border border-cream-200 overflow-hidden">
        {logs.length === 0 ? (
          <div className="p-8 text-center text-gray-500">{t('audit.noEntries')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-cream-200 bg-cream-50">
                  <th className="text-start py-3 px-4 font-medium text-gray-500">{t('audit.timestamp')}</th>
                  <th className="text-start py-3 px-4 font-medium text-gray-500">{t('audit.action')}</th>
                  <th className="text-start py-3 px-4 font-medium text-gray-500">{t('audit.table')}</th>
                  <th className="text-start py-3 px-4 font-medium text-gray-500">{t('audit.details')}</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <>
                    <tr
                      key={log.id}
                      className="border-b border-cream-100 hover:bg-cream-50 cursor-pointer transition-colors"
                      onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                    >
                      <td className="py-3 px-4 text-gray-600 whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex px-2 py-1 rounded-md bg-primary-50 text-primary-700 text-xs font-medium">
                          {formatAction(log.action)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-600">{log.table_name}</td>
                      <td className="py-3 px-4">
                        <button className="text-gray-400 hover:text-gray-600">
                          {expandedId === log.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </td>
                    </tr>
                    {expandedId === log.id && (
                      <tr key={`${log.id}-detail`} className="bg-cream-50">
                        <td colSpan={4} className="px-4 py-3">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                            {log.before && (
                              <div>
                                <p className="font-medium text-gray-500 mb-1">Before</p>
                                <pre className="bg-white p-3 rounded border border-cream-200 overflow-x-auto whitespace-pre-wrap">
                                  {JSON.stringify(log.before, null, 2)}
                                </pre>
                              </div>
                            )}
                            {log.after && (
                              <div>
                                <p className="font-medium text-gray-500 mb-1">After</p>
                                <pre className="bg-white p-3 rounded border border-cream-200 overflow-x-auto whitespace-pre-wrap">
                                  {JSON.stringify(log.after, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                          <p className="mt-2 text-xs text-gray-400">
                            Actor: {log.actor_id || 'System'} | Record: {log.record_id || 'N/A'}
                          </p>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
