import test from 'node:test';
import assert from 'node:assert/strict';
import { getTokenUsageRequestConfig, getUsageBucketCount } from './usageGridLayout.js';

test('uses fewer usage buckets on mobile so cells remain readable', () => {
  assert.equal(getUsageBucketCount(true), 176);
  assert.equal(getUsageBucketCount(false), 364);
});

test('token usage requests have a finite timeout', () => {
  assert.deepEqual(getTokenUsageRequestConfig(), { timeout: 15000 });
});
