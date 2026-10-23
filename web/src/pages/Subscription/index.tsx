import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { CreditCard, Plus, Pencil, Trash2, KeyRound, RotateCcw, RefreshCw } from 'lucide-react';
import { API, renderQuota } from '../../helpers';
import { Button, ConfirmDialog, IconButton, Input, PageShell, Pagination, Select, Table, Tag, showSuccess } from '../../components/ui';
import type { TableColumn } from '../../components/ui/layout/Table';
import type { ApiEnvelope } from '../../types/api';
import { useAuthStore } from '../../stores/auth-store';
import { useOwnedOperation } from '../../hooks/useOwnedOperation';
import { apiErrorMessage } from '../../lib/api-error';
import { readWalletData, walletRequestConfig } from '../../features/payments/wallet-query';
import SubscriptionResetDialog from '../../features/payments/SubscriptionResetDialog';
import { adminPlansSchema } from './plan-data';
import type { AdminPlan } from './plan-data';
import PlanEditPanel from './PlanEditPanel';
import CodesDialog from './CodesDialog';

type PlanAction = { kind: 'delete' | 'toggle'; plan: AdminPlan };
function PlanActionDialog({ action, onClose, onSaved }: { action: PlanAction; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation(); const { busy, run } = useOwnedOperation(); const { plan, kind } = action;
  return <ConfirmDialog open title={kind === 'delete' ? t('Delete plan {{plan}}?', { plan: plan.title }) : t(plan.enabled ? 'Disable plan {{plan}}?' : 'Enable plan {{plan}}?', { plan: plan.title })}
    description={kind === 'delete' ? t('Unused activation codes will also be deleted. Existing user subscription records are retained.') : t('This changes whether the plan is available for purchase and activation.')}
    onClose={onClose} loading={busy} closeOnConfirm={false} confirmText={t(kind === 'delete' ? 'Delete' : 'Confirm')} cancelText={t('Cancel')} onConfirm={() => void run(async (signal) => {
      const url = `/api/subscription/admin/plans/${plan.id}`; const config = { ...walletRequestConfig, signal, timeout: 30000 };
      const { data } = kind === 'delete' ? await API.delete<ApiEnvelope<unknown>>(url, config) : await API.patch<ApiEnvelope<unknown>>(url, { enabled: !plan.enabled }, config);
      signal.throwIfAborted(); if (!data.success) throw new Error(data.message || 'Unable to update plan');
      showSuccess(t(kind === 'delete' ? 'Plan deleted' : 'Plan status updated')); onSaved(); onClose();
    })} />;
}

function SubscriptionPage({ identity }: { identity: string }) {
  const { t, i18n } = useTranslation(); const [search, setSearch] = useState(''); const [filter, setFilter] = useState('all'); const [sort, setSort] = useState('weight'); const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<AdminPlan | 'new' | null>(null); const [action, setAction] = useState<PlanAction | null>(null); const [codes, setCodes] = useState<AdminPlan | null>(null); const [reset, setReset] = useState<AdminPlan | null>(null);
  const query = useQuery({ queryKey: ['subscription-admin-plans', identity], gcTime: 0, retry: false, queryFn: ({ signal }) => readWalletData('/api/subscription/admin/plans', adminPlansSchema, signal, undefined, 'Invalid subscription data; reload and try again.') });
  const rows = query.isError ? [] : (query.data ?? []).map(({ plan }) => plan).filter((plan) => `${plan.id} ${plan.title} ${plan.subtitle}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()) && (filter === 'all' || plan.enabled === (filter === 'enabled'))).sort((left, right) => sort === 'price-asc' ? left.price_amount - right.price_amount || left.id - right.id : sort === 'price-desc' ? right.price_amount - left.price_amount || right.id - left.id : sort === 'name' ? left.title.localeCompare(right.title, i18n.language) || left.id - right.id : right.sort_order - left.sort_order || right.id - left.id);
  const pageSize = 20; const currentPage = Math.min(page, Math.max(1, Math.ceil(rows.length / pageSize))); const visible = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const columns: TableColumn<AdminPlan>[] = [
    { key: 'id', title: 'ID', width: 70, render: (plan) => plan.id },
    { key: 'title', title: t('Plan name'), render: (plan) => plan.title },
    { key: 'price', title: t('Price'), render: (plan) => new Intl.NumberFormat(i18n.language, { style: 'currency', currency: plan.currency }).format(plan.price_amount) },
    { key: 'subtitle', title: t('Description'), render: (plan) => plan.subtitle || '—' },
    { key: 'duration', title: t('Duration'), render: (plan) => `${plan.duration_unit === 'custom' ? plan.custom_seconds : plan.duration_value} ${t(({ month: 'Months', year: 'Years', day: 'Days', hour: 'Hours', custom: 'Seconds' })[plan.duration_unit])}` },
    { key: 'quota', title: t('Credit'), render: (plan) => plan.total_amount ? renderQuota(plan.total_amount) : t('Unlimited') },
    { key: 'rpm', title: 'RPM', render: (plan) => plan.rpm_limit || t('Unlimited') },
    { key: 'groups', title: t('Allowed groups'), render: (plan) => <div className='flex flex-wrap gap-1'>{plan.allowed_groups.map((group) => <Tag key={group} color='blue'>{group}</Tag>)}</div> },
    { key: 'status', title: t('Status'), render: (plan) => <button aria-label={t('Change status of plan #{{id}}', { id: plan.id })} onClick={() => setAction({ kind: 'toggle', plan })}><Tag color={plan.enabled ? 'green' : 'grey'}>{t(plan.enabled ? 'Enabled' : 'Disabled')}</Tag></button> },
    { key: 'ops', mobileRole: 'actions' as const, title: t('Actions'), align: 'right', render: (plan) => <div className='flex justify-end gap-1'>
      <IconButton icon={RotateCcw} title={t('Reset subscription quota')} onClick={() => setReset(plan)} /><IconButton icon={KeyRound} title={t('Activation codes')} onClick={() => setCodes(plan)} /><IconButton icon={Pencil} title={t('Edit')} onClick={() => setEditing(plan)} /><IconButton icon={Trash2} variant='danger' title={t('Delete')} onClick={() => setAction({ kind: 'delete', plan })} />
    </div> },
  ];
  const refresh = () => { void query.refetch(); };
  return <PageShell title={t('Subscription plans')} actions={<Button icon={Plus} onClick={() => setEditing('new')}>{t('Create plan')}</Button>}>
    <div className='mb-4 flex min-w-0 flex-wrap items-center gap-3'>
      <div className='w-40 min-w-0 max-w-full sm:w-60'><Input width='full' aria-label={t('Search plans')} placeholder={t('Search plan ID, name or description')} value={search} onChange={(value) => { setSearch(value); setPage(1); }} /></div>
      <Select aria-label={t('Plan status')} value={filter} onChange={(value) => { setFilter(value); setPage(1); }} options={[{ value: 'all', label: t('All statuses') }, { value: 'enabled', label: t('Enabled') }, { value: 'disabled', label: t('Disabled') }]} />
      <Select aria-label={t('Plan sorting')} value={sort} onChange={(value) => { setSort(value); setPage(1); }} options={[{ value: 'weight', label: t('Sort weight') }, { value: 'price-asc', label: t('Price: low to high') }, { value: 'price-desc', label: t('Price: high to low') }, { value: 'name', label: t('Plan name') }]} />
      <IconButton icon={RefreshCw} aria-label={t('Refresh plans')} disabled={query.isFetching} onClick={refresh} />
    </div>
    {query.isError ? <div role='alert' className='space-y-2 text-sm text-ui-danger'><p>{t(apiErrorMessage(query.error, 'Unable to load subscription plans'))}</p><Button onClick={refresh}>{t('Retry')}</Button></div> : <><Table loading={query.isPending} columns={columns} rows={visible} rowKey='id' emptyIcon={CreditCard} emptyText={t('No subscription plans')} /><Pagination page={currentPage} pageSize={pageSize} total={rows.length} onChange={setPage} /></>}
    {editing && <PlanEditPanel key={editing === 'new' ? 'new' : editing.id} identity={identity} plan={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} onSaved={refresh} />}
    {codes && <CodesDialog key={codes.id} identity={identity} plan={codes} onClose={() => setCodes(null)} />}
    {reset && <SubscriptionResetDialog key={reset.id} plan={reset} onClose={() => setReset(null)} onSaved={() => { setReset(null); refresh(); }} />}
    {action && <PlanActionDialog key={`${action.plan.id}:${action.kind}`} action={action} onClose={() => setAction(null)} onSaved={refresh} />}
  </PageShell>;
}
export default function SubscriptionAccount() {
  const identity = useAuthStore((state) => `${state.auth.user?.id}:${state.auth.session?.sid}:${state.auth.user?.role}`);
  return <SubscriptionPage key={identity} identity={identity} />;
}
