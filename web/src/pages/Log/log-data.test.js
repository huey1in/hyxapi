import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { loadTestModules } from '../../../scripts/load-test-modules.mjs';

let data;
before(async () => { data = (await loadTestModules(['./src/pages/Log/log-data.ts'])).entry0; });
const log = (other) => data.logSchema.parse({ id: 1, created_at: 1, type: 2, quota: 0, other: JSON.stringify(other) });

test('legacy metadata failures do not hide usage or expose privileged diagnostics', () => {
  const row = log({ input_price: 'broken', output_price: 0, cache_tokens: 17, billing_source: 'subscription', request_conversion: ['OpenAI Responses', 'Claude Messages'], admin_info: { request_policy: ['private'] }, root_info: { private: true }, channel_id: 9 });
  row.upstream_request_id = 'provider-private';
  const user = data.enrichLog(row, 1);
  assert.equal(user.quota, 0);
  assert.equal(user._metadataInvalid, true);
  assert.equal(user._cacheHit, 17);
  assert.equal(user._other.billing_source, 'subscription');
  assert.deepEqual(user._other.request_conversion, ['OpenAI Responses', 'Claude Messages']);
  assert.equal(user._rawOther.admin_info, undefined);
  assert.equal(user._rawOther.root_info, undefined);
  assert.equal(user._rawOther.channel_id, undefined);
  assert.equal(user.upstream_request_id, '');
  assert.deepEqual(data.getBillingPriceFields(user._other).map(({ key, value }) => ({ key, value })), [{ key: 'output_price', value: 0 }]);
  assert.equal(data.enrichLog(row, 10)._rawOther.root_info, undefined);
  assert.equal(data.enrichLog(row, 100).upstream_request_id, 'provider-private');
  assert.equal(data.enrichLog({ ...row, other: '{broken' }, 1)._metadataInvalid, true);
  assert.equal(data.logSchema.safeParse({ ...row, quota: 'free' }).success, false);
});

test('cache counters use only the current fields and never sum duration details into the total', () => {
  const other = { cache_tokens: 20, cache_write_tokens: 12, cache_write_tokens_5m: 4, cache_write_tokens_1h: 6, input_tokens_total: 40 };
  const row = data.enrichLog(log(other), 1);
  assert.equal(row._cacheWrite, 12);
  assert.equal(row._cache, 32);
  assert.equal(row._cacheStatus, 'hit');
  assert.equal(row._cacheHitRate, 0.5);
  assert.equal(row._inputTokens, 40);
  assert.equal(data.enrichLog(log({ ...other, cache_write_tokens: 0 }), 1)._cacheWrite, 0);
  const missing = data.enrichLog(log({ cache_creation_tokens: 100, cache_creation_tokens_5m: 4, cache_creation_tokens_1h: 6 }), 1);
  assert.equal(missing._cacheWrite, 0);
  assert.equal(missing._cacheWriteKnown, false);
  assert.equal(missing._cacheStatus, 'unknown');
  assert.equal(missing._cacheHitRate, undefined);
  assert.equal(data.enrichLog(log({ cache_write_tokens_5m: 4, cache_write_tokens_1h: 6 }), 1)._cacheWriteKnown, false);
});

test('cache misses, missing measurements and invalid fractions stay distinct', () => {
  const miss = data.enrichLog(log({ cache_tokens: 0, cache_write_tokens: 20, input_tokens_total: 40 }), 1);
  assert.equal(miss._cacheStatus, 'miss');
  assert.equal(miss._cacheReadKnown, true);
  assert.equal(miss._cacheHitRate, 0);
  for (const other of [{ cache_tokens: 50, input_tokens_total: 40 }, { cache_tokens: 20 }, { cache_tokens: 0, input_tokens_total: 0 }]) {
    assert.equal(data.enrichLog(log(other), 1)._cacheHitRate, undefined);
  }
  assert.equal(data.enrichLog(log({ cache_tokens: -5, cache_write_tokens: '12' }), 1)._metadataInvalid, true);
});

test('historical log ranges have no maximum span while invalid dates are rejected', () => {
  const now = new Date('2026-10-20T12:00:00Z').getTime();
  const filters = { ...data.emptyLogFilters(), start_timestamp: '2020-10-01T00:00:00Z', end_timestamp: '2026-10-20T00:00:00Z' };
  assert.equal(data.validateLogFilters(filters, now), '');
  assert.equal(data.validateLogFilters(data.emptyLogFilters(), now), '');
  assert.equal(data.validateLogFilters({ ...filters, start_timestamp: 'invalid' }, now), 'Invalid time range');
  assert.equal(data.validateLogFilters({ ...filters, start_timestamp: '2026-10-21T00:00:00Z' }, now), 'Invalid time range');
  assert.equal(data.validateLogFilters({ ...filters, start_timestamp: '1969-12-31T00:00:00Z' }, now), 'Invalid time range');
});
