import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { API, renderQuota } from '../../helpers';
import { Button, ConfirmDialog, Loading, Modal, Select, Tag, showSuccess } from '../../components/ui';
import { useAuthStore } from '../../stores/auth-store';
import { apiErrorMessage } from '../../lib/api-error';
import type { ApiEnvelope } from '../../types/api';
import { useOwnedOperation } from '../../hooks/useOwnedOperation';
import { subscriptionMethods } from './payment-core';
import type { PaymentConfiguration } from './payment-core';
import type { SubscriptionPlan } from './wallet-data';
import { useWalletPaymentInfo, useWalletOffers, useWalletSubscriptions, walletRequestConfig } from './wallet-query';
import usePaymentCheckout from './usePaymentCheckout';

type Props = { onPurchased: () => void };
function BalancePurchaseConfirmation({ plan, price, onClose, onPurchased }: Props & { plan: SubscriptionPlan; price: string; onClose: () => void }) {
  const { t } = useTranslation(); const { busy, run } = useOwnedOperation();
  return <ConfirmDialog open title={t('Buy subscription with balance?')} description={t('{{amount}} will be deducted from your balance.', { amount: price })} loading={busy} closeOnConfirm={false} confirmText={t('Confirm purchase')} cancelText={t('Cancel')} onClose={onClose} onConfirm={() => void run(async (signal) => {
    const { data } = await API.post<ApiEnvelope<unknown>>('/api/subscription/balance/pay', { plan_id: plan.id, payment_method: 'balance' }, { ...walletRequestConfig, signal, timeout: 30000 });
    signal.throwIfAborted(); if (!data.success) throw new Error(data.message || 'Payment request failed');
    showSuccess(t('Subscription purchased')); onPurchased();
  })} />;
}
function PurchaseDialog({ plan, info, onClose, onPurchased }: Props & { plan: SubscriptionPlan; info: PaymentConfiguration; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const [methodId, setMethodId] = useState(''); const [confirm, setConfirm] = useState(false);
  const { checkingOut, checkout } = usePaymentCheckout();
  const methods = subscriptionMethods(plan, info); const method = methods.find((item) => item.id === methodId) || methods[0];
  const price = new Intl.NumberFormat(i18n.language, { style: 'currency', currency: plan.currency }).format(plan.price_amount);
  const buy = () => {
    if (!method) return;
    const request = { url: `/api/subscription/${method.provider.replaceAll('_', '-')}/pay`, body: { plan_id: plan.id, payment_method: method.type || method.provider } };
    void checkout(request);
  };
  return <>
    <Modal open title={t('Buy {{plan}}', { plan: plan.title })} onClose={onClose} hideFooter>
      <label className='block space-y-2 text-sm text-ui-text-2'>{t('Payment method')}<Select width='full' value={method?.id || ''} options={methods.map((item) => ({ value: item.id, label: t(item.name) }))} onChange={setMethodId} disabled={checkingOut} /></label>
      <p className='text-sm text-ui-text-2'>{t('Plan price: {{amount}}', { amount: price })}{method?.provider === 'balance' ? ` ${t('(deducted from balance)')}` : ''}</p>
      {method?.provider !== 'balance' && <p className='text-xs text-ui-text-3'>{t('Check the final amount at checkout. Refresh this page after payment to view your subscription.')}</p>}
      <div className='flex justify-end pb-3'><Button loading={checkingOut} disabled={!method} onClick={() => method?.provider === 'balance' ? setConfirm(true) : buy()}>{t('Confirm purchase')}</Button></div>
    </Modal>
    {confirm && <BalancePurchaseConfirmation plan={plan} price={price} onClose={() => setConfirm(false)} onPurchased={() => { onPurchased(); onClose(); }} />}
  </>;
}

function Offers({ onPurchased, identity }: Props & { identity: string }) {
  const { t, i18n } = useTranslation(); const [selected, setSelected] = useState<SubscriptionPlan | null>(null);
  const info = useWalletPaymentInfo(identity);
  const offers = useWalletOffers(identity); const subscriptions = useWalletSubscriptions(identity);
  if (offers.isPending || info.isPending || subscriptions.isPending) return <Loading size='sm' />;
  if (offers.isError || info.isError || subscriptions.isError) return <div role='alert' className='space-y-2 text-sm text-ui-danger'><p>{t(apiErrorMessage(offers.error || info.error || subscriptions.error, 'Unable to load subscription plans'))}</p><Button onClick={() => { void offers.refetch(); void info.refetch(); void subscriptions.refetch(); }}>{t('Retry')}</Button></div>;
  if (!offers.data?.length || !info.data) return null;
  const unitLabels: Record<string, string> = { hour: 'Hours', day: 'Days', week: 'Weeks', month: 'Months', year: 'Years', custom: 'Seconds' };
  const purchases = (planId: number) => subscriptions.data?.all_subscriptions.filter(({ subscription }) => subscription.plan_id === planId).length ?? 0;
  return <section className='space-y-4'>
    <h2 className='text-lg font-semibold text-ui-text'>{t('Subscription plans')}</h2>
    <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
      {offers.data.map(({ plan }) => <div key={plan.id} className='min-w-0 space-y-3 rounded-[26px] border border-ui-border p-5'>
        <div className='flex flex-wrap justify-between gap-2'><span className='font-semibold text-ui-text'>{plan.title}</span><span className='text-ui-text'>{new Intl.NumberFormat(i18n.language, { style: 'currency', currency: plan.currency }).format(plan.price_amount)}</span></div>
        {plan.subtitle && <p className='break-words text-sm text-ui-text-3'>{plan.subtitle}</p>}
        <p className='text-sm text-ui-text-2'>{plan.duration_unit === 'custom' ? plan.custom_seconds : plan.duration_value} {t(unitLabels[plan.duration_unit])} · {plan.total_amount ? renderQuota(plan.total_amount) : t('Unlimited credit')}</p>
        <div className='flex flex-wrap gap-2'>{plan.max_purchase_per_user > 0 && <Tag>{t('Limit {{count}} purchases per user', { count: plan.max_purchase_per_user })}</Tag>}{plan.upgrade_group && <Tag>{t('Group {{group}}', { group: plan.upgrade_group })}</Tag>}</div>
        <Button disabled={!subscriptionMethods(plan, info.data).length || (plan.max_purchase_per_user > 0 && purchases(plan.id) >= plan.max_purchase_per_user)} onClick={() => setSelected(plan)}>{t(plan.max_purchase_per_user > 0 && purchases(plan.id) >= plan.max_purchase_per_user ? 'Purchase limit reached' : 'Buy plan')}</Button>
      </div>)}
    </div>
    {selected && <PurchaseDialog key={selected.id} plan={selected} info={info.data} onClose={() => setSelected(null)} onPurchased={() => { void subscriptions.refetch(); onPurchased(); }} />}
  </section>;
}
export default function SubscriptionOffers(props: Props) {
  const identity = useAuthStore((state) => `${state.auth.user?.id}:${state.auth.session?.sid}:${state.auth.user?.role}`);
  return <Offers key={identity} identity={identity} {...props} />;
}
