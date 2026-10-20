import assert from 'node:assert/strict';
import { test } from 'node:test';
import { tokenPageSchema, tokenSchema } from './token-management.ts';

test('token pages keep only table fields and reject malformed identities and timestamps', () => {
  const item = { id: 1, name: 'production', key: 'abcd**********wxyz', status: 2, created_time: 100, accessed_time: 0 };
  const parsed = tokenPageSchema.parse({ total: 1, items: [{ ...item, used_quota: 12, remain_quota: 34, group: 'private', allow_ips: '127.0.0.1' }] });
  assert.deepEqual(parsed.items[0], item);
  for (const data of [{ total: -1, items: [] }, { total: 1, items: [{ ...item, id: 0 }] }, { total: 1, items: [{ ...item, accessed_time: Infinity }] }]) {
    assert.equal(tokenPageSchema.safeParse(data).success, false);
  }
});

test('on-demand token details retain legacy flags and policy fields for safe editing', () => {
  const parsed = tokenSchema.parse({ id: 1, name: 'legacy', key: 'masked', unlimited_quota: 1, remain_quota: 42, expired_time: 1000, allow_ips: null, group: null, model_limits_enabled: 1, model_limits: 'gpt-4.1', auto_groups: ['production'] });
  assert.equal(parsed.unlimited_quota, true);
  assert.equal(parsed.remain_quota, 42);
  assert.equal(parsed.expired_time, 1000);
  assert.equal(parsed.group, '');
  assert.equal(parsed.allow_ips, '');
  assert.equal(parsed.model_limits_enabled, true);
  assert.equal(parsed.model_limits, 'gpt-4.1');
  assert.deepEqual(parsed.auto_groups, ['production']);
});
