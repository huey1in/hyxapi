import test from 'node:test';
import assert from 'node:assert/strict';
import { getUsageBucketCount } from './usageGridLayout.js';

test('uses fewer usage buckets on mobile so cells remain readable', () => {
  assert.equal(getUsageBucketCount(true), 176);
  assert.equal(getUsageBucketCount(false), 364);
});
