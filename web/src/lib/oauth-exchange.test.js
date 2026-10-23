import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTestModules } from '../../scripts/load-test-modules.mjs';

globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const { entry0: { oauthExchange, authorizationURL }, entry1: { API }, entry2: { authResult }, entry3: { applyAuthBundle } } = await loadTestModules(['./src/lib/oauth-exchange.ts', './src/helpers/api.ts', './src/lib/secure-verification.ts', './src/lib/auth-session.ts']);

function popupFixture() {
  const handlers = new Set();
  const timers = new Set();
  const popup = { closed: false, sessionStorage: { setItem() {} }, location: { replace() {} }, close() { this.closed = true; } };
  globalThis.window = {
    localStorage: globalThis.localStorage, dispatchEvent() {},
    location: { origin: 'https://gateway.example' }, open: () => popup,
    addEventListener: (_type, handler) => handlers.add(handler), removeEventListener: (_type, handler) => handlers.delete(handler),
    setInterval: () => { const handle = Symbol(); timers.add(handle); return handle; }, clearInterval: (handle) => timers.delete(handle),
    setTimeout: () => { const handle = Symbol(); timers.add(handle); return handle; }, clearTimeout: (handle) => timers.delete(handle),
  };
  applyAuthBundle({
    access_token: 'fixture-dashboard-token', token_type: 'Bearer', access_expires_at: Math.floor(Date.now() / 1000) + 600,
    user: { id: 1, username: 'fixture', role: 1 },
    session: { sid: 'fixture-session', current: true, login_method: 'password', ip: '', user_agent: '', created_at: 1, last_active_at: 1, expires_at: 1900000000 },
  }, false);
  const requests = [];
  API.defaults.adapter = async (config) => {
    requests.push(config);
    const data = config.url === '/api/oauth/state' ? { flow_token: 'bound-state', authorization_url: 'https://idp.example/authorize' }
      : config.url === '/api/status' ? {} : { proof_token: 'bound-proof', scope: 'account.binding.bind' };
    return { data: { success: true, data }, status: 200, headers: {}, config };
  };
  const callback = (overrides = {}) => {
    const event = { origin: 'https://gateway.example', source: popup, data: { type: 'hyxware:oauth-callback', state: 'bound-state', provider: 'fixture', code: 'one-use-code' }, ...overrides };
    for (const handler of handlers) handler(event);
  };
  return { popup, handlers, timers, requests, callback };
}

test('OAuth exchange ignores foreign callbacks and exchanges the matching callback once', async () => {
  const fixture = popupFixture();
  const ready = new Promise((resolve) => { fixture.popup.location.replace = resolve; });
  const pending = oauthExchange('fixture', 'verify', { scope: 'account.binding.bind' });
  assert.equal(await ready, 'https://idp.example/authorize');
  fixture.callback({ origin: 'https://foreign.example' });
  fixture.callback({ source: {} });
  fixture.callback({ data: { type: 'hyxware:oauth-callback', state: 'other-state', provider: 'fixture' } });
  await Promise.resolve();
  assert.equal(fixture.requests.length, 2);
  fixture.callback();
  const proof = await pending;
  assert.equal(proof.proof_token, 'bound-proof');
  assert.equal(fixture.requests.length, 3);
  assert.equal(fixture.requests[2].singleUseAuthorization, true);
  assert.equal(fixture.popup.closed, true);
  assert.equal(fixture.handlers.size, 0);
  assert.equal(fixture.timers.size, 0);
});

test('cancelling an OAuth exchange closes its popup and cannot submit a stale callback', async () => {
  const fixture = popupFixture();
  const ready = new Promise((resolve) => { fixture.popup.location.replace = resolve; });
  const abort = new AbortController();
  const pending = oauthExchange('fixture', 'verify', { scope: 'account.binding.bind' }, undefined, abort.signal);
  const rejected = assert.rejects(pending, { name: 'AbortError' });
  await ready; abort.abort(); await rejected;
  fixture.callback();
  assert.equal(fixture.requests.length, 2);
  assert.equal(fixture.popup.closed, true);
  assert.equal(fixture.handlers.size, 0);
  assert.equal(fixture.timers.size, 0);
  assert.equal(fixture.requests.every((request) => request.signal === abort.signal), true);
});

test('authentication helpers preserve cancellation for callers to handle quietly', async () => {
  const abort = new DOMException('cancelled', 'AbortError');
  await assert.rejects(authResult(Promise.reject(abort)), (error) => error === abort);
});

test('LinuxDO authorization preserves state and uses the registered callback URL', () => {
  popupFixture();
  const url = new URL(authorizationURL('linuxdo', 'state+/with=special&characters', { linuxdo_client_id: 'configured-client' }));
  assert.equal(url.origin + url.pathname, 'https://connect.linux.do/oauth2/authorize');
  assert.equal(url.searchParams.get('client_id'), 'configured-client');
  assert.equal(url.searchParams.get('state'), 'state+/with=special&characters');
  assert.equal(url.searchParams.get('redirect_uri'), 'https://gateway.example/api/oauth/linuxdo');
  const github = new URL(authorizationURL('github', 'state', { github_client_id: 'configured-client' }));
  assert.equal(github.searchParams.get('redirect_uri'), 'https://gateway.example/oauth/github');
});
