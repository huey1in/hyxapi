import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { API, showSuccess } from '../../helpers';
import { Button, Input, Modal, Tag } from '../../components/ui';
import { useOwnedOperation } from '../../hooks/useOwnedOperation';
import { authResult } from '../../lib/secure-verification';
import type { AuthUser } from '../../stores/auth-store';
import { parsePersonalSettings } from './personal-settings';
import type { RefreshProfile } from './personal-settings';
import { FieldGroup, SettingRow } from './ProfileSettingsLayout';

type VerificationFlow = { flow_token: string; email: string; expires_at: number; resend_at: number };

function VerifyNotificationEmail({ initial, refresh, close }: { initial: string; refresh: RefreshProfile; close: () => void }) {
  const { t } = useTranslation();
  const [email, setEmail] = useState(initial);
  const [code, setCode] = useState('');
  const [flow, setFlow] = useState<VerificationFlow | null>(null);
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  const { busy, run } = useOwnedOperation();
  useEffect(() => { const timer = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000); return () => clearInterval(timer); }, []);
  const countdown = Math.max(0, resendAt - now);
  const expired = !!flow && now >= flow.expires_at;
  const send = () => void run(async (signal) => {
    const address = email.trim().toLowerCase();
    if (!z.email().safeParse(address).success) throw new Error('Invalid notification email');
    const result = await authResult<VerificationFlow>(API.post('/api/user/notification_email/start', { email: address }, { signal, skipErrorHandler: true }));
    signal.throwIfAborted(); setFlow(result); setEmail(result.email); setCode(''); setResendAt(result.resend_at); setNow(Math.floor(Date.now() / 1000));
    showSuccess(t('Verification code sent; check your email'));
  });
  const verify = () => void run(async (signal) => {
    if (!flow || expired) throw new Error('Send a verification code first');
    if (!/^\d{6}$/.test(code.trim())) throw new Error('Enter a six-digit verification code');
    await authResult(API.post('/api/user/notification_email/confirm', { flow_token: flow.flow_token, code: code.trim() }, { signal, skipErrorHandler: true, singleUseAuthorization: true }));
    signal.throwIfAborted(); await refresh(signal); showSuccess(t('Notification email verified')); close();
  });
  return <Modal open width={380} title={t('Verify notification email')} onClose={close} footer={<><Button onClick={close}>{t('Cancel')}</Button><Button onClick={verify} loading={busy} disabled={!flow || expired || !/^\d{6}$/.test(code.trim())}>{t('Verify')}</Button></>}>
    <FieldGroup label={t('Notification Email')}><div className='flex items-center gap-2'>
      <Input aria-label={t('Notification Email')} type='email' autoComplete='email' value={email} onChange={(value) => { setEmail(value); setFlow(null); setCode(''); }} disabled={busy} width='full' />
      <Button onClick={send} loading={busy} disabled={countdown > 0} shrink={false}>{countdown > 0 ? `${countdown}s` : t('Send code')}</Button>
    </div></FieldGroup>
    {flow && <FieldGroup label={t('Email verification code')}><Input aria-label={t('Email verification code')} inputMode='numeric' autoComplete='one-time-code' maxLength={6} value={code} onChange={setCode} disabled={busy || expired} width='full' /></FieldGroup>}
    {expired && <p role='alert' className='text-sm text-ui-text-2'>{t('Verification flow expired')}</p>}
  </Modal>;
}

export default function NotificationEmailSettings({ user, refresh }: { user: AuthUser; refresh: RefreshProfile }) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const settings = parsePersonalSettings(user.setting);
  const address = settings.notification_email || user.email || '';
  const verified = !!settings.notification_email && settings.notification_email_verified;
  return <>
    <SettingRow title={t('Notification Email')} description={<span className='break-all'>{address || t('No email linked')}</span>} last>
      <div className='flex items-center gap-2'><Tag color={verified ? 'green' : 'grey'}>{t(verified ? 'Verified' : 'Not verified')}</Tag><Button variant='toggle' onClick={() => setEditing(true)}>{t(verified ? 'Change' : 'Verify')}</Button></div>
    </SettingRow>
    {editing && <VerifyNotificationEmail initial={address} refresh={refresh} close={() => setEditing(false)} />}
  </>;
}
