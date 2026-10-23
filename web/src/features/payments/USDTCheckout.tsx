import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { Copy } from 'lucide-react';
import { API, copy } from '../../helpers';
import { Button, IconButton, Modal, showSuccess } from '../../components/ui';
import { useOwnedOperation } from '../../hooks/useOwnedOperation';
import { apiErrorMessage } from '../../lib/api-error';
import { readWalletData, walletRequestConfig } from './wallet-query';
import type { ApiEnvelope } from '../../types/api';

const invoiceSchema = z.object({
  trade_no: z.string().regex(/^[a-f0-9]{32}$/), status: z.enum(['pending', 'success', 'expired', 'failed']),
  currency: z.literal('USD'), token: z.literal('USDT'), amount: z.number().int().positive(), network: z.string().min(1),
  actual_amount: z.string().regex(/^\d+(?:\.\d+)?$/), receive_address: z.string().min(1), expires_at: z.number().int().positive(),
});
const networks: Record<string, string> = { tron: 'TRON (TRC20)', ethereum: 'Ethereum (ERC20)', bsc: 'BNB Smart Chain (BEP20)', solana: 'Solana', polygon: 'Polygon', arbitrum: 'Arbitrum', base: 'Base', plasma: 'Plasma' };

export default function USDTCheckout({ identity, amount, network, tradeNo, onClose, onPaid }: { identity: string; amount?: number; network?: string; tradeNo?: string; onClose: () => void; onPaid: () => void }) {
  const { t, i18n } = useTranslation(); const { busy, run } = useOwnedOperation();
  const [order, setOrder] = useState(tradeNo || ''); const [paid, setPaid] = useState(false);
  const query = useQuery({ queryKey: ['usdt-order', identity, order], enabled: !!order, retry: false, gcTime: 0,
    queryFn: ({ signal }) => readWalletData(`/api/user/usdt/orders/${order}`, invoiceSchema, signal),
    refetchInterval: (state) => state.state.data?.status === 'success' ? false : state.state.data?.status === 'expired' ? 15000 : 5000,
  });
  useEffect(() => { if (query.data?.status === 'success' && !paid) { setPaid(true); showSuccess(t('Payment received')); onPaid(); } }, [query.data?.status, paid, t, onPaid]);
  const invoice = query.data;
  const create = () => run(async (signal) => {
    const { data } = await API.post<ApiEnvelope<unknown>>('/api/user/usdt/pay', { amount }, { ...walletRequestConfig, signal, timeout: 30000 });
    signal.throwIfAborted(); if (!data.success) throw new Error(data.message || 'Payment request failed');
    setOrder(invoiceSchema.parse(data.data).trade_no);
  });
  return <Modal open width={440} title={t('USDT payment')} onClose={() => { if (!busy) onClose(); }} hideFooter>
    {!order ? <div className='space-y-5 pb-4'>
      <div className='flex justify-between gap-3 text-sm'><span>{t('Top-up amount')}</span><strong>USD {amount?.toFixed(2)}</strong></div>
      <div className='flex justify-between gap-3 text-sm'><span>{t('USDT network')}</span><span>{networks[network || ''] || network}</span></div>
      <p className='text-sm leading-6 text-ui-text-3'>{t('The exact USDT amount and receiving address will be shown after creating the order.')}</p>
      <Button loading={busy} block onClick={() => void create()}>{t('Create payment order')}</Button>
    </div> : query.isError ? <div role='alert' className='space-y-3 pb-4'><p>{t(apiErrorMessage(query.error, 'Unable to load payment order'))}</p><Button onClick={() => void query.refetch()}>{t('Retry')}</Button></div> : !invoice ? <p className='py-12 text-center text-sm text-ui-text-3'>{t('Loading...')}</p> : <div className='space-y-4 pb-4'>
      <div className='flex justify-between gap-3 text-sm'><span className='text-ui-text-3'>{t('Status')}</span><span>{t(invoice.status === 'success' ? 'Payment received' : invoice.status === 'expired' ? 'Expired' : 'Pending payment')}</span></div>
      <div className='flex justify-between gap-3 text-sm'><span className='text-ui-text-3'>{t('USDT network')}</span><strong>{networks[invoice.network] || invoice.network}</strong></div>
      {invoice.status === 'pending' && <QRCodeSVG role='img' aria-label={t('USDT receiving address')} value={invoice.receive_address} size={176} marginSize={2} title={t('USDT receiving address')} className='mx-auto' />}
      <div className='text-center'><span className='text-2xl font-semibold tabular-nums'>{invoice.actual_amount} USDT</span><IconButton icon={Copy} aria-label={t('Copy payment amount')} onClick={async () => { if (await copy(invoice.actual_amount)) showSuccess(t('Copied')); }} /></div>
      <div className='flex items-center gap-2 rounded-xl border border-ui-border px-3 py-2'><code className='min-w-0 flex-1 break-all text-sm'>{invoice.receive_address}</code><IconButton icon={Copy} aria-label={t('Copy receiving address')} onClick={async () => { if (await copy(invoice.receive_address)) showSuccess(t('Copied')); }} /></div>
      <p className='text-xs leading-5 text-ui-text-3'>{t('Send exactly the displayed USDT amount on the displayed network. The QR code contains the address only; enter the amount yourself. Network fees are paid separately.')}</p>
      <div className='text-xs text-ui-text-3'>{t('Expires at')}: {new Date(invoice.expires_at * 1000).toLocaleString(i18n.language)}</div>
      {invoice.status === 'expired' && <p className='text-sm text-ui-danger'>{t('This order has expired. Do not transfer funds to this invoice.')}</p>}
      <p className='break-all text-xs text-ui-text-3'>{t('Order number')}: {invoice.trade_no}</p>
    </div>}
  </Modal>;
}
