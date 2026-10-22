import Skeleton from '../../components/ui/feedback/Skeleton';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Copy, Ticket, Trash2 } from 'lucide-react';
import { API, copy } from '../../helpers';
import { Button, ConfirmDialog, EmptyState, IconButton, Input, Modal, NumberInput, Pagination, Select, Tag, showError, showSuccess, ContentSkeleton } from '../../components/ui';
import type { ApiEnvelope } from '../../types/api';
import { useOwnedOperation } from '../../hooks/useOwnedOperation';
import { apiErrorMessage } from '../../lib/api-error';
import { readWalletData, walletRequestConfig } from '../../features/payments/wallet-query';
import { codeGenerationDraft, subscriptionCodesSchema } from './plan-data';
import type { AdminPlan, SubscriptionCode } from './plan-data';

function DeleteCodes({ plan, code, onClose, onSaved }: { plan: AdminPlan; code: SubscriptionCode | 'invalid'; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation(); const { busy, run } = useOwnedOperation();
  return <ConfirmDialog open title={t(code === 'invalid' ? 'Delete used and expired activation codes?' : 'Delete activation code?')} description={code === 'invalid' ? t('Remove used and expired codes for {{plan}}.', { plan: plan.title }) : t('Delete activation code #{{id}}?', { id: code.id })} loading={busy} closeOnConfirm={false} confirmText={t('Delete')} cancelText={t('Cancel')} onClose={onClose} onConfirm={() => void run(async (signal) => {
    const url = code === 'invalid' ? `/api/subscription/admin/codes/invalid?plan_id=${plan.id}` : `/api/subscription/admin/codes/${code.id}`;
    const { data } = await API.delete<ApiEnvelope<unknown>>(url, { ...walletRequestConfig, signal, timeout: 30000 });
    signal.throwIfAborted(); if (!data.success) throw new Error(data.message || 'Unable to delete activation codes');
    showSuccess(t('Activation codes deleted')); onSaved(); onClose();
  })} />;
}

export default function CodesDialog({ identity, plan, onClose, inline = false }: { identity: string; plan: AdminPlan; onClose: () => void; inline?: boolean }) {
  const { t, i18n } = useTranslation(); const { busy, run } = useOwnedOperation();
  const [count, setCount] = useState<number | ''>(1); const [expiry, setExpiry] = useState(''); const [badExpiry, setBadExpiry] = useState(false);
  const [search, setSearch] = useState(''); const [keyword, setKeyword] = useState(''); const [filter, setFilter] = useState('all'); const [page, setPage] = useState(1);
  const [generated, setGenerated] = useState<SubscriptionCode[] | null>(null); const [deleting, setDeleting] = useState<SubscriptionCode | 'invalid' | null>(null);
  const query = useQuery({ queryKey: ['subscription-codes', identity, plan.id, keyword], gcTime: 0, retry: false, queryFn: ({ signal }) => readWalletData(`/api/subscription/admin/plans/${plan.id}/codes`, subscriptionCodesSchema, signal, { keyword }, 'Invalid subscription data; reload and try again.') });
  const now = Date.now() / 1000; const pageSize = 20;
  const statusLabels = { all: 'All codes', unused: 'Unused', used: 'Used', expired: 'Expired', disabled: 'Disabled' };
  const state = (code: SubscriptionCode) => code.status === 2 || code.used_user_id ? 'used' : code.expired_time > 0 && code.expired_time <= now ? 'expired' : code.status === 1 ? 'unused' : 'disabled';
  const rows = query.isError ? [] : query.data?.filter((code) => filter === 'all' || state(code) === filter) ?? [];
  const currentPage = Math.min(page, Math.max(1, Math.ceil(rows.length / pageSize))); const visible = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const draft = badExpiry ? null : codeGenerationDraft(count, expiry);
  const copied = async (text: string) => { if (await copy(text)) showSuccess(t('Copied')); else showError(t('Unable to copy codes')); };
  const generate = () => {
    const payload = badExpiry ? null : codeGenerationDraft(count, expiry);
    if (!payload) return;
    void run(async (signal) => {
      const { data } = await API.post<ApiEnvelope<unknown>>(`/api/subscription/admin/plans/${plan.id}/codes`, payload, { ...walletRequestConfig, signal, timeout: 30000 });
      signal.throwIfAborted(); if (!data.success) throw new Error(data.message || 'Unable to generate activation codes');
      const result = subscriptionCodesSchema.safeParse(data.data);
      if (!result.success || result.data.length !== payload.count || result.data.some((code) => code.plan_id !== plan.id)) { void query.refetch(); throw new Error('Unable to read generated codes; refresh the list before generating again.'); }
      setGenerated(result.data); setPage(1); void query.refetch(); showSuccess(t('Generated {{count}} activation codes', { count: result.data.length }));
    });
  };
  const formatDate = (timestamp: number) => new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(timestamp * 1000));
  const content = <>
    <fieldset disabled={busy} className='mb-4 space-y-4'>
      <label className='block space-y-1 text-xs text-ui-text-3'>{t('Number of codes (1–200)')}<NumberInput aria-label={t('Number of codes (1–200)')} value={count} onChange={setCount} min={1} max={200} width='full' /></label>
      <label className='block space-y-1 text-xs text-ui-text-3'>{t('Code expiry (empty = never)')}<Input aria-label={t('Code expiry (empty = never)')} type='datetime-local' value={expiry} onChange={(value, event) => { setExpiry(value); setBadExpiry(event?.target.validity.badInput ?? false); }} /></label>
      <div className='flex flex-wrap items-center gap-2'><Button loading={busy} disabled={!draft} onClick={generate}>{t('Generate codes')}</Button>{expiry && <Button variant='toggle' onClick={() => { setExpiry(''); setBadExpiry(false); }}>{t('Clear expiry')}</Button>}</div>
      {!draft && <p role='alert' className='text-xs text-ui-danger'>{t('Choose a whole count from 1 to 200 and a future expiry, or leave expiry empty.')}</p>}
    </fieldset>
    <div className='mb-4 h-px bg-ui-divider' />
    <form className='grid min-w-0 grid-cols-[1fr_auto] gap-2 sm:grid-cols-[1fr_auto_140px]' onSubmit={(event) => { event.preventDefault(); setKeyword(search.trim()); setPage(1); if (keyword === search.trim()) void query.refetch(); }}>
      <Input aria-label={t('Search code prefix')} placeholder={t('Search code prefix')} value={search} onChange={setSearch} disabled={busy} /><Button variant='secondary' type='submit' disabled={busy}>{t('Search')}</Button>
      <div className='col-span-2 min-w-0 sm:col-span-1'><Select width='full' aria-label={t('Code status')} value={filter} onChange={(value) => { setFilter(value); setPage(1); }} options={Object.entries(statusLabels).map(([value, label]) => ({ value, label: t(label) }))} /></div>
    </form>
    <div className='flex flex-wrap justify-end gap-2'><Button size='sm' variant='link' disabled={busy} onClick={() => void query.refetch()}>{t('Refresh')}</Button><Button size='sm' variant='link' disabled={busy} onClick={() => setDeleting('invalid')}>{t('Delete invalid codes')}</Button></div>
    {query.isPending ? <ContentSkeleton variant='tokens'><div className='max-h-80 space-y-2 overflow-auto'>{[0, 1, 2, 3].map((index) => <div key={index} className='flex flex-wrap items-center justify-between gap-2 rounded-lg border border-ui-border p-2'><div className='min-w-0 flex-1 space-y-1'><Skeleton width='65%' height={16} /><Skeleton width='40%' height={16} /></div><Skeleton width={55} height={20} /><Skeleton width={28} height={28} /><Skeleton width={28} height={28} /></div>)}</div></ContentSkeleton> : query.isError ? <div role='alert' className='space-y-2 text-sm text-ui-danger'><p>{t(apiErrorMessage(query.error, 'Unable to load activation codes'))}</p><Button onClick={() => void query.refetch()}>{t('Retry')}</Button></div> : <>
      <div className='max-h-80 space-y-2 overflow-auto'>{!visible.length && <EmptyState icon={Ticket} padding='sm' title={t('No activation codes')} />}{visible.map((code) => <div key={code.id} className='flex flex-wrap items-center justify-between gap-2 rounded-lg border border-ui-border p-2'>
        <div className='min-w-0 flex-1'><div className='truncate font-mono text-xs text-ui-text'>{code.key}</div>{code.expired_time > 0 && <div className='mt-1 text-xs text-ui-text-3'>{t('Expires {{date}}', { date: formatDate(code.expired_time) })}</div>}</div>
        <Tag color={state(code) === 'unused' ? 'green' : state(code) === 'expired' ? 'red' : 'grey'}>{state(code) === 'used' ? t('Used by #{{id}}', { id: code.used_user_id }) : t(statusLabels[state(code)])}</Tag>
        <IconButton icon={Copy} aria-label={t('Copy code #{{id}}', { id: code.id })} onClick={() => void copied(code.key)} /><IconButton icon={Trash2} variant='danger' aria-label={t('Delete code #{{id}}', { id: code.id })} disabled={busy} onClick={() => setDeleting(code)} />
      </div>)}</div>
      <Pagination page={currentPage} pageSize={pageSize} total={rows.length} onChange={setPage} />
    </>}
    {deleting && <DeleteCodes key={deleting === 'invalid' ? 'invalid' : deleting.id} plan={plan} code={deleting} onClose={() => setDeleting(null)} onSaved={() => void query.refetch()} />}
    {generated && <Modal open title={t('Activation codes generated')} onClose={() => setGenerated(null)} hideFooter width={520}><p className='text-sm text-ui-text-2'>{t('Store these activation codes safely:')}</p><pre className='max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-ui-bg-subtle p-3 font-mono text-xs'>{generated.map((code) => code.key).join('\n')}</pre><div className='flex flex-wrap justify-end gap-2'><Button variant='toggle' onClick={() => void copied(generated.map((code) => code.key).join('\n'))}>{t('Copy all')}</Button><Button onClick={() => setGenerated(null)}>{t('Done')}</Button></div></Modal>}
  </>;
  return inline ? <section aria-label={t('Activation codes · {{plan}}', { plan: plan.title })}>{content}</section> : <Modal open title={t('Activation codes · {{plan}}', { plan: plan.title })} onClose={() => { if (generated) setGenerated(null); else if (deleting) setDeleting(null); else onClose(); }} hideFooter width={680}>{content}</Modal>;
}
