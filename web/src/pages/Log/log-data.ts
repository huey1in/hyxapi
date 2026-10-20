import { z } from 'zod';
import { usageSchema } from '../../features/pricing/catalog-data';

const count = z.number().int().nonnegative();
const number = z.number().finite();
const record = z.record(z.string(), z.unknown());
const field = <T extends z.ZodType>(schema: T) => schema.nullish().transform((value) => value ?? undefined).catch(undefined);
const otherSchema = z.object({
  billing_mode: field(z.string()), billing_type: field(count),
  input_price: field(number), output_price: field(number), request_price: field(number),
  cache_read_price: field(number), cache_write_price: field(number), cache_write_price_5m: field(number), cache_write_price_1h: field(number),
  image_price: field(number), audio_input_price: field(number), audio_output_price: field(number), group_ratio: field(number),
  cache_tokens: field(count), cache_write_tokens: field(count), cache_creation_tokens: field(count),
  cache_creation_tokens_5m: field(count), cache_creation_tokens_1h: field(count), input_tokens_total: field(count), frt: field(number),
  matched_tier: field(z.string()), billing_unit: field(z.string()), fixed_price: field(number), image_count: field(count),
  expr_b64: field(z.string()), request_rules: field(z.array(z.object({ cond: z.string(), multiplier: number, matched: z.boolean() }))),
  usage_facts: field(record), billing_usage_schema: field(usageSchema),
  billing_source: field(z.string()), wallet: field(z.string()), billing_preference: field(z.string()),
  subscription_id: field(count), subscription_plan_title: field(z.string()), subscription_consumed: field(number),
  subscription_used: field(number), subscription_total: field(number), subscription_remain: field(number), wallet_quota_deducted: field(number),
  request_conversion: field(z.array(z.string())), request_convert: field(z.string()), request_path: field(z.string()), usage_semantic: field(z.string()),
  stream_status: field(z.object({ status: z.string().optional(), end_reason: z.string().optional() })),
  channel_id: field(count), admin_info: field(record), request_body: field(z.string()), response_body: field(z.string()),
}).passthrough();

export type LogOther = z.infer<typeof otherSchema>;
export const logSchema = z.object({
  id: count, created_at: count, type: count, content: z.string().default(''),
  username: z.string().default(''), token_name: z.string().default(''), model_name: z.string().default(''),
  quota: number.default(0), prompt_tokens: count.default(0), completion_tokens: count.default(0), use_time: number.default(0),
  is_stream: z.boolean().default(false), channel: count.default(0), channel_name: z.string().nullish().transform((value) => value ?? ''),
  group: z.string().default(''), ip: z.string().default(''), request_id: z.string().default(''), upstream_request_id: z.string().default(''),
  other: z.union([z.string(), record]).nullish().transform((value) => value ?? ''),
});
export const logPageSchema = z.object({ items: z.array(logSchema).nullable().transform((rows) => rows ?? []), total: count, page: count.min(1) });
export type LogRow = z.infer<typeof logSchema>;

export function enrichLog(row: LogRow, role: number) {
  let raw: Record<string, unknown> = {}; let invalid = false;
  try {
    const parsed = typeof row.other === 'string' ? (row.other ? JSON.parse(row.other) : {}) : row.other;
    raw = record.parse(parsed);
  } catch { invalid = true; }
  // Keep the UI's diagnostic boundary aligned with the server projection.
  raw = { ...raw };
  if (role < 100) delete raw.root_info;
  if (role < 10) for (const key of ['admin_info', 'audit_info', 'channel_id', 'channel_name', 'channel_type', 'reject_reason']) delete raw[key];
  const other = otherSchema.parse(raw);
  if (Object.keys(otherSchema.shape).some((key) => raw[key] != null && other[key] === undefined)) invalid = true;
  const cacheHit = other.cache_tokens ?? 0;
  // An explicit zero is authoritative; split durations supersede the legacy total.
  const splitWrite = (other.cache_creation_tokens_5m ?? 0) + (other.cache_creation_tokens_1h ?? 0);
  const cacheWrite = other.cache_write_tokens ?? (splitWrite || other.cache_creation_tokens || 0);
  return {
    ...row, upstream_request_id: role >= 100 ? row.upstream_request_id : '',
    _other: other, _rawOther: raw, _metadataInvalid: invalid,
    _cacheHit: cacheHit, _cacheWrite: cacheWrite, _cache: cacheHit + cacheWrite,
  };
}
export type EnrichedLog = ReturnType<typeof enrichLog>;

const TOKEN_PRICE_FIELDS = [
  { key: 'input_price', label: 'Input price' }, { key: 'output_price', label: 'Output price' },
  { key: 'cache_read_price', label: 'Cache read price' }, { key: 'cache_write_price', label: 'Cache write price' },
  { key: 'cache_write_price_5m', label: 'Cache write price (5m)' }, { key: 'cache_write_price_1h', label: 'Cache write price (1h)' },
  { key: 'image_price', label: 'Image price' }, { key: 'audio_input_price', label: 'Audio input price' }, { key: 'audio_output_price', label: 'Audio output price' },
] as const;
export function getBillingPriceFields(other: Partial<LogOther> | null | undefined) {
  if (other?.billing_mode === 'tiered_expr') return [];
  const definitions = Number(other?.billing_type) === 1
    ? [{ key: 'request_price', label: 'Request price', unit: 'request' }] as const
    : TOKEN_PRICE_FIELDS.map((item) => ({ ...item, unit: '1M tokens' }));
  return definitions.flatMap((item) => {
    const value = other?.[item.key];
    return typeof value === 'number' && Number.isFinite(value) ? [{ ...item, value }] : [];
  });
}

export const emptyLogFilters = () => ({
  token_name: '', model_name: '', group: '', request_id: '', upstream_request_id: '', channel: '', username: '', type: 0,
  start_timestamp: '', end_timestamp: '',
});
export type LogFilters = ReturnType<typeof emptyLogFilters>;
export function validateLogFilters(filters: LogFilters, admin: boolean, maxDays: unknown, exporting = false, now = Date.now()) {
  const start = filters.start_timestamp ? new Date(filters.start_timestamp).getTime() : 0;
  const end = filters.end_timestamp ? Math.min(new Date(filters.end_timestamp).getTime(), now) : now;
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < 0 || (start && start > end)) return 'Invalid time range';
  if ((!admin || exporting) && typeof maxDays === 'number' && maxDays > 0 && start && end - start > maxDays * 86400000) return 'Time range exceeds the configured limit';
  if (admin && filters.channel && !/^[1-9]\d*$/.test(filters.channel)) return 'Channel ID must be a positive integer';
  return '';
}
