import { useState } from 'react';
import { ReceiptText } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { API, timestamp2string } from '../../helpers';
import { Button, ConfirmDialog, Input, Modal, Pagination, Select, Table, showSuccess } from '../../components/ui';
import type { TableColumn } from '../../components/ui/layout/Table';
import type { ApiEnvelope } from '../../types/api';
import { apiErrorMessage } from '../../lib/api-error';
import { useOwnedOperation } from '../../hooks/useOwnedOperation';
import { useLiveSearch } from '../../hooks/useLiveSearch';
import { topUpPageSchema } from './wallet-data';
import type { TopUpRecord } from './wallet-data';
import { readWalletData, walletRequestConfig } from './wallet-query';
import USDTCheckout from './USDTCheckout';

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
  const [usdt, setUsdt] = useState<TopUpRecord | null>(null);
  useLiveSearch(search.trim(), (value) => { setKeyword(value); setPage(1); setComplete(null); });
  const pageSize = 20; const admin = role >= 10 && scope === 'all';
  const query = useQuery({ queryKey: ['wallet-history', identity, admin, keyword, page], gcTime: 0, retry: false,
    queryFn: ({ signal }) => readWalletData(admin ? '/api/user/topup' : '/api/user/topup/self', topUpPageSchema, signal, { p: page, page_size: pageSize, keyword }) });
  const data = query.isError ? undefined : query.data;
  const statusLabels: Record<string, string> = { pending: 'Pending payment', success: 'Completed', expired: 'Expired', failed: 'Failed' };
  const columns: TableColumn<TopUpRecord>[] = [
    { key: 'time', title: t('Time'), render: (order) => <span className='whitespace-nowrap'>{order.create_time ? timestamp2string(order.create_time) : '—'}</span> },
    { key: 'description', title: t('Description'), mobileRole: 'wide', render: (order) => <div><div>{order.payment_method || order.payment_provider || '—'} · {t(statusLabels[order.status] || order.status)}</div><div className='break-all text-xs text-ui-text-3'>{order.trade_no}{admin && ` · ${t('User #{{id}}', { id: order.user_id })}`}</div></div> },
    { key: 'money', title: t('Payment amount'), align: 'right', render: (order) => <span className='tabular-nums'>{`${order.payment_provider === 'epusdt' ? 'USD ' : ''}${order.money.toFixed(2)}`}</span> },
    ...(!admin ? [{ key: 'payment', title: t('Actions'), mobileRole: 'actions' as const, render: (order: TopUpRecord) => order.payment_provider === 'epusdt' && <Button size='sm' variant='link' onClick={() => setUsdt(order)}>{t('Payment details')}</Button> }] : []),
    ...(admin ? [{ key: 'actions', title: t('Actions'), mobileRole: 'actions' as const, render: (order: TopUpRecord) => order.status === 'pending' && order.payment_provider !== 'epusdt' && <Button size='sm' variant='link' onClick={() => setComplete(order)}>{t('Complete order')}</Button> }] : []),
  ];
  return <Modal open title={t('Top-up history')} onClose={onClose} width={admin ? 640 : 520} hideFooter>
    <div className={`grid min-w-0 grid-cols-[minmax(0,240px)] justify-start gap-2 ${role >= 10 ? 'sm:grid-cols-[150px_minmax(0,240px)]' : ''}`}>
      {role >= 10 && <div className='min-w-0'><Select width='full' aria-label={t('Order scope')} value={scope} options={[{ value: 'self', label: t('My orders') }, { value: 'all', label: t('All orders') }]} onChange={(value) => { setScope(value); setPage(1); setComplete(null); }} /></div>}
      <div className='min-w-0'><Input aria-label={t('Search trade number')} placeholder={t('Search trade number')} value={search} onChange={setSearch} clearable /></div>
    </div>
    {query.isError ? <div role='alert' className='space-y-2 text-sm text-ui-danger'><p>{t(apiErrorMessage(query.error, 'Unable to load wallet data'))}</p><Button onClick={() => void query.refetch()}>{t('Retry')}</Button></div> : <>
      <div className='h-[200px] overflow-y-auto ui-scrollbar'><Table className='min-h-full' columns={columns} rows={data?.items ?? []} rowKey='id' loading={query.isPending} skeletonRows={4} emptyIcon={ReceiptText} emptyText={t('No top-up records')} /></div>
      <Pagination page={page} pageSize={pageSize} total={data?.total ?? 0} onChange={(value: number) => { setPage(value); setComplete(null); }} />
    </>}
    {complete && <CompleteOrder key={complete.id} order={complete} onClose={() => setComplete(null)} onSaved={() => { void query.refetch(); onSaved(); }} />}
    {usdt && <USDTCheckout key={usdt.trade_no} identity={identity} tradeNo={usdt.trade_no} onClose={() => setUsdt(null)} onPaid={() => { void query.refetch(); onSaved(); }} />}
  </Modal>;
}
