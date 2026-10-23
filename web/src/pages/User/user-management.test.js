import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadTestModules } from '../../../scripts/load-test-modules.mjs';
const { entry0 } = await loadTestModules(['./src/pages/User/user-management.ts']);
const { canManageUser, managedUserSchema, userUpdatePayload } = entry0;

test('user profile payload preserves live balance, bindings and unchanged authorization', () => {
  const catalog = { resources: [{ resource: 'channel', actions: [{ action: 'read' }, { action: 'write' }] }], roles: [{ key: 'admin', grants: { channel: { read: true, write: false } } }] };
  const original = managedUserSchema.parse({ id: 4, username: 'admin', role: 10, status: 1, quota: 123, group: 'premium', admin_permissions: { channel: { read: true, write: false } } });
  const form = { ...original, password: '', display_name: 'Updated', remark: '' };
  const result = userUpdatePayload(form, original, catalog);
  assert.deepEqual(result, { id: 4, username: 'admin', display_name: 'Updated', group: 'premium', remark: '' });
  const changed = userUpdatePayload({ ...form, admin_permissions: { channel: { read: true, write: true } } }, original, catalog);
  assert.deepEqual(changed.admin_permissions, { channel: { read: true, write: true } });
  assert.equal(userUpdatePayload(form, original).admin_permissions, undefined);
  assert.deepEqual(userUpdatePayload({ ...form, role: 1 }, null), { username: 'admin', display_name: 'Updated', role: 1 });
  assert.deepEqual(userUpdatePayload({ ...form, role: 5 }, original, catalog), { id: 4, username: 'admin', display_name: 'Updated', group: 'premium', remark: '', role: 5 });
  const support = { ...original, role: 5, admin_permissions: {} };
  const promoted = userUpdatePayload({ ...form, admin_permissions: { channel: { read: true, write: false } } }, support, catalog);
  assert.equal(promoted.role, 10);
  assert.deepEqual(promoted.admin_permissions, { channel: { read: true, write: false } });
});

test('user controls distinguish deleted users and enforce the actor role hierarchy', () => {
  const user = { role: 1, DeletedAt: null };
  assert.equal(canManageUser(10, user), true);
  assert.equal(canManageUser(10, { ...user, role: 10 }), false);
  assert.equal(canManageUser(10, { ...user, role: 100 }), false);
  assert.equal(canManageUser(100, { ...user, role: 10 }), true);
  assert.equal(canManageUser(100, { ...user, DeletedAt: '2026-10-19T00:00:00Z' }), false);
});
