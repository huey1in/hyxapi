import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTestModules } from '../../../scripts/load-test-modules.mjs';
const { entry0: { createBlankPricingRow, normalizePricingRow, mergeRefreshedPricingRows, validatePricingRow } } = await loadTestModules(['./src/pages/Setting/pricing-editor.ts']);

test('direct pricing distinguishes an explicit free price from an empty or invalid amount', () => {
  const free = { ...createBlankPricingRow(), model_name: 'free-model' };
  assert.equal(validatePricingRow(free), '');
  for (const value of ['', -1, NaN, Infinity]) assert.notEqual(validatePricingRow({ ...free, input_price: value }), '', String(value));
  assert.notEqual(validatePricingRow({ ...free, billing_type: 99 }), '');
  assert.notEqual(validatePricingRow({ ...free, model_name: ' ' }), '');
});

test('automatic pricing refresh preserves another row draft and a saved row stable key', () => {
  const first = { ...normalizePricingRow({ id: 1, model_name: 'first', input_price: 1 }), _key: 'local-previously-saved' };
  const draft = { ...normalizePricingRow({ id: 2, model_name: 'second', input_price: 2 }), input_price: 8, _dirty: true };
  const blank = createBlankPricingRow();
  const next = mergeRefreshedPricingRows([first, draft, blank], [{ ...first, input_price: 3 }, { ...draft, input_price: 4 }], ['third']);
  assert.equal(next[0]._key, first._key);
  assert.equal(next[0].input_price, 3);
  assert.strictEqual(next[1], draft);
  assert.strictEqual(next[2], blank);
  assert.equal(next[3].model_name, 'third');
  assert.equal(next[3]._dirty, false);
});
