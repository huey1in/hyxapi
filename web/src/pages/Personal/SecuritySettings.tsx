import { useContext, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Copy, Fingerprint, KeyRound, Trash2 } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { API, copy, showSuccess } from '../../helpers';
import { Button, ConfirmDialog, IconButton, Input, Modal, Tag } from '../../components/ui';
import { useOwnedOperation } from '../../hooks/useOwnedOperation';
import { authResult } from '../../lib/secure-verification';
import { apiErrorMessage } from '../../lib/api-error';
import { isPasskeySupported, prepareCredentialCreationOptions, buildRegistrationResult } from '../../lib/passkey';
import type { RefreshProfile } from './personal-settings';
import type { AuthUser } from '../../stores/auth-store';
import { PasswordSettings } from './AccountSettings';
import { FieldGroup, SettingGroup, SettingRow } from './ProfileSettingsLayout';
import { StatusContext } from '../../context/Status';

type TwoFAStatus = { enabled: boolean; backup_codes_remaining?: number };
type PasskeyStatus = { enabled: boolean; last_used_at?: number };
type TwoFASetup = { secret: string; qr_code_data: string; backup_codes: string[]; flow_token: string; expires_at: number };

function SetupDialog({ setup, close, changed }: { setup: TwoFASetup; close: () => void; changed: RefreshProfile }) {
  const { t } = useTranslation();
  const [code, setCode] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const { busy, run } = useOwnedOperation();
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const expired = setup.expires_at * 1000 <= now;
  const enable = () => void run(async (signal) => {
    if (expired) throw new Error('Two-factor setup expired; start again');
    if (!/^\d{6}$/.test(code.trim())) throw new Error('Enter a six-digit verification code');
    await authResult(API.post('/api/user/2fa/enable', { flow_token: setup.flow_token, code: code.trim() }, { signal, skipErrorHandler: true, singleUseAuthorization: true, acceptAuthRotation: true }));
    signal.throwIfAborted(); await changed(signal); showSuccess(t('Two-factor authentication enabled')); close();
  });
  return <Modal open title={t('Set up two-factor authentication')} onClose={close} onConfirm={enable} loading={busy} confirmText={t('Enable')} cancelText={t('Cancel')}>
    <p className='text-sm text-ui-text-2'>{t('Scan the QR code with a TOTP app or enter the secret manually')}</p>
    <QRCodeSVG value={setup.qr_code_data} size={180} marginSize={4} title={t('Two-factor authentication QR code')} className='mx-auto rounded-xl border border-ui-border' />
    <div className='flex items-center gap-2 rounded-xl bg-ui-bg-subtle p-3'><code className='min-w-0 flex-1 break-all text-xs'>{setup.secret}</code><IconButton icon={Copy} aria-label={t('Copy setup secret')} onClick={() => void copy(setup.secret)} /></div>
    <FieldGroup label={t('Six-digit verification code')}><Input aria-label={t('Six-digit verification code')} value={code} onChange={setCode} inputMode='numeric' autoComplete='one-time-code' maxLength={6} disabled={busy || expired} width='full' /></FieldGroup>
    <p className='text-xs text-ui-text-3'>{t('Save your backup codes before enabling two-factor authentication')}</p>
    <pre className='max-h-32 overflow-auto whitespace-pre-wrap rounded-xl bg-ui-bg-subtle p-3 text-xs'>{setup.backup_codes.join('\n')}</pre>
    {expired && <p role='alert' className='text-sm text-ui-text-2'>{t('Two-factor setup expired; start again')}</p>}
  </Modal>;
}

