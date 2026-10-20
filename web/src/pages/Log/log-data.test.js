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
  assert.equal(data.logPageSchema.safeParse({ page: 1, total: 1, items: [{ ...row, quota: 'free' }] }).success, false);
});

test('cache creation durations do not double count legacy totals and explicit zeros remain authoritative', () => {
  const other = { cache_creation_tokens: 100, cache_creation_tokens_5m: 4, cache_creation_tokens_1h: 6, input_tokens_total: 40 };
  assert.equal(data.enrichLog(log(other), 1)._cacheWrite, 10);
  assert.equal(data.enrichLog(log({ ...other, cache_write_tokens: 0 }), 1)._cacheWrite, 0);
  assert.equal(data.enrichLog(log({ ...other, cache_write_tokens: 12 }), 1)._cacheWrite, 12);
  assert.equal(data.enrichLog(log(other), 1)._other.input_tokens_total, 40);
});

test('invalid and excessive log ranges are blocked without restricting admin list queries', () => {
  const now = new Date('2026-10-20T12:00:00Z').getTime();
  const filters = { ...data.emptyLogFilters(), start_timestamp: '2026-10-01T00:00:00Z', end_timestamp: '2026-10-20T00:00:00Z' };
  assert.equal(data.validateLogFilters(filters, false, 7, false, now), 'Time range exceeds the configured limit');
  assert.equal(data.validateLogFilters(filters, true, 7, false, now), '');
  assert.equal(data.validateLogFilters(filters, true, 7, true, now), 'Time range exceeds the configured limit');
  assert.equal(data.validateLogFilters({ ...filters, start_timestamp: 'invalid' }, true, 7, false, now), 'Invalid time range');
  assert.equal(data.validateLogFilters({ ...filters, start_timestamp: '2026-10-21T00:00:00Z' }, true, 7, false, now), 'Invalid time range');
  assert.equal(data.validateLogFilters({ ...data.emptyLogFilters(), channel: '0' }, true, 7), 'Channel ID must be a positive integer');
});
