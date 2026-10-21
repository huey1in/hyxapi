import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTestModules } from '../../../scripts/load-test-modules.mjs';
const { entry0: { registrationPayload, safeAuthRedirect, isLoginChallenge } } = await loadTestModules(['./src/pages/Auth/auth-flow.ts']);

test('registration forwards invitations and verified email without normalizing passwords', () => {
  const form = { username: ' invited ', password: ' 🙂🙂🙂🙂🙂🙂🙂🙂 ', confirm: ' 🙂🙂🙂🙂🙂🙂🙂🙂 ', email: ' Test@Example.test ', verificationCode: ' 123456 ' };
  assert.deepEqual(registrationPayload(form, true, ' referral '), { username: 'invited', password: form.password, email: 'test@example.test', verification_code: '123456', aff_code: 'referral' });
  assert.deepEqual(registrationPayload(form, false, ''), { username: 'invited', password: form.password, aff_code: '' });
  assert.throws(() => registrationPayload({ ...form, username: 'x'.repeat(21) }, false, ''), /20 characters/);
  assert.throws(() => registrationPayload({ ...form, password: '🙂'.repeat(7) }, false, ''), /8 and 128/);
  assert.throws(() => registrationPayload({ ...form, password: '🙂'.repeat(129) }, false, ''), /8 and 128/);
  assert.throws(() => registrationPayload({ ...form, confirm: 'different' }, false, ''), /do not match/);
  assert.throws(() => registrationPayload({ ...form, verificationCode: '' }, true, ''), /verification code/);
});
test('post-login redirects reject network paths, backslashes and control characters', () => {
  for (const value of ['//foreign.test', '/\\foreign.test', 'https://foreign.test', '\\foreign.test', '/\n/foreign.test', null, '']) assert.equal(safeAuthRedirect(value), '/console');
  assert.equal(safeAuthRedirect('/personal?tab=security#passkey'), '/personal?tab=security#passkey');
});
test('login challenges require a usable flow and advertised verification methods', () => {
  const challenge = { require_verification: true, flow_token: 'one-use-flow', expires_at: 1900000000, methods: [{ method: '2fa' }] };
  assert.equal(isLoginChallenge(challenge), true);
  for (const bad of [{ ...challenge, flow_token: '' }, { ...challenge, expires_at: NaN }, { ...challenge, methods: [] }, null]) assert.equal(isLoginChallenge(bad), false);
});
