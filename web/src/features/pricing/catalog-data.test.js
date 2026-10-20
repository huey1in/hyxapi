import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTestModules } from '../../../scripts/load-test-modules.mjs';
const { entry0: { parsePricingData, pricingModelSchema, filterPricingModels, sortPricingModels } } = await loadTestModules(['./src/features/pricing/catalog-data.ts']);

const row = (model_name, fields = {}) => pricingModelSchema.parse({ model_name, enable_groups: ['default'], configured: true, billing_type: 'tokens', input_price: 1, output_price: 2, ...fields });
const filters = { search: '', group: 'all', billing: 'all', vendor: 'all' };

test('public pricing normalizes legacy types and null lists without inventing prices or mutating server data', () => {
  const raw = { success: true, data: [{ model_name: 'free', enable_groups: null, billing_type: 0, input_price: 0, vendor_id: 7 }], vendors: [{ id: 7, name: 'Provider' }], group_ratio: { free: 0 }, usable_group: { free: 'Free group' } };
  const result = parsePricingData(raw);
  assert.equal(result.models[0].billing_type, 'tokens');assert.equal(result.models[0].input_price, 0);assert.equal(result.models[0].output_price, undefined);
  assert.equal(result.models[0].vendor_name, 'Provider');assert.deepEqual(result.models[0].enable_groups, []);assert.equal(raw.data[0].billing_type, 0);
  assert.deepEqual(parsePricingData({ ...raw, data: null, vendors: null }).models, []);
  const plugin = pricingModelSchema.parse({ ...raw.data[0], billing_plugin_variants: [{ plugin_key: 'plain', plugin_name: 'Plain', billing_expr: '', billing_mode: 'ratio', billing_usage_schema: null }] });
  assert.deepEqual(plugin.billing_plugin_variants[0].billing_usage_schema, {});
  assert.throws(() => parsePricingData({ ...raw, data: [{ ...raw.data[0], input_price: -1 }] }));
});

test('vendor and group filters combine with task billing and case-insensitive search', () => {
  const task = row('video', { vendor_name: 'Acme', billing_type: 'expression', tags: 'media;video| media', supported_endpoint_types: ['openai-video'], billing_usage_schema: { duration: { unit: 'second' } } });
  const token = row('plain', { tags: 'videography', supported_endpoint_types: ['openai'] });
  const expression = row('tiered', { billing_type: 'expression' });
  assert.deepEqual(filterPricingModels([task, token, expression], { ...filters, vendor: 'Acme', group: 'default', search: 'VID', billing: 'task' }).map((model) => model.model_name), ['video']);
  assert.deepEqual(filterPricingModels([task, token, expression], { ...filters, billing: 'expression' }).map((model) => model.model_name), ['tiered']);
  assert.deepEqual(filterPricingModels([task, token], { ...filters, search: 'MEDIA' }).map((model) => model.model_name), ['video']);
});

test('price sorting preserves free prices and leaves incompatible or unconfigured prices last in both directions', () => {
  const models = [row('missing', { configured: false }), row('request', { billing_type: 'request', request_price: 4 }), row('free', { input_price: 0 }), row('paid', { input_price: 3 }), row('tiered', { billing_type: 'expression', billing_mode: 'tiered_expr', billing_expr: 'tier("base", p * 2 + c * 4)' })];
  assert.deepEqual(sortPricingModels(models, 'input-price-low').map((model) => model.model_name), ['free', 'tiered', 'paid', 'missing', 'request']);
  assert.deepEqual(sortPricingModels(models, 'input-price-high').map((model) => model.model_name), ['paid', 'tiered', 'free', 'missing', 'request']);
  assert.equal(sortPricingModels(models, 'request-price-low')[0].model_name, 'request');assert.equal(models[0].model_name, 'missing');
});
