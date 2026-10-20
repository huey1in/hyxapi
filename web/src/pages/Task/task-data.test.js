import test from 'node:test';
import assert from 'node:assert/strict';
import { taskArtifactsSchema, taskFilterError, emptyTaskFilters, taskQueryParams, projectTaskRow, safeTaskMediaURL, midjourneyVideos, taskPageSchema } from './task-data.ts';

test('task filters keep seconds and Midjourney milliseconds distinct and reject invalid scope inputs', () => {
  const filters = { ...emptyTaskFilters(), start: '2026-10-20T00:00', end: '2026-10-21T00:00', action: 'generate', channel_id: '5' };
  assert.equal(taskFilterError(filters, true), '');
  const seconds = taskQueryParams(filters, 2, true); const millis = taskQueryParams(filters, 2, true, true);
  assert.equal(millis.start_timestamp, seconds.start_timestamp * 1000); assert.equal(seconds.action, 'generate'); assert.equal(seconds.p, 2);
  assert.equal(taskQueryParams(filters, 1, false).channel_id, undefined);
  for (const channel_id of ['-1', '0', '1.5', '9007199254740992']) assert.ok(taskFilterError({ ...filters, channel_id }, true));
  assert.ok(taskFilterError({ ...filters, end: '2025-01-01' }, false)); assert.ok(taskFilterError({ ...filters, start: 'invalid' }, false));
});
test('task result URLs allow signed local media and reject executable URLs or credentials', () => {
  assert.equal(safeTaskMediaURL('/api/task/media?signature=value', 'https://hyxware.example'), 'https://hyxware.example/api/task/media?signature=value');
  for (const value of ['javascript:alert(1)', 'data:text/html,test', 'https://user:secret@example.com/file']) {
    assert.equal(safeTaskMediaURL(value, 'https://hyxware.example'), '');
    assert.equal(taskArtifactsSchema.safeParse({ task_id: 'task-1', artifacts: [{ key: 'video', type: 'video', content_url: value }] }).success, false);
  }
  assert.deepEqual(midjourneyVideos({ video_url: 'https://example.com/1', video_urls: '["https://example.com/1",{"url":"https://example.com/2"},"javascript:bad"]' }, 'https://local.example'), ['https://example.com/1', 'https://example.com/2']);
  assert.deepEqual(midjourneyVideos({ video_url: 'https://example.com/1', video_urls: '{}' }, 'https://local.example'), ['https://example.com/1']);
});
test('task diagnostics obey viewer roles and malformed financial snapshots fail closed', () => {
  const row = { admin_info: { request_id: 'admin' }, root_info: { upstream_task_id: 'root' } };
  assert.equal(projectTaskRow(row, 1).admin_info, undefined); assert.equal(projectTaskRow(row, 10).root_info, undefined); assert.deepEqual(projectTaskRow(row, 100).root_info, row.root_info);
  assert.equal(taskPageSchema.safeParse({ items: [{ id: 1, task_id: 't', quota: -1 }], total: 1, page: 1 }).success, false);
  assert.equal(taskPageSchema.safeParse({ items: null, total: 0, page: 1 }).success, true);
});
