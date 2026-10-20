import test from 'node:test';
import assert from 'node:assert/strict';
import { before } from 'node:test';
import { loadTestModules } from '../../../scripts/load-test-modules.mjs';
let logsToCSV, logQuery;
before(async () => { ({ logsToCSV, logQuery } = (await loadTestModules(['./src/pages/Log/export.ts'])).entry0); });

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
  const filters = { username: 'other', channel: '3', model_name: 'gpt%', group: 'test', type: 2 };
  assert.equal(logQuery(filters, false).get('username'), null);
  assert.equal(logQuery(filters, false).get('channel'), null);
  assert.equal(logQuery(filters, true).get('channel'), '3');
  assert.equal(logQuery(filters, false).get('model_name'), 'gpt%');
});

test('upstream request identifiers are available only in root filters and CSV columns', () => {
  const filters = { upstream_request_id: 'provider-request' };
  assert.equal(logQuery(filters, true).get('upstream_request_id'), null);
  assert.equal(logQuery(filters, true, true).get('upstream_request_id'), 'provider-request');
  const data = JSON.stringify({ created_at: 1, upstream_request_id: 'provider-request' }) + '\n' + JSON.stringify({ success: true, data: { count: 1 } });
  assert.ok(!logsToCSV(data, 'en', true).includes('provider-request'));
  assert.ok(logsToCSV(data, 'en', true, true).includes('provider-request'));
});

test('truncated or malformed exports cannot create CSV and localized headers retain formula protection', () => {
  const trailer = '\n' + JSON.stringify({ success: true, data: { count: 1 } });
  assert.throws(() => logsToCSV('{broken' + trailer), /finish/);
  assert.throws(() => logsToCSV(JSON.stringify({ created_at: 'broken' }) + trailer), /finish/);
  assert.throws(() => logsToCSV(JSON.stringify({ created_at: 1 }) + '\n' + JSON.stringify({ success: true, data: { count: '1' } })), /finish/);
  const csv = logsToCSV(JSON.stringify({ created_at: 1, content: ' \t=cmd()', model_name: 'line\nquoted"' }) + trailer, 'fr', false, false, (key) => key === 'Time' ? 'Heure' : key);
  assert.ok(csv.startsWith('\uFEFF"Heure"'));
  assert.ok(csv.includes('"\' \t=cmd()"'));
  assert.equal(logQuery({ start_timestamp: '' }, false).get('start_timestamp'), '0');
  assert.throws(() => logQuery({ start_timestamp: 'broken' }, false), /Invalid time range/);
});
