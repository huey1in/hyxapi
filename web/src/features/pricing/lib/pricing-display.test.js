import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getDynamicPricingSummary, getDynamicPricingTiers, getDynamicPriceEntries } from './dynamic-price.ts';
import { getTaskPricingDisplayTiers } from './task-matrix-display.ts';
import { taskTierConditions, pricingDisplayFallbackKey } from './task-price-display.ts';
import { formatBillingCondition } from './billing-expression/condition-display.ts';
import { applyRechargePrice, decodeBillingExpression, priceEntryUnit } from './pricing-display.ts';
import { withPluginPricing } from './plugin-pricing.ts';

const model = (expression, extra = {}) => ({ model_name: 'example', billing_mode: 'tiered_expr', billing_expr: expression, enable_groups: ['default'], ...extra });
const options = { tokenUnit: 'M', formatUSD: (value) => `$${value}`, groupRatioMultiplier: 2 };
const t = (key, values = {}) => key.replace(/{{(\w+)}}/g, (_, name) => String(values[name] ?? ''));

test('recharge price converts credit cost before the display currency and preserves free prices', () => {
  assert.equal(applyRechargePrice(15, false, 4, 8), 15);
  assert.equal(applyRechargePrice(15, true, 4, 8), 7.5);
  assert.equal(applyRechargePrice(15, true, 4, 8) * 4, 30);
  assert.equal(applyRechargePrice(0, true, 4, 8), 0);
  assert.equal(applyRechargePrice(15, true, undefined, undefined), 15);
  assert.equal(applyRechargePrice(15, true, Number.NaN, Number.POSITIVE_INFINITY), 15);
});

test('time summaries select the current period while details retain every price row', () => {
  const quote = model('hour("UTC") >= 9 && hour("UTC") < 17 ? tier("day", p * 2 + c * 8) : tier("night", p * 1 + c * 4)');
  assert.equal(getDynamicPricingTiers(quote).length, 2);
  for (const [hour, price] of [['10', '$4'], ['20', '$2']]) {
    const summary = getDynamicPricingSummary(quote, { ...options, now: new Date(`2026-10-18T${hour}:00:00Z`) });
    assert.equal(summary.isTimePricing, true);
    assert.equal(summary.entries.find((entry) => entry.key === 'p').formatted, price);
  }
});

test('fixed image prices and explicit free token lanes keep distinct billing units', () => {
  const image = model('tier("image", fixed(0.04)) * image_count');
  const entry = getDynamicPricingSummary(image, options).entries[0];
  assert.equal(entry.formatted, '$0.08');
  assert.equal(priceEntryUnit(entry, 'K', 'zh-CN'), '张');
  assert.equal(priceEntryUnit({ ...entry, unitLabel: undefined, unit: 'second' }, 'M', 'fr-FR'), 'seconde');
  assert.equal(priceEntryUnit({ ...entry, unitLabel: undefined, unit: 'credit' }, 'M', 'zh-TW'), '積分');
  const free = getDynamicPricingSummary(model('tier("free", p * 0 + cr * 0 + c * 8)'), options);
  assert.equal(free.entries.find((entry) => entry.key === 'cr').formatted, '$0');
  const kilo = getDynamicPricingSummary(model('tier("base", p * 2)'), { ...options, tokenUnit: 'K' });
  assert.equal(kilo.entries[0].formatted, '$0.004');
});

test('boolean task conditions and token usage display scale per million exactly once', () => {
  const schema = { tokens: { type: 'number', unit: 'token' }, audio: { type: 'boolean' }, seconds: { type: 'number', unit: 'second' } };
  const quote = model('u("audio") == true ? tier("audio", u("tokens") * 6 / 1000000) : tier("text", u("tokens") * 3 / 1000000)', { billing_usage_schema: schema });
  const tiers = getTaskPricingDisplayTiers(quote.billing_expr, schema);
  assert.equal(tiers.length, 2);
  assert.match(taskTierConditions(tiers[0], schema, 'zh-CN', t), /audio: Yes/);
  const entries = getDynamicPriceEntries(tiers[0], { ...options, usageSchema: schema, tokenUnit: 'K' });
  assert.equal(entries[0].formatted, '$12');
  assert.equal(priceEntryUnit(entries[0], 'K', 'zh-CN'), '1M Tokens');
  assert.equal(entries.some((entry) => entry.field === 'seconds'), false);
});

