import { z } from 'zod';

export interface AuditLog {
  event_id: string; user_id: number; username: string; actor_role: number; created_at: number;
  category: string; action: string; token_ref: string; auth_method: string; ip: string;
  user_agent: string; method: string; route: string; status: number; success: boolean;
  request_id: string; content: string; other: unknown;
}

export interface LogOtherData {
  op?: { action: string; params?: Record<string, string | number | boolean | string[]> };
  audit_info?: { method: string; route: string; path: string; status: number; success: boolean };
}

export const auditPageSchema = z.object({
  items: z.array(z.object({
    event_id: z.string().min(1), user_id: z.number().int(), username: z.string(), actor_role: z.number().int(),
    created_at: z.number().finite(), category: z.string(), action: z.string(), token_ref: z.string(),
    auth_method: z.string().default(''), ip: z.string(), user_agent: z.string(), method: z.string(), route: z.string(),
    status: z.number().int(), success: z.boolean(), request_id: z.string(), content: z.string(), other: z.unknown(),
  })),
  total: z.number().int().nonnegative(),
});

export type AuditScope = 'all' | 'self';
export type TokenAuditScope = 'all' | 'current' | 'historical';
export interface AuditFilters {
  username: string; category: string; success: string; token_ref: string; request_id: string;
  start: string; end: string;
}
export const emptyAuditFilters = (): AuditFilters => ({ username: '', category: '', success: '', token_ref: '', request_id: '', start: '', end: '' });

export function auditParams(filters: AuditFilters, scope: AuditScope, page = 1, pageSize = 20): Record<string, string | number> {
  const params: Record<string, string | number> = { p: page, page_size: pageSize };
  if (!Number.isSafeInteger(page) || page < 1 || ![20, 50, 100].includes(pageSize)) throw new Error('Invalid audit pagination');
  if (!['', 'login', 'security', 'operation', 'access_token'].includes(filters.category) || !['', 'true', 'false'].includes(filters.success)) throw new Error('Invalid audit filters');
  for (const key of ['category', 'success', 'token_ref', 'request_id'] as const) {
    const value = filters[key].trim();
    if (value) params[key] = key === 'token_ref' ? value.toLowerCase() : value;
  }
  if (params.token_ref && !/^[a-f\d]{64}$/i.test(String(params.token_ref))) throw new Error('Token identifier must contain 64 hexadecimal characters');
  if (scope === 'all' && filters.username.trim()) params.username = filters.username.trim();
  const timestamps = [filters.start, filters.end].map((value) => value ? Math.floor(new Date(value).getTime() / 1000) : undefined);
  if (timestamps.some((value) => value !== undefined && (!Number.isSafeInteger(value) || value < 0))) throw new Error('Invalid audit time range');
  if (timestamps[0] !== undefined) params.start_timestamp = timestamps[0];
  if (timestamps[1] !== undefined) params.end_timestamp = timestamps[1];
  if (timestamps[0] !== undefined && timestamps[1] !== undefined && timestamps[0] > timestamps[1]) throw new Error('End time must be after start time');
  return params;
}

export function formatAuditDate(value: number, language = typeof document === 'undefined' ? 'en' : document.documentElement.lang): string {
  const date = new Date(value * 1000);
  return Number.isFinite(date.getTime()) ? date.toLocaleString(language || 'en') : '—';
}

export function accessAuditParams(params: Record<string, string | number>, tokenScope: TokenAuditScope, currentTokenRef?: string): Record<string, string | number> {
  const result: Record<string, string | number> = { ...params, category: 'access_token' };
  delete result.token_ref; delete result.exclude_token_ref; delete result.username;
  if (tokenScope === 'all') return result;
  if (currentTokenRef === undefined || (tokenScope === 'current' && !currentTokenRef)) throw new Error('Invalid audit filters');
  if (currentTokenRef && !/^[a-f\d]{64}$/i.test(currentTokenRef)) throw new Error('Token identifier must contain 64 hexadecimal characters');
  if (currentTokenRef) result[tokenScope === 'current' ? 'token_ref' : 'exclude_token_ref'] = currentTokenRef.toLowerCase();
  return result;
}
