import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTestModules } from '../../../scripts/load-test-modules.mjs';

const { entry0: sidebar, entry1: calendar, entry2: { filterSidebarItems } } = await loadTestModules(['./src/lib/sidebar-modules.ts', './src/pages/Personal/checkin-calendar.ts', './src/components/layout/sidebarItems.ts']);

test('sidebar preferences only narrow administrator visibility and never bypass roles', () => {
  const admin = sidebar.parseSidebarModules('{"console":{"token":false},"personal":{"topup":false}}');
  const user = sidebar.parseSidebarModules('{"console":{"token":true,"log":false},"admin":{"channel":true}}');
  assert.equal(sidebar.isSidebarModuleVisible('/console/token', admin, user), false);
  assert.equal(sidebar.isSidebarModuleVisible('/console/log', admin, user), false);
  assert.equal(sidebar.isSidebarModuleVisible('/console/my-subscription', admin, user), false);
  const items = [{ to: '/console' }, { to: '/console/channel', admin: true }];
  assert.deepEqual(filterSidebarItems(items, { admin: false, root: false, isVisible: (route) => sidebar.isSidebarModuleVisible(route, admin, user) }), [{ to: '/console' }]);
  assert.equal(sidebar.isSidebarModuleVisible('/console/personal', {}, { personal: { personal: false } }), true);
  assert.equal(sidebar.isSidebarModuleVisible('/console/personal', {}, { personal: { personal: false, security: false } }), false);
});

test('legacy sidebar values fail open for display and reset preserves unknown module preferences', () => {
  for (const value of [null, 'bad-json', '[]', 'null', '{"console":false}', '{"console":{"token":"false"}}']) {
    assert.equal(sidebar.isSidebarModuleVisible('/console/token', sidebar.parseSidebarModules(value)), true);
  }
  const current = { admin: { user: false }, chat: { future_module: false, chat: false } };
  const defaults = sidebar.defaultSidebarModules(current);
  assert.equal(defaults.chat.chat, true);
  assert.equal(defaults.chat.future_module, false);
  assert.equal(defaults.admin.user, false);
  assert.equal(current.chat.chat, false);
});

test('check-in calendar handles leap years, week boundaries, and year transitions', () => {
  assert.equal(calendar.moveMonth('2024-01', -1), '2023-12');
  assert.equal(calendar.moveMonth('2024-12', 1), '2025-01');
  const leap = calendar.calendarDays('2024-02');
  assert.equal(leap[4], '2024-02-01');
  assert.equal(leap.filter(Boolean).length, 29);
  assert.equal(leap.length % 7, 0);
  assert.equal(calendar.calendarDays('2023-02').filter(Boolean).length, 28);
  assert.equal(calendar.calendarDays('2024-09')[0], '2024-09-01');
});
