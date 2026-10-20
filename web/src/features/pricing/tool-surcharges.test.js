import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTestModules } from '../../../scripts/load-test-modules.mjs';
const { entry0: { parseToolSurcharges } } = await loadTestModules(['./src/features/pricing/tool-surcharges.ts']);

test('tool charge logs preserve named prices and distinguish invalid metadata from missing old logs', () => {
  const actual = [{ name: 'image_generation', count: 2, price: 150 }, { name: 'custom_priced', count: 3, price: 0 }];
  assert.deepEqual(parseToolSurcharges(actual), { items: actual, invalid: false });
  assert.deepEqual(parseToolSurcharges(undefined), { items: [], invalid: false });
  for (const item of [{ name: 'x', count: -1, price: 1 }, { name: 'x', count: 1, price: Infinity }, { name: 'x', count: 1, price: '25' }]) assert.deepEqual(parseToolSurcharges([actual[0], item]), { items: [actual[0]], invalid: true });
});
