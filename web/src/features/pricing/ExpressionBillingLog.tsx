import { useTranslation } from 'react-i18next';
import { DynamicPricingDetails } from './DynamicPricingDetails';
import { decodeBillingExpression } from './lib/pricing-display';
import { formatBillingCondition } from './lib/billing-expression/condition-display';
import type { BillingUsageSchema, PricingModel } from './types';

type Rule = { cond: string; multiplier: number; matched: boolean };
type Props = { other: { expr_b64?: string; matched_tier?: string; request_rules?: Rule[]; usage_facts?: Record<string, unknown>; billing_usage_schema?: BillingUsageSchema }; modelName: string };

export function ExpressionBillingLog({ other, modelName }: Props) {
  const { t, i18n } = useTranslation();
  const expression = decodeBillingExpression(other.expr_b64);
  const model: PricingModel = {
    id: 0, model_name: modelName, quota_type: 0, model_ratio: 0, completion_ratio: 0, enable_groups: [],
    billing_mode: 'tiered_expr', billing_expr: expression || '', billing_usage_schema: other.billing_usage_schema,
  };
  const formatUSD = (value: number) => `$${value.toLocaleString('en-US', { maximumFractionDigits: 10 })}`;
  return <div className='flex min-w-0 flex-col gap-3'>
    {expression ? <>
      <p className='text-xs text-ui-text-3'>{t('计费时的原价；本次分组倍率见详情。')}</p>
      <DynamicPricingDetails model={model} matchedTier={other.matched_tier} formatUSD={formatUSD} />
    </> : other.expr_b64 && <p className='text-xs text-ui-text-3'>{t('无法读取此日志的计费表达式')}</p>}
    {Array.isArray(other.request_rules) && other.request_rules.length > 0 && <div className='flex flex-col gap-2 text-xs'>
      <div className='font-medium text-ui-text'>{t('本次请求倍率')}</div>
      {other.request_rules.map((rule, index) => <div key={index} className='flex flex-wrap justify-between gap-2 text-ui-text-2'>
        <span className='break-all'>{formatBillingCondition(rule.cond, t, i18n.language) || rule.cond}</span>
        <span className='tabular-nums'>{rule.matched ? `${t('命中')} ×${rule.multiplier}` : `${t('未命中')} ×1`}</span>
      </div>)}
    </div>}
    {other.usage_facts && <details className='text-xs text-ui-text-3'>
      <summary className='cursor-pointer'>{t('实际计费用量')}</summary>
      <pre className='mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-all'>{JSON.stringify(other.usage_facts, null, 2)}</pre>
    </details>}
  </div>;
}
