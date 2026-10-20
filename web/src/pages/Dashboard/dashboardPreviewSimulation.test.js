import test from 'node:test';
import assert from 'node:assert/strict';
import { createPreviewState, advancePreviewState, getPreviewStats } from './dashboardPreviewSimulation.js';

const fixedRandom = () => 0.25;

test('creates recent activity from the current time', () => {
  const now = Date.UTC(2026, 6, 29, 8, 30, 0);
  const state = createPreviewState(now, fixedRandom);

  assert.equal(state.logs.length, 180);
  assert.equal(state.logs[0].created_at, Math.floor(now / 1000));
  assert.ok(state.logs.every((log, index) => index === 0 || log.created_at < state.logs[index - 1].created_at));
});

test('adds activity and updates every related metric', () => {
  const now = Date.UTC(2026, 6, 29, 8, 30, 0);
  const state = createPreviewState(now, fixedRandom);
  const next = advancePreviewState(state, now + 3000, fixedRandom);
  const added = next.logs[0];

  assert.equal(next.logs.length, 181);
  assert.equal(next.logs[0].created_at, Math.floor((now + 3000) / 1000));
  const range = { start_timestamp: 0, end_timestamp: Math.floor((now + 3000) / 1000) };
  const before = getPreviewStats(state, range);
  const after = getPreviewStats(next, range);
  assert.equal(after.requests, before.requests + 1);
  assert.equal(after.tokens, before.tokens + added.prompt_tokens + added.completion_tokens);
  assert.equal(after.quota, before.quota + added.quota);
  assert.equal(next.user.used_quota, state.user.used_quota + added.quota);
  assert.equal(next.user.quota, state.user.quota - added.quota);
});

test('preview applies the selected interval and exact key ID to every metric', () => {
  const state = { logs: [
    { created_at: 100, token_id: 1, quota: 7, prompt_tokens: 11, completion_tokens: 13 },
    { created_at: 101, token_id: 2, quota: 17, prompt_tokens: 19, completion_tokens: 23 },
    { created_at: 99, token_id: 1, quota: 999, prompt_tokens: 999, completion_tokens: 999 },
  ] };
  const range = { start_timestamp: 100, end_timestamp: 101 };
  assert.deepEqual(getPreviewStats(state, range), { quota: 24, tokens: 66, requests: 2 });
  assert.deepEqual(getPreviewStats(state, range, 1), { quota: 7, tokens: 24, requests: 1 });
  assert.deepEqual(getPreviewStats(state, range, 3), { quota: 0, tokens: 0, requests: 0 });
});
