import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanupTimestamp, systemStatusSchema, systemTaskListSchema, systemTaskSchema } from './status-data.ts';

test('usage log cleanup requires an explicit past time before any destructive request', () => {
  const now = Date.parse('2026-10-20T12:00:00Z');
  for (const value of ['', 'invalid', '1969-01-01', '2026-10-21T00:00:00Z']) assert.equal(cleanupTimestamp(value, now), null);
  assert.equal(cleanupTimestamp('2026-10-19T12:00:00Z', now), 1792411200);
});
test('system task list validates its top-level total and does not fabricate failed progress', () => {
  const row = { id: 1, task_id: 'systask-test', type: 'log_cleanup', status: 'failed', updated_at: 1792497600, created_at: 1792497600, locked_by: 'node', error: 'disk unavailable', state: { progress: 30 }, result: null, payload: null };
  assert.equal(systemTaskSchema.parse(row).status, 'failed'); assert.equal(systemTaskListSchema.parse({ success: true, data: [row], total: 12 }).total, 12);
  assert.equal(systemTaskListSchema.safeParse({ success: true, data: [], total: -1 }).success, false);
  assert.equal(systemTaskSchema.safeParse({ ...row, status: 'unknown' }).success, false);
});
test('missing or unknown system health never turns into a healthy snapshot', () => {
  assert.equal(systemStatusSchema.safeParse({}).success, false);
  assert.equal(systemStatusSchema.shape.health.safeParse({ status: 'unknown', warnings: [] }).success, false);
  assert.equal(systemStatusSchema.shape.resources.safeParse({ cpu_usage: 101, memory_usage: 1, disk_usage: 1, disk_total: 1, disk_free: 1 }).success, false);
});
