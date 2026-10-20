import { ProfileRowsSkeleton } from '../../components/layout/PageSkeletons';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Button, ConfirmDialog, Tag } from '../../components/ui';
import { API, showSuccess } from '../../helpers';
import { clearAuthentication } from '../../lib/auth-session';
import { authResult } from '../../lib/secure-verification';
import { apiErrorMessage } from '../../lib/api-error';
import { useOwnedOperation } from '../../hooks/useOwnedOperation';
import { useAuthStore } from '../../stores/auth-store';
import type { LoginSession } from '../../stores/auth-store';
import { SettingGroup, SettingRow } from './ProfileSettingsLayout';

function Sessions({ identity }: { identity: string }) {
  const { t, i18n } = useTranslation();
  const [confirm, setConfirm] = useState<LoginSession | 'others' | null>(null);
  const { busy, run } = useOwnedOperation();
  const sessions = useQuery({
    queryKey: ['personal-login-sessions', identity],
    queryFn: ({ signal }) => authResult<LoginSession[]>(API.get('/api/user/sessions', { signal, skipErrorHandler: true, disableDuplicate: true })),
    gcTime: 0, retry: false, refetchOnWindowFocus: false,
  });
  const revoke = () => void run(async (signal) => {
    if (!confirm) return;
    if (confirm === 'others') await authResult(API.post('/api/user/sessions/revoke-others', {}, { signal, skipErrorHandler: true }));
    else {
      const result = await authResult<{ current: boolean }>(API.delete(`/api/user/sessions/${encodeURIComponent(confirm.sid)}`, { signal, skipErrorHandler: true }));
      signal.throwIfAborted(); if (result.current) { clearAuthentication(); return; }
    }
    signal.throwIfAborted(); setConfirm(null); showSuccess(t('Login sessions revoked')); await sessions.refetch();
  });
  const message = sessions.error && apiErrorMessage(sessions.error, 'Unable to load login sessions');
  const formatDate = (value: number) => value > 0 ? new Date(value * 1000).toLocaleString(i18n.language) : '—';
  return <>
    <SettingGroup title={t('Login devices')}>
      <SettingRow title={t('Manage login sessions')} description={t('Revoked devices must sign in again')}>
        <Button variant='toggle' onClick={() => setConfirm('others')} disabled={busy || !sessions.data?.some((session) => !session.current)}>{t('Sign out other devices')}</Button>
      </SettingRow>
      {sessions.isPending && <ProfileRowsSkeleton lines={4} />}
      {message && <div role='alert' className='p-4 text-sm text-ui-text-2'>{t(message)} <Button onClick={() => void sessions.refetch()} loading={sessions.isFetching}>{t('Retry')}</Button></div>}
      {sessions.data?.map((session, index) => <SettingRow key={session.sid} last={index === (sessions.data?.length ?? 0) - 1}
        title={<span>{t(session.current ? 'Current device' : 'Other device')} {session.current && <Tag color='green'>{t('Current')}</Tag>}</span>}
        description={<><span className='break-all'>{session.user_agent || t('Unknown browser')}</span><br />{session.ip} · {session.login_method}<br />{t('Last active')}: {formatDate(session.last_active_at)}<br />{t('Expires')}: {formatDate(session.expires_at)}</>}>
        <Button variant='toggle' disabled={busy} onClick={() => setConfirm(session)}>{t('Sign out')}</Button>
      </SettingRow>)}
    </SettingGroup>
    <ConfirmDialog closeOnConfirm={false} open={!!confirm} title={t(confirm === 'others' ? 'Sign out other devices' : 'Sign out this device')}
      description={t('Revoke this login session? The device must sign in again.')}
      onClose={() => { if (!busy) setConfirm(null); }} onConfirm={revoke} loading={busy} confirmText={t('Confirm')} cancelText={t('Cancel')} />
  </>;
}

export default function LoginSessions() {
  const identity = useAuthStore((state) => `${state.auth.user?.id}:${state.auth.session?.sid}`);
  return <Sessions key={identity} identity={identity} />;
}
