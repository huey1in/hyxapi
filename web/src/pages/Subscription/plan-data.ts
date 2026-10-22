import { z } from 'zod';
import { subscriptionPlanSchema } from '../../features/payments/wallet-data';
import { subscriptionNamesSchema } from '../../features/payments/subscription-data';

const count = z.number().int().nonnegative().safe();
const adminPlanSchema = subscriptionPlanSchema.safeExtend({
  price_amount: z.number().finite().min(0).max(9999), enabled: z.boolean(), sort_order: z.number().int().safe(),
  allow_wallet_overflow: z.boolean().nullish(), downgrade_group: z.string(),
  allowed_groups: subscriptionNamesSchema, allowed_models: subscriptionNamesSchema,
  concurrent_limit: count, rpm_limit: count,
  quota_reset_period: z.enum(['never', 'daily', 'weekly', 'monthly', 'custom']), quota_reset_custom_seconds: count,
}).refine((plan) => plan.quota_reset_period !== 'custom' || plan.quota_reset_custom_seconds > 0, { path: ['quota_reset_custom_seconds'], message: 'Invalid reset interval' });
export const adminPlansSchema = z.array(z.object({ plan: adminPlanSchema })).nullable().transform((rows) => rows ?? []);
export type AdminPlan = z.infer<typeof adminPlanSchema>;
export type PlanNumberField = 'price_amount' | 'max_purchase_per_user' | 'duration_value' | 'custom_seconds' | 'sort_order' | 'total_amount' | 'quota_reset_custom_seconds' | 'concurrent_limit' | 'rpm_limit';
export type PlanDraft = Omit<AdminPlan, PlanNumberField | 'allow_balance_pay' | 'allow_wallet_overflow'> & { [K in PlanNumberField]: number | '' } & { allow_balance_pay: boolean; allow_wallet_overflow: boolean };
export const planFieldLabels: Record<PlanNumberField, string> = {
  price_amount: 'Price (USD)', max_purchase_per_user: 'Purchase limit per user (0 = unlimited)',
  duration_value: 'Duration count', custom_seconds: 'Custom duration (seconds)', sort_order: 'Sort weight',
  total_amount: 'Total credit (0 = unlimited)', quota_reset_custom_seconds: 'Reset interval (seconds)',
  concurrent_limit: 'Concurrency limit (0 = unlimited)', rpm_limit: 'RPM limit (0 = unlimited)',
};
export function createPlanDraft(plan?: AdminPlan, displayedQuota = 0): PlanDraft {
  return plan ? { ...plan, total_amount: displayedQuota, allow_balance_pay: plan.allow_balance_pay !== false, allow_wallet_overflow: plan.allow_wallet_overflow !== false } : {
    id: 0, title: '', subtitle: '', price_amount: 0, currency: 'USD', enabled: true, sort_order: 0,
    allow_balance_pay: true, allow_wallet_overflow: true, max_purchase_per_user: 0,
    stripe_price_id: '', creem_product_id: '', waffo_pancake_product_id: '',
    upgrade_group: '', downgrade_group: '', duration_unit: 'month', duration_value: 1, custom_seconds: 0,
    total_amount: 0, quota_reset_period: 'never', quota_reset_custom_seconds: 0,
    allowed_groups: [], allowed_models: [], concurrent_limit: 0, rpm_limit: 0,
  };
}
export class PlanDraftError extends Error {
  constructor(readonly field: string) { super('Invalid plan field: {{field}}'); }
}
export function serializePlan(draft: PlanDraft, toQuota: (displayAmount: number) => number) {
  if (!draft.title.trim()) throw new PlanDraftError('Plan name');
  for (const field of Object.keys(planFieldLabels) as PlanNumberField[]) {
    if (typeof draft[field] !== 'number' || !Number.isFinite(draft[field])) throw new PlanDraftError(planFieldLabels[field]);
  }
  if (Number((draft.price_amount as number).toFixed(6)) !== draft.price_amount) throw new PlanDraftError(planFieldLabels.price_amount);
  if (draft.duration_unit === 'custom' ? (draft.custom_seconds as number) <= 0 : (draft.duration_value as number) <= 0) throw new PlanDraftError(planFieldLabels[draft.duration_unit === 'custom' ? 'custom_seconds' : 'duration_value']);
  if (draft.quota_reset_period === 'custom' && (draft.quota_reset_custom_seconds as number) <= 0) throw new PlanDraftError(planFieldLabels.quota_reset_custom_seconds);
  const quota = toQuota(draft.total_amount as number);
  if ((draft.total_amount as number) < 0 || !Number.isSafeInteger(quota) || quota < 0 || ((draft.total_amount as number) > 0 && quota === 0)) throw new PlanDraftError(planFieldLabels.total_amount);
  const parsed = adminPlanSchema.safeParse({ ...draft, id: draft.id || 1, title: draft.title.trim(), currency: 'USD', total_amount: quota,
    allowed_groups: JSON.stringify(draft.allowed_groups), allowed_models: JSON.stringify(draft.allowed_models) });
  if (!parsed.success) {
    const field = String(parsed.error.issues[0]?.path[0] || 'duration_value');
    const labels: Record<string, string> = { ...planFieldLabels, title: 'Plan name', allowed_groups: 'Allowed groups', allowed_models: 'Allowed models', duration_unit: 'Duration unit', quota_reset_period: 'Credit reset period' };
    throw new PlanDraftError(labels[field] || 'Plan name');
  }
  const { id: _id, ...plan } = parsed.data;
  return { ...plan, allowed_groups: JSON.stringify(plan.allowed_groups), allowed_models: JSON.stringify(plan.allowed_models) };
}

export const subscriptionCodesSchema = z.array(z.object({
  id: count.positive(), plan_id: count.positive(), key: z.string().min(1), status: count,
  created_time: count.max(8640000000000), redeemed_time: count.max(8640000000000), expired_time: count.max(8640000000000), used_user_id: count,
})).nullable().transform((rows) => rows ?? []);
export type SubscriptionCode = z.infer<typeof subscriptionCodesSchema>[number];
export function codeGenerationDraft(countValue: number | '', expiry: string, now = Date.now()) {
  if (typeof countValue !== 'number' || !Number.isSafeInteger(countValue) || countValue < 1 || countValue > 200) return null;
  const timestamp = expiry ? Math.floor(new Date(expiry).getTime() / 1000) : 0;
  if (!Number.isFinite(timestamp) || (expiry && timestamp <= now / 1000)) return null;
  return { count: countValue, expired_time: timestamp };
}
