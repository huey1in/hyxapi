import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseChatConfig, resolveChatUrl, chatLinkRequiresApiKey, getFirstActiveKey, buildCCSwitchURL, sendToFluent } from './chat-links.ts';

test('chat config retains original route IDs while ignoring malformed and executable links', () => {
  const presets = parseChatConfig(JSON.stringify([{ Unsafe: 'javascript:alert(1)' }, { Web: 'https://chat.example/path?key={key}' }, { Native: 'deepchat://install?data={deepchatConfig}' }, { CC: 'ccswitch' }, { Fluent: 'fluentread' }]));
  assert.deepEqual(presets.map((item) => [item.id, item.type]), [['1', 'web'], ['2', 'custom-protocol'], ['3', 'custom-protocol'], ['4', 'fluent']]);
  for (const raw of ['{', '{}', 'null', [{ one: 'https://x', two: 'https://y' }], [{ bad: 'https://user:secret@host' }]]) assert.deepEqual(parseChatConfig(raw), []);
});

test('chat URLs encode keys and addresses without introducing extra parameters', () => {
  const params = { template: 'https://chat.example/?key={key}&address={address}&other={key}', apiKey: 'secret&injected=1', serverAddress: 'https://api.example/path/' };
  const url = new URL(resolveChatUrl(params));
  assert.equal(url.searchParams.get('key'), 'sk-secret&injected=1');
  assert.equal(url.searchParams.get('address'), 'https://api.example/path');
  assert.equal(url.searchParams.get('injected'), null);
  assert.equal(resolveChatUrl({ ...params, apiKey: '' }), '');
  assert.equal(resolveChatUrl({ ...params, template: 'data:text/html,{key}' }), '');
  assert.equal(chatLinkRequiresApiKey('https://chat.example/'), false);
});

test('desktop imports preserve UTF-8 server paths and normalize a key exactly once', () => {
  for (const [scheme, token, marker] of [['cherrystudio', 'cherryConfig', 'id'], ['aionui', 'aionuiConfig', 'platform'], ['deepchat', 'deepchatConfig', 'id']]) {
    const url = new URL(resolveChatUrl({ template: `${scheme}://install?data={${token}}`, apiKey: 'sk-secret', serverAddress: 'https://api.example/中文' }));
    const payload = JSON.parse(Buffer.from(url.searchParams.get('data'), 'base64').toString('utf8'));
    assert.deepEqual(payload, { [marker]: 'new-api', baseUrl: 'https://api.example/中文', apiKey: 'sk-secret' });
  }
  const aqbot = new URL(resolveChatUrl({ template: 'aqbot://providers?{aqbotConfig}', apiKey: 'secret', serverAddress: 'https://api.example' }));
  assert.equal(aqbot.searchParams.get('name'), 'Hyxware');
  assert.equal(aqbot.searchParams.get('apikey'), 'sk-secret');
});

test('active chat key selection skips expired, disabled and exhausted keys', () => {
  assert.equal(getFirstActiveKey([{ id: 1, status: 2 }, { id: 2, status: 1, expired_time: 50 }, { id: 3, status: 1, unlimited_quota: false, remain_quota: 0 }, { id: 4, status: 1, unlimited_quota: true, expired_time: -1 }], 100).id, 4);
  assert.equal(getFirstActiveKey([], 100), undefined);
});

test('CC Switch imports keep application-specific endpoints and optional Claude models', () => {
  for (const app of ['claude', 'codex', 'gemini']) {
    const url = new URL(buildCCSwitchURL(app, '我的配置', { model: 'main', haikuModel: 'quick' }, 'secret', 'https://api.example/'));
    assert.equal(url.searchParams.get('app'), app);
    assert.equal(url.searchParams.get('endpoint'), app === 'codex' ? 'https://api.example/v1' : 'https://api.example');
    assert.equal(url.searchParams.get('apiKey'), 'sk-secret');
    assert.equal(url.searchParams.get('haikuModel'), 'quick');
  }
  assert.equal(buildCCSwitchURL('claude', 'test', {}, 'secret', 'https://api.example'), '');
});

test('Fluent import targets the extension contract and reports a missing extension', () => {
  const previous = globalThis.document;
  let event;
  try {
    globalThis.document = { getElementById: (id) => id === 'fluent-new-api-container' ? { dispatchEvent: (value) => { event = value; } } : null };
    assert.equal(sendToFluent('sk-secret', 'https://api.example'), true);
    assert.equal(event.type, 'fluent:prefill');
    assert.equal(event.detail.apiKey, 'sk-secret');
    globalThis.document = { getElementById: () => null };
    assert.equal(sendToFluent('secret', 'https://api.example'), false);
  } finally { if (previous === undefined) delete globalThis.document; else globalThis.document = previous; }
});