test('provider price ranges respect schema units, zero per-call prices and local API fields', () => {
  const variants = [
    { plugin_key: 'a', billing_mode: 'ratio', billing_expr: '', billing_usage_schema: { seconds: { type: 'number', unit: 'second' } } },
    { plugin_key: 'b', billing_mode: 'tiered_expr', billing_expr: 'tier("credit", u("credits") * 0.2)', billing_usage_schema: { credits: { type: 'number', unit: 'credit' } } },
  ];
  const quote = model('', { billing_mode: 'ratio', billing_type: 'request', request_price: 0, configured: true, billing_plugin_variants: variants });
  const summary = getDynamicPricingSummary(quote, options);
  assert.equal(summary.entries.find((entry) => entry.field === 'modelPrice').formatted, '$0');
  assert.equal(summary.entries.find((entry) => entry.field === 'credits').formatted, '$0.4');
  assert.equal(summary.hasUnconfiguredProviders, false);
  assert.equal(withPluginPricing(quote, variants[0]).quota_type, 1);
});

test('same task field name with different provider units produces separate prices', () => {
  const quote = model('', { billing_plugin_variants: ['second', 'credit'].map((unit, index) => ({
    plugin_key: `p${index}`, billing_expr: `tier("base", u("units") * ${index + 1})`,
    billing_usage_schema: { units: { type: 'number', unit } },
  })) });
  assert.deepEqual(getDynamicPricingSummary(quote, options).entries.map((entry) => entry.unit), ['second', 'credit']);
});

test('an expression provider overlay preserves a sibling provider per-call quote from the API', () => {
  const quote = model('tier("seconds", u("seconds") * 0.05)', {
    billing_type: 'expression', quota_type: 1, request_price: 0.25, configured: true,
    billing_usage_schema: { seconds: { type: 'number', unit: 'second' } },
    billing_plugin_variants: [
      { plugin_key: 'alpha', billing_mode: 'tiered_expr', billing_expr: 'tier("seconds", u("seconds") * 0.05)', billing_usage_schema: { seconds: { type: 'number', unit: 'second' } } },
      { plugin_key: 'beta', billing_mode: 'ratio', billing_expr: '', billing_usage_schema: { credits: { type: 'number', unit: 'credit' } } },
    ],
  });
  const summary = getDynamicPricingSummary(quote, options);
  assert.equal(summary.entries.find((entry) => entry.field === 'modelPrice').formatted, '$0.5');
  assert.equal(summary.entries.find((entry) => entry.field === 'seconds').formatted, '$0.1');
  assert.equal(summary.hasUnconfiguredProviders, false);
  assert.equal(withPluginPricing(quote, quote.billing_plugin_variants[1]).billing_type, 'request');
});

test('complex or incomplete task metadata keeps the source instead of inventing a price', () => {
  const expression = 'tier("custom", max(u("seconds"), 10) * 2)';
  assert.deepEqual(getDynamicPricingTiers(model(expression, { billing_usage_schema: { seconds: { type: 'number', unit: 'second' } } })), []);
  assert.match(pricingDisplayFallbackKey(expression, {}), /metadata is unavailable/);
  assert.match(pricingDisplayFallbackKey(expression, { seconds: { type: 'number', unit: 'second' } }), /cannot be expanded/);
});

test('request multiplier summaries keep unsupported condition source and all tier boundaries', () => {
  const quote = model('(len <= 1000 ? tier("small", p * 1) : tier("large", p * 2)) * (param("service_tier") == "flex" ? 0.5 : 1)');
  const summary = getDynamicPricingSummary(quote, options);
  assert.equal(summary.hasRequestRules, true);
  assert.equal(summary.tierCount, 2);
  assert.equal(formatBillingCondition('param("service_tier") == "flex"', t, 'zh-CN'), null);
  assert.match(formatBillingCondition('hour("UTC") >= 21 || hour("UTC") < 6', t, 'zh-CN'), /UTC/);
});

test('log decoding supports UTF-8 and rejects corrupt, oversized or invalid UTF-8 data', () => {
  const expression = 'tier("免费<script>", p * 0)';
  assert.equal(decodeBillingExpression(Buffer.from(expression).toString('base64')), expression);
  assert.equal(decodeBillingExpression('@@@'), null);
  assert.equal(decodeBillingExpression('/w=='), null);
  assert.equal(decodeBillingExpression('a'.repeat(131073)), null);
  assert.equal(decodeBillingExpression(null), null);
});
