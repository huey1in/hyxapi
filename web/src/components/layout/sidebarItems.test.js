import test from 'node:test';
import assert from 'node:assert/strict';

import { loadTestModules } from '../../../scripts/load-test-modules.mjs';
const { entry0: { filterSidebarItems } } = await loadTestModules(['./src/components/layout/sidebarItems.ts']);

const items = [
  { to: '/console' },
  { to: '/console/channel', admin: true },
  { to: '/console/audit', admin: true },
  { to: '/console/setting', root: true },
];

test('sidebar follows the signed-in role', () => {
  assert.deepEqual(filterSidebarItems(items, { admin: false, root: false }), [{ to: '/console' }]);
  assert.deepEqual(filterSidebarItems(items, { admin: true, root: false }), items.slice(0, 3));
  assert.deepEqual(filterSidebarItems(items, { admin: true, root: true }), items);
});
