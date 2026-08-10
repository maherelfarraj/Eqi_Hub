import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Mail, Lock, User, Key, Eye, EyeOff } from 'lucide-react';

type AuthView = 'signIn' | 'signUp' | 'resetPassword';

export default function AuthPage() {
  const { t } = useTranslation();
  const { signIn, signUp, signUpWithInvitation, resetPassword } = useAuth();

  const urlToken = new URLSearchParams(window.location.search).get('token') || '';

  const [view, setView] = useState<AuthView>(urlToken ? 'signUp' : 'signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [fullName, setFullName] = useState('');
  const [invToken, setInvToken] = useState(urlToken);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [openRegistration, setOpenRegistration] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.rpc('is_open_registration').then(({ data }) => {
      setOpenRegistration(data === true);
    });
  }, []);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error: err } = await signIn(email, password);
    if (err) setError(err);
    setLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!openRegistration && !invToken.trim()) {
      setError(t('auth.invitationRequired'));
      return;
    }
    if (password !== confirmPwd) {
      setError(t('auth.passwordMismatch'));
      return;
    }
    setLoading(true);
    let result;
    if (invToken.trim()) {
      result = await signUpWithInvitation(email, password, fullName, invToken.trim());
    } else {
      result = await signUp(email, password, fullName);
      if (!result.error) {
        result = await signIn(email, password);
      }
    }
    if (result.error) {
      setError(result.error);
      setLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error: err } = await resetPassword(email);
    if (err) setError(err);
    else setSuccess(t('auth.resetEmailSent'));
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-cream-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary-500 mb-4">
            <span className="text-white text-2xl font-bold">P&R</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{t('app.name')}</h1>
          <p className="text-gray-600 mt-1">{t('app.tagline')}</p>
        </div>

        <div className="bg-white rounded-xl shadow-lg border border-cream-200 p-8">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-error-50 text-error-700 text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 p-3 rounded-lg bg-success-50 text-success-700 text-sm">
              {success}
            </div>
          )}

          {view === 'signIn' && (
            <form onSubmit={handleSignIn} className="space-y-4">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">{t('auth.signIn')}</h2>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('auth.email')}</label>
                <div className="relative">
                  <Mail className="absolute start-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full ps-10 pe-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-colors"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('auth.password')}</label>
                <div className="relative">
                  <Lock className="absolute start-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full ps-10 pe-12 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-colors"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute end-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-lg bg-primary-500 text-white font-medium hover:bg-primary-600 disabled:opacity-50 transition-colors"
              >
                {loading ? t('common.loading') : t('auth.signIn')}
              </button>
              <div className="flex justify-between text-sm">
                <button type="button" onClick={() => { setView('resetPassword'); setError(''); setSuccess(''); }} className="text-primary-600 hover:text-primary-700">
                  {t('auth.forgotPassword')}
                </button>
                <button type="button" onClick={() => { setView('signUp'); setError(''); setSuccess(''); }} className="text-primary-600 hover:text-primary-700">
                  {t('auth.noAccount')}
                </button>
              </div>
            </form>
          )}

          {view === 'signUp' && (
            <form onSubmit={handleSignUp} className="space-y-4">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">{t('auth.signUp')}</h2>

              {openRegistration && (
                <div className="p-3 rounded-lg bg-primary-50 text-primary-800 text-sm border border-primary-200">
                  {t('auth.openRegistrationNotice')}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('auth.fullName')}</label>
                <div className="relative">
                  <User className="absolute start-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full ps-10 pe-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-colors"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('auth.email')}</label>
                <div className="relative">
                  <Mail className="absolute start-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full ps-10 pe-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-colors"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('auth.password')}</label>
                <div className="relative">
                  <Lock className="absolute start-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full ps-10 pe-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-colors"
                    required
                    minLength={6}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('auth.confirmPassword')}</label>
                <div className="relative">
                  <Lock className="absolute start-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="password"
                    value={confirmPwd}
                    onChange={(e) => setConfirmPwd(e.target.value)}
                    className="w-full ps-10 pe-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-colors"
                    required
                    minLength={6}
                  />
                </div>
              </div>

              {!openRegistration && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('auth.invitationToken')}</label>
                  <div className="relative">
                    <Key className="absolute start-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      value={invToken}
                      onChange={(e) => setInvToken(e.target.value)}
                      className="w-full ps-10 pe-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-colors"
                      required
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || openRegistration === null}
                className="w-full py-3 rounded-lg bg-primary-500 text-white font-medium hover:bg-primary-600 disabled:opacity-50 transition-colors"
              >
                {loading ? t('common.loading') : t('auth.signUp')}
              </button>
              <button type="button" onClick={() => { setView('signIn'); setError(''); setSuccess(''); }} className="w-full text-center text-sm text-primary-600 hover:text-primary-700">
                {t('auth.hasAccount')}
              </button>
            </form>
          )}

          {view === 'resetPassword' && (
            <form onSubmit={handleReset} className="space-y-4">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">{t('auth.resetPassword')}</h2>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('auth.email')}</label>
                <div className="relative">
                  <Mail className="absolute start-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full ps-10 pe-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-colors"
                    required
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-lg bg-primary-500 text-white font-medium hover:bg-primary-600 disabled:opacity-50 transition-colors"
              >
                {loading ? t('common.loading') : t('auth.sendResetLink')}
              </button>
              <button type="button" onClick={() => { setView('signIn'); setError(''); setSuccess(''); }} className="w-full text-center text-sm text-primary-600 hover:text-primary-700">
                {t('auth.backToSignIn')}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
