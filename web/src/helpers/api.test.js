import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { loadTestModules } from '../../scripts/load-test-modules.mjs';

let API;
let language = 'en';
before(async () => {
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
  const modules = await loadTestModules(['./src/helpers/api.ts']);
  API = modules.entry0.API;
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
  assert.deepEqual(received, ['en', 'zh-CN']);
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
