import assert from 'node:assert/strict';
import test from 'node:test';
import { buildChannelPatch } from './channel-patch.ts';

test('routing edit excludes server fields and unchanged serialized settings', () => {
  const original = { id: 9, type: 1, name: 'before', status: 1, used_quota: 4000, setting: '', settings: '', base_url: 'https://example.com' };
  const form = { ...original, name: 'after', used_quota: 9999, setting: '{}', settings: '{}', other_settings: {}, fetchModelsOnOpen: true };
  assert.deepEqual(buildChannelPatch(form, original), { id: 9, type: 1, name: 'after', setting: '', settings: '', base_url: 'https://example.com' });
});

test('sensitive changes and explicit clearing remain in the patch', () => {
  const original = { id: 9, key: '', setting: '{"proxy":"https://proxy.example"}', base_url: 'https://example.com', param_override: '{"a":1}' };
  assert.deepEqual(buildChannelPatch({ ...original, key: 'new-key', setting: '{}', base_url: '', param_override: '' }, original),
    { id: 9, key: 'new-key', base_url: '', setting: '{}', param_override: '' });
});
