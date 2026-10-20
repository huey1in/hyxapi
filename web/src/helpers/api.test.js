import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { loadTestModules } from '../../scripts/load-test-modules.mjs';
import { AxiosError } from 'axios';

let API;
let logoutAuthentication;
let applyAuthBundle;
let useAuthStore;
let subscribeVerificationRequests;
let language = 'en';
before(async () => {
  // Browser channel behavior is covered separately; avoid opening Node's live
  // BroadcastChannel handle when this fixture signs out its fake window.
  globalThis.BroadcastChannel = undefined;
  globalThis.localStorage = {
    getItem: (key) => key === 'i18nextLng' ? language : null,
    removeItem: () => {},
  };
  globalThis.window = {
    localStorage: globalThis.localStorage,
    matchMedia: () => ({ matches: false }),
    location: { pathname: '/' },
    dispatchEvent: () => {},
  };
  const modules = await loadTestModules(['./src/helpers/api.ts', './src/lib/auth-session.ts', './src/stores/auth-store.ts', './src/lib/verification-request.ts']);
  API = modules.entry0.API;
  logoutAuthentication = modules.entry0.logoutAuthentication;
  applyAuthBundle = modules.entry1.applyAuthBundle;
  useAuthStore = modules.entry2.useAuthStore;
  subscribeVerificationRequests = modules.entry3.subscribeVerificationRequests;
});

function login() {
  applyAuthBundle({
    access_token: 'signed-dashboard-access', token_type: 'Bearer', access_expires_at: Math.floor(Date.now() / 1000) + 600,
    user: { id: 1, username: 'user', role: 100, has_password: true },
    session: { sid: 'browser-session', current: true, login_method: 'password', ip: '127.0.0.1', user_agent: 'test', created_at: 1, last_active_at: 1, expires_at: 1900000000 },
  }, false);
}

function rejectResponse(config, status, code) {
  throw new AxiosError(code, 'ERR_BAD_RESPONSE', config, {}, { status, data: { success: false, code }, headers: {}, statusText: '', config });
}

test('scope denials do not sign out the browser or retry the request', async () => {
  login();
  let requests = 0;
  API.defaults.adapter = async (config) => { requests += 1; return rejectResponse(config, 403, 'ACCESS_TOKEN_SCOPE_DENIED'); };
  await assert.rejects(API.get('/api/user/self', { skipErrorHandler: true }));
  assert.equal(requests, 1);
  assert.equal(useAuthStore.getState().auth.accessToken, 'signed-dashboard-access');
});

test('security proof requests bind the action and submit the grant once', async () => {
  login();
  const seen = [];
  const unsubscribe = subscribeVerificationRequests((operation, resolve) => {
    assert.deepEqual(operation, { scope: 'channel.key.read', context: { channel_id: 42 } });
    resolve({ proof_token: 'one-use-proof', scope: operation.scope, method: '2fa', expires_at: 1900000000 });
  });
  try {
    API.defaults.adapter = async (config) => {
      seen.push({ proof: config.headers['X-Security-Proof'], authorization: config.headers.Authorization, skipRefresh: config.skipAuthRefresh });
      if (!config.headers['X-Security-Proof']) return rejectResponse(config, 403, 'SECURITY_PROOF_REQUIRED');
      return { data: { success: true, data: { key: 'channel-key' } }, status: 200, headers: {}, config };
    };
    await API.post('/api/channel/42/key', {}, { skipErrorHandler: true });
    assert.equal(seen.length, 2);
    assert.equal(seen[1].proof, 'one-use-proof');
    assert.equal(seen[1].authorization, 'Bearer signed-dashboard-access');
    assert.equal(seen[1].skipRefresh, true);
  } finally { unsubscribe(); }
});

test('requests carrying single-use authorization are never replayed after 401', async () => {
  login();
  let requests = 0;
  API.defaults.adapter = async (config) => { requests += 1; return rejectResponse(config, 401, 'AUTH_ACCESS_EXPIRED'); };
  await assert.rejects(API.post('/api/user/passkey/register/finish', { flow_token: 'one-use-flow' }, { singleUseAuthorization: true, skipErrorHandler: true }));
  assert.equal(requests, 1);
});

test('a proof resolved after an account switch cannot replay the original action', async () => {
  login();
  let requests = 0;
  const unsubscribe = subscribeVerificationRequests((operation, resolve) => {
    const auth = useAuthStore.getState().auth;
    auth.setUser({ ...auth.user, id: 99 });
    resolve({ proof_token: 'old-account-proof', scope: operation.scope, method: 'password', expires_at: 1900000000 });
  });
  try {
    API.defaults.adapter = async (config) => { requests += 1; return rejectResponse(config, 403, 'SECURITY_PROOF_REQUIRED'); };
    await assert.rejects(API.post('/api/channel/42/key', {}, { skipErrorHandler: true }), { code: 'ERR_CANCELED' });
    assert.equal(requests, 1);
  } finally { unsubscribe(); login(); }
});

