import { z } from 'zod';
import { isAxiosError, isCancel } from 'axios';

export const TOKEN_PAGE_SIZE = 10;

const flag = z.preprocess((value) => value === 1 ? true : value === 0 ? false : value, z.boolean()).default(false);
const text = z.string().nullish().transform((value) => value ?? '');
export const tokenListItemSchema = z.object({
  id: z.number().int().positive(), name: z.string(), key: z.string(), status: z.number().int().default(1),
  created_time: z.number().finite().default(0), accessed_time: z.number().finite().default(0),
});
export const tokenSchema = tokenListItemSchema.extend({
  remain_quota: z.number().finite().default(0), unlimited_quota: flag, expired_time: z.number().default(-1),
  group: text, groups: z.array(z.string()).optional(), auto_groups: z.array(z.string()).nullish(),
  model_limits_enabled: flag, model_limits: text, allow_ips: text, allow_user_quota_query: flag,
  cross_group_retry: flag, group_switch_status_codes: z.array(z.number()).optional(), group_switch_retry_count: z.number().optional(),
});
export type ManagedToken = z.infer<typeof tokenSchema>;
export type TokenListItem = z.infer<typeof tokenListItemSchema>;
export const tokenPageSchema = z.object({ items: z.array(tokenListItemSchema), total: z.number().int().nonnegative() });

export function tokenErrorMessage(error: unknown): string {
  if (isCancel(error) || isAxiosError(error) && error.response?.status === 401) return '';
  if (isAxiosError<{ message?: string }>(error) && typeof error.response?.data?.message === 'string') return error.response.data.message;
  if (typeof error === 'string') return error;
  return error instanceof Error ? error.message : 'Unable to load API keys';
}
