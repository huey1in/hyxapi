import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { API, showSuccess } from '../../helpers';
import { Button, Input, Modal } from '../../components/ui';
import { useOwnedOperation } from '../../hooks/useOwnedOperation';
import { clearAuthentication } from '../../lib/auth-session';
import { authResult } from '../../lib/secure-verification';
import { requestVerification } from '../../lib/verification-request';
import type { AuthUser } from '../../stores/auth-store';
import type { RefreshProfile } from './personal-settings';
import { passwordPayload } from './personal-settings';
import { FieldGroup, SettingGroup, SettingRow } from './ProfileSettingsLayout';

function PasswordDialog({ user, refresh, close }: { user: AuthUser; refresh: RefreshProfile; close: () => void }) {
  const { t } = useTranslation();
  const [original, setOriginal] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const { busy, run } = useOwnedOperation();
  const save = () => void run(async (signal) => {
    const payload = passwordPayload(user.has_password !== false, { original, password, confirmation });
    await authResult(API.put('/api/user/self', payload, { signal, skipErrorHandler: true, acceptAuthRotation: true }));
    signal.throwIfAborted(); await refresh(signal); showSuccess(t('Password updated')); close();
  });
  return <Modal open title={t(user.has_password === false ? 'Set password' : 'Change password')} onClose={close} onConfirm={save} loading={busy} confirmText={t('Save')} cancelText={t('Cancel')}>
    <fieldset disabled={busy} className='m-0 space-y-3 border-0 p-0'>
      {user.has_password !== false && <FieldGroup label={t('Current password')}><Input aria-label={t('Current password')} type='password' autoComplete='current-password' value={original} onChange={setOriginal} width='full' /></FieldGroup>}
      <FieldGroup label={t('New password')}><Input aria-label={t('New password')} type='password' autoComplete='new-password' value={password} onChange={setPassword} width='full' /></FieldGroup>
      <FieldGroup label={t('Confirm password')}><Input aria-label={t('Confirm password')} type='password' autoComplete='new-password' value={confirmation} onChange={setConfirmation} width='full' /></FieldGroup>
    </fieldset>
  </Modal>;
}

type EmailFlow = { flow_token: string; old_email_required: boolean; current_email: string; expires_at: number; resend_at: number };
function EmailDialog({ user, refresh, close }: { user: AuthUser; refresh: RefreshProfile; close: () => void }) {
  const { t } = useTranslation();
  const [email, setEmail] = useState(user.email || '');
  const [flow, setFlow] = useState<EmailFlow | null>(null);
  const [code, setCode] = useState('');
  const [oldCode, setOldCode] = useState('');
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  const { busy, run } = useOwnedOperation();
  useEffect(() => { const timer = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000); return () => clearInterval(timer); }, []);
  const expired = !!flow && now >= flow.expires_at;
  const countdown = flow ? Math.max(0, flow.resend_at - now) : 0;
  const send = () => void run(async (signal) => {
    if (!email.trim()) throw new Error('Enter an email address');
    const starting = !flow || expired;
    const address = email.trim().toLowerCase();
    // A proof-less attempt also consumes the email endpoint's send allowance.
    const proof = starting ? await requestVerification({ scope: 'account.binding.bind', context: { provider: 'email', email: address } }, signal) : null;
    const result = await authResult<EmailFlow>(API.post(starting ? '/api/oauth/email/bind/start' : '/api/oauth/email/bind/resend', starting ? { email: address } : { flow_token: flow?.flow_token }, {
      signal, skipErrorHandler: true, ...(proof ? { headers: { 'X-Security-Proof': proof.proof_token }, singleUseAuthorization: true } : {}),
    }));
    signal.throwIfAborted(); setFlow(result); setCode(''); setOldCode(''); showSuccess(t('Verification code sent; check your email'));
  });
  const bind = () => void run(async (signal) => {
    if (!flow || expired) throw new Error('Send a verification code first');
    if (!code.trim() || (flow.old_email_required && !oldCode.trim())) throw new Error('Enter all required email verification codes');
    await authResult(API.post('/api/oauth/email/bind', { flow_token: flow.flow_token, new_code: code.trim(), old_code: oldCode.trim() }, { signal, skipErrorHandler: true, singleUseAuthorization: true }));
    signal.throwIfAborted(); await refresh(signal); showSuccess(t('Email linked')); close();
  });
  return <Modal open title={t(user.email ? 'Change email' : 'Link email')} onClose={close} onConfirm={bind} loading={busy} confirmText={t('Confirm')} cancelText={t('Cancel')}>
    <FieldGroup label={t('Email address')}><div className='flex items-center gap-2'>
      <Input aria-label={t('Email address')} type='email' value={email} onChange={(value) => { setEmail(value); setFlow(null); setCode(''); setOldCode(''); }} disabled={busy} width='full' />
      <Button onClick={send} loading={busy} disabled={countdown > 0} shrink={false}>{countdown > 0 ? `${countdown}s` : t('Send code')}</Button>
    </div></FieldGroup>
    {flow && <FieldGroup label={t('New email verification code')}><Input aria-label={t('New email verification code')} value={code} onChange={setCode} disabled={busy || expired} width='full' /></FieldGroup>}
    {flow?.old_email_required && <FieldGroup label={t('Current email verification code')} hint={flow.current_email}><Input aria-label={t('Current email verification code')} value={oldCode} onChange={setOldCode} disabled={busy || expired} width='full' /></FieldGroup>}
    {expired && <p role='alert' className='text-sm text-ui-text-2'>{t('Email verification expired; send a new code')}</p>}
  </Modal>;
}

