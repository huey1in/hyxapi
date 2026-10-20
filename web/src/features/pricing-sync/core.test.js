import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { loadTestModules } from '../../../scripts/load-test-modules.mjs';
let defaultEndpoint, selectSource, syncChanges;
before(async () => { ({ defaultEndpoint, selectSource, syncChanges } = (await loadTestModules(['./src/features/pricing-sync/core.ts'])).entry0); });

const pluginKey = 'billing_setting.plugin_billing_expr';
const baseline = { entries: [{ model_name: 'm', version: 'old-version', configured: { ModelPrice: 8, [pluginKey]: { vendor: 'fixed(2)' } } }], empty_version: 'empty' };
const preview = (price) => ({ prices: { m: { current: {}, upstreams: { source: price } } } });

test('sync switches expression and fixed prices as complete drafts while preserving provider overrides and versions', () => {
  const [change] = syncChanges(preview({ billing_mode: 'tiered_expr', billing_expr: 'tier("free", p * 0)' }), { m: 'source' }, baseline);
  assert.equal(change.expected_version, 'old-version');
  assert.equal(change.pricing.ModelPrice, undefined);
  assert.equal(change.pricing['billing_setting.billing_mode'], 'tiered_expr');
  assert.deepEqual(change.pricing[pluginKey], baseline.entries[0].configured[pluginKey]);
  change.pricing[pluginKey].vendor = 'changed';
  assert.equal(baseline.entries[0].configured[pluginKey].vendor, 'fixed(2)');
  const [fixed] = syncChanges(preview({ model_price: 0 }), { m: 'source' }, baseline);
  assert.equal(fixed.pricing.ModelPrice, 0);
  assert.equal(fixed.pricing.ModelRatio, undefined);
  assert.equal(fixed.pricing['billing_setting.billing_expr'], undefined);
  assert.equal(fixed.pricing['billing_setting.billing_mode'], 'ratio');
});
test('sync preserves unchanged base prices, free lanes, audio bases and new model empty versions', () => {
  const [change] = syncChanges(preview({ model_ratio: 1, completion_ratio: 4, cache_ratio: 0, audio_ratio: 2, audio_completion_ratio: 3 }), { m: 'source' }, { entries: [], empty_version: 'empty' });
  assert.equal(change.expected_version, 'empty');
  assert.deepEqual(change.pricing, { ModelRatio: 1, CompletionRatio: 4, CacheRatio: 0, AudioRatio: 2, AudioCompletionRatio: 3, 'billing_setting.billing_mode': 'ratio' });
});
test('sync rejects incomplete, nonnumeric, overflowing or stale sources instead of producing free prices', () => {
  for (const price of [{ completion_ratio: 3 }, { model_ratio: -1 }, { model_ratio: Infinity }, { model_ratio: '0' }, { billing_mode: 'tiered_expr', billing_expr: ' ' }]) assert.throws(() => syncChanges(preview(price), { m: 'source' }, baseline));
  assert.throws(() => syncChanges(preview({ model_ratio: 1 }), { m: 'missing' }, baseline));
});
test('bulk selection only changes filtered models with the chosen source', () => {
  const old = { other: 'kept', missing: 'previous' };
  assert.deepEqual(selectSource(preview({ model_price: 0 }), ['m', 'missing'], 'source', old), { other: 'kept', missing: 'previous', m: 'source' });
  assert.deepEqual(old, { other: 'kept', missing: 'previous' });
});
test('presets use stable IDs and OpenRouter uses its authenticated protocol', () => {
  assert.match(defaultEndpoint({ id: -100 }), /ratio_config-v1-base/);
  assert.equal(defaultEndpoint({ id: -101 }), 'https://models.dev/api.json');
  assert.equal(defaultEndpoint({ id: 5, type: 20 }), 'openrouter');
  assert.equal(defaultEndpoint({ id: 7 }), '/api/pricing');
});
