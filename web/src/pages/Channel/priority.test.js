import test from 'node:test';
import assert from 'node:assert/strict';
import { priorityMove } from './priority.js';

test('priority moves preserve displayed values for conflict checking and leave hidden tiers to the server', () => {
  const rows = [{ id: 1, priority: 30 }, { id: 2, priority: 10 }, { id: 3, priority: 0 }];
  assert.deepEqual(priorityMove(rows, 3, 2), { source_id: 3, target_id: 2, source_before: 0, target_before: 10, placement: 'before' });
  assert.equal(priorityMove(rows, 3, 2, 'same').placement, 'same');
  assert.equal(priorityMove(rows, 3, 99), null);
  assert.equal(priorityMove(rows, 3, 3), null);
});
