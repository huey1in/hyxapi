import { z } from 'zod';

const count = z.number().int().nonnegative().safe();
export const walletProfileSchema = z.object({
  id: count.positive(), username: z.string(), role: count,
  quota: z.number().int().safe(), used_quota: count,
  aff_count: count, aff_quota: count, aff_history_quota: count,
}).passthrough();
export const topUpPageSchema = z.object({
  total: count, page: count.positive(), page_size: count.positive(),
  items: z.array(z.object({
    id: count.positive(), user_id: count.positive(), amount: count,
    money: z.number().finite().nonnegative(), trade_no: z.string().min(1),
    payment_method: z.string(), payment_provider: z.string(),
    create_time: count, complete_time: count, status: z.string(),
  })).nullish().transform((value) => value ?? []),
});
export const subscriptionPlanSchema = z.object({
  id: count.positive(), title: z.string().min(1), subtitle: z.string(),
  price_amount: z.number().finite().nonnegative(), currency: z.string().regex(/^[A-Z]{3}$/),
  duration_unit: z.enum(['hour', 'day', 'month', 'year', 'custom']), duration_value: count, custom_seconds: count,
  total_amount: count, max_purchase_per_user: count, upgrade_group: z.string(),
  allow_balance_pay: z.boolean().nullish(), stripe_price_id: z.string(), creem_product_id: z.string(), waffo_pancake_product_id: z.string(),
}).refine((plan) => plan.duration_unit === 'custom' ? plan.custom_seconds > 0 : plan.duration_value > 0, 'Invalid subscription duration');
export const subscriptionOffersSchema = z.array(z.object({ plan: subscriptionPlanSchema })).nullish().transform((value) => value ?? []);
export type SubscriptionPlan = z.infer<typeof subscriptionPlanSchema>;
export type TopUpRecord = z.infer<typeof topUpPageSchema>['items'][number];

export function affiliateURL(code: string, origin: string): string {
  const url = new URL('/auth', origin); url.searchParams.set('mode', 'register'); url.searchParams.set('aff', code); return url.href;
}
// A transport failure is ambiguous: only an explicit missing-code reply permits
// trying the separate wallet-code system. Used/expired codes never fall through.
export function isUnknownSubscriptionCode(response: unknown): boolean {
  if (!response || typeof response !== 'object') return false;
  const value = response as Record<string, unknown>;
  return value.success === false && typeof value.message === 'string' && /^(无效的兑换码|無效的兌換碼|invalid redemption code|invalid code)$/i.test(value.message.trim());
}
export function transferQuota(amount: string, quotaPerUnit: number, available: number): number | null {
  if (!amount.trim() || !Number.isFinite(quotaPerUnit) || quotaPerUnit <= 0 || !Number.isSafeInteger(available) || available < 0) return null;
  const units = Number(amount), quota = Math.round(units * quotaPerUnit);
  return Number.isFinite(units) && units > 0 && Number.isSafeInteger(quota) && quota >= Math.ceil(quotaPerUnit) && quota <= available ? quota : null;
}
