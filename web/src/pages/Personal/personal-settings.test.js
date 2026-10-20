import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTestModules } from '../../../scripts/load-test-modules.mjs';
const { entry0: { passwordPayload } } = await loadTestModules(['./src/pages/Personal/personal-settings.ts']);

test('password changes follow Unicode bounds, confirmation and first-password rules', () => {
  const password = '🙂'.repeat(8);
  assert.deepEqual(passwordPayload(false, { original: '', password, confirmation: password }), { password });
  assert.deepEqual(passwordPayload(true, { original: 'old-password', password, confirmation: password }), { original_password: 'old-password', password });
  assert.throws(() => passwordPayload(false, { original: '', password: '🙂'.repeat(7), confirmation: '🙂'.repeat(7) }), /8 and 128/);
  assert.throws(() => passwordPayload(false, { original: '', password: '🙂'.repeat(129), confirmation: '🙂'.repeat(129) }), /8 and 128/);
  assert.throws(() => passwordPayload(false, { original: '', password, confirmation: password + 'x' }), /do not match/);
  assert.throws(() => passwordPayload(true, { original: '', password, confirmation: password }), /current password/);
  assert.throws(() => passwordPayload(true, { original: password, password, confirmation: password }), /different/);
});
