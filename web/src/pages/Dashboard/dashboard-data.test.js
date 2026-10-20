import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTestModules } from '../../../scripts/load-test-modules.mjs';
const { entry0: { dashboardStatsSchema, dashboardProfileSchema, dashboardTodayRange } } = await loadTestModules(['./src/pages/Dashboard/dashboard-data.ts']);

test('dashboard keeps live rates distinct from interval totals and rejects broken financial payloads', () => {
  const actual = { quota: 0, tokens: 0, requests: 0, rpm: 4, tpm: 52 };
  assert.deepEqual(dashboardStatsSchema.parse(actual), actual);
  assert.equal(dashboardStatsSchema.safeParse({ ...actual, tpm: '52' }).success, false);
  assert.equal(dashboardProfileSchema.safeParse({ quota: Infinity, used_quota: 0, request_count: 0 }).success, false);
  assert.equal(dashboardStatsSchema.safeParse({ ...actual, tokens: -1 }).success, false);
});

test('dashboard daily totals use local calendar boundaries', () => {
  const now = new Date(2026, 9, 20, 12, 30);
  const start = new Date(2026, 9, 20);
  const range = dashboardTodayRange(now);
  assert.equal(range.start_timestamp, Math.floor(start.getTime() / 1000));
  assert.equal(range.end_timestamp, Math.floor(now.getTime() / 1000));
});
