import type { PricingChange, PricingSnapshot, PricingValues } from '../../pages/Setting/billing/pricing-config';
import { pluginExpressionKey } from '../../pages/Setting/billing/pricing-config.ts';

export type Price = Record<string, number | string>;
export type Source = { id: number; name: string; base_url: string; type?: number; status?: number; endpoint: string };
export type Preview = {
  prices: Record<string, { current: Price; upstreams: Record<string, Price> }>;
  differences: Record<string, Record<string, { confidence: Record<string, boolean> }>>;
  test_results: { name: string; status: string; error?: string }[];
  export_errors?: Record<string, string>;
};
const fields: Record<string, string> = {
  model_ratio: 'ModelRatio', completion_ratio: 'CompletionRatio', cache_ratio: 'CacheRatio',
  create_cache_ratio: 'CreateCacheRatio', image_ratio: 'ImageRatio', audio_ratio: 'AudioRatio',
  audio_completion_ratio: 'AudioCompletionRatio', model_price: 'ModelPrice',
};
export const labels: Record<string, string> = {
  model_ratio: '输入倍率', completion_ratio: '输出倍率', cache_ratio: '缓存读倍率',
  create_cache_ratio: '缓存写倍率', image_ratio: '图片倍率', audio_ratio: '音频输入倍率',
  audio_completion_ratio: '音频输出倍率', model_price: '每次 USD', billing_mode: '计费方式', billing_expr: '计费表达式',
};
export function defaultEndpoint(source: Pick<Source, 'id' | 'type'>): string {
  if (source.id === -100) return '/llm-metadata/api/newapi/ratio_config-v1-base.json';
  if (source.id === -101) return 'https://models.dev/api.json';
  return source.type === 20 ? 'openrouter' : '/api/pricing';
}
export function syncChanges(preview: Preview, selected: Record<string, string>, snapshot: PricingSnapshot): PricingChange[] {
  return Object.entries(selected).map(([name, source]) => {
    const price = preview.prices[name]?.upstreams[source];
    if (!price) throw new Error(`${name}：所选来源已失效，请重新比较。`);
    const entry = snapshot.entries.find((item) => item.model_name === name);
    const pricing: PricingValues = {};
    if (entry?.configured[pluginExpressionKey] !== undefined) pricing[pluginExpressionKey] = structuredClone(entry.configured[pluginExpressionKey]);
    if (price.billing_mode === 'tiered_expr') {
      if (typeof price.billing_expr !== 'string' || !price.billing_expr.trim()) throw new Error(`${name}：来源表达式为空。`);
      pricing['billing_setting.billing_mode'] = 'tiered_expr'; pricing['billing_setting.billing_expr'] = price.billing_expr;
    } else {
      for (const [field, key] of Object.entries(fields)) {
        if (price[field] === undefined) continue;
        const value = price[field];
        if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new Error(`${name}：${labels[field]}无效。`);
        pricing[key] = value;
      }
      if (pricing.ModelPrice === undefined && pricing.ModelRatio === undefined) throw new Error(`${name}：来源没有完整基础价格。`);
      pricing['billing_setting.billing_mode'] = 'ratio';
    }
    return { model_name: name, expected_version: entry?.version || snapshot.empty_version, pricing };
  });
}
export function selectSource(preview: Preview, names: string[], source: string, previous: Record<string, string>) {
  const next = { ...previous };
  for (const name of names) if (preview.prices[name]?.upstreams[source]) next[name] = source;
  return next;
}
