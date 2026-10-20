import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { loadTestModules } from '../../scripts/load-test-modules.mjs';

let operationForRequest;
before(async () => {
  ({ operationForRequest } = (await loadTestModules(['./src/lib/verification-operation.ts'])).entry0);
});

test('proof grants bind to the exact channel and managed account', () => {
  assert.deepEqual(operationForRequest({ method: 'post', url: '/api/channel/42/key' }), { scope: 'channel.key.read', context: { channel_id: 42 } });
  assert.deepEqual(operationForRequest({ method: 'put', url: '/api/authz/user/7/permissions', data: { permissions: {} } }), { scope: 'admin.user.update', context: { user_id: 7 } });
  assert.deepEqual(operationForRequest({ method: 'post', url: '/api/user/manage', data: JSON.stringify({ id: 7, action: 'disable' }) }), { scope: 'admin.user.manage', context: { user_id: 7, action: 'disable' } });
  assert.equal(operationForRequest({ method: 'post', url: '/api/user/manage', data: { id: 7, action: 'add_quota' } }), null);
});

test('PAT creation and grant edits bind all requested scopes and expiry', () => {
  assert.deepEqual(operationForRequest({ method: 'post', url: '/api/user/access_tokens', data: { name: 'client', scopes: ['usage:read'], expires_at: 123 } }), { scope: 'access_token.generate', context: { scopes: ['usage:read'], expires_at: 123 } });
  assert.deepEqual(operationForRequest({ method: 'patch', url: '/api/user/access_tokens/9', data: { scopes: ['profile:read'] } }), { scope: 'access_token.update', context: { token_id: 9, scopes: ['profile:read'] } });
});

test('unknown routes never receive a guessed security scope', () => {
  assert.equal(operationForRequest({ method: 'post', url: '/api/custom/action', data: {} }), null);
  assert.equal(operationForRequest({ method: 'delete', url: '/api/channel/42' }), null);
  assert.equal(operationForRequest({ method: 'get', url: '/api/user/self' }), null);
});

test('first password and password changes use different proof scopes', () => {
  const config = { method: 'put', url: '/api/user/self', data: { password: 'new-password' } };
  assert.equal(operationForRequest(config, false).scope, 'account.password.set');
  assert.equal(operationForRequest(config, true).scope, 'account.password.change');
});
