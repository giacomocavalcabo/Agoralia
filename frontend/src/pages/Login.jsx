import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/lib/useAuth';

export default function Login() {
  const { t } = useTranslation('pages');
  const { user, isLoading } = useAuth();

  const API = (import.meta.env.VITE_AUTH_URL || import.meta.env.VITE_API_URL)?.replace(/\/$/, '');
  const AUTH_URL = import.meta.env.VITE_AUTH_URL || `${API}/auth/login`;

  useEffect(() => {
    if (!isLoading && user?.id) window.location.replace('/');
  }, [user, isLoading]);

  const start = () => {
    const redirect = encodeURIComponent(window.location.origin);
    window.location.href = `${AUTH_URL}?redirect=${redirect}`;
  };

  return (
    <div className="min-h-screen grid place-items-center bg-slate-50">
      <div className="w-full max-w-sm rounded-2xl border bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold mb-2">{t('auth.title','Sign in')}</h1>
        <p className="text-sm text-slate-600 mb-6">
          {t('auth.subtitle','Access your Agoralia workspace')}
        </p>
        <button
          onClick={start}
          className="w-full rounded-lg bg-primary-600 text-white py-2.5 font-medium hover:bg-primary-700 focus:ring-4 focus:ring-primary-300"
        >
          {t('auth.cta','Continue')}
        </button>
      </div>
    </div>
  );
}
