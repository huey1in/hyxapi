import assert from 'node:assert/strict';
import { test } from 'node:test';
import { autoGroupsPayload, manualTokenGroups, reconcileAutoGroups, validateAutoGroups } from './autoGroups.ts';

test('Auto group inheritance and legacy manual priorities remain distinct', () => {
  for (const stored of [undefined, null, []]) assert.equal(reconcileAutoGroups(stored, ['default'], 5).mode, 'inherit');
  for (const token of [{ group: 'auto' }, { groups: ['auto'] }, { group: '[]' }]) assert.deepEqual(manualTokenGroups(token), []);
  assert.deepEqual(manualTokenGroups({ group: '["vip","default"]' }), ['vip', 'default']);
  assert.deepEqual(manualTokenGroups({ group: 'vip' }), ['vip']);
});

test('revoked custom groups never silently become inherited Auto groups', () => {
  const result = reconcileAutoGroups(['removed', 'vip', 'default'], ['default', 'vip'], 1);
  assert.deepEqual(result, { mode: 'custom', groups: ['vip'], changed: true });
  const empty = reconcileAutoGroups(['removed'], ['default'], 5);
  assert.equal(empty.mode, 'custom');
  assert.ok(validateAutoGroups(empty.mode, empty.groups, 5, ['default']));
});

test('Auto validation and payload retain order and enforce current permissions', () => {
  assert.equal(validateAutoGroups('custom', ['vip', 'default'], 2, ['default', 'vip']), '');
  assert.ok(validateAutoGroups('custom', ['vip', 'default'], 1, ['default', 'vip']));
  assert.ok(validateAutoGroups('custom', ['vip', 'vip'], 2, ['vip']));
  assert.ok(validateAutoGroups('custom', ['revoked'], 2, ['vip']));
  assert.deepEqual(autoGroupsPayload(true, 'custom', ['vip', 'default']), ['vip', 'default']);
  assert.deepEqual(autoGroupsPayload(true, 'inherit', ['vip']), []);
  assert.deepEqual(autoGroupsPayload(false, 'custom', ['vip']), []);
});
