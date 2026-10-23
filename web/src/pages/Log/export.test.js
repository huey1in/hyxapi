import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTestModules } from '../../../scripts/load-test-modules.mjs';

const { entry0: feed, entry1: csv, entry2: query } = await loadTestModules(['./src/pages/Log/feed-data.ts', './src/pages/Log/feed-export.ts', './src/pages/Log/export.ts']);
const request = feed.feedItemSchema.parse({ key: 'usage:1', source: 'usage', time: 100000, log: { id: 1, created_at: 100, type: 2, model_name: '=1+1', content: 'a,"b"\nc', upstream_request_id: 'root-only', other: JSON.stringify({ admin_info: { actor: 'admin-only' }, root_info: { secret: 'root-only' }, cache_tokens: 3 }) } });
const task = feed.feedItemSchema.parse({ key: 'tasks:1', source: 'tasks', time: 100500, task: { id: 1, task_id: 'task-public', platform: 'suno', action: 'song', status: 'SUCCESS', progress: '100%', quota: 5, created_at: 100, submit_time: 100, start_time: 100, finish_time: 101, user_id: 7, channel_id: 2, fail_reason: '', admin_info: { request_id: 'admin-only' }, root_info: { upstream_task_id: 'root-only' }, private_data: 'secret-must-not-leak' } });
const mj = feed.feedItemSchema.parse({ key: 'midjourney:1', source: 'midjourney', time: 100900, midjourney: { id: 1, user_id: 7, mj_id: 'mj-public', action: 'IMAGINE', status: 'SUCCESS', progress: '100%', quota: 6, submit_time: 100900, start_time: 100900, finish_time: 101900, channel_id: 3, prompt: '', prompt_en: '', description: '', fail_reason: '', image_url: '/image', video_url: '', video_urls: '', buttons: '', properties: '' } });
const ndjson = (rows) => rows.map((row) => JSON.stringify(row)).join('\n') + '\n' + JSON.stringify({ success: true, data: { count: rows.length } });

test('mixed feed retains independent row identities and native time units', () => {
  const page = feed.feedPageSchema.parse({ items: [mj, task, request], total: 3, next_cursor: '' });
  assert.equal(new Set(page.items.map((row) => row.key)).size, 3);
  assert.deepEqual(page.items.map((row) => row.time), [100900, 100500, 100000]);
  assert.equal(feed.feedModel(task), 'suno');
  assert.equal(feed.feedStatus(task), 'SUCCESS');
  assert.equal(feed.feedItemSchema.safeParse({ ...task, task: undefined }).success, false);
  assert.equal(feed.feedItemSchema.safeParse({ ...task, task: { ...task.task, quota: -1 } }).success, false);
  assert.equal(feed.feedPageSchema.safeParse({ items: null, total: 0, next_cursor: '' }).success, false);
});

test('source changes clear incompatible filters while retaining shared time and scope filters', () => {
  const filters = { ...feed.emptyFeedFilters(), source: 'usage', request_id: 'request', token_name: 'key', type: 2, group: 'vip', username: 'user', start_timestamp: '2026-10-20T00:00' };
  assert.equal('channel' in feed.emptyFeedFilters(), false);
  for (const all of [false, true]) {
    const params = feed.feedQuery({ ...filters, channel: '5' }, all, 100, ['usage', 'tasks', 'midjourney']);
    assert.equal(params.get('group'), 'vip');
    assert.equal(params.get('channel'), null);
    assert.equal(feed.validateFeedFilters(filters), '');
  }
  const allSources = feed.changeFeedSource(filters, '');
  assert.equal(allSources.group, 'vip');
  assert.equal(feed.changeFeedSource(allSources, 'usage').group, 'vip');
  const changed = feed.changeFeedSource(filters, 'midjourney');
  assert.equal(changed.request_id, ''); assert.equal(changed.type, 0); assert.equal(changed.token_name, '');
  assert.equal(changed.group, ''); assert.equal(changed.start_timestamp, filters.start_timestamp);
  const params = feed.feedQuery(changed, false, 100, ['usage', 'tasks', 'midjourney']);
  assert.equal(params.get('source'), 'midjourney');
  assert.equal(params.get('username'), null); assert.equal(params.get('channel'), null);
  assert.equal(params.get('start_timestamp'), String(Math.floor(new Date(filters.start_timestamp).getTime() / 1000)));
  assert.equal(query.logQuery({ upstream_request_id: 'root' }, true, false).get('upstream_request_id'), null);
  assert.equal(query.logQuery({ upstream_request_id: 'root' }, true, true).get('upstream_request_id'), 'root');
  assert.ok(feed.validateFeedFilters({ ...changed, end_timestamp: '2025-01-01' }));
});

