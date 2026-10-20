import test from 'node:test';
import assert from 'node:assert/strict';
import { operationsRange, validLogRetention, operationsReportSchema, instancesSchema, logFilesSchema } from './operations-data.ts';

test('report refresh advances its end time and uses local calendar day boundaries', () => {
  const now = new Date(2026, 9, 20, 12, 30).getTime();
  assert.equal(operationsRange(1, now).start_timestamp, new Date(2026, 9, 20).getTime() / 1000);
  assert.equal(operationsRange(7, now).start_timestamp, new Date(2026, 9, 14).getTime() / 1000);
  assert.equal(operationsRange(0, now).start_timestamp, 0);
  assert.equal(operationsRange(7, now + 10000).end_timestamp, operationsRange(7, now).end_timestamp + 10);
});
test('file log cleanup requires an explicit supported retention policy and safe positive integer', () => {
  for (const value of ['', '0', '-1', '1.5', '9007199254740992']) assert.equal(validLogRetention('by_count', value), false);
  assert.equal(validLogRetention('by_days', '365001'), false); assert.equal(validLogRetention('unknown', '1'), false);
  assert.equal(validLogRetention('by_count', '1'), true); assert.equal(validLogRetention('by_days', '30'), true);
});
test('operational snapshots reject invalid financial values, instance status and file metadata', () => {
  assert.equal(operationsReportSchema.shape.summary.shape.revenue.safeParse({ range: { total_money: -1, total_amount: 1, total_orders: 1 } }).success, false);
  assert.equal(instancesSchema.safeParse([{ node_name: 'node', status: 'unknown' }]).success, false);
  assert.equal(logFilesSchema.safeParse({ enabled: true, log_dir: 'logs', file_count: 1, total_size: 1, files: [{ name: 'test.log', size: 1, mod_time: 'invalid', active: false }] }).success, false);
});
