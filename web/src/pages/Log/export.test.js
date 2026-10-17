import test from 'node:test';
import assert from 'node:assert/strict';
import { logsToCSV, logQuery } from './export.js';

test('export confirms completion, quotes cells and neutralizes spreadsheet formulas', () => {
  const log = { created_at: 1, model_name: '=1+1', content: 'a,"b"\nc' };
  const data = JSON.stringify(log) + '\n' + JSON.stringify({ success: true, data: { count: 1 } });
  const csv = logsToCSV(data, 'en');
  assert.ok(csv.startsWith('\uFEFF"Time"'));
  assert.ok(csv.includes('"\'=1+1"'));
  assert.ok(csv.includes('"a,""b""\nc"'));
  assert.ok(!csv.includes('"Channel"'));
  assert.throws(() => logsToCSV(JSON.stringify(log)), /finish/);
  assert.throws(() => logsToCSV(data.replace('"count":1', '"count":2')), /finish/);
});

test('same query filters serve search and export while excluding admin filters for users', () => {
  const filters = { username: 'other', channel: 3, model_name: 'gpt%', group: 'test', type: 2 };
  assert.equal(logQuery(filters, false).get('username'), null);
  assert.equal(logQuery(filters, false).get('channel'), null);
  assert.equal(logQuery(filters, true).get('channel'), '3');
  assert.equal(logQuery(filters, false).get('model_name'), 'gpt%');
});
