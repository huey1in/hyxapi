import { z } from 'zod';

const number = z.number().finite().nullish();
const text = z.string().nullish();
const windowSchema = z.object({ used_percent: number, reset_at: number, reset_after_seconds: number, limit_window_seconds: number });
const rateSchema = z.object({ plan_type: text, allowed: z.boolean().nullish(), limit_reached: z.boolean().nullish(), primary_window: windowSchema.nullish(), secondary_window: windowSchema.nullish() });
const usageSchema = z.object({
  plan_type: text, email: text, user_id: text,
  rate_limit: rateSchema.nullish(),
  additional_rate_limits: z.array(z.object({ limit_name: text, metered_feature: text, rate_limit: rateSchema.nullish(), primary_window: windowSchema.nullish(), secondary_window: windowSchema.nullish(), plan_type: text })).nullish(),
  rate_limit_reset_credits: z.object({ available_count: number }).nullish(),
  credits: z.object({ overage_limit_reached: z.boolean().nullish() }).nullish(),
  spend_control: z.object({ reached: z.boolean().nullish() }).nullish(),
});
const creditsSchema = z.object({ available_count: number, total_earned_count: number, credits: z.array(z.object({ id: z.union([z.string(), z.number()]).nullish(), title: text, description: text, status: text, reset_type: text, granted_at: text, expires_at: text, redeem_started_at: text, redeemed_at: text })).nullish() });

export type CodexUsage = z.infer<typeof usageSchema>;
export type CodexCredits = z.infer<typeof creditsSchema>;
export type CodexWindow = z.infer<typeof windowSchema>;
export type CodexRateLimit = z.infer<typeof rateSchema>;

export function parseCodexUsage(value: unknown): CodexUsage { return usageSchema.parse(value); }
export function parseCodexCredits(value: unknown): CodexCredits { return creditsSchema.parse(value); }
export function availableResetCredits(usage?: CodexUsage, credits?: CodexCredits): number | undefined {
  const count = credits?.available_count ?? usage?.rate_limit_reset_credits?.available_count;
  return typeof count === 'number' && Number.isSafeInteger(count) && count >= 0 ? count : undefined;
}
export function usedPercent(window?: CodexWindow | null): number | undefined {
  const value = window?.used_percent;
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : undefined;
}
export function resetTimestamp(window: CodexWindow, receivedAt: number): number | undefined {
  const value = window.reset_at != null ? window.reset_at * 1000
    : window.reset_after_seconds != null ? receivedAt + Math.max(0, window.reset_after_seconds) * 1000 : undefined;
  return value !== undefined && Number.isFinite(value) && !Number.isNaN(new Date(value).valueOf()) ? value : undefined;
}
export function codexLimits(usage: CodexUsage): { name: string; rate: CodexRateLimit }[] {
  const limits = usage.rate_limit ? [{ name: 'Account limit', rate: usage.rate_limit }] : [];
  return limits.concat((usage.additional_rate_limits ?? []).map((item) => ({ name: item.limit_name || item.metered_feature || 'Additional limit', rate: item.rate_limit ?? item })));
}
