import { z } from 'zod';
import { usageSchema } from '../../../features/pricing/catalog-data';

const numericKeys = new Set(['ModelRatio', 'CompletionRatio', 'CacheRatio', 'CreateCacheRatio', 'ImageRatio', 'AudioRatio', 'AudioCompletionRatio', 'ModelPrice']);
const pricingValuesSchema = z.record(z.string(), z.union([z.number().finite().nonnegative(), z.string(), z.record(z.string(), z.string())])).superRefine((values, context) => {
  for (const [key, value] of Object.entries(values)) if (numericKeys.has(key) && typeof value !== 'number') context.addIssue({ code: 'custom', path: [key], message: 'Invalid numeric price' });
});
const usageExamples = z.array(z.object({ label: z.string(), facts: z.record(z.string(), z.union([z.string(), z.number().finite(), z.boolean()])) }));
const pricingEntrySchema = z.object({
  model_name: z.string().min(1), version: z.string().min(1), configured: pricingValuesSchema, effective: pricingValuesSchema.default({}), source: z.string(),
  direct: z.object({ model_name: z.string() }).optional(), usage_schema: usageSchema.optional(),
  plugin_variants: z.array(z.object({
    plugin_key: z.string().min(1), plugin_name: z.string(), configured: z.string(), effective: z.string(),
    usage_schema: usageSchema.nullish().transform((value) => value ?? {}), usage_examples: usageExamples.optional(), compatible: z.boolean(), stale: z.boolean().optional(),
  })).optional(),
});
export const pricingSnapshotSchema = z.object({ entries: z.array(pricingEntrySchema), empty_version: z.string().min(1) });
export const pricingPreviewSchema = z.object({ effective: pricingValuesSchema.optional(), cache_write_mode: z.string().optional(), billing_details: z.record(z.string(), z.unknown()) });
export const pricingConversionSchema = pricingPreviewSchema.extend({ expression: z.string().optional(), unsupported_reason: z.string().optional() });
export type PricingValues = z.infer<typeof pricingValuesSchema>;
export type PricingEntry = z.infer<typeof pricingEntrySchema>;
export type PricingSnapshot = z.infer<typeof pricingSnapshotSchema>;
export type PricingChange = { model_name: string; expected_version: string; pricing: PricingValues; reset?: boolean };
export const pluginExpressionKey = 'billing_setting.plugin_billing_expr';

export class PricingConfigError extends Error {
  constructor(message: string, readonly values: Record<string, string | number> = {}) { super(message); }
}

export function validatePricingDraft(values: PricingValues): string {
  if (!pricingValuesSchema.safeParse(values).success) return 'Prices must be non-negative finite numbers';
  const mode = values['billing_setting.billing_mode'];
  if (mode !== undefined && mode !== 'ratio' && mode !== 'tiered_expr') return 'Choose a valid billing mode';
  const expression = values['billing_setting.billing_expr'];
  if (expression !== undefined && (typeof expression !== 'string' || !expression.trim())) return 'Billing expression cannot be empty';
  const plugins = values[pluginExpressionKey];
  if (plugins !== undefined && (typeof plugins !== 'object' || Object.values(plugins).some((item) => !item.trim()))) return 'Plugin expressions cannot be empty';
  return '';
}

export function copyModelPricing(source: PricingEntry, target: PricingEntry): PricingValues {
  if (source.source === 'direct') throw new PricingConfigError('Convert the source model’s direct USD prices to advanced billing before copying.');
  // Copy the displayed model default price. Provider bindings belong to their
  // target model and must survive copying, including obsolete saved overrides.
  const values = structuredClone(source.effective);
  delete values[pluginExpressionKey];
  if (target.configured[pluginExpressionKey] !== undefined) values[pluginExpressionKey] = structuredClone(target.configured[pluginExpressionKey]);
  return values;
}

export function parsePricingBatch(raw: string, snapshot: PricingSnapshot): PricingChange[] {
  const rows: unknown = JSON.parse(raw);
  if (!Array.isArray(rows)) throw new PricingConfigError('The batch draft must be a JSON array.');
  if (rows.length > 1000) throw new PricingConfigError('Save at most 1,000 models per batch.');
  const seen = new Set<string>();
  return rows.map((row) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) throw new PricingConfigError('Each draft must be a model configuration object.');
    if (Object.keys(row).some((key) => !['model_name', 'pricing', 'reset'].includes(key))) throw new PricingConfigError('Drafts accept only model_name, pricing and reset. Versions come from the current snapshot.');
    if (typeof row.model_name !== 'string' || !row.model_name.trim()) throw new PricingConfigError('The model name cannot be empty.');
    const name = row.model_name.trim();
    if (seen.has(name)) throw new PricingConfigError('Duplicate model: {{model}}', { model: name });
    seen.add(name);
    if (row.reset !== undefined && typeof row.reset !== 'boolean') throw new PricingConfigError('{{model}}: reset must be a boolean.', { model: name });
    const pricing = row.pricing ?? {};
    if (!pricing || typeof pricing !== 'object' || Array.isArray(pricing)) throw new PricingConfigError('{{model}}: pricing must be an object.', { model: name });
    for (const [key, value] of Object.entries(pricing)) {
      if (numericKeys.has(key)) {
        if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new PricingConfigError('{{model}}: {{field}} must be a finite non-negative number.', { model: name, field: key });
      } else if (key === 'billing_setting.billing_mode') {
        if (value !== 'ratio' && value !== 'tiered_expr') throw new PricingConfigError('{{model}}: choose a valid billing mode.', { model: name });
      } else if (key === 'billing_setting.billing_expr') {
        if (typeof value !== 'string' || !value.trim()) throw new PricingConfigError('{{model}}: the expression cannot be empty.', { model: name });
      } else if (key === pluginExpressionKey) {
        if (!value || typeof value !== 'object' || Array.isArray(value) || Object.values(value).some((item) => typeof item !== 'string' || !item.trim())) throw new PricingConfigError('{{model}}: plugin prices must map plugin keys to non-empty expressions.', { model: name });
      } else throw new PricingConfigError('{{model}}: unsupported pricing field {{field}}.', { model: name, field: key });
    }
    return { model_name: name, expected_version: snapshot.entries.find((entry) => entry.model_name === name)?.version || snapshot.empty_version,
      pricing: pricingValuesSchema.parse(structuredClone(pricing)), ...(row.reset ? { reset: true } : {}) };
  });
}

export function serializePricingDraft(changes: PricingChange[]) {
  return JSON.stringify(changes.map(({ model_name, pricing, reset }) => ({ model_name, pricing, ...(reset ? { reset: true } : {}) })), null, 2);
}
