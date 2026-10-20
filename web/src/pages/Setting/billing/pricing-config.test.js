import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { loadTestModules } from '../../../../scripts/load-test-modules.mjs';
const pluginExpressionKey = 'billing_setting.plugin_billing_expr';
let copyModelPricing, parsePricingBatch, serializePricingDraft, pricingSnapshotSchema, pricingConversionSchema, validatePricingDraft, usageLabel, usageUnit;
before(async () => {
  const modules = await loadTestModules(['./src/pages/Setting/billing/pricing-config.ts', './src/pages/Setting/billing/usage-labels.ts']);
  ({ copyModelPricing, parsePricingBatch, serializePricingDraft, pricingSnapshotSchema, pricingConversionSchema, validatePricingDraft } = modules.entry0);
  ({ usageLabel, usageUnit } = modules.entry1);
});

const source = { model_name: 'source', source: 'tiered_expr', configured: {}, effective: {
  'billing_setting.billing_mode': 'tiered_expr', 'billing_setting.billing_expr': 'tier("base", p * 2 + cr * 0)',
  CacheRatio: 0, [pluginExpressionKey]: { 'source-plugin': 'tier("task", u("seconds") * 0.2)' },
} };
const target = { model_name: 'target', version: 'target-version', configured: { [pluginExpressionKey]: { 'target-plugin': 'tier("task", u("credits") * 0.3)' } } };
const snapshot = { entries: [target], empty_version: 'empty-version' };

test('batch copies the effective model price and preserves each target plugin override and explicit zero', () => {
  const result = copyModelPricing(source, target);
  assert.equal(result.CacheRatio, 0);
  assert.equal(result['billing_setting.billing_expr'], source.effective['billing_setting.billing_expr']);
  assert.deepEqual(result[pluginExpressionKey], target.configured[pluginExpressionKey]);
  result[pluginExpressionKey]['target-plugin'] = 'changed draft';
  assert.notEqual(target.configured[pluginExpressionKey]['target-plugin'], 'changed draft');
  assert.throws(() => copyModelPricing({ ...source, source: 'direct' }, target), /direct USD/);
});

test('imported drafts bind to the current captured snapshot and preserve zero and inheritance', () => {
  const changes = parsePricingBatch(JSON.stringify([{ model_name: 'target', pricing: { ModelRatio: 0 } }, { model_name: 'new', pricing: {} }]), snapshot);
  assert.equal(changes[0].expected_version, 'target-version');
  assert.equal(changes[0].pricing.ModelRatio, 0);
  assert.equal(changes[1].expected_version, 'empty-version');
  assert.deepEqual(changes[1].pricing, {});
  assert.deepEqual(parsePricingBatch(serializePricingDraft(changes), snapshot), changes);
});

test('batch validation rejects duplicate names, malformed prices and injected versions', () => {
  for (const rows of [
    [{ model_name: 'same' }, { model_name: ' same ' }],
    [{ model_name: 'target', pricing: { ModelRatio: -1 } }],
    [{ model_name: 'target', pricing: { ModelRatio: '0' } }],
    [{ model_name: 'target', pricing: [] }],
    [{ model_name: 'target', pricing: { SessionSecret: 'unsafe' } }],
    [{ model_name: 'target', pricing: {}, expected_version: 'injected' }],
    [{ model_name: 'target', pricing: { [pluginExpressionKey]: [] } }],
  ]) assert.throws(() => parsePricingBatch(JSON.stringify(rows), snapshot));
});

test('reset is explicit and cannot be triggered by a truthy string', () => {
  const [change] = parsePricingBatch('[{"model_name":"target","reset":true}]', snapshot);
  assert.equal(change.reset, true);
  assert.equal(change.expected_version, 'target-version');
  assert.throws(() => parsePricingBatch('[{"model_name":"target","reset":"false"}]', snapshot));
  assert.equal(JSON.parse(serializePricingDraft([change]))[0].reset, true);
});

test('pricing snapshots validate financial values, provider schemas and versions while preserving free prices', () => {
  const entry = { ...source, version: 'captured-version', configured: { ModelRatio: 0, [pluginExpressionKey]: { provider: 'tier("base", 0)' } }, plugin_variants: [{ plugin_key: 'provider', plugin_name: 'Provider', configured: '', effective: '', usage_schema: { seconds: { type: 'number', unit: 'second' } }, compatible: true }] };
  const raw = { entries: [entry], empty_version: 'empty' };
  assert.equal(pricingSnapshotSchema.parse(raw).entries[0].configured.ModelRatio, 0);
  for (const configured of [{ ModelRatio: -1 }, { ModelRatio: '0' }, { ModelRatio: Infinity }, { [pluginExpressionKey]: { provider: 1 } }]) assert.equal(pricingSnapshotSchema.safeParse({ ...raw, entries: [{ ...entry, configured }] }).success, false);
  assert.equal(pricingSnapshotSchema.safeParse({ ...raw, entries: [{ ...entry, version: '' }] }).success, false);
  assert.equal(pricingConversionSchema.safeParse({ expression: { invalid: true }, billing_details: {} }).success, false);
});

test('invalid drafts never turn into free prices or empty provider overrides', () => {
  assert.equal(validatePricingDraft({ ModelPrice: 0, CacheRatio: 0 }), '');
  assert.equal(validatePricingDraft({}), '');
  for (const draft of [{ ModelRatio: -1 }, { ModelRatio: NaN }, { ModelPrice: Infinity }, { ModelPrice: '0' }, { 'billing_setting.billing_mode': 'unknown' }, { 'billing_setting.billing_expr': ' ' }, { [pluginExpressionKey]: { provider: '' } }]) assert.notEqual(validatePricingDraft(draft), '');
});

test('plugin field and unit labels follow the active language before falling back', () => {
  const labels = { 'zh-CN': '秒数', en: 'Duration', fr: 'Durée', 'zh-TW': '秒數' };
  assert.equal(usageLabel(labels, 'seconds', 'fr-FR'), 'Durée');
  assert.equal(usageLabel(labels, 'seconds', 'zh-TW'), '秒數');
  assert.equal(usageLabel(labels, 'seconds', 'vi'), 'Duration');
  assert.equal(usageLabel(undefined, 'seconds', 'en'), 'seconds');
  assert.equal(usageUnit({ unit: 'count', unitLabel: { en: 'seconds', fr: 'secondes' } }, 'fr', String), 'secondes');
  assert.equal(usageUnit({ unit: 'second' }, 'fr', (key) => ({ Seconds: 'secondes' })[key] || key), 'secondes');
  assert.equal(usageUnit({ unit: 'token' }, 'fr', String), '1M tokens');
});