export default function SecuritySettings({ identity, user, refresh }: { identity: string; user: AuthUser; refresh: RefreshProfile }) {
  const { t, i18n } = useTranslation();
  const [statusState] = useContext(StatusContext);
  const passkeyEnabled = statusState.status?.passkey_login === true;
  const twofaEnabled = statusState.status?.two_factor_enabled === true;
  const [supported, setSupported] = useState(false);
  const [setup, setSetup] = useState<TwoFASetup | null>(null);
  const [confirm, setConfirm] = useState<'passkey' | 'twofa' | null>(null);
  const [backup, setBackup] = useState<string[] | null>(null);
  const { busy, run } = useOwnedOperation();
  const twofaQuery = useQuery({
    queryKey: ['personal-security', identity, 'twofa'], enabled: twofaEnabled,
    queryFn: ({ signal }) => authResult<TwoFAStatus>(API.get('/api/user/2fa/status', { signal, skipErrorHandler: true })),
    gcTime: 0, retry: false, refetchOnWindowFocus: false,
  });
  const passkeyQuery = useQuery({
    queryKey: ['personal-security', identity, 'passkey'], enabled: passkeyEnabled,
    queryFn: ({ signal }) => authResult<PasskeyStatus>(API.get('/api/user/passkey', { signal, skipErrorHandler: true })),
    gcTime: 0, retry: false, refetchOnWindowFocus: false,
  });
  useEffect(() => { if (!passkeyEnabled) return; let active = true; void isPasskeySupported().then((value) => { if (active) setSupported(value); }).catch(() => {}); return () => { active = false; }; }, [passkeyEnabled]);
  const changed: RefreshProfile = async (signal) => {
    await refresh(signal); signal.throwIfAborted();
    await Promise.all([...(twofaEnabled ? [twofaQuery.refetch()] : []), ...(passkeyEnabled ? [passkeyQuery.refetch()] : [])]);
    signal.throwIfAborted();
  };
  const register = () => void run(async (signal) => {
    const begin = await authResult<{ options: unknown; flow_token: string }>(API.post('/api/user/passkey/register/begin', {}, { signal, skipErrorHandler: true }));
    const credential = await navigator.credentials.create({ publicKey: prepareCredentialCreationOptions(begin.options), signal });
    signal.throwIfAborted(); if (!(credential instanceof PublicKeyCredential)) throw new Error('Passkey registration cancelled');
    await authResult(API.post('/api/user/passkey/register/finish', { flow_token: begin.flow_token, credential: buildRegistrationResult(credential) }, { signal, skipErrorHandler: true, singleUseAuthorization: true, acceptAuthRotation: true }));
    signal.throwIfAborted(); await changed(signal); showSuccess(t('Passkey saved'));
  });
  const startSetup = () => void run(async (signal) => {
    const result = await authResult<TwoFASetup>(API.post('/api/user/2fa/setup', {}, { signal, skipErrorHandler: true }));
    signal.throwIfAborted(); setSetup(result);
  });
  const remove = () => void run(async (signal) => {
    if (!confirm) return;
    if (confirm === 'passkey') await authResult(API.delete('/api/user/passkey', { signal, skipErrorHandler: true, acceptAuthRotation: true }));
    else await authResult(API.post('/api/user/2fa/disable', {}, { signal, skipErrorHandler: true, acceptAuthRotation: true }));
    signal.throwIfAborted(); await changed(signal); setConfirm(null); showSuccess(t('Security settings updated'));
  });
  const regenerate = () => void run(async (signal) => {
    const result = await authResult<{ backup_codes: string[] }>(API.post('/api/user/2fa/backup_codes', {}, { signal, skipErrorHandler: true, acceptAuthRotation: true }));
    signal.throwIfAborted(); setBackup(result.backup_codes); await changed(signal);
  });
  const twofa = twofaQuery.data;
  const passkey = passkeyQuery.data;
  const failedQueries = [...(twofaEnabled && twofaQuery.error ? [twofaQuery] : []), ...(passkeyEnabled && passkeyQuery.error ? [passkeyQuery] : [])];
  const message = failedQueries.length > 0 && apiErrorMessage(failedQueries[0].error, 'Unable to load security settings');
  const twofaDisabled = busy || !twofa || !!twofaQuery.error;
  const passkeyDisabled = busy || !passkey || !!passkeyQuery.error;
  return <>
    <SettingGroup title={t('Security')}>
      <PasswordSettings user={user} refresh={refresh} last={!passkeyEnabled && !twofaEnabled} />
      {message && <div role='alert' className='p-4 text-sm'>{t(message)} <Button onClick={() => void Promise.all(failedQueries.map((query) => query.refetch()))} loading={failedQueries.some((query) => query.isFetching)}>{t('Retry')}</Button></div>}
      {passkeyEnabled && <>
        <SettingRow title={<span className='inline-flex items-center gap-2'><Fingerprint size={15} />Passkey <Tag color={passkey?.enabled ? 'green' : 'grey'}>{t(passkey?.enabled ? 'Enabled' : 'Not enabled')}</Tag></span>}
          description={t(supported ? 'Sign in with a fingerprint or face recognition' : 'This browser does not support Passkey')} last={!twofaEnabled && !passkey?.enabled}>
          {supported && <Button onClick={register} loading={busy} disabled={passkeyDisabled}>{t(passkey?.enabled ? 'Replace' : 'Add')}</Button>}
        </SettingRow>
        {passkey?.enabled && <SettingRow title='Passkey' description={passkey.last_used_at ? t('Last used') + ': ' + new Date(passkey.last_used_at * 1000).toLocaleString(i18n.language) : t('Never used')} last={!twofaEnabled}>
          <IconButton icon={Trash2} variant='danger' aria-label={t('Delete Passkey')} title={t('Delete Passkey')} disabled={passkeyDisabled} onClick={() => setConfirm('passkey')} />
        </SettingRow>}
      </>}
      {twofaEnabled && <SettingRow title={<span className='inline-flex items-center gap-2'><KeyRound size={15} />{t('Two-factor authentication')} <Tag color={twofa?.enabled ? 'green' : 'grey'}>{t(twofa?.enabled ? 'Enabled' : 'Not enabled')}</Tag></span>}
        description={twofa?.enabled ? <>{t('Backup codes remaining: {{count}}', { count: twofa.backup_codes_remaining ?? 0 })} <Button variant='link' disabled={twofaDisabled} onClick={regenerate}>{t('Regenerate')}</Button></> : t('Protect sign-in with a TOTP app')} last>
        <Button variant='toggle' onClick={() => twofa?.enabled ? setConfirm('twofa') : startSetup()} loading={busy} disabled={twofaDisabled}>{t(twofa?.enabled ? 'Disable' : 'Enable')}</Button>
      </SettingRow>}
    </SettingGroup>
    {twofaEnabled && setup && <SetupDialog setup={setup} close={() => setSetup(null)} changed={changed} />}
    <ConfirmDialog open={confirm === 'passkey' ? passkeyEnabled : confirm === 'twofa' && twofaEnabled} closeOnConfirm={false} title={t(confirm === 'passkey' ? 'Delete Passkey' : 'Disable two-factor authentication')} description={t('Continue to verify this security change.')}
      onClose={() => { if (!busy) setConfirm(null); }} onConfirm={remove} loading={busy} confirmText={t('Confirm')} cancelText={t('Cancel')} />
    {twofaEnabled && backup && <Modal open title={t('Save backup codes')} onClose={() => setBackup(null)} onConfirm={() => void copy(backup.join('\n'))} confirmText={t('Copy backup codes')} cancelText={t('Close')}>
      <p className='text-sm text-ui-text-2'>{t('Each backup code can be used once. Save them now; they cannot be shown again after closing.')}</p><pre className='whitespace-pre-wrap rounded-xl bg-ui-bg-subtle p-3 text-xs'>{backup.join('\n')}</pre>
    </Modal>}
  </>;
}
