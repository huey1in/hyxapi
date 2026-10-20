import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatSuccessRate, trendSamples, ttftSamples } from './format.ts';
import { modelResultSchema, summaryResultSchema } from './types.ts';

test('performance contracts retain missing summaries and normalize empty server slices', () => {
  const common = { summary: null, window_start: 1, window_end: 2 };
  assert.deepEqual(summaryResultSchema.parse({ window_start: 1, window_end: 2, models: null }).models, []);
  const result = modelResultSchema.parse({ ...common, model_name: 'empty', series_schema: 'v1', series: null, groups: null });
  assert.equal(result.summary, null); assert.deepEqual(result.series, []); assert.deepEqual(result.groups, []);
  assert.equal(summaryResultSchema.safeParse({ window_start: 1, window_end: 2, models: [{ model_name: 'invalid', avg_latency_ms: 0, avg_tps: 0, success_rate: 101 }] }).success, false);
});

test('performance displays distinguish missing samples from actual failures', () => {
  assert.equal(formatSuccessRate(null), '—');
  assert.equal(formatSuccessRate(Number.NaN), '—');
  assert.equal(formatSuccessRate(0), '0.00%');
  assert.equal(formatSuccessRate(100), '100.00%');
});

test('performance trends retain empty-hour gaps and exclude absent TTFT', () => {
  const points = [
    { ts: 10800, success_rate: 0, avg_ttft_ms: 0 },
    { ts: 3600, success_rate: 100, avg_ttft_ms: 120 },
  ];
  assert.deepEqual(trendSamples(points, 'success_rate').map((point) => point.ts), [3600, 10800]);
  assert.deepEqual(ttftSamples(points).map((point) => point.ts), [3600]);
  assert.equal(points[0].ts, 10800);
});
