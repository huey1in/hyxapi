import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTestModules } from '../../../scripts/load-test-modules.mjs';
const { entry0: { rankingPeriod, historyMatrix, modelPricingLink, vendorPricingLink, rankingsSchema } } = await loadTestModules(['./src/features/public-pages/rankings-data.ts']);

test('rankings periods and entity links preserve route boundaries and literal provider/model names', () => {
  assert.equal(rankingPeriod('bad'), 'week');
  assert.equal(rankingPeriod('today'), 'today');
  assert.equal(modelPricingLink('vendor/model?x=1#value'), '/pricing/model/vendor%2Fmodel%3Fx%3D1%23value');
  assert.equal(new URLSearchParams(vendorPricingLink('A&B / ?').split('?')[1]).get('vendor'), 'A&B / ?');
});

test('history grouping orders timestamps, keeps duplicate labels separate and safely handles model names', () => {
  const result = historyMatrix([{ ts: '2026-01-02', label: 'day', name: 'model', value: 3 }, { ts: '2026-01-01', label: 'day', name: '__proto__', value: 2 }, { ts: '2026-01-02', label: 'day', name: 'model', value: 4 }], ['model']);
  assert.deepEqual(result.entities, ['model', '__proto__']);
  assert.equal(result.buckets.length, 2);
  assert.equal(result.buckets[0].values.__proto__, 2);
  assert.equal(result.buckets[1].total, 7);
  assert.deepEqual(historyMatrix([], []), { entities: [], buckets: [] });
});

test('rankings schema accepts empty server lists while rejecting invalid public aggregates', () => {
  const empty = { models: null, vendors: null, top_movers: null, top_droppers: null, models_history: { points: null, models: null, buckets: 0 }, vendor_share_history: { points: null, vendors: null, buckets: 0 } };
  assert.deepEqual(rankingsSchema.parse(empty).models, []);
  assert.equal(rankingsSchema.safeParse({ ...empty, models: [{ rank: 1, model_name: 'm', vendor: 'v', category: 'all', total_tokens: 1, share: 2, growth_pct: 0 }] }).success, false);
});
