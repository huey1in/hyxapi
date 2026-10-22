import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { RefreshCw, Save, Search, ShieldCheck } from 'lucide-react';
import { API, showSuccess } from '../../helpers';
import { Button, IconButton, Select, Switch, EmptyState, Tag, Input, Pagination, ContentSkeleton } from '../../components/ui';
import type { ApiEnvelope } from '../../types/api';
import type { AdminPermissionMatrix, PermissionCatalog } from '../../lib/admin-permissions';
import { normalizeAdminPermissions } from '../../lib/admin-permissions';
import { apiErrorMessage } from '../../lib/api-error';
import { useAuthStore } from '../../stores/auth-store';
import { useOwnedOperation } from '../../hooks/useOwnedOperation';
import { useLiveSearch } from '../../hooks/useLiveSearch';
import { userPageSchema } from '../User/user-management';
import { permissionCatalogSchema, permissionDetailsSchema } from './permission-settings';
import { LayoutSkeleton } from '../../components/ui/feedback/ContentSkeleton';
import Skeleton from '../../components/ui/feedback/Skeleton';

type Administrator = { id: number; username: string };

function TargetPermissions({ target, identity, catalog }: { target: Administrator; identity: string; catalog: PermissionCatalog }) {
  const { t } = useTranslation();
  const { busy, run } = useOwnedOperation();
  const [draft, setDraft] = useState<AdminPermissionMatrix | null>(null);
  const details = useQuery({
    queryKey: ['administrator-permissions', identity, target.id], gcTime: 0, retry: false, refetchOnWindowFocus: false,
    queryFn: async ({ signal }) => {
      const { data } = await API.get<ApiEnvelope<unknown>>(`/api/authz/user/${target.id}/permissions`, { signal, skipErrorHandler: true, disableDuplicate: true });
      signal.throwIfAborted(); if (!data.success) throw new Error(data.message || 'Unable to load administrator permissions');
      const result = permissionDetailsSchema.safeParse(data.data);
      if (!result.success) throw new Error('Unable to load administrator permissions');
      return result.data;
    },
  });
  useEffect(() => { if (details.data) setDraft(normalizeAdminPermissions(details.data.permissions, catalog)); }, [details.data, catalog]);
  const original = normalizeAdminPermissions(details.data?.permissions, catalog);
  const dirty = draft !== null && JSON.stringify(draft) !== JSON.stringify(original);
  const unavailable = details.isFetching || !details.data || !!details.error || !draft;
  const save = () => run(async (signal) => {
    if (unavailable || !dirty || !draft) return;
    const { data } = await API.put<ApiEnvelope<unknown>>(`/api/authz/user/${target.id}/permissions`, { permissions: draft }, { signal, skipErrorHandler: true });
    signal.throwIfAborted(); if (!data.success) throw new Error(data.message || 'Unable to save administrator permissions');
    showSuccess(t('Permissions saved')); await details.refetch();
  });
  return <section aria-label={t('Administrator permissions')} className='min-w-0 space-y-5'>
    <div className='flex flex-wrap items-center gap-3'>
      <h3 className='min-w-0 break-all text-sm font-medium'>#{target.id} {target.username}</h3>
      <Button icon={Save} loading={busy} disabled={unavailable || !dirty} onClick={() => void save()}>{t('Save permissions')}</Button>
      <Button variant='toggle' disabled={busy || unavailable} onClick={() => setDraft(normalizeAdminPermissions({}, catalog))}>{t('Reset to role defaults')}</Button>
      <IconButton icon={RefreshCw} title={t('Refresh')} disabled={busy || details.isFetching} onClick={() => void details.refetch()} />
    </div>
    {details.error ? <div role='alert' className='space-y-3 text-sm text-ui-text-2'>
      <p>{t(apiErrorMessage(details.error, 'Unable to load administrator permissions'))}</p><Button variant='toggle' onClick={() => void details.refetch()}>{t('Retry')}</Button>
    </div> : <LayoutSkeleton loading={details.isPending} className='[&>div]:space-y-5'>{catalog.resources.map((resource) => <div key={resource.resource} className='min-w-0 rounded-[26px] border border-ui-border px-[22px] py-5'>
      <h4 className='mb-1 text-[15px] font-semibold text-ui-text'>{t(resource.label_key)}</h4>
      <p className='mb-4 text-xs leading-relaxed text-ui-text-3'>{t('Changes override this administrator’s role defaults. Reset restores the defaults from the permission catalog.')}</p>
      <div className='space-y-3'>{resource.actions.map((action) => <div key={action.action} className='flex items-center justify-between gap-4 rounded-xl border border-ui-border p-3'>
        <div className='min-w-0'>
          <div className='flex flex-wrap items-center gap-2 text-sm text-ui-text'>
            <span>{t(action.label_key)}</span>
            {Object.hasOwn(details.data?.overrides[resource.resource] ?? {}, action.action) && <Tag color='blue'>{t('Override')}</Tag>}
          </div>
          <p className='mt-1 text-xs leading-relaxed text-ui-text-3'>{t(action.description_key)}</p>
        </div>
        <Switch size='sm' aria-label={t(action.label_key)} checked={draft?.[resource.resource]?.[action.action] ?? false} disabled={busy || unavailable} onChange={(checked) => setDraft((current) => ({ ...current, [resource.resource]: { ...current?.[resource.resource], [action.action]: checked } }))} />
      </div>)}</div>
    </div>)}</LayoutSkeleton>}
  </section>;
}