function DeleteAccountDialog({ user, close }: { user: AuthUser; close: () => void }) {
  const { t } = useTranslation();
  const [confirmation, setConfirmation] = useState('');
  const { busy, run } = useOwnedOperation();
  const remove = () => void run(async (signal) => {
    if (confirmation !== user.username || user.role >= 100) throw new Error('Enter your username to confirm account deletion');
    await authResult(API.delete('/api/user/self', { signal, skipErrorHandler: true }));
    signal.throwIfAborted(); clearAuthentication();
  });
  return <Modal open title={t('Delete account')} onClose={close} footer={<><Button onClick={close}>{t('Cancel')}</Button><Button onClick={remove} loading={busy} disabled={confirmation !== user.username}>{t('Delete account')}</Button></>}>
    <p className='text-sm text-ui-text-2'>{t('Deleting your account revokes its API tokens and signs out every device.')}</p>
    <FieldGroup label={t('Enter {{username}} to confirm', { username: user.username })}><Input aria-label={t('Confirm account username')} value={confirmation} onChange={setConfirmation} disabled={busy} width='full' autoComplete='off' /></FieldGroup>
  </Modal>;
}

export default function AccountSettings({ user, refresh }: { user: AuthUser; refresh: RefreshProfile }) {
  const { t } = useTranslation();
  const [dialog, setDialog] = useState<'email' | 'password' | 'delete' | null>(null);
  return <>
    <SettingGroup title={t('Account')}>
      <SettingRow title={t('Email')} description={user.email || t('No email linked')}><Button variant='toggle' onClick={() => setDialog('email')}>{t(user.email ? 'Change' : 'Link account')}</Button></SettingRow>
      <SettingRow title={t('Password')} description={t(user.has_password === false ? 'Set a login password' : 'Change your login password')} last><Button variant='toggle' onClick={() => setDialog('password')}>{t(user.has_password === false ? 'Set password' : 'Change')}</Button></SettingRow>
    </SettingGroup>
    {dialog === 'password' && <PasswordDialog user={user} refresh={refresh} close={() => setDialog(null)} />}
    {dialog === 'email' && <EmailDialog user={user} refresh={refresh} close={() => setDialog(null)} />}
    {dialog === 'delete' && <DeleteAccountDialog user={user} close={() => setDialog(null)} />}
    {user.role < 100 && <SettingGroup title={t('Account actions')}><SettingRow title={t('Delete account')} description={t('Permanently close this account and revoke its access')} last><Button variant='toggle' onClick={() => setDialog('delete')}>{t('Delete account')}</Button></SettingRow></SettingGroup>}
  </>;
}
