import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { UserPlus, Loader2, Send, Users, Clock, CheckCircle2 } from 'lucide-react';

interface Role {
  id: string;
  name: string;
  description: string;
}

interface Invitation {
  id: string;
  email: string;
  token: string;
  expires_at: string;
  accepted_at: string | null;
  roles: { name: string };
}

interface UserProfile {
  id: string;
  full_name: string;
  email?: string;
  is_active: boolean;
  user_roles: { roles: { name: string }; branch_id: string | null }[];
}

export default function UsersPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [roles, setRoles] = useState<Role[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [invEmail, setInvEmail] = useState('');
  const [invRole, setInvRole] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [rolesRes, invRes, usersRes] = await Promise.all([
      supabase.from('roles').select('*').order('rank'),
      supabase.from('invitations').select('*, roles(name)').is('deleted_at', null).order('created_at', { ascending: false }),
      supabase.from('profiles').select('id, full_name, is_active, user_roles(roles(name), branch_id)').is('deleted_at', null),
    ]);

    if (rolesRes.data) setRoles(rolesRes.data);
    if (invRes.data) setInvitations(invRes.data as any);
    if (usersRes.data) setUsers(usersRes.data as any);
    setLoading(false);
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSending(true);

    if (!invEmail || !invRole) {
      setError('Email and role are required');
      setSending(false);
      return;
    }

    const { error: insertError } = await supabase.from('invitations').insert({
      email: invEmail,
      role_id: invRole,
      invited_by: user!.id,
    });

    if (insertError) {
      setError(insertError.message);
    } else {
      setSuccess(t('users.inviteSent'));
      setInvEmail('');
      setInvRole('');
      await fetchData();
    }
    setSending(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
      </div>
    );
  }

  const staffRoles = roles.filter((r) => !['adult_rider', 'parent_guardian', 'junior_rider'].includes(r.name));

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <UserPlus className="w-6 h-6 text-primary-600" />
        <h1 className="text-2xl font-bold text-gray-900">{t('users.title')}</h1>
      </div>

      {/* Invite form */}
      <div className="bg-white rounded-xl border border-cream-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('users.invite')}</h2>
        {error && <div className="mb-4 p-3 rounded-lg bg-error-50 text-error-700 text-sm">{error}</div>}
        {success && <div className="mb-4 p-3 rounded-lg bg-success-50 text-success-700 text-sm">{success}</div>}

        <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-3">
          <input
            type="email"
            value={invEmail}
            onChange={(e) => setInvEmail(e.target.value)}
            placeholder={t('users.email')}
            className="flex-1 px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            required
          />
          <select
            value={invRole}
            onChange={(e) => setInvRole(e.target.value)}
            className="px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            required
          >
            <option value="">{t('users.role')}</option>
            {staffRoles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name.replace('_', ' ')}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={sending}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-primary-500 text-white font-medium hover:bg-primary-600 disabled:opacity-50 transition-colors"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {t('users.send')}
          </button>
        </form>
      </div>

      {/* Pending invitations */}
      <div className="bg-white rounded-xl border border-cream-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-warning-500" />
          {t('users.pending')}
        </h2>
        {invitations.filter((i) => !i.accepted_at).length === 0 ? (
          <p className="text-gray-500 text-sm">{t('common.noResults')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-cream-200">
                  <th className="text-start py-2 px-3 font-medium text-gray-500">{t('users.email')}</th>
                  <th className="text-start py-2 px-3 font-medium text-gray-500">{t('users.role')}</th>
                  <th className="text-start py-2 px-3 font-medium text-gray-500">Token</th>
                  <th className="text-start py-2 px-3 font-medium text-gray-500">{t('users.expires')}</th>
                </tr>
              </thead>
              <tbody>
                {invitations.filter((i) => !i.accepted_at).map((inv) => (
                  <tr key={inv.id} className="border-b border-cream-100">
                    <td className="py-2 px-3 text-gray-900">{inv.email}</td>
                    <td className="py-2 px-3 capitalize text-gray-600">{inv.roles?.name?.replace('_', ' ')}</td>
                    <td className="py-2 px-3">
                      <code className="text-xs bg-cream-100 px-2 py-1 rounded break-all">{inv.token}</code>
                    </td>
                    <td className="py-2 px-3 text-gray-500">{new Date(inv.expires_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Active users */}
      <div className="bg-white rounded-xl border border-cream-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Users className="w-5 h-5 text-primary-500" />
          {t('users.active')}
        </h2>
        {users.length === 0 ? (
          <p className="text-gray-500 text-sm">{t('common.noResults')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-cream-200">
                  <th className="text-start py-2 px-3 font-medium text-gray-500">Name</th>
                  <th className="text-start py-2 px-3 font-medium text-gray-500">Roles</th>
                  <th className="text-start py-2 px-3 font-medium text-gray-500">{t('users.status')}</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-cream-100">
                    <td className="py-2 px-3 text-gray-900">{u.full_name}</td>
                    <td className="py-2 px-3 capitalize text-gray-600">
                      {u.user_roles?.map((ur: any) => ur.roles?.name?.replace('_', ' ')).join(', ') || 'No role'}
                    </td>
                    <td className="py-2 px-3">
                      {u.is_active ? (
                        <span className="inline-flex items-center gap-1 text-success-700">
                          <CheckCircle2 className="w-4 h-4" /> Active
                        </span>
                      ) : (
                        <span className="text-gray-400">Inactive</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
