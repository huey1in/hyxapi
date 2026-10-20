import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTestModules } from '../../scripts/load-test-modules.mjs';

const { entry0: { clearRetiredFeatureStorage } } = await loadTestModules(['./src/lib/retired-feature-storage.ts']);

test('retired conversation data is cleared for all accounts while other browser settings survive', () => {
  const kept = ['auth', 'theme', 'sidebar-collapsed', 'playground_messages:backup'];
  const removed = ['playground_config', 'playground_messages', 'playground_parameter_enabled', 'playground_messages:1', 'playground_config:22', 'playground_parameter_enabled:22'];
  const entries = new Map([...kept, ...removed].map((key) => [key, 'stored value']));
  const storage = {
    get length() { return entries.size; },
    key(index) { return [...entries.keys()][index] ?? null; },
    removeItem(key) { entries.delete(key); },
  };
  clearRetiredFeatureStorage(storage);
  clearRetiredFeatureStorage(storage);
  assert.deepEqual([...entries.keys()], kept);
});
