import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { API } from '../../helpers';
import { quotaToDisplayAmount, displayAmountToQuota } from '../../helpers/quota';
import { Button, FormField as Field, Input, MultiSelect, NumberInput, Select, SlideOver, Switch, showSuccess } from '../../components/ui';
import type { ApiEnvelope } from '../../types/api';
import { useOwnedOperation } from '../../hooks/useOwnedOperation';
import { apiErrorMessage } from '../../lib/api-error';
import { readWalletData, walletRequestConfig } from '../../features/payments/wallet-query';
import PancakePlanProduct from '../../features/payments/PancakePlanProduct';
import { createPlanDraft, serializePlan, PlanDraftError, planFieldLabels } from './plan-data';
import type { AdminPlan, PlanDraft, PlanNumberField } from './plan-data';

export default function PlanEditPanel({ identity, plan, onClose, onSaved }: { identity: string; plan?: AdminPlan; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation(); const { busy, run } = useOwnedOperation();
  const [form, setForm] = useState(() => createPlanDraft(plan, plan ? quotaToDisplayAmount(plan.total_amount) : 0));
  const set = <K extends keyof PlanDraft>(key: K, value: PlanDraft[K]) => setForm((previous) => ({ ...previous, [key]: value }));
  const groups = useQuery({ queryKey: ['subscription-groups', identity], gcTime: 0, retry: false, queryFn: ({ signal }) => readWalletData('/api/group', z.array(z.string()), signal) });
  const group = form.allowed_groups.length === 1 ? form.allowed_groups[0] : '';
  const models = useQuery({ queryKey: ['subscription-models', identity, group], gcTime: 0, retry: false, queryFn: ({ signal }) => readWalletData('/api/user/models', z.array(z.string()), signal, group ? { group } : undefined) });
  const groupNames = [...new Set([...(groups.isError ? [] : groups.data ?? []), ...form.allowed_groups, form.upgrade_group, form.downgrade_group])].filter(Boolean);
  const groupOptions = groupNames.map((name) => ({ value: name, label: name }));
  const modelOptions = [...new Set([...(models.isError ? [] : models.data ?? []), ...form.allowed_models])].map((name) => ({ value: name, label: name }));
  const validation = useMemo(() => {
    try { return { payload: serializePlan(form, displayAmountToQuota), field: '' }; }
    catch (cause) { return { payload: null, field: cause instanceof PlanDraftError ? cause.field : 'Plan name' }; }
  }, [form]);
  const save = () => {
    if (!validation.payload) return;
    void run(async (signal) => {
      const url = plan ? `/api/subscription/admin/plans/${plan.id}` : '/api/subscription/admin/plans';
      const { data } = plan ? await API.put<ApiEnvelope<unknown>>(url, { plan: validation.payload }, { ...walletRequestConfig, signal, timeout: 30000 }) : await API.post<ApiEnvelope<unknown>>(url, { plan: validation.payload }, { ...walletRequestConfig, signal, timeout: 30000 });
      signal.throwIfAborted(); if (!data.success) throw new Error(data.message || 'Unable to save plan');
      showSuccess(t(plan ? 'Plan updated' : 'Plan created')); onSaved(); onClose();
    });
  };
  const number = (key: PlanNumberField, min = 0, step: number | 'any' = 1) => <Field label={t(planFieldLabels[key])}><NumberInput aria-label={t(planFieldLabels[key])} value={form[key]} onChange={(value) => set(key, value)} min={min} step={step} width='full' invalid={validation.field === planFieldLabels[key]} /></Field>;
  const selection = <K extends 'duration_unit' | 'quota_reset_period'>(key: K, labels: Record<PlanDraft[K], string>) => <Select aria-label={t(key === 'duration_unit' ? 'Duration unit' : 'Credit reset period')} width='full' value={form[key]} options={Object.entries(labels).map(([value, label]) => ({ value, label: t(label as string) }))} onChange={(value) => set(key, value as PlanDraft[K])} />;
  return <SlideOver open title={plan ? t('Edit plan #{{id}}', { id: plan.id }) : t('Create plan')} onClose={onClose} footer={<div className='flex w-full flex-wrap justify-end gap-2.5'><Button variant='toggle' onClick={onClose}>{t('Cancel')}</Button><Button loading={busy} disabled={!validation.payload} onClick={save}>{t(plan ? 'Save' : 'Create')}</Button></div>}>
    <fieldset disabled={busy} className='space-y-5 px-6 pb-6'>
      <div className='space-y-4'><Field label={t('Plan name')}><Input aria-label={t('Plan name')} value={form.title} onChange={(value) => set('title', value)} placeholder={t('Example: Monthly Pro')} /></Field><Field label={t('Description')}><Input value={form.subtitle} onChange={(value) => set('subtitle', value)} /></Field>
        <div className='space-y-4'>{number('sort_order', Number.MIN_SAFE_INTEGER)}<label className='flex items-center gap-2 pt-5 text-sm text-ui-text-2'><Switch checked={form.enabled} onChange={(value) => set('enabled', value)} />{t('Enable this plan')}</label></div>
      </div>
      <div className='h-px bg-ui-divider' />
      <div className='space-y-4'><h2 className='text-sm font-medium text-ui-text'>{t('Purchase and billing')}</h2><div className='space-y-4'>{number('price_amount', 0, 0.000001)}{number('max_purchase_per_user')}</div>
        <label className='flex items-center gap-2 text-sm text-ui-text-2'><Switch checked={form.allow_balance_pay} onChange={(value) => set('allow_balance_pay', value)} />{t('Allow purchase with balance')}</label>
        <label className='flex items-center gap-2 text-sm text-ui-text-2'><Switch checked={form.allow_wallet_overflow} onChange={(value) => set('allow_wallet_overflow', value)} />{t('Allow balance after subscription credit is exhausted')}</label>
        <Field label='Stripe Price ID'><Input value={form.stripe_price_id} onChange={(value) => set('stripe_price_id', value)} /></Field><Field label='Creem Product ID'><Input value={form.creem_product_id} onChange={(value) => set('creem_product_id', value)} /></Field>
        <PancakePlanProduct title={form.title} price={typeof form.price_amount === 'number' ? form.price_amount : NaN} value={form.waffo_pancake_product_id} onChange={(value) => set('waffo_pancake_product_id', value)} disabled={busy} />
        <Field label={t('Group after purchase')}><Select width='full' value={form.upgrade_group} options={[{ value: '', label: t('Keep current group') }, ...groupOptions]} onChange={(value) => set('upgrade_group', value)} /></Field><Field label={t('Group after expiry')}><Select width='full' value={form.downgrade_group} options={[{ value: '', label: t('Restore previous group') }, ...groupOptions]} onChange={(value) => set('downgrade_group', value)} /></Field>
      </div>
      <div className='h-px bg-ui-divider' />
      <div className='space-y-4'><h2 className='text-sm font-medium text-ui-text'>{t('Subscription duration')}</h2><div className='space-y-4'><Field label={t('Duration unit')}>{selection('duration_unit', { month: 'Months', year: 'Years', day: 'Days', hour: 'Hours', custom: 'Custom seconds' })}</Field>{form.duration_unit === 'custom' ? number('custom_seconds', 1) : number('duration_value', 1)}</div></div>
      <div className='h-px bg-ui-divider' />
      <div className='space-y-4'><h2 className='text-sm font-medium text-ui-text'>{t('Credit and rate limits')}</h2>{number('total_amount', 0, 'any')}<div className='space-y-4'><Field label={t('Credit reset period')}>{selection('quota_reset_period', { never: 'Never', daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly', custom: 'Custom seconds' })}</Field>{form.quota_reset_period === 'custom' && number('quota_reset_custom_seconds', 1)}</div><div className='space-y-4'>{number('rpm_limit')}{number('concurrent_limit')}</div></div>
      <div className='h-px bg-ui-divider' />
      <div className='space-y-4'><h2 className='text-sm font-medium text-ui-text'>{t('Access restrictions')}</h2><Field label={t('Allowed groups (empty = unrestricted)')}><MultiSelect value={form.allowed_groups} onChange={(value: string[]) => set('allowed_groups', value)} options={groupOptions} placeholder={t('Select groups')} width='full' /></Field><Field label={t('Allowed models (empty = unrestricted)')}><MultiSelect value={form.allowed_models} onChange={(value: string[]) => set('allowed_models', value)} options={modelOptions} placeholder={t('Select allowed models')} searchable width='full' /></Field></div>
      {(groups.isError || models.isError) && <div role='alert' className='space-y-2 text-sm text-ui-danger'><p>{t(apiErrorMessage(groups.error || models.error, 'Unable to load plan options'))}</p><Button variant='link' onClick={() => { void groups.refetch(); void models.refetch(); }}>{t('Retry')}</Button></div>}
      {validation.field && <p role='alert' className='text-sm text-ui-danger'>{t('Invalid plan field: {{field}}', { field: t(validation.field) })}</p>}
    </fieldset>
  </SlideOver>;
}
