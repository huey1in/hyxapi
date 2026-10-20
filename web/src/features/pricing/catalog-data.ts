import { z } from 'zod';
import type { PricingModel } from './types';
import { getCardExamplePrice, getDynamicPricingSummary } from './lib/dynamic-price';

const price = z.number().finite().nonnegative();
const localized = z.union([z.string(), z.record(z.string(), z.string())]);
export const usageSchema = z.record(z.string(), z.object({ type: z.enum(['number', 'boolean']).optional(), unit: z.enum(['second', 'count', 'token', 'credit']).optional(), unitLabel: localized.optional(), enum: z.array(z.string()).optional(), enumLabels: z.record(z.string(), localized).optional(), description: localized.optional() }));
const usageExamples = z.array(z.object({ label: z.string(), facts: z.record(z.string(), z.union([z.string(), z.number().finite(), z.boolean()])) }));
const plugin = z.object({ plugin_key: z.string(), plugin_name: z.string(), icon: z.string().optional(), billing_expr: z.string(), billing_mode: z.enum(['ratio', 'tiered_expr']).optional(), billing_usage_schema: usageSchema.nullish().transform((value) => value ?? {}), billing_usage_examples: usageExamples.optional() });
export const pricingModelSchema = z.object({
  id: z.number().int().optional(), model_name: z.string().min(1), description: z.string().optional(), icon: z.string().optional(), tags: z.string().optional(),
  vendor_id: z.number().int().optional(), vendor_name: z.string().optional(), vendor_icon: z.string().optional(), vendor_description: z.string().optional(), owner_by: z.string().optional(),
  quota_type: z.number().int().default(0), billing_type: z.union([z.string(), z.literal(0), z.literal(1)]).optional().transform((value) => value === 0 ? 'tokens' : value === 1 ? 'request' : value === 'tokens' || value === 'request' || value === 'expression' ? value : undefined),
  configured: z.boolean().optional(), enable_groups: z.array(z.string()).nullable().transform((groups) => groups ?? []), supported_endpoint_types: z.array(z.string()).nullish().transform((endpoints) => endpoints ?? []),
  input_price: price.optional(), output_price: price.optional(), request_price: price.optional(), cache_read_price: price.optional(), cache_write_price: price.optional(), image_price: price.optional(), audio_input_price: price.optional(), audio_output_price: price.optional(),
  model_ratio: price.optional(), completion_ratio: price.optional(), model_price: price.optional(),
  billing_mode: z.string().optional(), billing_expr: z.string().optional(), billing_usage_schema: usageSchema.optional(), billing_usage_examples: usageExamples.optional(), billing_plugin_variants: z.array(plugin).optional(),
}).passthrough();
const pricingEnvelopeSchema = z.object({ success: z.literal(true), data: z.array(pricingModelSchema).nullable(), vendors: z.array(z.object({ id: z.number().int(), name: z.string(), icon: z.string().optional(), description: z.string().optional() })).nullable(), group_ratio: z.record(z.string(), price), usable_group: z.record(z.string(), z.string()), supported_endpoint: z.record(z.string(), z.object({ path: z.string(), method: z.string() })).optional(), auto_groups: z.array(z.string()).nullish().transform((groups) => groups ?? []) });
export function parsePricingData(raw: unknown) {
  const snapshot = pricingEnvelopeSchema.parse(raw);
  const vendors = new Map((snapshot.vendors ?? []).map((vendor) => [vendor.id, vendor]));
  const models: PricingModel[] = (snapshot.data ?? []).map((model) => {
    const vendor = model.vendor_id === undefined ? undefined : vendors.get(model.vendor_id);
    return { ...model, key: model.model_name, ...(vendor ? { vendor_name: vendor.name, vendor_icon: vendor.icon, vendor_description: vendor.description } : {}) };
  });
  return { models, groupRatio: snapshot.group_ratio, usableGroup: snapshot.usable_group, supportedEndpoints: snapshot.supported_endpoint ?? {}, autoGroups: snapshot.auto_groups };
}
export const pricingSorts = [
  { value: 'name', label: 'Name' }, { value: 'input-price-low', label: 'Input Price: Low to High' }, { value: 'input-price-high', label: 'Input Price: High to Low' },
  { value: 'output-price-low', label: 'Output Price: Low to High' }, { value: 'output-price-high', label: 'Output Price: High to Low' },
  { value: 'request-price-low', label: 'Per-request Price: Low to High' }, { value: 'request-price-high', label: 'Per-request Price: High to Low' },
] as const;
export type PricingSort = typeof pricingSorts[number]['value'];
export const parsePricingSort = (raw: string | null): PricingSort => pricingSorts.find((item) => item.value === raw)?.value ?? 'name';
export const pricingTags = (raw?: string): string[] => [...new Set((raw ?? '').split(/[,;|]+/).map((tag) => tag.trim()).filter(Boolean))];
export const hasTaskUsage = (model: PricingModel): boolean => Object.keys(model.billing_usage_schema ?? {}).length > 0 || !!model.billing_plugin_variants?.some((variant) => Object.keys(variant.billing_usage_schema).length > 0);
export const hasExpressionPricing = (model: PricingModel): boolean => model.billing_type === 'expression' || model.billing_mode === 'tiered_expr' || !!model.billing_plugin_variants?.some((variant) => !!variant.billing_expr);
export interface PricingFilters { search: string; group: string; billing: string; vendor: string; endpoint: string; tag: string }
export function filterPricingModels(models: PricingModel[], filters: PricingFilters): PricingModel[] {
  const search = filters.search.trim().toLowerCase();
  return models.filter((model) => {
    const task = hasTaskUsage(model); const expression = hasExpressionPricing(model);
    return (filters.group === 'all' || model.enable_groups.includes(filters.group)) &&
      (filters.vendor === 'all' || (filters.vendor === 'unknown' ? !model.vendor_name : model.vendor_name === filters.vendor)) &&
      (filters.endpoint === 'all' || !!model.supported_endpoint_types?.includes(filters.endpoint)) &&
      (filters.tag === 'all' || pricingTags(model.tags).includes(filters.tag)) &&
      (filters.billing === 'all' || (filters.billing === 'task' ? task : filters.billing === 'expression' ? !task && expression : !task && !expression && model.billing_type === filters.billing)) &&
      (!search || [model.model_name, model.description, model.tags, model.vendor_name].some((value) => value?.toLowerCase().includes(search)));
  });
}
function sortPrice(model: PricingModel, kind: 'input' | 'output' | 'request', now: Date): number | undefined {
  if (model.configured === false) return undefined;
  const options = { tokenUnit: 'M' as const, groupRatioMultiplier: 1, now };
  if (kind === 'request') { const example = getCardExamplePrice(model, options); if (example) return example.total; }
  const summary = getDynamicPricingSummary(model, options);
  if (summary) return summary.entries.find((entry) => kind === 'request' ? entry.field === 'fixedPrice' || entry.field === 'modelPrice' : entry.field === (kind === 'input' ? 'inputPrice' : 'outputPrice') && entry.unit === 'token')?.value;
  if (hasTaskUsage(model) || hasExpressionPricing(model)) return undefined;
  return kind === 'request' ? model.billing_type === 'request' ? model.request_price : undefined : model.billing_type === 'tokens' ? model[kind === 'input' ? 'input_price' : 'output_price'] : undefined;
}
export function sortPricingModels(models: PricingModel[], sort: PricingSort, now = new Date()): PricingModel[] {
  const rows = [...models]; if (sort === 'name') return rows.sort((a, b) => a.model_name.localeCompare(b.model_name));
  const kind = sort.startsWith('input-') ? 'input' : sort.startsWith('output-') ? 'output' : 'request';
  const values = new Map(rows.map((model) => [model, sortPrice(model, kind, now)])); const direction = sort.endsWith('-high') ? -1 : 1;
  return rows.sort((a, b) => {
    const left = values.get(a); const right = values.get(b);
    if (left === undefined || right === undefined) return Number(left === undefined) - Number(right === undefined);
    return direction * (left - right) || a.model_name.localeCompare(b.model_name);
  });
}
