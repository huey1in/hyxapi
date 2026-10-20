import { z } from 'zod';

const count = z.number().int().nonnegative().safe();
const timestamp = count.max(8640000000000);
export const redemptionCodeSchema = z.object({ id: count.positive(), key: z.string().min(1), name: z.string(), quota: count.positive(), status: z.union([z.literal(1), z.literal(2), z.literal(3)]), used_user_id: count, created_time: timestamp, expired_time: timestamp });
export const redemptionPageSchema = z.object({ total: count, items: z.array(redemptionCodeSchema).nullable().transform((rows) => rows ?? []) });
export type RedemptionCode = z.infer<typeof redemptionCodeSchema>;
export type RedemptionDraft = { name: string; amount: number | ''; count: number | ''; expiry: string; badExpiry: boolean };
export function serializeRedemptionDraft(draft: RedemptionDraft, toQuota: (amount: number) => number, includeCount = true, now = Date.now()) {
  if (typeof draft.amount !== 'number' || !Number.isFinite(draft.amount) || draft.amount <= 0 || [...draft.name.trim()].length > 20 || draft.badExpiry) return null;
  const quota = toQuota(draft.amount);
  if (!Number.isSafeInteger(quota) || quota <= 0) return null;
  if (includeCount && (typeof draft.count !== 'number' || !Number.isSafeInteger(draft.count) || draft.count < 1 || draft.count > 100)) return null;
  const expired_time = draft.expiry ? Math.floor(new Date(draft.expiry).getTime() / 1000) : 0;
  if (!Number.isFinite(expired_time) || (draft.expiry && expired_time <= now / 1000)) return null;
  return { name: draft.name.trim(), quota, count: includeCount ? draft.count as number : 1, expired_time };
}

export type CodeStatus = '1' | '2' | '3' | 'expired' | '';
export interface CodeFilters { keyword: string; status: CodeStatus }

export function codesURL(filters: CodeFilters, page: number, pageSize = 20): string {
  const query = new URLSearchParams({ p: String(page), page_size: String(pageSize) });
  if (filters.keyword.trim()) query.set('keyword', filters.keyword.trim());
  if (filters.status) query.set('status', filters.status);
  const route = filters.keyword.trim() || filters.status ? 'search' : '';
  return `/api/redemption/${route}?${query}`;
}

export function codeStatus(code: RedemptionCode, now = Date.now() / 1000): CodeStatus {
  if (code.status === 1 && code.expired_time > 0 && code.expired_time < now) return 'expired';
  return code.status === 1 ? '1' : code.status === 2 ? '2' : '3';
}

export function localExpiry(timestamp: number): string {
  if (!timestamp) return '';
  const date = new Date(timestamp * 1000);
  if (!Number.isFinite(date.getTime())) return '';
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
