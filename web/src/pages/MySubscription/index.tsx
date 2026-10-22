import { MySubscriptionSkeleton } from '../../components/layout/PageSkeletons';
import { useEffect, useState } from 'react';
import { CreditCard } from 'lucide-react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { renderQuota } from '../../helpers';
import { Button, EmptyState, Tag } from '../../components/ui';
import { useAuthStore } from '../../stores/auth-store';
import { apiErrorMessage } from '../../lib/api-error';
import useIsMobile from '../../hooks/useIsMobile';
import SubscriptionOffers from '../../features/payments/SubscriptionOffers';
import { useWalletSubscriptions, useWalletOffers } from '../../features/payments/wallet-query';
import { isActiveSubscription, subscriptionState, subscriptionUsage } from '../../features/payments/subscription-data';
import type { UserSubscription } from '../../features/payments/subscription-data';

function InfoItem({ label, children }: { label: string; children: ReactNode }) {
  return <div className='min-w-0'><div className='mb-1 text-[13px] text-ui-text-3'>{label}</div><div className='break-words text-[15px] text-ui-text'>{children}</div></div>;
}
function SubscriptionCard({ subscription: sub, title, mobile, now }: { subscription: UserSubscription; title?: string; mobile: boolean; now: number }) {
  const { t, i18n } = useTranslation(); const usage = subscriptionUsage(sub); const active = isActiveSubscription(sub, now); const state = subscriptionState(sub, now);
  const date = (value: number) => value ? new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value * 1000)) : '—';
  const sourceLabels: Record<string, string> = { admin: 'Assigned by administrator', redemption: 'Activated with code', balance: 'Purchased with balance', order: 'Purchased online' };
  const planLabel = `${title ? `${title} · ` : ''}${t('Plan #{{id}}', { id: sub.plan_id })}`;
  if (!active) return <div data-subscription-id={sub.id} className='flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ui-border px-4 py-3 opacity-60'>
    <div className='min-w-0'><div className='break-words text-[15px] font-medium text-ui-text'>{planLabel}</div><div className='mt-0.5 text-[13px] text-ui-text-3'>{date(sub.start_time)} ~ {date(sub.end_time)}</div></div><Tag color={state === 'Expired' ? 'red' : 'grey'}>{t(state)}</Tag>
  </div>;
  return <div data-subscription-id={sub.id} className={mobile ? 'space-y-4' : 'rounded-[26px] border border-ui-border px-6 py-5'}>
    <div className='mb-3.5 flex flex-wrap items-center justify-between gap-2'><div className='flex min-w-0 flex-wrap items-center gap-2.5'><span className='break-words text-lg font-semibold text-ui-text'>{planLabel}</span><Tag color='green'>{t('Active')}</Tag></div>{!mobile && <span className='text-[13px] text-ui-text-3'>ID: {sub.id}</span>}</div>
    <div className={`grid min-w-0 gap-4 ${mobile ? 'grid-cols-1' : 'grid-cols-2'}`}>
      <InfoItem label={t('Validity')}>{date(sub.start_time)} ~ {date(sub.end_time)}</InfoItem><InfoItem label={t('Source')}>{t(sourceLabels[sub.source] || sub.source)}</InfoItem>
      <div><div className='mb-1.5 text-[13px] text-ui-text-3'>{t('Credit usage')}</div>{usage.unlimited ? <span className='text-[15px] text-ui-text'>{t('Unlimited credit')}</span> : <>
        <div className='mb-1 flex flex-wrap justify-between gap-1 text-sm'><span className='text-ui-text-2'>{t('Used {{amount}}', { amount: renderQuota(sub.amount_used) })}</span><span className='text-ui-text-3'>/ {renderQuota(sub.amount_total)}</span></div>
        <div role='progressbar' aria-label={t('Credit usage')} aria-valuenow={usage.percent} aria-valuemin={0} aria-valuemax={100} className='h-1.5 overflow-hidden rounded-[3px] bg-ui-bg-subtle'><div className='h-full rounded-[3px] transition-[width]' style={{ width: `${usage.percent}%`, background: usage.percent > 80 ? 'var(--ui-danger)' : 'var(--ui-accent)' }} /></div>
        <p className='mt-1 text-xs text-ui-text-3'>{t('Remaining {{amount}}', { amount: renderQuota(usage.remaining) })}</p>
      </>}</div>
      <InfoItem label={t('Concurrency / RPM limits')}>{sub.concurrent_limit || sub.rpm_limit ? t('{{concurrency}} concurrent / {{rpm}} RPM', { concurrency: sub.concurrent_limit || '∞', rpm: sub.rpm_limit || '∞' }) : t('Unlimited')}</InfoItem>
      <InfoItem label={t('Next credit reset')}>{sub.next_reset_time ? date(sub.next_reset_time) : t('No scheduled reset')}</InfoItem>
      <InfoItem label={t('Wallet fallback after credit is exhausted')}>{t(sub.allow_wallet_overflow ? 'Allowed by this plan' : 'Blocked by this plan')}</InfoItem>
      {sub.upgrade_group && <InfoItem label={t('Upgraded group')}>{sub.upgrade_group}</InfoItem>}{(sub.downgrade_group || sub.prev_user_group) && <InfoItem label={t('Group after expiry')}>{sub.downgrade_group || sub.prev_user_group}</InfoItem>}
    </div>
    {(sub.allowed_groups.length > 0 || sub.allowed_models.length > 0) && <div className='mt-3.5 space-y-2.5 border-t border-ui-divider pt-3.5'>
      {sub.allowed_groups.length > 0 && <InfoItem label={t('Allowed groups')}><div className='flex flex-wrap gap-1.5'>{sub.allowed_groups.map((group) => <Tag key={group} color='blue'><span className='whitespace-normal break-all'>{group}</span></Tag>)}</div></InfoItem>}
      {sub.allowed_models.length > 0 && <InfoItem label={t('Allowed models')}><div className='flex flex-wrap gap-1.5'>{sub.allowed_models.map((model) => <Tag key={model} color='grey'><span className='whitespace-normal break-all'>{model}</span></Tag>)}</div></InfoItem>}
    </div>}
  </div>;
}

