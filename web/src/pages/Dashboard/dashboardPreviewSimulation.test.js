import test from 'node:test';
import assert from 'node:assert/strict';
import { createPreviewState, advancePreviewState } from './dashboardPreviewSimulation.js';

const fixedRandom = () => 0.25;

test('creates recent activity from the current time', () => {
  const now = Date.UTC(2026, 6, 29, 8, 30, 0);
  const state = createPreviewState(now, fixedRandom);

  assert.equal(state.logs.length, 6);
  assert.equal(state.logs[0].created_at, Math.floor(now / 1000));
  assert.ok(state.logs.every((log, index) => index === 0 || log.created_at < state.logs[index - 1].created_at));
});

test('adds activity and updates every related metric', () => {
  const now = Date.UTC(2026, 6, 29, 8, 30, 0);
  const state = createPreviewState(now, fixedRandom);
  const next = advancePreviewState(state, now + 3000, fixedRandom);
  const added = next.logs[0];

  assert.equal(next.logs.length, 6);
  assert.equal(next.logs[0].created_at, Math.floor((now + 3000) / 1000));
  assert.equal(next.user.request_count, state.user.request_count + 1);
  assert.equal(next.cumulative.requests, state.cumulative.requests + 1);
  assert.equal(next.today.requests, state.today.requests + 1);
  assert.equal(next.cumulative.tokens, state.cumulative.tokens + added.prompt_tokens + added.completion_tokens);
  assert.equal(next.today.tokens, state.today.tokens + added.prompt_tokens + added.completion_tokens);
  assert.equal(next.today.quota, state.today.quota + added.quota);
  assert.equal(next.user.used_quota, state.user.used_quota + added.quota);
  assert.equal(next.user.quota, state.user.quota - added.quota);
});
