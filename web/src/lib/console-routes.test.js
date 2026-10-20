import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTestModules } from '../../scripts/load-test-modules.mjs';
const { entry0: { canOpenConsolePage, isConsolePath } } = await loadTestModules(['./src/lib/console-routes.ts']);

test('console authorization respects route boundaries and role requirements', () => {
  const member = { id: 1, username: 'member', role: 1 };
  assert.equal(isConsolePath('/console'), true);
  assert.equal(isConsolePath('/console/token'), true);
  assert.equal(isConsolePath('/console-preview'), false);
  assert.equal(canOpenConsolePage('/console/personal', member), true);
  assert.equal(canOpenConsolePage('/console/token', null), false);
  for (const page of ['user', 'models', 'vendors', 'operations', 'system-status', 'redemption', 'subscription', 'setting']) assert.equal(canOpenConsolePage('/console/' + page, member), false, page);
  assert.equal(canOpenConsolePage('/console/user', { ...member, role: 10 }), true);
  assert.equal(canOpenConsolePage('/console/setting', { ...member, role: 10 }), false);
  assert.equal(canOpenConsolePage('/console/setting', { ...member, role: 100 }), true);
});
test('channel navigation requires read permission while personal audit stays available', () => {
  const admin = { id: 2, username: 'admin', role: 10, permissions: { admin_permissions: { channel: { operate: true, read: false }, audit: { read: true } } } };
  assert.equal(canOpenConsolePage('/console/channel', admin), false);
  assert.equal(canOpenConsolePage('/console/channel/nested', admin), false);
  assert.equal(canOpenConsolePage('/console/audit', admin), true);
  assert.equal(canOpenConsolePage('/console/audit', { ...admin, role: 1, permissions: {} }), true);
  assert.equal(canOpenConsolePage('/console/audit', { ...admin, permissions: {} }), true);
  assert.equal(canOpenConsolePage('/console/channel', { ...admin, role: 100 }), true);
});
