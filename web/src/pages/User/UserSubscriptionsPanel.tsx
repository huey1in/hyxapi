import Skeleton from '../../components/ui/feedback/Skeleton';
import { useEffect, useState } from 'react';
import { CreditCard } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { API, showSuccess, renderQuota } from '../../helpers';
import SubscriptionResetDialog from '../../features/payments/SubscriptionResetDialog';
import { Button, FormField, Select, SlideOver, ConfirmDialog, Tag, ContentSkeleton, EmptyState } from '../../components/ui';
import type { ApiEnvelope } from '../../types/api';
import type { ManagedUser } from './user-management';
import { userErrorMessage } from './user-management';
import { useOwnedOperation } from '../../hooks/useOwnedOperation';

type Plan = { id: number; title?: string; enabled?: boolean };
type Subscription = { id: number; plan_id: number; status: string; amount_total: number; amount_used: number; start_time: number; end_time: number };
export default function UserSubscriptionsPanel({ user, onClose }: { user: ManagedUser; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const { busy, run } = useOwnedOperation();
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedPlan, setSelectedPlan] = useState('');
  const [resetPlan, setResetPlan] = useState<Plan | null>(null);
  const [target, setTarget] = useState<{ subscription: Subscription; action: 'cancel' | 'delete' } | null>(null);
  const load = async (signal: AbortSignal) => {
    const [subscriptions, offers] = await Promise.all([
      API.get<ApiEnvelope<(Subscription | { subscription: Subscription })[]>>(`/api/subscription/admin/users/${user.id}/subscriptions`, { signal, skipErrorHandler: true }),
      API.get<ApiEnvelope<(Plan | { plan: Plan })[]>>('/api/subscription/admin/plans', { signal, skipErrorHandler: true }),
    ]);
    signal.throwIfAborted();
    if (!subscriptions.data.success || !offers.data.success) throw new Error(subscriptions.data.message || offers.data.message || 'Unable to load subscriptions');
    setSubs((subscriptions.data.data ?? []).map((item) => 'subscription' in item ? item.subscription : item));
    setPlans((offers.data.data ?? []).map((item) => 'plan' in item ? item.plan : item)); setError('');
  };
  useEffect(() => {
    const owner = new AbortController();
    void load(owner.signal).catch((failure) => { if (!owner.signal.aborted) setError(userErrorMessage(failure)); }).finally(() => { if (!owner.signal.aborted) setLoading(false); });
    return () => owner.abort();
  }, [user.id]);
  const refresh = () => run(async (signal) => { await load(signal); });
  const planName = (id: number) => plans.find((plan) => plan.id === id)?.title || t('Plan #{{id}}', { id });
  return <SlideOver open title={<h2 className='text-lg font-semibold'>{t('Manage subscriptions · {{username}}', { username: user.username })}</h2>} onClose={() => { if (!busy) onClose(); }}>
    <div className='px-6 pb-6 space-y-5'>
      {loading ? <ContentSkeleton variant='tokens'><div className='space-y-5'><div className='rounded-2xl border border-ui-border p-4 space-y-2'><div className='text-sm'>{t('Assign plan')}</div><div className='flex gap-2'><Skeleton height={36} /><Skeleton width={70} height={36} /></div></div><Skeleton width={150} height={28} />{[0, 1].map((index) => <div key={index} className='rounded-xl border border-ui-border px-4 py-3.5 space-y-2'><div className='flex justify-between gap-2'><Skeleton width={140} height={20} /><Skeleton width={55} height={20} /></div><Skeleton height={16} /><Skeleton height={6} /><div className='flex gap-2'><Skeleton width={80} height={28} /><Skeleton width={100} height={28} /></div></div>)}</div></ContentSkeleton> : <>
        {error && <p role='alert' className='text-sm text-ui-danger'>{t(error)}</p>}
        <div className='rounded-2xl border border-ui-border p-4 space-y-2'>
          <FormField label={t('Assign plan')}><Select popover aria-label={t('Assign plan')} width='full' options={plans.filter((plan) => plan.enabled).map((plan) => ({ value: String(plan.id), label: plan.title || t('Plan #{{id}}', { id: plan.id }) }))} value={selectedPlan} onChange={setSelectedPlan} placeholder={t('Select plan')} /></FormField>
          <div className='flex justify-end'>
            <Button disabled={!selectedPlan || !!error} loading={busy} onClick={() => run(async (signal) => {
              const { data } = await API.post<ApiEnvelope<unknown>>(`/api/subscription/admin/users/${user.id}/subscriptions`, { plan_id: Number(selectedPlan) }, { signal, skipErrorHandler: true });
              signal.throwIfAborted(); if (!data.success) throw new Error(data.message || 'Unable to assign subscription'); showSuccess(t('Subscription assigned')); setSelectedPlan(''); await load(signal);
            })}>{t('Assign')}</Button>
          </div>
        </div>
        <div className='flex items-center justify-between'><h3 className='text-sm font-medium'>{t('Subscription records')}</h3><Button size='sm' variant='toggle' disabled={busy} onClick={() => void refresh()}>{t('Refresh')}</Button></div>
        {!subs.length && !error && <EmptyState icon={CreditCard} padding='sm' title={t('No subscriptions')} />}
        {subs.map((subscription) => {
          const total = subscription.amount_total || 0; const used = subscription.amount_used || 0; const pct = total > 0 ? Math.min(100, used / total * 100) : 0;
          return <div key={subscription.id} className='rounded-xl border border-ui-border px-4 py-3.5 space-y-2'>
            <div className='flex items-center justify-between gap-2'><span className='text-sm font-medium break-all'>{planName(subscription.plan_id)}</span><Tag tone={subscription.status === 'active' ? 'green' : 'grey'}>{t(subscription.status === 'active' ? 'Active' : subscription.status === 'cancelled' ? 'Cancelled' : 'Expired')}</Tag></div>
            <p className='text-xs text-ui-text-3'>{new Date(subscription.start_time * 1000).toLocaleString(i18n.language)} ~ {new Date(subscription.end_time * 1000).toLocaleString(i18n.language)}</p>
            <div className='flex items-center gap-2'><div className='flex-1 h-1.5 rounded-sm bg-ui-bg-subtle overflow-hidden'><div className='h-full bg-ui-accent' style={{ width: `${pct}%` }} /></div><span className='text-xs text-ui-text-3 whitespace-nowrap'>{renderQuota(used, 2)} / {renderQuota(total, 2)}</span></div>
            <div className='flex flex-wrap gap-2'>
              {subscription.status === 'active' && <><Button size='sm' variant='toggle' disabled={busy} onClick={() => setResetPlan(plans.find((plan) => plan.id === subscription.plan_id) || { id: subscription.plan_id })}>{t('Reset quota')}</Button><Button size='sm' variant='toggle' disabled={busy} onClick={() => setTarget({ subscription, action: 'cancel' })}>{t('Cancel subscription')}</Button></>}
              <Button size='sm' variant='link' disabled={busy} onClick={() => setTarget({ subscription, action: 'delete' })}>{t('Delete record')}</Button>
            </div>
          </div>;
        })}
      </>}
    </div>
    {resetPlan && <SubscriptionResetDialog plan={resetPlan} user={user} onClose={() => setResetPlan(null)} onSaved={() => { setResetPlan(null); void refresh(); }} />}
    {target && <ConfirmDialog open title={t(target.action === 'delete' ? 'Delete subscription record?' : 'Cancel subscription?')} description={t('This affects the selected subscription and restores the user group according to the plan settings.')} confirmText={t('Confirm')} cancelText={t('Cancel')} loading={busy} closeOnConfirm={false} onClose={() => { if (!busy) setTarget(null); }} onConfirm={() => run(async (signal) => {
      const path = `/api/subscription/admin/user_subscriptions/${target.subscription.id}`;
      const { data } = target.action === 'delete' ? await API.delete<ApiEnvelope<unknown>>(path, { signal, skipErrorHandler: true }) : await API.post<ApiEnvelope<unknown>>(path + '/invalidate', undefined, { signal, skipErrorHandler: true });
      signal.throwIfAborted(); if (!data.success) throw new Error(data.message || 'Unable to update subscription'); setTarget(null); showSuccess(t('Subscription updated')); await load(signal);
    })} />}
  </SlideOver>;
}
