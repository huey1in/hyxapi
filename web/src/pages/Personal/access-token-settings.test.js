import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTestModules } from '../../../scripts/load-test-modules.mjs';
const { entry0: { personalTokenPayload } } = await loadTestModules(['./src/pages/Personal/access-token-settings.ts']);
const now = Date.parse('2026-10-20T00:00:00Z');
const original = { id: 1, scopes: ['retired:read'], expires_at: 99 };
const form = { name: ' renamed ', scopes: ['retired:read'], expiry: 'never', customExpiry: '' };

test('renaming a token preserves expiry and unchanged retired or empty grants', () => {
  assert.deepEqual(personalTokenPayload(form, original, now), { name: 'renamed' });
  assert.deepEqual(personalTokenPayload({ ...form, scopes: [] }, { ...original, scopes: [] }, now), { name: 'renamed' });
  assert.throws(() => personalTokenPayload({ ...form, scopes: [] }, original, now), /Select at least one permission/);
  assert.deepEqual(personalTokenPayload({ ...form, scopes: ['profile:read', 'profile:read'] }, original, now), { name: 'renamed', scopes: ['profile:read'] });
});

test('access token expiry is explicit and custom times enforce the server minimum', () => {
  assert.equal(personalTokenPayload({ ...form, expiry: '30' }, null, now).expires_at, now / 1000 + 30 * 86400);
  assert.equal(personalTokenPayload(form, null, now).expires_at, 0);
  assert.equal(personalTokenPayload({ ...form, expiry: 'custom', customExpiry: '2026-10-20T02:00:00Z' }, null, now).expires_at, now / 1000 + 7200);
  for (const customExpiry of ['', 'invalid', '2026-10-20T00:59:00Z']) {
    assert.throws(() => personalTokenPayload({ ...form, expiry: 'custom', customExpiry }, null, now), /at least one hour/);
  }
});

test('access token names follow the backend Unicode character limit', () => {
  assert.equal(personalTokenPayload({ ...form, name: '🙂'.repeat(64) }, null, now).name, '🙂'.repeat(64));
  for (const name of ['', '  ', '🙂'.repeat(65)]) assert.throws(() => personalTokenPayload({ ...form, name }, null, now), /1 to 64 characters/);
});
