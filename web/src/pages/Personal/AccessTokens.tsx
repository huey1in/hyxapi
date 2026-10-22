import { ProfileRowsSkeleton } from '../../components/layout/PageSkeletons';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { API, copy, showSuccess } from '../../helpers';
import { Button, Checkbox, Input, Select, Modal, ConfirmDialog, Tag, SlideOver } from '../../components/ui';
import AuditViewer from '../../features/audit/AuditViewer';
import { useAuthStore } from '../../stores/auth-store';
import { useOwnedOperation } from '../../hooks/useOwnedOperation';
import { apiErrorMessage } from '../../lib/api-error';
import { authResult } from '../../lib/secure-verification';
import { SettingGroup, SettingRow, FieldGroup } from './ProfileSettingsLayout';
import { localExpiryInput, personalTokenPayload, personalTokensSchema, tokenScopeCatalogSchema } from './access-token-settings';
import type { AccessTokenForm, PersonalToken } from './access-token-settings';

const permissionGroupLabels: Record<string, string> = {
  personal: 'Personal permissions',
  admin: 'Administrative permissions',
  system: 'System permissions',
};

function Tokens({ identity }: { identity: string }) {
  const { t, i18n } = useTranslation();
  const { busy, run } = useOwnedOperation();
  const [editing, setEditing] = useState<{ original: PersonalToken | null; form: AccessTokenForm } | null>(null);
  const [secret, setSecret] = useState('');
  const [confirm, setConfirm] = useState<PersonalToken | 'legacy' | null>(null);
  const [records, setRecords] = useState<{ tokenRef?: string } | null>(null);
  const data = useQuery({
    queryKey: ['personal-access-tokens', identity],
    queryFn: async ({ signal }) => {
      const [tokens, catalog] = await Promise.all([
        authResult<unknown>(API.get('/api/user/access_tokens', { signal, skipErrorHandler: true, disableDuplicate: true })),
        authResult<unknown>(API.get('/api/user/access_tokens/catalog', { signal, skipErrorHandler: true })),
      ]);
      signal.throwIfAborted(); return { ...personalTokensSchema.parse(tokens), catalog: tokenScopeCatalogSchema.parse(catalog) };
    }, retry: false, gcTime: 0, refetchOnWindowFocus: false,
  });
  const items = data.data?.items ?? [];
  const legacy = data.data?.legacy;
  const catalog = data.data?.catalog;
  const message = data.error && apiErrorMessage(data.error, 'Unable to load access tokens');
  const formatDate = (value: number) => new Date(value * 1000).toLocaleString(i18n.language);
  const open = (original: PersonalToken | null = null) => setEditing({ original, form: {
    name: original?.name ?? '', scopes: original?.scopes ?? [], expiry: String(catalog?.default_expiry_days ?? 30), customExpiry: localExpiryInput(),
  } });
  const set = <K extends keyof AccessTokenForm>(key: K, value: AccessTokenForm[K]) => setEditing((previous) => previous ? { ...previous, form: { ...previous.form, [key]: value } } : null);
  const save = () => void run(async (signal) => {
    if (!editing) return;
    const { original, form } = editing;
    const payload = personalTokenPayload(form, original);
    if (original) await authResult(API.patch(`/api/user/access_tokens/${original.id}`, payload, { signal, skipErrorHandler: true }));
    else {
      const result = await authResult<{ token: string }>(API.post('/api/user/access_tokens', payload, { signal, skipErrorHandler: true }));
      signal.throwIfAborted(); setSecret(result.token);
    }
    signal.throwIfAborted(); setEditing(null); showSuccess(t(original ? 'Access token updated' : 'Access token created')); await data.refetch();
  });
  const revoke = () => void run(async (signal) => {
    if (!confirm) return;
    const response = await API.delete(`/api/user/access_tokens/${confirm === 'legacy' ? 'legacy' : confirm.id}`, { signal, skipErrorHandler: true });
    signal.throwIfAborted(); if (!response.data.success) throw new Error(response.data.message || 'Unable to revoke access token');
    setConfirm(null); showSuccess(t('Access token revoked')); await data.refetch();
  });
  const grantable = new Set(catalog?.groups.flatMap((group) => group.resources.flatMap((resource) => resource.actions.map((action) => `${resource.resource}:${action.action}`))));
  const unavailable = editing?.form.scopes.filter((scope) => !grantable.has(scope)) ?? [];
  const toggleScope = (scope: string, checked: boolean) => { if (editing) set('scopes', checked ? [...editing.form.scopes, scope] : editing.form.scopes.filter((value) => value !== scope)); };
  return <>
    <SettingGroup title={t('System access tokens')}>
      <SettingRow title={t('Personal tokens for the management API')} description={t('Grant specific permissions; the full token is shown only once')} last={!items.length && !legacy}>
        <div className='flex flex-wrap justify-end gap-1.5 max-w-[180px] sm:max-w-none'><Button variant='toggle' onClick={() => setRecords({})} disabled={busy}>{t('Access records')}</Button><Button variant='toggle' onClick={() => open()} disabled={busy || !catalog || !!data.error || items.length >= catalog.max_tokens}>{t('Create')}</Button></div>
      </SettingRow>
      {data.isPending && <ProfileRowsSkeleton lines={3} />}
      {message && <div role='alert' className='p-4 text-sm text-ui-text-2'>{t(message)} <Button onClick={() => void data.refetch()} loading={data.isFetching}>{t('Retry')}</Button></div>}
      {items.map((item, index) => <SettingRow key={item.id} last={index === items.length - 1 && !legacy}
        title={<>{item.name} {item.expires_at > 0 && item.expires_at * 1000 <= Date.now() && <Tag color='grey'>{t('Expired')}</Tag>}</>}
        description={<><span className='break-all'>{item.token_hint}… · {item.scopes.join(', ')}</span><br />{t('Expires')}: {item.expires_at ? formatDate(item.expires_at) : t('Never expires')}<br />{t('Last used')}: {item.last_used_at ? formatDate(item.last_used_at) : t('Never used')}</>}>
        <div className='flex flex-wrap justify-end gap-1.5 max-w-[180px] sm:max-w-none'><Button variant='toggle' disabled={busy} onClick={() => setRecords({ tokenRef: item.token_ref })}>{t('Access records')}</Button><Button variant='toggle' disabled={busy || !!data.error} onClick={() => open(item)}>{t('Edit')}</Button><Button variant='toggle' disabled={busy} onClick={() => setConfirm(item)}>{t('Revoke')}</Button></div>
      </SettingRow>)}
      {legacy && <SettingRow title={t('Legacy access token')} description={t('Retires on {{date}}; migrate to a scoped token.', { date: formatDate(legacy.retire_at) })} last>
        <div className='flex flex-wrap justify-end gap-1.5 max-w-[180px] sm:max-w-none'><Button variant='toggle' disabled={busy} onClick={() => setRecords({ tokenRef: legacy.token_ref })}>{t('Access records')}</Button><Button variant='toggle' disabled={busy} onClick={() => setConfirm('legacy')}>{t('Revoke now')}</Button></div>
      </SettingRow>}
    </SettingGroup>
    {records && <SlideOver open title={t('Access records')} onClose={() => setRecords(null)}>
      <div className='p-4 space-y-4'><p className='text-sm text-ui-text-2'>{t('Audit records start after this feature was enabled. Earlier records remain in Common Logs.')}</p>
        <AuditViewer key={records.tokenRef ?? 'all'} identity={identity} scope='self' accessOnly currentTokenRef={records.tokenRef} defaultTokenScope={records.tokenRef ? 'current' : 'all'} />
      </div>
    </SlideOver>}
    {editing && <Modal open width={480} title={t(editing.original ? 'Edit access token' : 'Create access token')} onClose={() => { if (!busy) setEditing(null); }} onConfirm={save} loading={busy} confirmText={t('Save')} cancelText={t('Cancel')}>
      <fieldset disabled={busy} className='m-0 min-w-0 space-y-4 border-0 p-0'>
        <div className='flex items-center justify-between gap-3'>
          <label htmlFor='personal-access-token-name' className='min-w-0 flex-1 text-sm text-ui-text'>{t('Name')}</label>
          <div className='w-[min(220px,calc(100%_-_88px))] min-w-0 shrink-0'>
            <Input id='personal-access-token-name' aria-label={t('Access token name')} value={editing.form.name} onChange={(value) => set('name', value)} maxLength={128} width='full' />
          </div>
        </div>
        {!editing.original && <div className='flex items-start justify-between gap-3'>
          <label htmlFor='personal-access-token-validity' className='min-w-0 flex-1 pt-2 text-sm text-ui-text'>{t('Validity')}</label>
          <div className='flex w-[min(220px,calc(100%_-_88px))] min-w-0 shrink-0 flex-col items-end'>
            <Select id='personal-access-token-validity' aria-label={t('Access token validity')} popover width='full' value={editing.form.expiry} onChange={(value) => set('expiry', value)} options={[
              ...[7, 30, 90, 180, 365].map((days) => ({ value: String(days), label: t('{{days}} days', { days }) })),
              { value: 'custom', label: t('Custom') }, { value: 'never', label: t('Never expires') },
            ]} />
            {editing.form.expiry === 'custom' && <div className='mt-2 w-full'><Input aria-label={t('Access token expiry date')} type='datetime-local' value={editing.form.customExpiry} onChange={(value) => set('customExpiry', value)} width='full' /><p className='mt-1 text-xs text-ui-text-3'>{t('Choose an expiry at least one hour from now')}</p></div>}
          </div>
        </div>}
        {(catalog?.groups ?? []).map((group) => <section key={group.group} className='space-y-3 border-t border-ui-divider pt-4'>
          <h4 className='text-sm font-semibold text-ui-text'>{t(permissionGroupLabels[group.group] ?? group.group)}</h4>
          <div className='grid grid-cols-2 gap-x-5 gap-y-4'>
            {group.resources.map((resource) => <FieldGroup key={resource.resource} label={t(resource.label_key)}>
              <div className='grid gap-2 [&>label]:min-w-0 [&>label>span]:min-w-0 [&>label>span]:break-words'>{resource.actions.map((action) => {
                const scope = `${resource.resource}:${action.action}`;
                return <Checkbox key={scope} label={t(action.label_key)} title={t(action.description_key)} aria-label={`${t(resource.label_key)}: ${t(action.label_key)}`} checked={editing.form.scopes.includes(scope)} disabled={busy} onChange={(checked) => toggleScope(scope, checked)} />;
              })}</div>
            </FieldGroup>)}
          </div>
        </section>)}
        {unavailable.length > 0 && <FieldGroup label={t('Permissions no longer available')} hint={t('Renaming preserves the current grant; remove unavailable permissions before changing it.')}>
          <div className='space-y-2'>{unavailable.map((scope) => <Checkbox key={scope} label={<span className='break-all'>{scope}</span>} aria-label={scope} checked disabled={busy} onChange={() => toggleScope(scope, false)} />)}</div>
        </FieldGroup>}
      </fieldset>
    </Modal>}
    {secret && <Modal open title={t('Save access token')} onClose={() => setSecret('')} onConfirm={async () => { await copy(secret); showSuccess(t('Copied')); }} confirmText={t('Copy token')} cancelText={t('Close')}>
      <p className='text-sm text-ui-text-2'>{t('Save this token now. The full value cannot be shown again after closing.')}</p>
      <code className='block break-all rounded-xl bg-ui-bg-subtle p-3 text-xs'>{secret}</code>
    </Modal>}
    <ConfirmDialog closeOnConfirm={false} open={!!confirm} title={t('Revoke access token')} description={t('Applications using this token will lose access. Continue?')}
      onClose={() => { if (!busy) setConfirm(null); }} onConfirm={revoke} loading={busy} confirmText={t('Confirm')} cancelText={t('Cancel')} />
  </>;
}

export default function AccessTokens() {
  const identity = useAuthStore((state) => `${state.auth.user?.id}:${state.auth.session?.sid}`);
  return <Tokens key={identity} identity={identity} />;
}
