import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTestModules } from '../../../scripts/load-test-modules.mjs';
const { entry0: { buildModelRequest, renderModelRequest } } = await loadTestModules(['./src/features/pricing/request-examples.ts']);
const endpoint = { path: '/v1/chat/completions', method: 'POST' };

test('model examples use the actual endpoint, origin, method and protocol body', () => {
  const model = 'model/特殊%2F';
  const chat = buildModelRequest(model, 'openai', endpoint, 'http://localhost:3135');
  assert.equal(chat.url, 'http://localhost:3135/v1/chat/completions');
  assert.equal(chat.body.model, model); assert.equal(chat.body.messages[0].role, 'user');
  const gemini = buildModelRequest(model, 'gemini', { path: '/v1beta/models/{model}:generateContent', method: 'POST' }, 'https://example.test');
  assert.equal(gemini.url, 'https://example.test/v1beta/models/model%2F%E7%89%B9%E6%AE%8A%252F:generateContent');
  assert.equal(gemini.body.model, undefined); assert.equal(gemini.body.contents[0].parts[0].text, 'Hello');
  const anthropic = buildModelRequest(model, 'anthropic', { path: '/v1/messages', method: 'POST' }, 'https://example.test');
  assert.equal(anthropic.headers['anthropic-version'], '2023-06-01'); assert.equal(anthropic.body.max_tokens, 1024);
  assert.equal(buildModelRequest(model, 'unknown', endpoint, 'https://example.test'), null);
  assert.equal(buildModelRequest(model, 'openai', { ...endpoint, path: '//other.test/v1' }, 'https://example.test'), null);
  assert.equal(buildModelRequest(model, 'openai', { ...endpoint, path: '/\\other.test/v1' }, 'https://example.test'), null);
});

test('copied examples escape model data and do not send a body with GET', () => {
  const name = "quote'\"\n$(echo unsafe)</script>";
  const request = buildModelRequest(name, 'openai', endpoint, 'https://example.test');
  const curl = renderModelRequest(request, 'curl');
  assert.ok(curl.includes("'\"'\"'")); assert.ok(curl.includes('$HYXWARE_API_KEY'));
  const python = renderModelRequest(request, 'python');
  assert.deepEqual(JSON.parse(JSON.parse(python.split('body = json.loads(')[1].split(')\n')[0])), request.body);
  const js = renderModelRequest(request, 'javascript');
  assert.ok(js.includes(JSON.stringify(name))); assert.ok(js.includes('process.env.HYXWARE_API_KEY'));
  const get = buildModelRequest('read', 'openai', { ...endpoint, method: 'GET' }, 'https://example.test');
  assert.equal(get.body, undefined); assert.ok(!renderModelRequest(get, 'curl').includes('--data-raw'));
});
