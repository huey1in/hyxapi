import test from 'node:test';
import assert from 'node:assert/strict';
import { taskArtifactsSchema, projectTaskRow, safeTaskMediaURL, midjourneyVideos, taskSchema } from './task-data.ts';

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
  assert.equal(taskSchema.safeParse({ id: 1, task_id: 't', quota: -1 }).success, false);
});
