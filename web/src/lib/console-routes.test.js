import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTestModules } from '../../scripts/load-test-modules.mjs';
const { entry0: { canOpenConsolePage, isConsolePath }, entry1: { pageTitleKey }, entry2: sidebar } = await loadTestModules(['./src/lib/console-routes.ts', './src/lib/page-title.ts', './src/lib/sidebar-modules.ts']);

const adminPaths = ['/channel', '/models', '/vendors', '/user', '/operations', '/system-status', '/redemption', '/subscription/manage', '/audit'];

test('console authorization respects route boundaries and role requirements', () => {
  const member = { id: 1, username: 'member', role: 1 };
  assert.equal(isConsolePath('/console'), true);
  assert.equal(isConsolePath('/console/token'), false);
  assert.equal(isConsolePath('/console-preview'), false);
  for (const path of ['/token', '/log', '/topup', '/subscription', '/personal', '/notices', '/leaderboard']) {
    assert.equal(isConsolePath(path), true, path);
    assert.equal(canOpenConsolePage(path, member), true, path);
    assert.equal(canOpenConsolePage(path, null), false, path);
  }
  for (const path of [...adminPaths, '/setting']) {
    assert.equal(isConsolePath(path), true, path);
    assert.equal(canOpenConsolePage(path, member), false, path);
    assert.equal(canOpenConsolePage(path, null), false, path);
  }
  assert.equal(canOpenConsolePage('/user', { ...member, role: 10 }), true);
  assert.equal(canOpenConsolePage('/setting', { ...member, role: 10 }), false);
  assert.equal(canOpenConsolePage('/setting', { ...member, role: 100 }), true);
});

test('pricing retains public access and uses the console layout when signed in', () => {
  for (const path of ['/pricing', '/pricing/model/provider%2Fmodel']) {
    assert.equal(isConsolePath(path), false, path);
    assert.equal(isConsolePath(path, true), true, path);
    assert.equal(canOpenConsolePage(path, null), true, path);
  }
  for (const path of ['/tokenizer', '/subscription-preview', '/pricing-preview']) {
    assert.equal(isConsolePath(path, true), false, path);
  }
});

test('ticket management starts at support level without granting other administration access', () => {
  for (const role of [1, 5, 10, 100]) {
    const user = { id: 7, username: 'agent', role };
    assert.equal(canOpenConsolePage('/tickets', user), true);
    assert.equal(canOpenConsolePage('/tickets/manage', user), role >= 5);
    assert.equal(canOpenConsolePage('/tickets/manage/nested', user), role >= 5);
    assert.equal(canOpenConsolePage('/user', user), role >= 10);
  }
  assert.equal(canOpenConsolePage('/tickets/manage', null), false);
});

test('audit pages require an administrator role independently of audit grants', () => {
  const member = { id: 1, username: 'member', role: 1, permissions: { admin_permissions: { audit: { read: true } } } };
  for (const path of ['/audit', '/audit/', '/audit/nested']) {
    assert.equal(canOpenConsolePage(path, member), false, path);
    assert.equal(canOpenConsolePage(path, { ...member, role: 10 }), true, path);
    assert.equal(canOpenConsolePage(path, { ...member, role: 100 }), true, path);
  }
});

test('channel navigation requires read permission while administrators retain their own audit view', () => {
  const admin = { id: 2, username: 'admin', role: 10, permissions: { admin_permissions: { channel: { operate: true, read: false }, audit: { read: true } } } };
  assert.equal(canOpenConsolePage('/channel', admin), false);
  assert.equal(canOpenConsolePage('/channel/nested', admin), false);
  assert.equal(canOpenConsolePage('/audit', admin), true);
  assert.equal(canOpenConsolePage('/audit', { ...admin, role: 1, permissions: {} }), false);
  assert.equal(canOpenConsolePage('/audit', { ...admin, permissions: {} }), true);
  assert.equal(canOpenConsolePage('/channel', { ...admin, role: 100 }), true);
});

test('removing the console prefix preserves public password reset and distinct management pages', () => {
  for (const path of ['/user/reset', '/user/reset/']) {
    assert.equal(isConsolePath(path), false);
    assert.equal(isConsolePath(path, true), false);
    assert.equal(canOpenConsolePage(path, null), true);
  }
  const member = { id: 1, role: 1 };
  assert.equal(canOpenConsolePage('/subscription', member), true);
  assert.equal(canOpenConsolePage('/subscription/manage', member), false);
  assert.equal(canOpenConsolePage('/tickets', member), true);
  assert.equal(canOpenConsolePage('/tickets/manage', member), false);
  for (const path of ['/channel-preview', '/models-preview', '/users', '/setting-preview']) assert.equal(isConsolePath(path, true), false, path);
});

test('management routes retain page titles and administrator sidebar switches', () => {
  for (const path of [...adminPaths, '/setting', '/tickets/manage']) assert.notEqual(pageTitleKey(path), '', path);
  assert.notEqual(pageTitleKey('/subscription'), pageTitleKey('/subscription/manage'));
  assert.notEqual(pageTitleKey('/tickets'), pageTitleKey('/tickets/manage'));
  const modules = { admin: { channel: false, models: false, subscription: false, user: false, setting: false } };
  for (const path of ['/channel', '/models', '/vendors', '/subscription/manage', '/user', '/setting']) assert.equal(sidebar.isSidebarModuleVisible(path, modules), false, path);
  assert.equal(sidebar.isSidebarModuleVisible('/subscription', modules), true);
});
