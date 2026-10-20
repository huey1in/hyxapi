import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deriveModelMappingPairs, mergeModelMappingPairs, synchronizeModelMapping } from './model-mapping-rules.ts';

test('mapping naming rules produce explicit request aliases and report collisions', () => {
  const result = deriveModelMappingPairs(['vendor/a', 'other/a', 'plain', 'vendor/a'], 'upstream', { type: 'strip-prefix', values: 'vendor/,other/' });
  assert.deepEqual(result.pairs, [{ from: 'a', to: 'vendor/a' }]);
  assert.deepEqual(result.conflicts, ['other/a']);
  assert.deepEqual(result.unchanged, ['plain']);
  assert.deepEqual(deriveModelMappingPairs(['a'], 'request', { type: 'add-suffix', value: '-vendor' }).pairs, [{ from: 'a', to: 'a-vendor' }]);
  assert.deepEqual(deriveModelMappingPairs(['model-old-old'], 'request', { type: 'replace', find: 'old', replaceWith: 'new' }).pairs, [{ from: 'model-old-old', to: 'model-new-new' }]);
});

test('merging mappings preserves JSON model names and rejects malformed documents', () => {
  const value = mergeModelMappingPairs('{"old":"target"}', [{ from: '__proto__', to: 'upstream' }, { from: 'old', to: 'updated' }]);
  assert.deepEqual(Object.entries(JSON.parse(value)), [['old', 'updated'], ['__proto__', 'upstream']]);
  for (const invalid of ['null', '[]', '{', '{"model":5}']) assert.equal(mergeModelMappingPairs(invalid, []), null);
});

test('advertised alias synchronization reverses only editor changes', () => {
  const first = synchronizeModelMapping(['raw', 'unrelated'], '{"alias":"raw","existing":"never-advertised"}');
  assert.deepEqual(first.models, ['unrelated', 'alias', 'existing']);
  const second = synchronizeModelMapping([...first.models, 'manually-added'], '', first);
  assert.deepEqual(second.models, ['unrelated', 'manually-added', 'raw']);
  assert.equal(second.models.includes('never-advertised'), false);
  assert.equal(synchronizeModelMapping(first.models, '{', first), null);
});
