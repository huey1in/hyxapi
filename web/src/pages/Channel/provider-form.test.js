import test from 'node:test';
import assert from 'node:assert/strict';
import { channelCredentialError, isMultiKeyChannel } from './provider-form.ts';

test('Codex credentials preserve formatted JSON and require string identifiers', () => {
  const key = JSON.stringify({ access_token: 'token', account_id: 'account' }, null, 2);
  assert.equal(isMultiKeyChannel(57, key), false);
  assert.equal(isMultiKeyChannel(1, 'first\nsecond'), true);
  assert.equal(isMultiKeyChannel(1, '', { is_multi_key: true }), true);
  assert.equal(channelCredentialError(57, key, 'single', false), undefined);
  assert.match(channelCredentialError(57, key, 'batch', false), /single/);
  assert.match(channelCredentialError(57, '{"access_token":true,"account_id":"a"}', 'single', false), /access_token/);
  assert.match(channelCredentialError(57, '{"access_token":"a","account_id":12}', 'single', false), /account_id/);
  for (const invalid of ['[]', 'null', 'sk-token', '{}{}']) assert.match(channelCredentialError(57, invalid, 'single', false), /JSON object/);
  assert.equal(channelCredentialError(57, '', 'single', true), undefined);
  assert.equal(channelCredentialError(62, 'EMPTY', 'single', false), undefined);
});
