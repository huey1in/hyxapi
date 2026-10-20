import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTagEdit } from './tag-edit.ts';
const values = { new_tag: '', models: '', groups: '', priority: '0', weight: '0', model_mapping: '', param_override: '', header_override: '' };

test('tag edits distinguish untouched fields, explicit clearing and numeric zero', () => {
  assert.deepEqual(buildTagEdit('old', new Set(['priority', 'weight', 'models']), { ...values, new_tag: 'must-not-send', model_mapping: 'invalid' }, false), { tag: 'old', priority: 0, weight: 0, models: '' });
  assert.deepEqual(buildTagEdit('old', new Set(['models']), { ...values, models: 'a, b,a, ' }, false), { tag: 'old', models: 'a,b' });
  assert.throws(() => buildTagEdit('old', new Set(), values, true));
});

test('tag edit validates precision, UTF-8 column limits and sensitive overrides', () => {
  for (const priority of ['', '1.2', '9007199254740992']) assert.throws(() => buildTagEdit('old', new Set(['priority']), { ...values, priority }, true));
  assert.throws(() => buildTagEdit('old', new Set(['groups']), { ...values, groups: '组'.repeat(22) }, true));
  assert.throws(() => buildTagEdit('old', new Set(['header_override']), values, false));
  assert.throws(() => buildTagEdit('old', new Set(['model_mapping']), { ...values, model_mapping: '{"a":1}' }, true));
  assert.throws(() => buildTagEdit('old', new Set(['model_mapping']), { ...values, model_mapping: '{"a":""}' }, true));
});
