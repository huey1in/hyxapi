import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseBalanceResult } from './balance.ts';

test('balance responses preserve zero, negative wallets and server timestamps', () => {
  assert.deepEqual(parseBalanceResult({ balance: 0, balance_updated_time: 123 }), { kind: 'balance', balance: 0, updatedAt: 123 });
  assert.equal(parseBalanceResult({ balance: -2.5, balance_updated_time: 123 }).balance, -2.5);
  for (const value of [NaN, Infinity, -Infinity, '12', null]) assert.equal(parseBalanceResult({ balance: value, balance_updated_time: 123 }), null);
  assert.equal(parseBalanceResult({ balance: 1 }), null);
});

test('custom JSON cannot silently become numeric balance or ambiguous success', () => {
  const json = '{"remaining":"unlimited","html":"<script>fixture</script>"}';
  assert.deepEqual(parseBalanceResult({ raw_response: json }), { kind: 'raw', json });
  assert.equal(parseBalanceResult({ raw_response: 'not JSON' }), null);
  assert.equal(parseBalanceResult({ raw_response: json, balance: 0, balance_updated_time: 123 }), null);
});
