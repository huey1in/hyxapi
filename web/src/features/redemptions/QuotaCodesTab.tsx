import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { Copy, Pencil, Power, PowerOff, Trash2 } from 'lucide-react';
import { API, copy, renderQuota, timestamp2string } from '../../helpers';
import { quotaToDisplayAmount, displayAmountToQuota } from '../../helpers/quota';
import { useAuthStore } from '../../stores/auth-store';
import { useOwnedOperation } from '../../hooks/useOwnedOperation';
import { apiErrorMessage } from '../../lib/api-error';
import { readWalletData, walletRequestConfig } from '../payments/wallet-query';
import { Button, Checkbox, ConfirmDialog, IconButton, Input, Modal, NumberInput, Pagination, Select, Table, Tag, showError, showSuccess } from '../../components/ui';
import type { TableColumn } from '../../components/ui/layout/Table';
import type { ApiEnvelope } from '../../types/api';
import { codeStatus, codesURL, localExpiry, redemptionPageSchema, serializeRedemptionDraft } from './codes';
import type { CodeFilters, CodeStatus, RedemptionCode, RedemptionDraft } from './codes';

const PAGE_SIZE = 20;
const requestConfig = { ...walletRequestConfig, timeout: 30000 };
const freshDraft = (): RedemptionDraft => ({ name: '', amount: quotaToDisplayAmount(500000), count: 1, expiry: '', badExpiry: false });
type Confirmation = { title: string; ids?: number[]; invalid?: boolean };
function validDraft(draft: RedemptionDraft, includeCount = true) { return serializeRedemptionDraft(draft, displayAmountToQuota, includeCount); }

