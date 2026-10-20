import type { PropsWithChildren } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { API } from '../../helpers';
import { Button, Select, Skeleton, ContentSkeleton, showSuccess } from '../../components/ui';
import { useAuthStore } from '../../stores/auth-store';
import { useOwnedOperation } from '../../hooks/useOwnedOperation';
import { apiErrorMessage } from '../../lib/api-error';
import type { ApiEnvelope } from '../../types/api';
import { billingPreferenceSchema, isActiveSubscription } from '../../features/payments/subscription-data';
import type { SubscriptionSelf } from '../../features/payments/subscription-data';
import { useWalletSubscriptions, walletRequestConfig } from '../../features/payments/wallet-query';
import { SettingGroup } from './ProfileSettingsLayout';

function BillingSettingsLayout({ children }: PropsWithChildren) {
  const { t } = useTranslation();
  return <SettingGroup title={t('Billing priority')}><div className='space-y-2 p-4'>{children}</div></SettingGroup>;
}

export function BillingSettingsSkeleton() {
  return <BillingSettingsLayout><ContentSkeleton variant='form'><Skeleton height={36} rounded='rounded-full' /></ContentSkeleton></BillingSettingsLayout>;
}

function BillingSettingsForm({ identity }: { identity: string }) {
  const { t } = useTranslation(); const client = useQueryClient(); const { busy, run } = useOwnedOperation();
  const queryKey = ['wallet-subscriptions', identity];
  const query = useWalletSubscriptions(identity, !busy);
  const data = query.isError ? undefined : query.data;
  const active = data?.all_subscriptions.some(({ subscription }) => isActiveSubscription(subscription)) ?? false;
  const setPreference = (preference: string) => {
    if (!data || preference === data.billing_preference || !billingPreferenceSchema.safeParse(preference).success) return;
    void run(async (signal) => {
      await client.cancelQueries({ queryKey }); signal.throwIfAborted();
      const { data: response } = await API.put<ApiEnvelope<unknown>>('/api/subscription/self/preference', { billing_preference: preference }, { ...walletRequestConfig, signal, timeout: 30000 });
      signal.throwIfAborted(); if (!response.success) throw new Error(response.message || 'Unable to save billing preference');
      const saved = z.object({ billing_preference: billingPreferenceSchema }).safeParse(response.data);
      if (!saved.success) { void query.refetch(); throw new Error('Invalid subscription data; reload and try again.'); }
      await client.cancelQueries({ queryKey }); signal.throwIfAborted();
      client.setQueryData<SubscriptionSelf>(queryKey, (previous) => previous ? { ...previous, billing_preference: saved.data.billing_preference } : previous);
      showSuccess(t('Saved successfully'));
    });
  };
  if (query.isPending) return <BillingSettingsSkeleton />;
  return <BillingSettingsLayout>
    {query.isError ? <div role='alert' className='space-y-2 text-sm text-ui-danger'><p>{t(apiErrorMessage(query.error, 'Unable to load subscriptions'))}</p><Button onClick={() => void query.refetch()}>{t('Retry')}</Button></div> : data && <>
      <Select width='full' popover aria-label={t('Billing priority')} value={data.billing_preference} disabled={busy} options={[
        { value: 'subscription_first', label: t('Subscription first, then balance') }, { value: 'wallet_first', label: t('Balance first, then subscription') }, { value: 'subscription_only', label: t('Subscription only') }, { value: 'wallet_only', label: t('Balance only') },
      ]} onChange={setPreference} />
      {!active && (data.billing_preference === 'subscription_only' || data.billing_preference === 'subscription_first') && <p className='text-xs text-ui-text-3'>{t(data.billing_preference === 'subscription_only' ? 'No active subscription: requests will be rejected with the current billing priority.' : 'No active subscription: requests will use your balance.')}</p>}
    </>}
  </BillingSettingsLayout>;
}

export default function BillingSettings() {
  const identity = useAuthStore((state) => `${state.auth.user?.id}:${state.auth.session?.sid}:${state.auth.user?.role}`);
  return <BillingSettingsForm key={identity} identity={identity} />;
}
