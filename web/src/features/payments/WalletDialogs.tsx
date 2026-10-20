import { useState } from 'react';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { API, renderQuota } from '../../helpers';
import { Button, Input, Modal, showSuccess } from '../../components/ui';
import { useOwnedOperation } from '../../hooks/useOwnedOperation';
import type { ApiEnvelope } from '../../types/api';
import { isUnknownSubscriptionCode, transferQuota } from './wallet-data';
import { walletRequestConfig } from './wallet-query';

type Props = { onClose: () => void; onSaved: () => void };
export function RedemptionDialog({ initialCode, onClose, onSaved }: Props & { initialCode: string }) {
  const { t } = useTranslation();
  const [code, setCode] = useState(initialCode);
  const { busy, run } = useOwnedOperation();
  const redeem = () => {
    if (!code.trim()) return;
    void run(async (signal) => {
      const config = { ...walletRequestConfig, signal, timeout: 30000 };
      const sub = await API.post<ApiEnvelope<unknown>>('/api/subscription/redeem', { key: code.trim() }, config);
      signal.throwIfAborted();
      if (sub.data.success) {
        const plan = z.object({ plan_title: z.string() }).safeParse(sub.data.data);
        showSuccess(plan.success ? t('Subscription activated: {{title}}', { title: plan.data.plan_title }) : t('Subscription activated'));
      } else {
        if (!isUnknownSubscriptionCode(sub.data)) throw new Error(sub.data.message || 'Unable to redeem code');
        const { data } = await API.post<ApiEnvelope<unknown>>('/api/user/topup', { key: code.trim() }, config);
        signal.throwIfAborted();
        if (!data.success) throw new Error(data.message || 'Unable to redeem code');
        const quota = z.number().int().nonnegative().safe().safeParse(data.data);
        showSuccess(quota.success ? t('Code redeemed: {{amount}}', { amount: renderQuota(quota.data) }) : t('Code redeemed'));
      }
      onSaved(); onClose();
    });
  };
  return <Modal open title={t('Redemption code')} onClose={onClose} footer={<div className='flex flex-wrap justify-end gap-2.5'><Button onClick={onClose}>{t('Cancel')}</Button><Button loading={busy} disabled={!code.trim()} onClick={redeem}>{t('Redeem')}</Button></div>}>
    <p className='text-sm text-ui-text-3'>{t('Enter a code to add credit or activate a subscription.')}</p>
    <Input aria-label={t('Redemption code')} value={code} onChange={setCode} disabled={busy} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); redeem(); } }} placeholder='XXXX-XXXX-XXXX-XXXX' width='full' />
  </Modal>;
}

export function AffiliateTransferDialog({ quotaPerUnit, available, onClose, onSaved }: Props & { quotaPerUnit: number; available: number }) {
  const { t } = useTranslation();
  const [amount, setAmount] = useState('');
  const { busy, run } = useOwnedOperation();
  const quota = transferQuota(amount, quotaPerUnit, available);
  const transfer = () => {
    if (quota === null) return;
    void run(async (signal) => {
      const { data } = await API.post<ApiEnvelope<unknown>>('/api/user/aff_transfer', { quota }, { ...walletRequestConfig, signal, timeout: 30000 });
      signal.throwIfAborted(); if (!data.success) throw new Error(data.message || 'Unable to transfer rewards');
      showSuccess(t('Rewards transferred to balance')); onSaved(); onClose();
    });
  };
  return <Modal open title={t('Transfer invitation rewards')} onClose={onClose} footer={<div className='flex flex-wrap justify-end gap-2.5'><Button onClick={onClose}>{t('Cancel')}</Button><Button disabled={quota === null} loading={busy} onClick={transfer}>{t('Transfer to balance')}</Button></div>}>
    <p className='text-sm text-ui-text-2'>{t('Available rewards: {{amount}}', { amount: renderQuota(available) })}</p>
    <p className='text-xs text-ui-text-3'>{t('Enter a credit amount in USD. Minimum transfer: 1 credit.')}</p>
    <Input type='number' min='1' step='any' aria-label={t('Reward transfer amount')} value={amount} onChange={setAmount} disabled={busy} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); transfer(); } }} />
    <Button variant='link' disabled={busy || available < Math.ceil(quotaPerUnit)} onClick={() => setAmount(String(available / quotaPerUnit))}>{t('Transfer all rewards')}</Button>
    {amount && quota === null && <p role='alert' className='text-xs text-ui-danger'>{t('Enter an amount of at least 1 credit within your available rewards.')}</p>}
  </Modal>;
}
