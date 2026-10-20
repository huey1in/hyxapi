import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams, Link } from 'react-router-dom';
import { API, copy, showSuccess } from '../../helpers';
import { Card, Input, Button, Notice } from '../../components/ui';
import { useAuthOperation } from '../Auth/useAuthOperation';
import type { ApiEnvelope } from '../../types/api';

function ResetForm({ email, token }: { email: string; token: string }) {
  const { t } = useTranslation();
  const [countdown, setCountdown] = useState(0);
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const { busy, run } = useAuthOperation((message) => setError(t(message)));
  const isValid = !!email && !!token;
  useEffect(() => {
    if (!countdown) return;
    const timer = window.setTimeout(() => setCountdown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [countdown]);
  const submit = () => {
    if (!isValid || countdown || newPassword) return;
    void run('reset', async (signal) => {
      setError(''); setCountdown(30);
      const response = await API.post<ApiEnvelope<string>>('/api/user/reset', { email, token }, { signal, skipAuthRefresh: true, skipErrorHandler: true });
      signal.throwIfAborted();
      if (!response.data.success) throw new Error(response.data.message || 'Unable to reset password');
      if (typeof response.data.data !== 'string' || !response.data.data) throw new Error('Invalid password reset response');
      setNewPassword(response.data.data); showSuccess(t('Password reset successfully'));
    });
  };
  return <div className='min-h-screen flex items-start sm:items-center justify-center px-4 pt-24 pb-12' style={{ backgroundColor: 'var(--page-bg)' }}>
    <Card className='w-full max-w-sm'>
      <h2 className='text-2xl font-semibold text-ui-text-1 mb-6'>{t('Confirm password reset')}</h2>
      <div className='space-y-4'>
        {!isValid && <Notice kind='warning'>{t('Invalid reset link. Request a new password reset email.')}</Notice>}
        {error && <div role='alert'><Notice kind='warning'>{error}</Notice></div>}
        <div>
          <label className='block mb-2 text-sm font-medium text-ui-text-1'>{t('Email')}</label>
          <Input aria-label={t('Email')} variant='auth' size={44} width='full' type='email' value={email} disabled />
        </div>
        {newPassword && <div>
          <label className='block mb-2 text-sm font-medium text-ui-text-1'>{t('New password')}</label>
          <div className='flex gap-2 items-center'>
            <Input aria-label={t('New password')} variant='auth' size={44} width='full' value={newPassword} readOnly autoComplete='off' />
            <Button variant='secondary' shrink={false} onClick={() => void run('copy', async (signal) => { if (!await copy(newPassword)) throw new Error('Unable to copy password'); signal.throwIfAborted(); showSuccess(t('Copied')); })}>{t('Copy')}</Button>
          </div>
          <p className='text-sm text-ui-text-2 mt-2'>{t('Save this password before leaving. It will not be shown again.')}</p>
        </div>}
        <Button block size='lg' onClick={submit} disabled={busy || countdown > 0 || !!newPassword || !isValid} loading={busy}>
          {newPassword ? t('Password reset complete') : countdown ? t('Retry in {{seconds}}s', { seconds: countdown }) : t('Confirm password reset')}
        </Button>
      </div>
      <p className='mt-6 text-center text-sm text-ui-text-2'><Link to='/auth?mode=login' className='text-ui-text-1 font-medium underline'>{t('Return to sign-in')}</Link></p>
    </Card>
  </div>;
}
export default function PasswordResetConfirm() {
  const [params] = useSearchParams();
  const email = params.get('email') || ''; const token = params.get('token') || '';
  return <ResetForm key={`${email}:${token}`} email={email} token={token} />;
}