function PermissionWorkspace({ identity }: { identity: string }) {
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [target, setTarget] = useState<Administrator | null>(null);
  useLiveSearch(input.trim(), (value) => { setPage(1); setKeyword(value); });
  const catalog = useQuery({
    queryKey: ['administrator-permission-catalog', identity], gcTime: 0, retry: false, refetchOnWindowFocus: false,
    queryFn: async ({ signal }) => {
      const { data } = await API.get<ApiEnvelope<unknown>>('/api/authz/catalog', { signal, skipErrorHandler: true });
      signal.throwIfAborted(); if (!data.success) throw new Error(data.message || 'Unable to load permission catalog');
      const result = permissionCatalogSchema.safeParse(data.data);
      if (!result.success) throw new Error('Unable to load permission catalog');
      return result.data;
    },
  });
  const users = useQuery({
    queryKey: ['permission-administrators', identity, keyword, page], gcTime: 0, retry: false, refetchOnWindowFocus: false,
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams({ role: '10', keyword, p: String(page), page_size: '20', sort_by: 'id', sort_order: 'desc' });
      const { data } = await API.get<ApiEnvelope<unknown>>(`/api/user/search?${params}`, { signal, skipErrorHandler: true, disableDuplicate: true });
      signal.throwIfAborted(); if (!data.success) throw new Error(data.message || 'Unable to load administrators');
      const result = userPageSchema.safeParse(data.data);
      if (!result.success) throw new Error('Unable to load administrators');
      return result.data;
    },
  });
  const rows = users.error ? [] : users.data?.items ?? [];
  const choices: Administrator[] = target && !rows.some((user) => user.id === target.id) ? [target, ...rows] : rows;
  return <div className='min-w-0 space-y-5'>
    <div className='flex flex-wrap items-end gap-3'>
      <label className='min-w-0 flex-1 space-y-1.5 text-xs text-ui-text-3'>{t('Search administrators')}
        <Input aria-label={t('Search administrators')} value={input} onChange={setInput} prefix={<Search size={15} />} clearable width='full' />
      </label>
    </div>
    {users.error ? <div role='alert' className='space-y-2 text-sm'><p>{t(apiErrorMessage(users.error, 'Unable to load administrators'))}</p><Button variant='toggle' onClick={() => void users.refetch()}>{t('Retry')}</Button></div> : <>
      <label className='block min-w-0 space-y-1.5 text-xs text-ui-text-3'>{t('Select administrator')}
        <Select aria-label={t('Select administrator')} options={choices.map((user) => ({ value: String(user.id), label: `#${user.id} ${user.username}` }))} value={target ? String(target.id) : ''} disabled={users.isFetching} placeholder={t(users.isFetching ? 'Loading administrators' : 'Choose an administrator to edit permissions')} emptyText={t('No administrators found')} width='full' onChange={(value) => setTarget(choices.find((user) => String(user.id) === value) ?? null)} />
      </label>
      <Pagination page={page} pageSize={20} total={users.data?.total ?? 0} onChange={setPage} />
    </>}
    {catalog.isPending ? <ContentSkeleton variant='form'><div className='flex flex-col items-center gap-4 py-10'><Skeleton width={32} height={32} /><Skeleton width={260} height={20} /></div></ContentSkeleton> : catalog.error ? <div role='alert' className='space-y-2 text-sm'><p>{t(apiErrorMessage(catalog.error, 'Unable to load permission catalog'))}</p><Button variant='toggle' onClick={() => void catalog.refetch()}>{t('Retry')}</Button></div> : target && catalog.data ? <TargetPermissions key={target.id} target={target} identity={identity} catalog={catalog.data} /> : <EmptyState icon={ShieldCheck} title={t('Select an administrator to edit permissions')} />}
  </div>;
}

export default function PermissionEditor() {
  const { t } = useTranslation();
  const actor = useAuthStore((state) => state.auth.user);
  const session = useAuthStore((state) => state.auth.session?.sid);
  const identity = `${actor?.id}:${session}`;
  return actor?.role === 100 ? <PermissionWorkspace key={identity} identity={identity} /> : <EmptyState icon={ShieldCheck} title={t('Access denied')} description={t('Only the super administrator can edit permissions')} />;
}
