import test from 'node:test';
import assert from 'node:assert/strict';

import { filterSidebarItems } from './sidebarItems.js';

const items = [
  { to: '/console' },
  { to: '/console/channel', admin: true },
  { to: '/console/setting', root: true },
];

test('preview sidebar never inherits administrator entries', () => {
  assert.deepEqual(
    filterSidebarItems(items, { preview: true, admin: true, root: true }),
    [{ to: '/console' }],
  );
});

test('real sidebar still follows the signed-in role', () => {
  assert.equal(filterSidebarItems(items, { preview: false, admin: true, root: false }).length, 2);
});
