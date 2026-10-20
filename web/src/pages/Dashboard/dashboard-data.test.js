import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTestModules } from '../../../scripts/load-test-modules.mjs';
const { entry0: { dashboardStatsSchema, dashboardProfileSchema, dashboardKeysSchema, dashboardRange, dashboardCustomRange, dashboardLocalTime } } = await loadTestModules(['./src/pages/Dashboard/dashboard-data.ts']);

test('dashboard accepts only interval metrics and validates key identities and financial payloads', () => {
  const actual = { quota: 0, tokens: 0, requests: 0 };
  assert.deepEqual(dashboardStatsSchema.parse(actual), actual);
  assert.deepEqual(dashboardStatsSchema.parse({ ...actual, rpm: 4, tpm: 52 }), actual);
  assert.equal(dashboardProfileSchema.safeParse({ quota: Infinity, used_quota: 0 }).success, false);
  assert.equal(dashboardStatsSchema.safeParse({ ...actual, tokens: -1 }).success, false);
  assert.equal(dashboardStatsSchema.safeParse({ ...actual, requests: '1' }).success, false);
  assert.equal(dashboardKeysSchema.safeParse([{ id: 0, name: 'key' }]).success, false);
  assert.deepEqual(dashboardKeysSchema.parse([{ id: 1, name: 'duplicate' }, { id: 2, name: 'duplicate' }]).map((key) => key.id), [1, 2]);
});

test('dashboard daily totals use local calendar boundaries', () => {
  const now = new Date(2026, 9, 20, 12, 30);
  const start = new Date(2026, 9, 20);
  const range = dashboardRange('today', now);
  assert.equal(range.start_timestamp, Math.floor(start.getTime() / 1000));
  assert.equal(range.end_timestamp, Math.floor(now.getTime() / 1000));
});

test('yesterday and multi-day presets use inclusive local calendar boundaries across months', () => {
  const now = new Date(2026, 10, 2, 12, 30);
  const today = new Date(2026, 10, 2);
  assert.deepEqual(dashboardRange('yesterday', now), { start_timestamp: new Date(2026, 10, 1).getTime() / 1000, end_timestamp: today.getTime() / 1000 - 1 });
  assert.equal(dashboardRange('week', now).start_timestamp, new Date(2026, 9, 27).getTime() / 1000);
  assert.equal(dashboardRange('month', now).start_timestamp, new Date(2026, 9, 4).getTime() / 1000);
});

test('custom ranges reject missing, reversed, invalid and future boundaries and preserve local input', () => {
  const now = new Date(2026, 9, 20, 12, 30);
  const range = dashboardCustomRange('2026-10-19T09:15', '2026-10-20T10:30', now);
  assert.equal(dashboardRange(range, now), range);
  assert.equal(dashboardLocalTime(range.start_timestamp), '2026-10-19T09:15');
  for (const [start, end] of [['', '2026-10-20T10:30'], ['invalid', '2026-10-20T10:30'], ['2026-10-20T10:30', '2026-10-19T09:15'], ['2026-10-19T09:15', '2026-10-21T00:00']]) assert.throws(() => dashboardCustomRange(start, end, now), /Invalid time range/);
});
