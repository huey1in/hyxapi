import test from 'node:test';
import assert from 'node:assert/strict';
import { pluginRuntimeSchema, pluginListSchema, pluginUsageSchema, validPluginSources } from './task-plugin-data.ts';

test('plugin runtime uses the published current generation instead of inventing zero', () => {
  const runtime = { current_generation: 17, generation_published_at: '', database_revision: 'revision', last_rebuild: { status: 'partial', attempted_at: '', generation: 16, plugin_error_count: 1 }, plugin_errors: { broken: 'failed' } };
  assert.equal(pluginRuntimeSchema.parse(runtime).current_generation, 17);
  const { current_generation: _generation, ...missing } = runtime;
  assert.equal(pluginRuntimeSchema.safeParse({ ...missing, generation: 0 }).success, false);
  assert.equal(pluginRuntimeSchema.safeParse({ ...runtime, current_generation: -1 }).success, false);
});
test('plugin lists and destructive usage require valid status and bounded counts', () => {
  const item = { meta: { key: 'p', name: 'P', version: '1', apiVersion: 1 }, source: 'override', enabled: true, active: true, source_hash: '', has_icon: false, remark: '', runtime_status: 'registered', channel_count: 1, in_flight_count: 2 };
  assert.equal(pluginListSchema.parse([item])[0].channel_count, 1);
  for (const patch of [{ runtime_status: 'unknown' }, { in_flight_count: -1 }, { meta: { key: 'p' } }]) assert.equal(pluginListSchema.safeParse([{ ...item, ...patch }]).success, false);
  assert.equal(pluginUsageSchema.safeParse({ channels: [], in_flight_count: '2' }).success, false);
});
test('marketplace sources accept explicit empty configuration and reject credentials or unsupported URLs', () => {
  assert.equal(validPluginSources([]), true);
  assert.equal(validPluginSources([{ name: 'Local', index_url: 'http://localhost:1234/index.json' }]), true);
  for (const index_url of ['javascript:alert(1)', 'https://user:secret@example.test/index.json', 'invalid']) assert.equal(validPluginSources([{ name: 'Source', index_url }]), false);
  assert.equal(validPluginSources([{ name: '', index_url: 'https://example.test/index.json' }]), false);
});
