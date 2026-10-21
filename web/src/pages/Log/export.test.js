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
  const filters = { ...feed.emptyFeedFilters(), source: 'usage', request_id: 'request', token_name: 'key', type: 2, channel: '5', username: 'user', start_timestamp: '2026-10-20T00:00' };
  const changed = feed.changeFeedSource(filters, 'midjourney');
  assert.equal(changed.request_id, ''); assert.equal(changed.type, 0); assert.equal(changed.token_name, '');
  assert.equal(changed.channel, '5'); assert.equal(changed.start_timestamp, filters.start_timestamp);
  const params = feed.feedQuery(changed, false, 100, ['usage', 'tasks', 'midjourney']);
  assert.equal(params.get('source'), 'midjourney');
  assert.equal(params.get('username'), null); assert.equal(params.get('channel'), null);
  assert.equal(params.get('start_timestamp'), String(Math.floor(new Date(filters.start_timestamp).getTime() / 1000)));
  assert.equal(query.logQuery({ upstream_request_id: 'root' }, true, false).get('upstream_request_id'), null);
  assert.equal(query.logQuery({ upstream_request_id: 'root' }, true, true).get('upstream_request_id'), 'root');
  for (const channel of ['-1', '0', '1.5', '9007199254740992']) assert.ok(feed.validateFeedFilters({ ...changed, channel }, true));
  assert.ok(feed.validateFeedFilters({ ...changed, end_timestamp: '2025-01-01' }, false));
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
