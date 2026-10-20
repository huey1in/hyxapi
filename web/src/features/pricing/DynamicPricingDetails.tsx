import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { PricingModel, TokenUnit } from './types';
import { compileBillingExpression } from './lib/billing-expression/parser';
import { formatBillingCondition } from './lib/billing-expression/condition-display';
import { getDynamicPriceEntries, getDynamicPricingSummary, getDynamicPricingTiers } from './lib/dynamic-price';
import { withPluginPricing } from './lib/plugin-pricing';
import { taskTierConditions, pricingDisplayFallbackKey } from './lib/task-price-display';
import { priceEntryLabel, priceEntryUnit } from './lib/pricing-display';
import { evaluateBillingExpression } from './lib/billing-expression/runtime';
import type { ParsedTier } from './lib/billing-expr';

type Props = {
  model: PricingModel; tokenUnit?: TokenUnit; groupRatioMultiplier?: number;
  formatUSD: (value: number) => string; matchedTier?: string;
};

// Refresh price summaries on minute boundaries and after returning to the tab.
// Detail rows remain complete; current-time selection only affects summaries.
export function usePricingClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const refresh = () => { setNow(new Date()); timer = setTimeout(refresh, 60000 - Date.now() % 60000); };
    const visible = () => { if (document.visibilityState === 'visible') { clearTimeout(timer); refresh(); } };
    timer = setTimeout(refresh, 60000 - Date.now() % 60000);
    document.addEventListener('visibilitychange', visible);
    return () => { clearTimeout(timer); document.removeEventListener('visibilitychange', visible); };
  }, []);
  return now;
}

export function DynamicPricingSummary({ model, tokenUnit = 'M', groupRatioMultiplier = 1, formatUSD, now }: Props & { now: Date }) {
  const { t, i18n } = useTranslation();
  const summary = getDynamicPricingSummary(model, { tokenUnit, groupRatioMultiplier, formatUSD, now });
  if (!summary) return <span className='text-ui-text-3'>{t('未配置价格')}</span>;
  const entries = summary.primaryEntries.length ? summary.primaryEntries : summary.entries;
  return <div className='flex min-w-0 flex-col gap-1 text-xs'>
    {entries.slice(0, 2).map((entry) => <div key={entry.key} className='flex flex-wrap justify-between gap-x-2 gap-y-0.5'>
      <span className='text-ui-text-3'>{priceEntryLabel(entry, i18n.language, t)}</span>
      <span className='text-ui-text tabular-nums'>{entry.formattedRange || entry.formatted} / {priceEntryUnit(entry, tokenUnit, i18n.language)}</span>
    </div>)}
    {!entries.length && <span>{t('表达式计费')}</span>}
    <div className='text-ui-text-3'>{[
      summary.isTimePricing && t('当前时段'), summary.tierCount > 1 && t('多阶梯'),
      summary.hasRequestRules && t('含请求倍率'), summary.providerCount && `${summary.providerCount} ${t('个提供方')}`,
      summary.hasUnconfiguredProviders && t('部分提供方未配置价格'),
    ].filter(Boolean).join(' · ')}</div>
  </div>;
}

