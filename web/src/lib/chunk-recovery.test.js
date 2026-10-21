import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTestModules } from '../../scripts/load-test-modules.mjs';

const { entry0: { isChunkLoadError, recoverChunkLoad } } = await loadTestModules(['./src/lib/chunk-recovery.ts']);

test('recognizes script and style loading failures without treating API or rendering errors as stale assets', () => {
  for (const error of [
    { name: 'ChunkLoadError', message: 'Loading chunk 5 failed.' },
    { code: 'CSS_CHUNK_LOAD_FAILED' },
    new TypeError('Failed to fetch dynamically imported module: /assets/page.js'),
    new TypeError('Importing a module script failed.'),
    new TypeError('error loading dynamically imported module: /assets/page.js'),
    new Error('Loading CSS chunk 5 failed.'),
  ]) assert.equal(isChunkLoadError(error), true);
  for (const error of [null, 'ChunkLoadError', new Error('Unauthorized'), new Error('Network Error'), new TypeError('Cannot read properties of undefined')]) {
    assert.equal(isChunkLoadError(error), false);
  }
});

test('reloads once across page loads and keeps a persistent failure from looping', () => {
  const values = new Map();
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  let reloads = 0;
  const reload = () => { reloads += 1; assert.equal(values.size, 1); };
  assert.equal(recoverChunkLoad(storage, reload, 100_000), true);
  assert.equal(recoverChunkLoad(storage, reload, 100_001), false);
  assert.equal(recoverChunkLoad(storage, reload, 159_999), false);
  assert.equal(reloads, 1);
  assert.equal(recoverChunkLoad(storage, reload, 160_000), true);
  assert.equal(reloads, 2);
});

test('does not reload when the browser cannot persist the reload guard', () => {
  let reloads = 0;
  const denied = () => { throw new Error('Storage denied'); };
  for (const storage of [{ getItem: denied, setItem: denied }, { getItem: () => null, setItem: denied }]) {
    assert.equal(recoverChunkLoad(storage, () => { reloads += 1; }), false);
  }
  assert.equal(reloads, 0);
});

test('leaves the retry action available when navigation fails', () => {
  const values = new Map();
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  assert.equal(recoverChunkLoad(storage, () => { throw new Error('Navigation blocked'); }, 100_000), false);
  assert.equal(recoverChunkLoad(storage, () => assert.fail('Must not loop'), 100_001), false);
});
