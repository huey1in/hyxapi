import assert from 'node:assert/strict';
import { test } from 'node:test';
import { metricValue, metricRatio, metricMean, recentMetrics } from './inference-status.ts';

const metric = (name, value, labels = {}) => ({ name, value, labels });
const snapshot = (time, metrics, error) => ({
  sampled_at: time, endpoints: { '/metrics': { status: 200, error } }, metrics,
});

test('inference aggregation preserves zero, worker peaks and histogram means', () => {
  const metrics = [
    metric('load', 0, { rank: '0' }), metric('load', 3, { rank: '1' }),
    metric('latency_sum', 4), metric('latency_count', 2),
  ];
  assert.equal(metricValue(metrics, 'load', { rank: '0' }), 0);
  assert.equal(metricValue(metrics, 'load'), 3);
  assert.equal(metricValue(metrics, 'load', {}, 'max'), 3);
  assert.equal(metricMean(metrics, 'latency'), 2);
  assert.equal(metricValue(metrics, 'missing'), undefined);
  assert.equal(metricRatio(0, 4), 0);
  assert.equal(metricRatio(4, 0), undefined);
  assert.equal(metricValue([metric('load', Infinity)], 'load'), undefined);
});

test('recent rates match labelled series despite ordering and detect restarts', () => {
  const old = snapshot(1000, [metric('tokens_total', 12, { a: '1', b: '2' }), metric('process_start_time_seconds', 100)]);
  const next = snapshot(3000, [metric('process_start_time_seconds', 100), metric('tokens_total', 20, { b: '2', a: '1' })]);
  const recent = recentMetrics(next, old);
  assert.equal(recent.seconds, 2);
  assert.equal(metricValue(recent.metrics, 'tokens_total'), 8);
  assert.equal(recentMetrics(snapshot(4000, [metric('tokens_total', 5, { a: '1', b: '2' }), metric('process_start_time_seconds', 100)]), next), undefined);
  assert.equal(recentMetrics(snapshot(4000, [metric('tokens_total', 21, { a: '1', b: '2' }), metric('process_start_time_seconds', 200)]), next), undefined);
  assert.equal(recentMetrics({ ...next, endpoints: { '/metrics': { status: 403, error: 'http_error' } } }, old), undefined);
  assert.equal(recentMetrics(next, next), undefined);
  assert.equal(recentMetrics(snapshot(4000, [metric('tokens_total', 22, { rank: 'new' })]), next), undefined);
});
