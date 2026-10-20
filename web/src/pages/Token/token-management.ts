import { z } from 'zod';
import { isAxiosError, isCancel } from 'axios';

const flag = z.preprocess((value) => value === 1 ? true : value === 0 ? false : value, z.boolean()).default(false);
const text = z.string().nullish().transform((value) => value ?? '');
export const tokenSchema = z.object({
  id: z.number().int().positive(), name: z.string(), key: z.string(), status: z.number().int().default(1),
  remain_quota: z.number().finite().default(0), used_quota: z.number().finite().default(0), unlimited_quota: flag,
  created_time: z.number().default(0), accessed_time: z.number().default(0), expired_time: z.number().default(-1),
  group: text, groups: z.array(z.string()).optional(), auto_groups: z.array(z.string()).nullish(),
  model_limits_enabled: flag, model_limits: text, allow_ips: text, allow_user_quota_query: flag,
  cross_group_retry: flag, group_switch_status_codes: z.array(z.number()).optional(), group_switch_retry_count: z.number().optional(),
});
export type ManagedToken = z.infer<typeof tokenSchema>;
export type TokenSelection = Record<number, { id: number; name: string }>;
export type TokenSearch = { keyword: string; token: string };
export const tokenPageSchema = z.object({ items: z.array(tokenSchema), total: z.number().int().nonnegative() });

export function tokenErrorMessage(error: unknown): string {
  if (isCancel(error) || isAxiosError(error) && error.response?.status === 401) return '';
  if (isAxiosError<{ message?: string }>(error) && typeof error.response?.data?.message === 'string') return error.response.data.message;
  if (typeof error === 'string') return error;
  return error instanceof Error ? error.message : 'Unable to load API keys';
}

export function effectiveTokenStatus(token: Pick<ManagedToken, 'status' | 'expired_time' | 'unlimited_quota' | 'remain_quota'>, now = Date.now() / 1000): number {
  if (token.status === 2) return 2;
  if (token.expired_time !== -1 && token.expired_time <= now) return 3;
  if (!token.unlimited_quota && token.remain_quota <= 0) return 4;
  return token.status;
}
