import test from 'node:test';
import assert from 'node:assert/strict';
import { availableResetCredits, codexLimits, parseCodexCredits, parseCodexUsage, resetTimestamp, usedPercent } from './codex-usage.ts';

test('reset-credit details preserve explicit zero and reject invalid counters', () => {
  const usage = parseCodexUsage({ rate_limit_reset_credits: { available_count: 5 } });
  assert.equal(availableResetCredits(usage, parseCodexCredits({ available_count: 0 })), 0);
  assert.equal(availableResetCredits(usage, parseCodexCredits({})), 5);
  assert.equal(availableResetCredits(usage, parseCodexCredits({ available_count: -1 })), undefined);
  assert.equal(availableResetCredits(usage, parseCodexCredits({ available_count: 1.5 })), undefined);
  assert.throws(() => parseCodexUsage('upstream error'));
  assert.throws(() => parseCodexCredits({ credits: 'unavailable' }));
});

test('usage windows retain zero, clamp percentages and keep relative reset anchored to receipt', () => {
  assert.equal(usedPercent({ used_percent: 0 }), 0);
  assert.equal(usedPercent({ used_percent: 120 }), 100);
  assert.equal(usedPercent({ used_percent: -3 }), 0);
  assert.equal(usedPercent({ used_percent: NaN }), undefined);
  assert.equal(usedPercent({}), undefined);
  assert.equal(resetTimestamp({ reset_at: 1700000000, reset_after_seconds: 99 }, 100), 1700000000000);
  assert.equal(resetTimestamp({ reset_after_seconds: 60 }, 1000), 61000);
  assert.equal(resetTimestamp({}, 1000), undefined);
  const usage = parseCodexUsage({ rate_limit: { primary_window: { used_percent: 0 } }, additional_rate_limits: [{ limit_name: 'Model', primary_window: { used_percent: 35 } }, { metered_feature: 'Review', rate_limit: { limit_reached: true } }] });
  assert.deepEqual(codexLimits(usage).map(({ name }) => name), ['Account limit', 'Model', 'Review']);
  assert.equal(codexLimits(usage)[1].rate.primary_window.used_percent, 35);
});
