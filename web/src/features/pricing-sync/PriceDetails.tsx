import { DynamicPricingDetails } from '../pricing/DynamicPricingDetails';
import type { PricingModel } from '../pricing/types';
import type { Price } from './core';
import { labels } from './core';

export default function PriceDetails({ name, price }: { name: string; price: Price }) {
  if (price.billing_mode === 'tiered_expr' && typeof price.billing_expr === 'string') {
    const model = { id: 0, model_name: name, quota_type: 0, model_ratio: 0, completion_ratio: 0, enable_groups: [], billing_mode: 'tiered_expr', billing_expr: price.billing_expr } satisfies PricingModel;
    return <DynamicPricingDetails model={model} formatUSD={(value) => `$${value.toLocaleString(undefined, { maximumFractionDigits: 8 })}`} />;
  }
  const entries = Object.entries(price).filter(([key]) => labels[key] && key !== 'billing_mode');
  if (!entries.length) return <p className='text-xs text-ui-text-3'>尚未配置基础价格</p>;
  return <dl className='space-y-1 text-xs'>{entries.map(([key, value]) => <div key={key} className='flex flex-wrap justify-between gap-2'><dt className='text-ui-text-3'>{labels[key]}</dt><dd className='break-all text-ui-text'>{String(value)}</dd></div>)}</dl>;
}
