import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { API, timestamp2string } from '../../helpers';
import { Button, ConfirmDialog, Input, Loading, Modal, Pagination, Select, showSuccess } from '../../components/ui';
import type { ApiEnvelope } from '../../types/api';
import { apiErrorMessage } from '../../lib/api-error';
import { useOwnedOperation } from '../../hooks/useOwnedOperation';
import { topUpPageSchema } from './wallet-data';
import type { TopUpRecord } from './wallet-data';
import { readWalletData, walletRequestConfig } from './wallet-query';

function CompleteOrder({ order, onClose, onSaved }: { order: TopUpRecord; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation(); const { busy, run } = useOwnedOperation();
  return <ConfirmDialog open title={t('Complete top-up order?')} description={t('Credit the wallet for order {{trade}}. Verify the payment before continuing.', { trade: order.trade_no })}
    closeOnConfirm={false} loading={busy} confirmText={t('Complete order')} cancelText={t('Cancel')} onClose={onClose}
    onConfirm={() => void run(async (signal) => {
      const { data } = await API.post<ApiEnvelope<unknown>>('/api/user/topup/complete', { trade_no: order.trade_no }, { ...walletRequestConfig, signal, timeout: 30000 });
      signal.throwIfAborted(); if (!data.success) throw new Error(data.message || 'Unable to complete order');
      showSuccess(t('Order completed')); onSaved(); onClose();
    })} />;
}

export default function TopUpHistory({ identity, role, onClose, onSaved }: { identity: string; role: number; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation(); const [scope, setScope] = useState('self');
  const [search, setSearch] = useState(''); const [keyword, setKeyword] = useState(''); const [page, setPage] = useState(1);
  const [complete, setComplete] = useState<TopUpRecord | null>(null);
  const pageSize = 20; const admin = role >= 10 && scope === 'all';
  const query = useQuery({ queryKey: ['wallet-history', identity, admin, keyword, page], gcTime: 0, retry: false,
    queryFn: ({ signal }) => readWalletData(admin ? '/api/user/topup' : '/api/user/topup/self', topUpPageSchema, signal, { p: page, page_size: pageSize, keyword }) });
  const data = query.isError ? undefined : query.data;
  const statusLabels: Record<string, string> = { pending: 'Pending payment', success: 'Completed', expired: 'Expired', failed: 'Failed' };
  return <Modal open title={t('Top-up history')} onClose={onClose} width={admin ? 780 : 660} hideFooter>
    <form className={`grid min-w-0 grid-cols-[1fr_auto_auto] gap-2 ${role >= 10 ? 'sm:grid-cols-[150px_1fr_auto_auto]' : ''}`} onSubmit={(event) => { event.preventDefault(); setKeyword(search.trim()); setPage(1); if (keyword === search.trim() && page === 1) void query.refetch(); }}>
      {role >= 10 && <div className='col-span-3 min-w-0 sm:col-span-1'><Select width='full' aria-label={t('Order scope')} value={scope} options={[{ value: 'self', label: t('My orders') }, { value: 'all', label: t('All orders') }]} onChange={(value) => { setScope(value); setPage(1); setComplete(null); }} /></div>}
      <div className='min-w-0 flex-1'><Input aria-label={t('Search trade number')} placeholder={t('Search trade number')} value={search} onChange={setSearch} /></div>
      <Button type='submit' variant='secondary'>{t('Search')}</Button><Button variant='link' onClick={() => void query.refetch()}>{t('Refresh')}</Button>
    </form>
    {query.isFetching ? <Loading size='sm' /> : query.isError ? <div role='alert' className='space-y-2 text-sm text-ui-danger'><p>{t(apiErrorMessage(query.error, 'Unable to load wallet data'))}</p><Button onClick={() => void query.refetch()}>{t('Retry')}</Button></div> : data && <>
      <div className='max-h-[400px] overflow-auto'><table className='w-full border-collapse text-sm'>
        <thead><tr className='border-b border-ui-divider text-ui-text-3'><th className='px-3 py-2 text-left font-normal'>{t('Time')}</th><th className='px-3 py-2 text-left font-normal'>{t('Description')}</th><th className='px-3 py-2 text-right font-normal'>{t('Payment amount')}</th>{admin && <th className='px-3 py-2 font-normal'>{t('Actions')}</th>}</tr></thead>
        <tbody>{!data.items.length ? <tr><td colSpan={admin ? 4 : 3} className='px-3 py-6 text-center text-ui-text-3'>{t('No top-up records')}</td></tr> : data.items.map((order) => <tr key={order.id} className='border-b border-ui-divider text-ui-text'>
          <td className='whitespace-nowrap px-3 py-2'>{order.create_time ? timestamp2string(order.create_time) : '—'}</td>
          <td className='px-3 py-2'><div>{order.payment_method || order.payment_provider || '—'} · {t(statusLabels[order.status] || order.status)}</div><div className='break-all text-xs text-ui-text-3'>{order.trade_no}{admin && ` · ${t('User #{{id}}', { id: order.user_id })}`}</div></td>
          <td className='px-3 py-2 text-right tabular-nums'>{order.money.toFixed(2)}</td>
          {admin && <td className='px-3 py-2'>{order.status === 'pending' && <Button size='sm' variant='link' onClick={() => setComplete(order)}>{t('Complete order')}</Button>}</td>}
        </tr>)}</tbody>
      </table></div>
      <Pagination page={page} pageSize={pageSize} total={data.total} onChange={(value: number) => { setPage(value); setComplete(null); }} />
    </>}
    {complete && <CompleteOrder key={complete.id} order={complete} onClose={() => setComplete(null)} onSaved={() => { void query.refetch(); onSaved(); }} />}
  </Modal>;
}