function ProviderDetails({ model, tokenUnit = 'M', groupRatioMultiplier = 1, formatUSD, matchedTier }: Props) {
  const { t, i18n } = useTranslation();
  const tiers = getDynamicPricingTiers(model);
  const compiled = compileBillingExpression(model.billing_expr || '');
  const requestRules = compiled.status === 'ready' ? compiled.requestRules : [];
  const examples = model.billing_usage_examples || [];
  if (model.billing_mode === 'ratio') {
    return <p className='text-sm text-ui-text-2'>{model.billing_type === 'request' && model.configured !== false
      ? `${formatUSD((model.request_price ?? model.model_price ?? 0) * groupRatioMultiplier)} / ${t('次')}`
      : t('使用模型基础价格')}</p>;
  }
  return <div className='flex min-w-0 flex-col gap-3 text-xs'>
    {!model.billing_expr && <p className='text-ui-text-3'>{t('此提供方尚未配置兼容的计费表达式')}</p>}
    {model.billing_expr && !tiers.length && <p className='text-ui-text-3'>{t(pricingDisplayFallbackKey(model.billing_expr, model.billing_usage_schema))}</p>}
    {tiers.map((tier, index) => {
      const taskTier = 'unitPrices' in tier && typeof tier.unitPrices === 'object';
      const condition = taskTier
        ? taskTierConditions(tier as Parameters<typeof taskTierConditions>[0], model.billing_usage_schema, i18n.language, t)
        : [tier.conditionText && (formatBillingCondition(tier.conditionText, t, i18n.language) || tier.conditionText),
          ...(tier as ParsedTier).conditions.map((item) => `${t(({ p: 'Input', c: 'Output', len: 'Full input length' } as Record<string, string>)[item.var] || item.var)} ${item.op} ${item.value}`)].filter(Boolean).join(' · ');
      const entries = getDynamicPriceEntries(tier, { tokenUnit, groupRatioMultiplier, formatUSD, usageSchema: model.billing_usage_schema });
      const matched = matchedTier !== undefined && tier.label === matchedTier;
      return <div key={`${tier.label}-${index}`} className={`min-w-0 rounded-xl border px-4 py-3 ${matched ? 'border-ui-text-3' : 'border-ui-border'}`}>
        <div className='flex flex-wrap items-center justify-between gap-2 text-ui-text'>
          <span className='font-medium break-all'>{tier.label || `${t('阶梯')} ${index + 1}`}</span>
          {matched && <span>{t('本次命中')}</span>}
        </div>
        <p className='mt-1 break-words text-ui-text-3'>{condition || (index === 0 ? t('默认条件') : t('前述条件未命中时'))}</p>
        <div className='mt-2 grid min-w-0 gap-2 sm:grid-cols-2'>
          {entries.map((entry) => <div key={entry.key} className='flex min-w-0 flex-wrap justify-between gap-x-2 gap-y-0.5'>
            <span className='text-ui-text-3'>{priceEntryLabel(entry, i18n.language, t)}</span>
            <span className='text-ui-text tabular-nums'>{entry.formatted} / {priceEntryUnit(entry, tokenUnit, i18n.language)}</span>
          </div>)}
        </div>
      </div>;
    })}
    {requestRules.length > 0 && <div className='flex flex-col gap-2 text-ui-text-2'>
      <div className='font-medium'>{t('请求倍率（按顺序相乘）')}</div>
      {requestRules.map((rule, index) => <div key={index} className='break-all'>{formatBillingCondition(rule.cond, t, i18n.language) || rule.cond} → ×{rule.multiplier}</div>)}
    </div>}
    {examples.length > 0 && <div className='flex flex-col gap-2 text-ui-text-2'>
      <div className='font-medium'>{t('用量示例')}</div>
      {examples.map((example, index) => {
        const result = evaluateBillingExpression(model.billing_expr || '', { usage: example.facts });
        return <div key={index} className='rounded-xl bg-ui-bg-subtle px-4 py-3'>
          <span className='font-medium'>{example.label}</span>
          <span className='ml-2 tabular-nums'>{result.status === 'success' ? formatUSD(result.cost * groupRatioMultiplier) : t('需要请求上下文才能计算')}</span>
          <pre className='mt-1 whitespace-pre-wrap break-all text-ui-text-3'>{JSON.stringify(example.facts)}</pre>
        </div>;
      })}
    </div>}
    {model.billing_expr && <details className='text-ui-text-3'>
      <summary className='cursor-pointer'>{t('查看原始表达式')}</summary>
      <pre className='mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-xl bg-ui-bg-subtle px-4 py-3'>{model.billing_expr}</pre>
    </details>}
  </div>;
}

export function DynamicPricingDetails(props: Props) {
  const { t } = useTranslation();
  if (!props.model.billing_plugin_variants?.length) return <ProviderDetails {...props} />;
  return <div className='flex min-w-0 flex-col gap-5'>
    {props.model.billing_plugin_variants.map((variant) => <section key={variant.plugin_key} className='min-w-0'>
      <div className='mb-2 text-sm font-medium text-ui-text break-all'>{variant.plugin_name || variant.plugin_key}</div>
      <ProviderDetails {...props} model={withPluginPricing(props.model, variant)} />
    </section>)}
    <p className='text-xs text-ui-text-3'>{t('最终价格取决于实际路由的提供方及命中条件。')}</p>
  </div>;
}