test('aborting an action waiting for verification ignores a later proof', async () => {
  login();
  let requests = 0;
  let complete;
  let signal;
  let notified;
  const requested = new Promise((resolve) => { notified = resolve; });
  const unsubscribe = subscribeVerificationRequests((operation, resolve, _reject, owner) => {
    signal = owner;
    complete = () => resolve({ proof_token: 'cancelled-action-proof', scope: operation.scope, method: 'password', expires_at: 1900000000 });
    notified();
  });
  const abort = new AbortController();
  try {
    API.defaults.adapter = async (config) => { requests += 1; return rejectResponse(config, 403, 'SECURITY_PROOF_REQUIRED'); };
    const action = API.post('/api/channel/42/key', {}, { signal: abort.signal, skipErrorHandler: true });
    const rejected = assert.rejects(action, { name: 'AbortError' });
    await requested; abort.abort(); await rejected; complete();
    assert.equal(signal.aborted, true);
    assert.equal(requests, 1);
  } finally { unsubscribe(); }
});

test('a late proof requirement from a previous account cannot open verification', async () => {
  login();
  let complete;
  let requested;
  let prompts = 0;
  const started = new Promise((resolve) => { requested = resolve; });
  const unsubscribe = subscribeVerificationRequests(() => { prompts += 1; });
  try {
    API.defaults.adapter = (config) => new Promise((_resolve, reject) => {
      complete = () => { try { rejectResponse(config, 403, 'SECURITY_PROOF_REQUIRED'); } catch (error) { reject(error); } };
      requested();
    });
    const action = API.post('/api/channel/42/key', {}, { skipErrorHandler: true });
    const rejected = assert.rejects(action, { code: 'ERR_CANCELED' });
    await started;
    const auth = useAuthStore.getState().auth;
    auth.setUser({ ...auth.user, id: 99 });
    complete(); await rejected;
    assert.equal(prompts, 0);
  } finally { unsubscribe(); login(); }
});

test('API requests follow the saved language, including English', async () => {
  const received = [];
  API.defaults.adapter = async (config) => {
    received.push(config.headers['Accept-Language']);
    return { data: {}, status: 200, statusText: 'OK', headers: {}, config };
  };
  language = 'en';
  await API.get('/api/status');
  language = 'zh-CN';
  await API.get('/api/status');
  language = 'zh-Hant';
  await API.get('/api/status');
  language = 'fr-CA';
  await API.get('/api/status');
  assert.deepEqual(received, ['en', 'zh-CN', 'zh-TW', 'fr']);
});

test('concurrent GETs share a request and a subsequent GET refreshes it', async () => {
  let complete;
  let requests = 0;
  API.defaults.adapter = (config) => {
    requests += 1;
    return new Promise((resolve) => {
      complete = () => resolve({ data: { value: requests }, status: 200, statusText: 'OK', headers: {}, config });
    });
  };
  const first = API.get('/api/status');
  const second = API.get('/api/status');
  assert.strictEqual(first, second);
  await new Promise((resolve) => setImmediate(resolve));
  complete();
  await first;
  const third = API.get('/api/status');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(requests, 2);
  complete();
  await third;
});


test('late logout response cannot clear a different signed-in session', async () => {
  login();
  let finish;
  const started = new Promise((resolve) => {
    API.defaults.adapter = (config) => { resolve(); return new Promise((done) => { finish = () => done({ data: { success: true }, status: 200, headers: {}, config }); }); };
  });
  const result = logoutAuthentication();
  await started;
  applyAuthBundle({ access_token: 'another-dashboard-access', token_type: 'Bearer', access_expires_at: Math.floor(Date.now() / 1000) + 600,
    user: { id: 2, username: 'another-user', role: 1 },
    session: { sid: 'another-session', current: true, login_method: 'password', ip: '', user_agent: '', created_at: 1, last_active_at: 1, expires_at: 1900000000 },
  }, false);
  finish();
  assert.equal(await result, false);
  assert.equal(useAuthStore.getState().auth.user.id, 2);
  assert.equal(useAuthStore.getState().auth.session.sid, 'another-session');
});

test('successful logout clears the matching browser session through the modern endpoint', async () => {
  login(); let requested;
  API.defaults.adapter = async (config) => { requested = config; return { data: { success: true }, status: 200, headers: {}, config }; };
  assert.equal(await logoutAuthentication(), true);
  assert.equal(requested.url, '/api/user/auth/logout');
  assert.equal(requested.method, 'post');
  assert.equal(requested.skipAuthRefresh, true);
  assert.equal(useAuthStore.getState().auth.user, null);
});

test('rejected logout preserves the browser session for retry', async () => {
  login();
  const sid = useAuthStore.getState().auth.session.sid;
  API.defaults.adapter = async (config) => ({ data: { success: false, message: 'Logout unavailable' }, status: 200, headers: {}, config });
  await assert.rejects(logoutAuthentication(), /Logout unavailable/);
  assert.equal(useAuthStore.getState().auth.session.sid, sid);
});