function QuotaFields({ draft, onChange, includeCount = false }: { draft: RedemptionDraft; onChange: (draft: RedemptionDraft) => void; includeCount?: boolean }) {
  const { t } = useTranslation();
  return <div className='space-y-3'>
    <div className='flex flex-wrap items-end gap-3'>
      <label className='grid max-w-full gap-1 text-xs text-ui-text-2'>{t('Name')}<Input aria-label={t('Code name')} value={draft.name} onChange={(name) => onChange({ ...draft, name })} maxLength={40} width={180} placeholder={t('Optional, up to 20 characters')} /></label>
      <label className='grid max-w-full gap-1 text-xs text-ui-text-2'>{t('Amount')}<NumberInput aria-label={t('Code amount')} value={draft.amount} onChange={(amount) => onChange({ ...draft, amount })} min={0} step='any' width={140} /></label>
      {includeCount && <label className='grid max-w-full gap-1 text-xs text-ui-text-2'>{t('Count')}<NumberInput aria-label={t('Quota code count (1–100)')} value={draft.count} onChange={(count) => onChange({ ...draft, count })} min={1} max={100} width={110} /></label>}
    </div>
    <label className='grid gap-1 text-xs text-ui-text-2'>{t('Expiry time (blank means never)')}<Input aria-label={t('Quota code expiry (empty = never)')} type='datetime-local' value={draft.expiry} onChange={(expiry, event) => onChange({ ...draft, expiry, badExpiry: event?.target.validity.badInput ?? false })} width={260} /></label>
    {!validDraft(draft, includeCount) && <p role='alert' className='text-xs text-ui-danger'>{t('Enter a positive amount, a whole count from 1 to 100, and a future expiry or leave expiry empty.')}</p>}
  </div>;
}
function EditCode({ code, onClose, onSaved }: { code: RedemptionCode; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation(); const { busy, run } = useOwnedOperation();
  const [draft, setDraft] = useState<RedemptionDraft>(() => ({ name: code.name, amount: quotaToDisplayAmount(code.quota), count: 1, expiry: localExpiry(code.expired_time), badExpiry: false }));
  return <Modal open title={t('Update Redemption Code')} onClose={onClose} hideFooter width={560}>
    <fieldset disabled={busy} className='space-y-4'><QuotaFields draft={draft} onChange={setDraft} /><div className='flex justify-end'><Button loading={busy} disabled={!validDraft(draft, false)} onClick={() => void run(async (signal) => {
      const payload = validDraft(draft, false); if (!payload) return;
      const { data } = await API.put<ApiEnvelope<unknown>>('/api/redemption/', { id: code.id, ...payload }, { ...requestConfig, signal });
      signal.throwIfAborted(); if (!data.success) throw new Error(data.message || 'Unable to update redemption code');
      showSuccess(t('Updated')); onSaved(); onClose();
    })}>{t('Save')}</Button></div></fieldset>
    <div className='mt-3 flex justify-end'><Button onClick={onClose}>{t('Cancel')}</Button></div>
  </Modal>;
}
function DeleteCodes({ confirmation, onClose, onSaved }: { confirmation: Confirmation; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation(); const { busy, run } = useOwnedOperation();
  return <ConfirmDialog open title={confirmation.title} description={t('Deleted codes cannot be redeemed. Historical records are retained.')} confirmText={t('Delete')} cancelText={t('Cancel')} loading={busy} closeOnConfirm={false} onClose={onClose} onConfirm={() => void run(async (signal) => {
    const { data } = confirmation.invalid ? await API.delete<ApiEnvelope<unknown>>('/api/redemption/invalid', { ...requestConfig, signal }) : await API.post<ApiEnvelope<unknown>>('/api/redemption/batch', { ids: confirmation.ids }, { ...requestConfig, signal });
    signal.throwIfAborted(); if (!data.success) throw new Error(data.message || 'Unable to delete redemption codes');
    showSuccess(t('Deleted')); onSaved(); onClose();
  })} />;
}

export default function QuotaCodesTab() {
  const { t } = useTranslation(); const { busy, run } = useOwnedOperation();
  const identity = useAuthStore((state) => `${state.auth.user?.id}:${state.auth.session?.sid}:${state.auth.user?.role}`);
  const [filters, setFilters] = useState<CodeFilters>({ keyword: '', status: '' }); const [applied, setApplied] = useState(filters); const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<number[]>([]); const [draft, setDraft] = useState(freshDraft); const [editing, setEditing] = useState<RedemptionCode>();
  const [confirmation, setConfirmation] = useState<Confirmation>(); const [generated, setGenerated] = useState<string[]>();
  const query = useQuery({ queryKey: ['quota-codes', identity, applied, page], gcTime: 0, retry: false, queryFn: ({ signal }) => readWalletData(codesURL(applied, page), redemptionPageSchema, signal, undefined, 'Invalid redemption data; reload and try again.') });
  const data = query.isError ? undefined : query.data; const rows = data?.items ?? []; const total = data?.total ?? 0;
  const statuses = [{ value: '', label: t('All statuses') }, { value: '1', label: t('Unused') }, { value: '2', label: t('Disabled') }, { value: '3', label: t('Used') }, { value: 'expired', label: t('Expired') }];
  useEffect(() => { setSelected([]); }, [applied, page]);
  useEffect(() => { if (data && page > Math.max(1, Math.ceil(data.total / PAGE_SIZE))) setPage(Math.max(1, Math.ceil(data.total / PAGE_SIZE))); }, [data, page]);
  const refresh = () => { setSelected([]); void query.refetch(); };
  const search = (next = filters) => { setApplied({ ...next, keyword: next.keyword.trim() }); setPage(1); setSelected([]); if (page === 1 && JSON.stringify(applied) === JSON.stringify({ ...next, keyword: next.keyword.trim() })) refresh(); };
  const copied = async (text: string) => { if (await copy(text)) showSuccess(t('Copied')); else showError(t('Unable to copy codes')); };
  const generate = () => {
    const payload = validDraft(draft); if (!payload) return;
    void run(async (signal) => {
      const { data } = await API.post<ApiEnvelope<unknown>>('/api/redemption/', payload, { ...requestConfig, signal });
      signal.throwIfAborted(); if (!data.success) throw new Error(data.message || 'Unable to generate redemption codes');
      const result = z.array(z.string().min(1)).length(payload.count).safeParse(data.data);
      refresh(); if (!result.success) throw new Error('Unable to read generated codes; refresh the list before generating again.');
      setGenerated(result.data); showSuccess(t('Redemption code(s) created successfully'));
    });
  };
  const setStatus = (code: RedemptionCode) => void run(async (signal) => {
    const { data } = await API.put<ApiEnvelope<unknown>>('/api/redemption/?status_only=true', { id: code.id, status: code.status === 1 ? 2 : 1 }, { ...requestConfig, signal });
    signal.throwIfAborted(); if (!data.success) throw new Error(data.message || 'Unable to update redemption code');
    showSuccess(t('Updated')); refresh();
  });
  const allSelected = rows.length > 0 && rows.every((row) => selected.includes(row.id));
  const columns: TableColumn<RedemptionCode>[] = [
    { key: 'select', mobileRole: 'selection', title: <Checkbox checked={allSelected} indeterminate={selected.length > 0 && !allSelected} disabled={busy || !rows.length} aria-label={t('Select current page')} onChange={(checked) => setSelected(checked ? rows.map((row) => row.id) : [])} />, width: 45, render: (row) => <Checkbox checked={selected.includes(row.id)} disabled={busy} aria-label={t('Select redemption code #{{id}}', { id: row.id })} onChange={(checked) => setSelected((old) => checked ? [...old, row.id] : old.filter((id) => id !== row.id))} /> },
    { key: 'id', title: 'ID', width: 65 }, { key: 'name', title: t('Name'), render: (row) => row.name || '—' },
    { key: 'key', title: t('Redemption Code'), render: (row) => <div className='flex items-center gap-2 font-mono text-xs'><span>{row.key.slice(0, 12)}…</span><IconButton icon={Copy} aria-label={t('Copy code #{{id}}', { id: row.id })} onClick={() => void copied(row.key)} /></div> },
    { key: 'quota', title: t('Value'), render: (row) => renderQuota(row.quota, 2) },
    { key: 'status', title: t('Status'), render: (row) => <Tag color={codeStatus(row) === '1' ? 'green' : codeStatus(row) === 'expired' ? 'red' : codeStatus(row) === '3' ? 'blue' : 'grey'}>{statuses.find((status) => status.value === codeStatus(row))?.label}</Tag> },
    { key: 'used_user_id', title: t('Redeemed by'), render: (row) => row.used_user_id || '—' },
    { key: 'expired_time', title: t('Expiry time'), render: (row) => row.expired_time ? timestamp2string(row.expired_time) : t('Never') },
    { key: 'created_time', title: t('Created time'), render: (row) => timestamp2string(row.created_time) },
    { key: 'ops', mobileRole: 'actions' as const, title: t('Actions'), align: 'right', render: (row) => <div className='flex justify-end gap-1'>
      {row.status !== 3 && <IconButton icon={Pencil} aria-label={t('Edit code #{{id}}', { id: row.id })} disabled={busy} onClick={() => setEditing(row)} />}
      {(row.status === 1 || row.status === 2) && <IconButton icon={row.status === 1 ? PowerOff : Power} aria-label={t(row.status === 1 ? 'Disable code #{{id}}' : 'Enable code #{{id}}', { id: row.id })} disabled={busy} onClick={() => setStatus(row)} />}
      <IconButton icon={Trash2} variant='danger' aria-label={t('Delete code #{{id}}', { id: row.id })} disabled={busy} onClick={() => setConfirmation({ title: t('Delete redemption code #{{id}}?', { id: row.id }), ids: [row.id] })} />
    </div> },
  ];
  return <>
    <fieldset disabled={busy} className='mb-4 space-y-3 rounded-2xl border border-ui-border p-4'><QuotaFields draft={draft} onChange={setDraft} includeCount /><Button loading={busy} disabled={!validDraft(draft)} onClick={generate}>{t('Create Redemption Code')}</Button></fieldset>
    <form className='mb-3 flex flex-wrap items-center justify-between gap-3' onSubmit={(event) => { event.preventDefault(); search(); }}>
      <div className='flex max-w-full flex-wrap items-center gap-2'>
        <Input aria-label={t('Search ID, name or redemption code')} value={filters.keyword} onChange={(keyword) => setFilters({ ...filters, keyword })} placeholder={t('Search ID, name or redemption code')} width={200} />
        <Select aria-label={t('Quota code status')} value={filters.status} options={statuses} onChange={(value) => { const next = { ...filters, status: value as CodeStatus }; setFilters(next); search(next); }} width={130} />
        <Button variant='toggle' type='submit' disabled={busy}>{t('Search')}</Button><Button variant='toggle' disabled={busy} loading={query.isFetching} onClick={refresh}>{t('Refresh codes')}</Button>
        {(filters.keyword || filters.status) && <Button variant='toggle' onClick={() => { const next = { keyword: '', status: '' } as const; setFilters(next); search(next); }}>{t('Clear')}</Button>}
      </div>
      <div className='flex flex-wrap gap-2'>
        <Button variant='toggle' disabled={busy || !selected.length || query.isError || query.isFetching} onClick={() => setConfirmation({ title: t('Delete {{count}} redemption codes?', { count: selected.length }), ids: [...selected] })}>{t('Delete selected redemption codes')} ({selected.length})</Button>
        <Button variant='toggle' disabled={busy} onClick={() => setConfirmation({ title: t('Delete Invalid Redemption Codes?'), invalid: true })}>{t('Delete invalid redemption codes')}</Button>
      </div>
    </form>
    {query.isError ? <div role='alert' className='space-y-2 text-sm text-ui-danger'><p>{t(apiErrorMessage(query.error, 'Unable to load redemption codes'))}</p><Button onClick={refresh}>{t('Retry')}</Button></div> : <><Table loading={!data} columns={columns} rows={rows} rowKey='id' minWidth={1050} /><div className='mt-4 flex justify-end'><Pagination total={total} pageSize={PAGE_SIZE} page={page} onChange={setPage} /></div></>}
    {generated && <Modal open title={t('Redemption codes created')} onClose={() => setGenerated(undefined)} hideFooter width={520}><div className='space-y-3'><p className='text-sm text-ui-text-2'>{t('Save these redemption codes in a safe place:')}</p><pre className='max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-ui-bg-subtle p-3 font-mono text-xs'>{generated.join('\n')}</pre><div className='flex justify-end gap-2'><Button variant='toggle' onClick={() => void copied(generated.join('\n'))}>{t('Copy all')}</Button><Button onClick={() => setGenerated(undefined)}>{t('Done')}</Button></div></div></Modal>}
    {editing && <EditCode key={editing.id} code={editing} onClose={() => setEditing(undefined)} onSaved={refresh} />}
    {confirmation && <DeleteCodes confirmation={confirmation} onClose={() => setConfirmation(undefined)} onSaved={refresh} />}
  </>;
}
