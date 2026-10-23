import { z } from 'zod';

const count = z.number().int().nonnegative().safe();
const timestamp = count.max(8640000000000);
const names = z.array(z.string());
export const subscriptionNamesSchema = z.string().transform((raw, context) => {
  try { const parsed = names.safeParse(raw ? JSON.parse(raw) : []); if (parsed.success) return parsed.data; } catch { /* Report the invalid restrictions below. */ }
  context.addIssue({ code: 'custom', message: 'Invalid subscription restrictions' }); return z.NEVER;
});
export const billingPreferenceSchema = z.enum(['subscription_first', 'wallet_first', 'subscription_only', 'wallet_only']);
export const userSubscriptionSchema = z.object({
  id: count.positive(), user_id: count.positive(), plan_id: count.positive(),
  amount_total: count, amount_used: count, start_time: timestamp, end_time: timestamp,
  status: z.string().min(1), source: z.string(),
  last_reset_time: timestamp, next_reset_time: timestamp,
  allowed_groups: subscriptionNamesSchema, allowed_models: subscriptionNamesSchema,
  concurrent_limit: count, rpm_limit: count, allow_wallet_overflow: z.boolean(),
  upgrade_group: z.string(), downgrade_group: z.string(), prev_user_group: z.string(),
});
const summaries = z.array(z.object({ subscription: userSubscriptionSchema })).nullable().transform((rows) => rows ?? []);
export const subscriptionSelfSchema = z.object({ billing_preference: billingPreferenceSchema, all_subscriptions: summaries });
export type UserSubscription = z.infer<typeof userSubscriptionSchema>;
export type SubscriptionSelf = z.infer<typeof subscriptionSelfSchema>;
export function isActiveSubscription(subscription: Pick<UserSubscription, 'status' | 'end_time'>, now = Date.now() / 1000): boolean {
  return subscription.status === 'active' && subscription.end_time > now;
}
export function subscriptionState(subscription: Pick<UserSubscription, 'status' | 'end_time'>, now = Date.now() / 1000): string {
  if (subscription.status === 'cancelled') return 'Cancelled';
  if (subscription.status === 'expired' || (subscription.end_time > 0 && subscription.end_time <= now)) return 'Expired';
  if (isActiveSubscription(subscription, now)) return 'Active';
  return subscription.status === 'active' ? 'Inactive' : subscription.status;
}
export function subscriptionUsage(subscription: Pick<UserSubscription, 'amount_total' | 'amount_used'>) {
  const unlimited = subscription.amount_total === 0;
  return { unlimited, remaining: unlimited ? null : Math.max(0, subscription.amount_total - subscription.amount_used), percent: unlimited ? 0 : Math.max(0, Math.min(100, 100 * subscription.amount_used / subscription.amount_total)) };
}
