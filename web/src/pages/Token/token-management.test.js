import assert from 'node:assert/strict';
import { test } from 'node:test';
import { effectiveTokenStatus, tokenPageSchema } from './token-management.ts';

test('token status displays effective expiry and quota before the next API request', () => {
  const token = { status: 1, expired_time: -1, unlimited_quota: true, remain_quota: 0 };
  assert.equal(effectiveTokenStatus(token, 100), 1);
  assert.equal(effectiveTokenStatus({ ...token, expired_time: 100 }, 100), 3);
  assert.equal(effectiveTokenStatus({ ...token, status: 2, expired_time: 99 }, 100), 2);
  assert.equal(effectiveTokenStatus({ ...token, unlimited_quota: false }, 100), 4);
  assert.equal(effectiveTokenStatus({ ...token, unlimited_quota: false, remain_quota: -2 }, 100), 4);
});

test('token list accepts legacy optional fields and numeric flags but rejects malformed pages', () => {
  const parsed = tokenPageSchema.parse({ total: 1, items: [{ id: 1, name: 'legacy', key: 'masked', unlimited_quota: 1, allow_ips: null, group: null }] });
  assert.equal(parsed.items[0].unlimited_quota, true);
  assert.equal(parsed.items[0].group, '');
  assert.equal(parsed.items[0].allow_ips, '');
  for (const data of [{ total: -1, items: [] }, { total: 1, items: [{ id: 0, name: 'bad', key: 'masked' }] }]) {
    assert.equal(tokenPageSchema.safeParse(data).success, false);
  }
});
