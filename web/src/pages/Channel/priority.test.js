import test from 'node:test';
import assert from 'node:assert/strict';
import { priorityMove, priorityRestore } from './priority.ts';

test('priority moves use global revisions and reject stale displayed priorities', () => {
  const rows = [{ id: 1, priority: 30 }, { id: 2, priority: 10 }, { id: 3, priority: 0 }];
  const order = { revision: 'global', items: rows, changes: [] };
  assert.deepEqual(priorityMove(rows, 3, 2, 'before', order), { revision: 'global', id: 3, target_id: 2, position: 'before' });
  assert.equal(priorityMove(rows, 3, 2, 'same', order).position, 'same');
  assert.equal(priorityMove(rows, 3, 99, 'before', order), null);
  assert.equal(priorityMove(rows, 3, 3, 'before', order), null);
  assert.equal(priorityMove(rows, 3, 2, 'before'), null);
  assert.equal(priorityMove([{ id: 3, priority: 9 }, rows[1]], 3, 2, 'before', order), null);
});

test('priority undo preserves null values and uses the applied revision', () => {
  assert.deepEqual(priorityRestore({ revision: 'applied', items: [], changes: [{ id: 3, previous: null, priority: 10 }] }), { revision: 'applied', restore: [{ id: 3, previous: 10, priority: null }] });
});
