import { useContext, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { API, showSuccess } from '../../helpers';
import { Button, ConfirmDialog, Input, Modal } from '../../components/ui';
import { StatusContext } from '../../context/Status';
import { authResult } from '../../lib/secure-verification';
import { requestVerification } from '../../lib/verification-request';
import { oauthExchange } from '../../lib/oauth-exchange';
import { apiErrorMessage } from '../../lib/api-error';
import { useAuthStore } from '../../stores/auth-store';
import { useOwnedOperation } from '../../hooks/useOwnedOperation';
import type { AuthUser } from '../../stores/auth-store';
import type { SecurityProof } from '../../features/auth/secure-verification/types';
import { FieldGroup, SettingGroup, SettingRow } from './ProfileSettingsLayout';

type Binding = { provider_id: number; provider_name: string; provider_slug: string; provider_user_id: string };
type Provider = { slug: string; name: string; bound: boolean };

function WeChatBinding({ qrCode, onClose, refresh }: { qrCode: string; onClose: () => void; refresh: (signal: AbortSignal) => Promise<void> }) {
  const { t } = useTranslation();
  const [code, setCode] = useState('');
  const { busy, run } = useOwnedOperation();
  const bind = () => void run(async (signal) => {
    const value = code.trim();
    if (!value || value.length > 128) throw new Error('Enter a valid WeChat verification code');
    await authResult(API.post('/api/oauth/wechat/bind', { code: value }, { signal, skipErrorHandler: true }));
    signal.throwIfAborted(); await refresh(signal); signal.throwIfAborted();
    showSuccess(t('Account linked')); onClose();
  });
  return <Modal open title={t('Link WeChat account')} onClose={onClose} onConfirm={bind} loading={busy} confirmText={t('Link account')} cancelText={t('Cancel')}>
    {qrCode ? <img src={qrCode} alt={t('WeChat verification QR code')} className='mx-auto h-48 w-48 object-contain' /> : <p className='text-sm text-ui-text-3'>{t('A WeChat QR code has not been configured')}</p>}
    <p className='text-sm text-ui-text-2'>{t('Scan the QR code and enter the verification code from WeChat')}</p>
    <FieldGroup label={t('Verification code')}><Input aria-label={t('WeChat verification code')} value={code} onChange={setCode} maxLength={128} disabled={busy} width='full' /></FieldGroup>
  </Modal>;
}

function Bindings({ identity }: { identity: string }) {
  const { t } = useTranslation();
  const [statusState] = useContext(StatusContext);
  const user = useAuthStore((state) => state.auth.user);
  const { busy, run } = useOwnedOperation();
  const [ready, setReady] = useState<{ provider: Provider; proof: SecurityProof } | null>(null);
  const [removing, setRemoving] = useState<Binding | null>(null);
  const [wechat, setWechat] = useState(false);
  const status = statusState.status ?? {};
  const query = useQuery({
    queryKey: ['personal-oauth-bindings', identity],
    queryFn: ({ signal }) => authResult<Binding[]>(API.get('/api/user/oauth/bindings', { signal, disableDuplicate: true, skipErrorHandler: true })),
    gcTime: 0, retry: false, refetchOnWindowFocus: false,
  });
  const bindings = query.data ?? [];
  const providers: Provider[] = [];
  const add = (enabled: unknown, slug: string, name: string, bound: unknown) => { if (enabled || bound) providers.push({ slug, name, bound: !!bound }); };
  add(status.github_oauth, 'github', 'GitHub', user?.github_id);
  add(status.discord_oauth, 'discord', 'Discord', user?.discord_id);
  add(status.oidc_enabled, 'oidc', typeof status.oidc_display_name === 'string' ? status.oidc_display_name : 'OIDC', user?.oidc_id);
  add(status.linuxdo_oauth, 'linuxdo', 'Linux DO', user?.linux_do_id);
  add(status.telegram_oauth, 'telegram', 'Telegram', user?.telegram_id);
  for (const provider of status.custom_oauth_providers ?? []) providers.push({ slug: provider.slug, name: provider.name || provider.slug, bound: bindings.some((item) => item.provider_id === provider.id) });
  const showWeChat = !!(status.wechat_login || user?.wechat_id);
  const refresh = async (signal: AbortSignal) => {
    const fresh = await authResult<AuthUser>(API.get('/api/user/self', { signal, disableDuplicate: true, skipErrorHandler: true }));
    signal.throwIfAborted(); useAuthStore.getState().auth.setUser(fresh);
    await query.refetch(); signal.throwIfAborted();
  };
  const prepare = (provider: Provider) => void run(async (signal) => {
    const proof = await requestVerification({ scope: 'account.binding.bind', context: { provider: provider.slug } }, signal);
    signal.throwIfAborted(); setReady({ provider, proof });
  });
  // This second explicit click opens the provider popup before asynchronous work.
  const bind = () => void run(async (signal) => {
    if (!ready) return;
    try {
      await oauthExchange(ready.provider.slug, 'bind', undefined, ready.proof.proof_token, signal);
      signal.throwIfAborted(); await refresh(signal); showSuccess(t('Account linked'));
    } finally { if (!signal.aborted) setReady(null); }
  });
  const unbind = () => void run(async (signal) => {
    if (!removing) return;
    await authResult(API.delete(`/api/user/oauth/bindings/${removing.provider_id}`, { signal, skipErrorHandler: true }));
    signal.throwIfAborted(); await refresh(signal); setRemoving(null); showSuccess(t('Account unlinked'));
  });
  const message = query.error && apiErrorMessage(query.error, 'Unable to load linked accounts');
  if (!providers.length && !bindings.length && !showWeChat && !query.error && !query.isPending) return null;
  return <>
    <SettingGroup title={t('Linked accounts')}>
      {query.isPending && <p className='p-4 text-sm text-ui-text-3'>{t('Loading...')}</p>}
      {message && <div role='alert' className='p-4 text-sm text-ui-text-2'>{t(message)} <Button onClick={() => void query.refetch()} loading={query.isFetching}>{t('Retry')}</Button></div>}
      {providers.map((provider, index) => <SettingRow key={provider.slug} title={provider.name} description={t(provider.bound ? 'Linked' : 'Not linked')} last={index === providers.length - 1 && !bindings.length && !showWeChat}>
        <Button variant='toggle' disabled={provider.bound || busy || wechat || !!query.error || query.isPending} onClick={() => prepare(provider)}>{t(provider.bound ? 'Linked' : 'Link account')}</Button>
      </SettingRow>)}
      {showWeChat && <SettingRow title={t('WeChat')} description={t(user?.wechat_id ? 'Linked' : 'Not linked')} last={!bindings.length}>
        <Button variant='toggle' disabled={!!user?.wechat_id || busy || wechat} onClick={() => setWechat(true)}>{t(user?.wechat_id ? 'Linked' : 'Link account')}</Button>
      </SettingRow>}
      {bindings.map((item, index) => <SettingRow key={item.provider_id} title={item.provider_name} description={t('Linked custom account')} last={index === bindings.length - 1}>
        <Button variant='toggle' disabled={busy || wechat} onClick={() => setRemoving(item)}>{t('Unlink account')}</Button>
      </SettingRow>)}
    </SettingGroup>
    <ConfirmDialog closeOnConfirm={false} open={!!ready} title={t('Continue linking account')} description={t('Verification completed. Continue to {{provider}} to authorize.', { provider: ready?.provider.name ?? '' })}
      onClose={() => { if (!busy) setReady(null); }} onConfirm={bind} loading={busy} confirmText={t('Continue')} cancelText={t('Cancel')} />
    <ConfirmDialog closeOnConfirm={false} open={!!removing} title={t('Unlink account')} description={t('Unlink this account? Keep another sign-in method available.')}
      onClose={() => { if (!busy) setRemoving(null); }} onConfirm={unbind} loading={busy} confirmText={t('Confirm')} cancelText={t('Cancel')} />
    {wechat && <WeChatBinding qrCode={typeof status.wechat_qrcode === 'string' ? status.wechat_qrcode : ''} onClose={() => setWechat(false)} refresh={refresh} />}
  </>;
}

export default function AccountBindings() {
  const identity = useAuthStore((state) => `${state.auth.user?.id}:${state.auth.session?.sid}`);
  return <Bindings key={identity} identity={identity} />;
}