function MySubscription({ identity }: { identity: string }) {
  const { t } = useTranslation(); const mobile = useIsMobile(); const navigate = useNavigate();
  const [clock, setClock] = useState(() => Date.now() / 1000); const now = Math.max(clock, Date.now() / 1000);
  const query = useWalletSubscriptions(identity); const offers = useWalletOffers(identity);
  const planTitles = new Map(offers.isError ? [] : offers.data?.map(({ plan }) => [plan.id, plan.title]));
  const data = query.isError ? undefined : query.data;
  useEffect(() => {
    const ends = data?.all_subscriptions.map(({ subscription }) => subscription.end_time * 1000).filter((time) => time > Date.now()) ?? [];
    if (!ends.length) return;
    const next = ends.reduce((earliest, time) => Math.min(earliest, time), Infinity);
    const timer = setTimeout(() => setClock(Date.now() / 1000), Math.min(2147483647, Math.max(1, next - Date.now() + 1)));
    return () => clearTimeout(timer);
  }, [data, clock]);
  const active = data?.all_subscriptions.filter(({ subscription }) => isActiveSubscription(subscription, now)) ?? [];
  const inactive = data?.all_subscriptions.filter(({ subscription }) => !isActiveSubscription(subscription, now)) ?? [];
  return <div style={{ display: 'flex', flexDirection: 'column', gap: mobile ? 20 : 28, width: '100%', maxWidth: 960, marginInline: 'auto', padding: mobile ? '16px' : '24px 16px' }}>
    <h1 className='text-lg font-semibold text-ui-text'>{t('My subscriptions')}</h1>
    {query.isPending ? <MySubscriptionSkeleton /> : query.isError ? <div role='alert' className='space-y-2 text-sm text-ui-danger'><p>{t(apiErrorMessage(query.error, 'Unable to load subscriptions'))}</p><Button onClick={() => void query.refetch()}>{t('Retry')}</Button></div> : data && <>
      {!data.all_subscriptions.length ? <EmptyState icon={CreditCard} padding='md' title={t('No subscriptions yet. Activate one with a code or buy a plan.')} action={<Button onClick={() => navigate('/topup')}>{t('Open top-up page')}</Button>} /> : <>
        {active.map(({ subscription }) => <SubscriptionCard key={subscription.id} subscription={subscription} title={planTitles.get(subscription.plan_id)} mobile={mobile} now={now} />)}
        {!active.length && <EmptyState icon={CreditCard} padding='sm' title={t('No active subscriptions')} />}
        {inactive.length > 0 && <section className='space-y-3'><h2 className='text-[15px] font-semibold text-ui-text-2'>{t('Subscription history')}</h2>{inactive.map(({ subscription }) => <SubscriptionCard key={subscription.id} subscription={subscription} title={planTitles.get(subscription.plan_id)} mobile={mobile} now={now} />)}</section>}
      </>}
    </>}
    <SubscriptionOffers onPurchased={() => void query.refetch()} />
  </div>;
}
export default function MySubscriptionAccount() {
  const identity = useAuthStore((state) => `${state.auth.user?.id}:${state.auth.session?.sid}:${state.auth.user?.role}`);
  return <MySubscription key={identity} identity={identity} />;
}
