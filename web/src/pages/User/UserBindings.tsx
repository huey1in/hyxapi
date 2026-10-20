import Skeleton from '../../components/ui/feedback/Skeleton';
import { useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { API, showSuccess } from '../../helpers';
import { Button, ConfirmDialog, SlideOver, Switch, ContentSkeleton } from '../../components/ui';
import { StatusContext } from '../../context/Status';
import type { ApiEnvelope } from '../../types/api';
import { managedUserSchema, userErrorMessage } from './user-management';
import type { ManagedUser } from './user-management';
import { useOwnedOperation } from '../../hooks/useOwnedOperation';

type CustomBinding = { provider_id: number; provider_name: string; provider_user_id: string };
type Binding = { key: string; label: string; value: string; endpoint: string; enabled: boolean };
const builtins = [
  { key: 'email', field: 'email', label: 'Email', enabled: '' },
  { key: 'github', field: 'github_id', label: 'GitHub', enabled: 'github_oauth' },
  { key: 'discord', field: 'discord_id', label: 'Discord', enabled: 'discord_oauth' },
  { key: 'oidc', field: 'oidc_id', label: 'OIDC', enabled: 'oidc_enabled' },
  { key: 'wechat', field: 'wechat_id', label: 'WeChat', enabled: 'wechat_login' },
  { key: 'telegram', field: 'telegram_id', label: 'Telegram', enabled: 'telegram_oauth' },
  { key: 'linuxdo', field: 'linux_do_id', label: 'LinuxDO', enabled: 'linuxdo_oauth' },
] as const;

export default function UserBindings({ user, onClose, onChanged }: { user: ManagedUser; onClose: () => void; onChanged: () => void }) {
  const { t } = useTranslation();
  const [statusState] = useContext(StatusContext);
  const { busy, run } = useOwnedOperation();
  const [details, setDetails] = useState<ManagedUser>();
  const [custom, setCustom] = useState<CustomBinding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [boundOnly, setBoundOnly] = useState(true);
  const [reveal, setReveal] = useState(false);
  const [target, setTarget] = useState<Binding | null>(null);
  useEffect(() => {
    const owner = new AbortController(); setLoading(true); setError('');
    void Promise.all([
      API.get<ApiEnvelope<unknown>>(`/api/user/${user.id}`, { signal: owner.signal, skipErrorHandler: true }),
      API.get<ApiEnvelope<CustomBinding[]>>(`/api/user/${user.id}/oauth/bindings`, { signal: owner.signal, skipErrorHandler: true }),
    ]).then(([response, bindings]) => {
      owner.signal.throwIfAborted();
      if (!response.data.success || !bindings.data.success) throw new Error(response.data.message || bindings.data.message || 'Unable to load account bindings');
      setDetails(managedUserSchema.parse(response.data.data)); setCustom(bindings.data.data ?? []);
    }).catch((failure) => { if (!owner.signal.aborted) setError(userErrorMessage(failure)); }).finally(() => { if (!owner.signal.aborted) setLoading(false); });
    return () => owner.abort();
  }, [user.id, revision]);
  const status = statusState.status ?? {};
  const bindings: Binding[] = builtins.map((entry) => ({ key: entry.key, label: entry.label, value: details?.[entry.field] ?? '', endpoint: `/api/user/${user.id}/bindings/${entry.key}`, enabled: !entry.enabled || !!status[entry.enabled] }));
  const providers = (status.custom_oauth_providers ?? []).filter((provider): provider is typeof provider & { id: number } => typeof provider.id === 'number' && provider.id > 0);
  for (const providerID of new Set([...providers.map((provider) => provider.id), ...custom.map((binding) => binding.provider_id)])) {
    const provider = providers.find((entry) => entry.id === providerID); const binding = custom.find((entry) => entry.provider_id === providerID);
    bindings.push({ key: `oauth_${providerID}`, label: provider?.name || binding?.provider_name || String(providerID), value: binding?.provider_user_id ?? '', endpoint: `/api/user/${user.id}/oauth/bindings/${providerID}`, enabled: !!provider });
  }
  return <SlideOver open title={<h2 className='text-lg font-semibold'>{t('Account bindings · {{username}}', { username: user.username })}</h2>} width={480} onClose={() => { if (!busy) onClose(); }}>
    <div className='px-6 pb-6 space-y-4'>
      <label className='flex items-center justify-between text-sm'>{t('Show bound accounts only')}<Switch checked={boundOnly} onChange={setBoundOnly} /></label>
      <label className='flex items-center justify-between text-sm'>{t('Show binding identifiers')}<Switch checked={reveal} onChange={setReveal} /></label>
      {loading ? <ContentSkeleton variant='form'><div className='space-y-4'>{[0, 1, 2].map((index) => <div key={index} className='rounded-xl border border-ui-border p-3 space-y-2'><div className='flex items-center justify-between gap-2'><Skeleton width={100} height={20} /><Skeleton width={70} height={28} /></div><Skeleton width='70%' height={16} /></div>)}</div></ContentSkeleton> : error ? <p role='alert'>{t(error)}</p> : bindings.filter((binding) => !boundOnly || binding.value).map((binding) => <div key={binding.key} className='rounded-xl border border-ui-border p-3 space-y-2'>
        <div className='flex items-center justify-between gap-2'><span className='text-sm font-medium'>{t(binding.label)}</span><Button size='sm' variant='toggle' disabled={busy || !binding.value} onClick={() => setTarget(binding)}>{t('Unbind')}</Button></div>
        <p className='text-xs text-ui-text-3 break-all'>{binding.value ? reveal ? binding.value : '••••••••' : t('Not bound')}{!binding.enabled && ` · ${t('Provider disabled')}`}</p>
      </div>)}
      {!loading && !error && boundOnly && !bindings.some((binding) => binding.value) && <p className='text-sm text-ui-text-3'>{t('No bound accounts')}</p>}
      <p className='text-xs text-ui-text-3'>{t('Unbinding removes a login method. Ensure the user retains another way to sign in.')}</p>
    </div>
    {target && <ConfirmDialog open title={t('Unbind {{provider}}?', { provider: target.label })} description={t('Confirm removing this login method from {{username}}.', { username: user.username })} confirmText={t('Unbind')} cancelText={t('Cancel')} loading={busy} closeOnConfirm={false} onClose={() => { if (!busy) setTarget(null); }} onConfirm={() => run(async (signal) => {
      const { data } = await API.delete<ApiEnvelope<unknown>>(target.endpoint, { signal, skipErrorHandler: true });
      signal.throwIfAborted(); if (!data.success) throw new Error(data.message || 'Unable to remove account binding');
      showSuccess(t('Account binding removed')); setTarget(null); setReveal(false); setRevision((value) => value + 1); onChanged();
    })} />}
  </SlideOver>;
}
