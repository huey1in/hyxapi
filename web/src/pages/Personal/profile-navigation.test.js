import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTestModules } from '../../../scripts/load-test-modules.mjs';

const { entry0: sidebar, entry1: calendar, entry2: { filterSidebarItems } } = await loadTestModules(['./src/lib/sidebar-modules.ts', './src/features/payments/checkin-calendar.ts', './src/components/layout/sidebarItems.ts']);

test('sidebar navigation respects administrator visibility and role requirements', () => {
  const admin = sidebar.parseSidebarModules('{"console":{"token":false,"log":false,"task":false,"midjourney":false},"personal":{"topup":false}}');
  assert.equal(sidebar.isSidebarModuleVisible('/token', admin), false);
  assert.equal(sidebar.isSidebarModuleVisible('/log', admin), false);
  assert.equal(sidebar.isSidebarModuleVisible('/subscription', admin), false);
  const items = [{ to: '/console' }, { to: '/channel', admin: true }];
  assert.deepEqual(filterSidebarItems(items, { admin: false, root: false, isVisible: (route) => sidebar.isSidebarModuleVisible(route, admin) }), [{ to: '/console' }]);
  assert.equal(sidebar.isSidebarModuleVisible('/personal', { personal: { personal: false } }), true);
  assert.equal(sidebar.isSidebarModuleVisible('/personal', { personal: { personal: false, security: false } }), false);
});

test('legacy administrator sidebar values fail open for display and ignore retired sections', () => {
  for (const value of [null, 'bad-json', '[]', 'null', '{"console":false}', '{"console":{"token":"false"}}']) {
    assert.equal(sidebar.isSidebarModuleVisible('/token', sidebar.parseSidebarModules(value)), true);
  }
  assert.deepEqual(sidebar.parseSidebarModules({ chat: { chat: false }, console: { token: false } }), { console: { token: false } });
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
