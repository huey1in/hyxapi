import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { loadTestModules } from '../../scripts/load-test-modules.mjs';

let createRefreshRunner;
const bundle = {
  access_token: 'signed-access-token', token_type: 'Bearer', access_expires_at: 1900000000,
  user: { id: 1, username: 'user', role: 1 },
  session: { sid: 'current-session', current: true, login_method: 'password', ip: '127.0.0.1', user_agent: 'test', created_at: 1, last_active_at: 1, expires_at: 1900000000 },
};
before(async () => {
  ({ createRefreshRunner } = (await loadTestModules(['./src/lib/auth-session.ts'])).entry0);
});

function runtime(responses) {
  const result = { accepted: [], cleared: [], waits: [], sids: [], transient: 0, sid: 'old-session' };
  result.run = createRefreshRunner({
    request: async (sid) => { result.sids.push(sid); return responses.shift(); },
    getExpectedSID: () => result.sid,
    parseBundle: (value) => value?.access_token ? value : null,
    acceptBundle: (value) => result.accepted.push(value),
    clear: (...args) => { result.cleared.push(args); result.sid = undefined; },
    markTransient: () => { result.transient += 1; },
    wait: async (delay) => { result.waits.push(delay); },
  });
  return result;
}

test('refresh recovers from another tab rotating the same cookie', async () => {
  const state = runtime([{ status: 409, data: { code: 'AUTH_REFRESH_RACE' } }, { status: 200, data: { success: true, data: bundle } }]);
  assert.equal((await state.run()).kind, 'authenticated');
  assert.deepEqual(state.waits, [80]);
  assert.deepEqual(state.accepted, [bundle]);
  assert.deepEqual(state.cleared, []);
});

test('a session mismatch retries against the new cookie without the stale SID', async () => {
  const state = runtime([{ status: 409, data: { code: 'AUTH_SESSION_MISMATCH' } }, { status: 200, data: { success: true, data: bundle } }]);
  assert.equal((await state.run()).kind, 'authenticated');
  assert.deepEqual(state.sids, ['old-session', undefined]);
  assert.deepEqual(state.cleared, [[false, 'idle']]);
});

test('refresh races have a bounded retry budget', async () => {
  const state = runtime(Array.from({ length: 4 }, () => ({ status: 409, data: { code: 'AUTH_REFRESH_RACE' } })));
  assert.equal((await state.run()).kind, 'out_of_sync');
  assert.deepEqual(state.waits, [80, 200, 500]);
  assert.equal(state.sids.length, 4);
  assert.deepEqual(state.cleared, [[false]]);
});

test('temporary network and server failures preserve the authentication state', async () => {
  for (const status of [0, 429, 500, 503]) {
    const state = runtime([{ status, error: new Error('temporary failure') }]);
    assert.equal((await state.run()).kind, 'transient_error');
    assert.equal(state.transient, 1);
    assert.deepEqual(state.cleared, []);
  }
});

test('an expired or revoked refresh cookie clears authentication across tabs', async () => {
  const state = runtime([{ status: 401, data: { code: 'AUTH_SESSION_REVOKED' } }]);
  assert.equal((await state.run()).kind, 'anonymous');
  assert.deepEqual(state.cleared, [[true]]);
});

test('a superseded refresh cannot overwrite a newly signed-in account', async () => {
  let current = true;
  let accepted = false;
  const run = createRefreshRunner({
    request: async () => { current = false; return { status: 200, data: { success: true, data: bundle } }; },
    getExpectedSID: () => undefined,
    parseBundle: () => bundle,
    acceptBundle: () => { accepted = true; },
    clear: () => assert.fail('must not clear a newer session'),
    markTransient: () => {}, wait: async () => {}, isCurrent: () => current,
  });
  assert.equal((await run()).kind, 'transient_error');
  assert.equal(accepted, false);
});