test('unified CSV includes every source, protects formulas and projects diagnostics by role', () => {
  const data = ndjson([mj, task, request]);
  for (const role of [1, 10, 100]) {
    const result = csv.feedToCSV(data, role);
    for (const value of ['Midjourney', 'Async tasks', 'Request logs', 'task-public', 'mj-public']) assert.ok(result.includes(value), value);
    assert.ok(result.includes('"\'=1+1"'));
    assert.ok(result.includes('"a,""b""\nc"'));
    assert.equal(result.includes('admin-only'), role >= 10);
    assert.equal(result.includes('root-only'), role >= 100);
    assert.ok(!result.includes('secret-must-not-leak'));
    assert.equal(result.includes('"Channel"'), role >= 10);
  }
  assert.ok(csv.feedToCSV(data, 1, (key) => key === 'Time' ? 'Heure' : key).startsWith('\uFEFF"Heure"'));
});

test('incomplete or invalid unified exports never produce a CSV', () => {
  assert.throws(() => csv.feedToCSV(JSON.stringify(request), 1), /finish/);
  assert.throws(() => csv.feedToCSV(ndjson([request]).replace('"count":1', '"count":2'), 1), /finish/);
  assert.throws(() => csv.feedToCSV('{broken', 1), /finish/);
  assert.throws(() => csv.feedToCSV(ndjson([{ ...task, time: 'invalid' }]), 1), /finish/);
  assert.throws(() => csv.feedToCSV(ndjson([request]).replace('"count":1', '"count":"1"'), 1), /finish/);
});

test('cache CSV uses canonical counters, distinguishes missing values and normalizes input totals', () => {
  const usage = (other) => ({ ...request, log: { ...request.log, other: JSON.stringify(other) } });
  const data = ndjson([
    usage({ cache_tokens: 20, cache_write_tokens: 12, cache_write_tokens_5m: 4, cache_write_tokens_1h: 6, input_tokens_total: 40 }),
    usage({ cache_tokens: 0, cache_write_tokens: 0, input_tokens_total: 30 }),
    usage({ cache_creation_tokens: 99 }),
  ]);
  const rows = csv.feedToCSV(data, 1).replace(/^\uFEFF/, '').trim().split('\r\n');
  // These fixture fields contain no embedded commas; metadata follows these columns.
  const fields = rows.map((row) => row.match(/"(?:[^"]|"")*"/g).map((value) => value.slice(1, -1).replaceAll('""', '"')));
  const column = (name) => fields[0].indexOf(name);
  assert.deepEqual(fields.slice(1).map((row) => row[column('Cache read tokens')]), ['20', '0', '']);
  assert.deepEqual(fields.slice(1).map((row) => row[column('Cache write tokens')]), ['12', '0', '']);
  assert.deepEqual(fields.slice(1).map((row) => row[column('Cache status')]), ['Cache hit', 'Cache miss', 'Not recorded']);
  assert.deepEqual(fields.slice(1).map((row) => row[column('Cache hit rate')]), ['50%', '0%', '']);
  assert.deepEqual(fields.slice(1).map((row) => row[column('Input tokens')]), ['40', '30', '0']);
});
