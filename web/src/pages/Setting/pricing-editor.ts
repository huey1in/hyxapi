import { z } from 'zod';

export const TOKEN_BILLING = 0;
export const REQUEST_BILLING = 1;
export const DEFAULT_PAGE_SIZE = 10;
export const priceFields = ['input_price', 'output_price', 'cache_read_price', 'cache_write_price', 'image_price', 'audio_input_price', 'audio_output_price', 'request_price'] as const;
export type PriceField = typeof priceFields[number];
export const directPriceSchema = z.object({
  id: z.number().int(), model_name: z.string(), billing_type: z.number().int(), enabled: z.boolean(),
  input_price: z.number(), output_price: z.number(), cache_read_price: z.number(), cache_write_price: z.number(),
  image_price: z.number(), audio_input_price: z.number(), audio_output_price: z.number(), request_price: z.number(),
  created_time: z.number().optional(), updated_time: z.number().optional(),
});
export const directPriceListSchema = z.array(directPriceSchema).nullish().transform((value) => value ?? []);
export const pricingSummarySchema = z.object({ entries: z.array(z.object({ model_name: z.string(), source: z.string(), configured: z.record(z.string(), z.unknown()).nullish().transform((value) => value ?? {}) })).nullish().transform((value) => value ?? []) });
export type DirectPrice = z.infer<typeof directPriceSchema>;
export type PricingRow = Omit<DirectPrice, PriceField> & Record<PriceField, number | ''> & { _new: boolean; _dirty: boolean; _key: string };
type PricingInput = Partial<Omit<PricingRow, 'billing_type'>> & { billing_type?: number | string | null };
export type PricingSuggestion = string | { model_name?: string; value?: string; label?: string };
export const upstreamPricePreviewSchema = z.array(z.object({
  model_name: z.string(), provider: z.string(), status: z.string(), description: z.string().optional(), description_action: z.string().optional(),
  local: directPriceSchema.nullable(), upstream: directPriceSchema,
}));
export type SyncPreview = z.infer<typeof upstreamPricePreviewSchema>[number];

export const MODEL_PRICING_REQUEST_CONFIG = Object.freeze({ skipErrorHandler: true });
const defaults: DirectPrice = { id: 0, model_name: '', billing_type: TOKEN_BILLING, input_price: 0, output_price: 0, cache_read_price: 0, cache_write_price: 0, image_price: 0, audio_input_price: 0, audio_output_price: 0, request_price: 0, enabled: true };
let nextLocalPricingKey = 0;
export const createBlankPricingRow = (): PricingRow => ({ ...defaults, _new: true, _dirty: true, _key: `local-${++nextLocalPricingKey}` });
export const normalizePricingRow = (row: PricingInput): PricingRow => ({ ...defaults, ...row, billing_type: row.billing_type == null ? TOKEN_BILLING : Number(row.billing_type), enabled: row.enabled !== false, _new: false, _dirty: false, _key: row._key || `server-${row.id}` });
export const getModelName = (item: PricingSuggestion): string => typeof item === 'string' ? item : item.model_name || item.value || item.label || '';
export function mergePricingRowsWithModels(rows: PricingRow[], models: PricingSuggestion[]): PricingRow[] {
  const merged = [...rows]; const names = new Set(rows.map((row) => row.model_name.trim()).filter(Boolean));
  for (const name of [...new Set((models ?? []).map(getModelName).map((name) => name.trim()).filter(Boolean))].sort()) {
    if (!names.has(name)) merged.push({ ...normalizePricingRow({ model_name: name }), _key: `suggested-${name}`, _new: true });
  }
  return merged;
}
export const replacePricingRow = (rows: PricingRow[], rowKey: string, saved: PricingInput) => rows.map((row) => row._key === rowKey ? { ...normalizePricingRow(saved), _key: rowKey } : row);
export const removePricingRow = (rows: PricingRow[], rowKey: string) => rows.filter((row) => row._key !== rowKey);
export function mergeRefreshedPricingRows(current: PricingRow[], server: DirectPrice[], suggestions: PricingSuggestion[]) {
  const next = server.map((price) => {
    const previous = current.find((row) => row.id === price.id || (row._new && row.model_name.trim() === price.model_name));
    return previous?._dirty ? previous : { ...normalizePricingRow(price), ...(previous ? { _key: previous._key } : {}) };
  });
  next.push(...current.filter((row) => row._new && row._dirty && !server.some((price) => price.model_name === row.model_name.trim())));
  return mergePricingRowsWithModels(next, suggestions);
}
export const getModelPricingPageCount = (total: number, pageSize: number) => Math.max(1, Math.ceil(Math.max(0, total) / Math.max(1, pageSize)));
export const clampModelPricingPage = (page: number, total: number, pageSize: number) => Math.min(Math.max(1, Number(page) || 1), getModelPricingPageCount(total, pageSize));
export function getModelPricingPageRows<T>(rows: T[], page: number, pageSize: number): T[] { const safe = clampModelPricingPage(page, rows.length, pageSize); return rows.slice((safe - 1) * pageSize, safe * pageSize); }
export function getBillingTypeOptions(billingType: number | string) {
  const options = [{ value: TOKEN_BILLING, label: 'Per token' }, { value: REQUEST_BILLING, label: 'Per request' }];
  const value = Number(billingType);
  return value === TOKEN_BILLING || value === REQUEST_BILLING ? options : [{ value, label: `Invalid type (${billingType})` }, ...options];
}
export const getDefaultModelPricingSyncSelection = (preview: Pick<SyncPreview, 'model_name' | 'status'>[]) => (preview ?? []).filter((item) => item.status === 'new' || item.status === 'description').map((item) => item.model_name);
export function buildModelPricingSyncPayload(preview: Pick<SyncPreview, 'model_name'>[], selected: string[]) { const names = new Set((preview ?? []).map((item) => item.model_name)); return { model_names: [...new Set(selected ?? [])].filter((name) => names.has(name)) }; }
export function getModelPricingErrorMessage(error: unknown, fallback: string) {
  const result = z.object({ message: z.string().optional(), response: z.object({ data: z.object({ message: z.string().optional() }).optional() }).optional() }).safeParse(error);
  return result.success ? result.data.response?.data?.message || result.data.message || fallback : fallback;
}
export function toModelPricingPayload(row: PricingInput & { model_name: string }) {
  const { _key: _key, _new: _new, _dirty: _dirty, ...payload } = row;
  return { ...payload, model_name: row.model_name.trim(), billing_type: Number(row.billing_type) };
}
export function validatePricingRow(row: PricingRow): string {
  if (!row.model_name.trim()) return 'Enter a model name';
  if (row.billing_type !== TOKEN_BILLING && row.billing_type !== REQUEST_BILLING) return 'Choose a valid billing type';
  if (priceFields.some((key) => typeof row[key] !== 'number' || !Number.isFinite(row[key]) || row[key] < 0)) return 'Prices must be non-negative finite numbers. Empty values are not free prices.';
  return '';
}
