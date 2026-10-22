import Skeleton from '../../components/ui/feedback/Skeleton';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Button, FormField, PageShell, Select, ContentSkeleton } from '../../components/ui';
import { useAuthStore } from '../../stores/auth-store';
import { apiErrorMessage } from '../../lib/api-error';
import { readWalletData } from '../../features/payments/wallet-query';
import QuotaCodesTab from '../../features/redemptions/QuotaCodesTab';
import CodesDialog from '../Subscription/CodesDialog';
import { adminPlansSchema } from '../Subscription/plan-data';

function SubscriptionCodesTab({ identity }: { identity: string }) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<number | null>(null);
  const query = useQuery({ queryKey: ['redemption-plans', identity], gcTime: 0, retry: false, queryFn: ({ signal }) => readWalletData('/api/subscription/admin/plans', adminPlansSchema, signal, undefined, 'Invalid subscription data; reload and try again.') });
  const plans = query.isError ? [] : query.data?.map((item) => item.plan) ?? [];
  const plan = plans.find((item) => item.id === selected) ?? plans[0];
  if (query.isError) return <div role='alert' className='space-y-2 text-sm text-ui-danger'><p>{t(apiErrorMessage(query.error, 'Unable to load plans'))}</p><Button onClick={() => void query.refetch()}>{t('Retry')}</Button></div>;
  if (!query.data) return <ContentSkeleton variant='form'><div className='flex flex-wrap items-end justify-between gap-3 rounded-2xl border border-ui-border p-4'><div className='grid w-60 max-w-full gap-1.5 text-xs text-ui-text-3'>{t('Select plan')}<Skeleton height={36} rounded='rounded-full' /></div><Skeleton width={110} height={36} rounded='rounded-full' /></div></ContentSkeleton>;
  return <div className='space-y-4'>
    <div className='flex flex-wrap items-end justify-between gap-3 rounded-2xl border border-ui-border p-4'>
      <FormField label={t('Select plan')}><Select popover aria-label={t('Select plan')} width='full' value={plan ? String(plan.id) : ''} onChange={(value) => setSelected(Number(value))} options={plans.map((item) => ({ value: String(item.id), label: item.title }))} /></FormField>
      <Button variant='toggle' loading={query.isFetching} onClick={() => void query.refetch()}>{t('Refresh plans')}</Button>
    </div>
    {plan ? <CodesDialog key={`${identity}:${plan.id}`} identity={identity} plan={plan} inline onClose={() => {}} /> : <p className='text-sm text-ui-text-3'>{t('Create a subscription plan before generating activation codes.')}</p>}
  </div>;
}

function RedemptionSession({ identity }: { identity: string }) {
  const { t } = useTranslation();
  const [tab, setTab] = useState('quota');
  return <PageShell title={t('Redemption Codes')}>
    <div role='group' aria-label={t('Code type')} className='mb-4 flex flex-wrap gap-1'>
      {[{ key: 'quota', label: 'Quota codes' }, { key: 'subscription', label: 'Subscription activation codes' }].map((item) => <button key={item.key} aria-pressed={tab === item.key} onClick={() => setTab(item.key)} style={{ cursor: 'pointer', height: 30, paddingInline: 14, borderRadius: 15, fontSize: 13, border: 'none', color: tab === item.key ? 'var(--ui-text)' : 'var(--ui-text-2)', background: tab === item.key ? 'var(--ui-bg-subtle)' : 'transparent', fontWeight: tab === item.key ? 500 : 400, transition: 'background 0.15s' }}>{t(item.label)}</button>)}
    </div>
    {tab === 'quota' ? <QuotaCodesTab /> : <SubscriptionCodesTab identity={identity} />}
  </PageShell>;
}
export default function RedemptionPage() {
  const identity = useAuthStore((state) => `${state.auth.user?.id}:${state.auth.session?.sid}:${state.auth.user?.role}`);
  return <RedemptionSession key={identity} identity={identity} />;
}
