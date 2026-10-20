import test, { beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { useAuthStore } from '../../stores/auth-store.ts';
import { DEFAULT_CONFIG, DEFAULT_PARAMETER_ENABLED, STORAGE_KEYS } from './constants.ts';
import { loadConfig, saveConfig, loadMessages, saveMessages } from './lib/storage/storage.ts';
import { createUserMessage, createLoadingAssistantMessage, getMessageContent } from './lib/message/message-utils.ts';
import { appendUserMessagePair, applyMessageEdit, createRegeneratedMessages } from './lib/message/conversation-message-utils.ts';
import { applyStreamingChunk, completeAssistantMessage } from './lib/message/message-streaming-utils.ts';
import { buildChatCompletionPayload } from './lib/streaming/payload-builder.ts';
import { createStreamRequestController } from './lib/streaming/request-controller.ts';
import { parseRequestErrorDetails } from './lib/streaming/request-error-utils.ts';

let originalStorage;
let originalUser;
let values;
beforeEach(() => {
  originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  values = new Map();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  } });
  originalUser = useAuthStore.getState().auth.user;
  useAuthStore.getState().auth.setUser({ id: 11, username: 'first', role: 1 });
});
afterEach(() => {
  useAuthStore.getState().auth.setUser(originalUser);
  if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
  else delete globalThis.localStorage;
});

test('history and config belong to their signed-in account; unowned legacy history is removed', () => {
  values.set(STORAGE_KEYS.MESSAGES, JSON.stringify([createUserMessage('unowned')]));
  saveConfig({ ...DEFAULT_CONFIG, model: 'first-model' });
  saveMessages([createUserMessage('first-account')]);
  useAuthStore.getState().auth.setUser({ id: 22, username: 'second', role: 1 });
  assert.equal(loadMessages(), null);
  assert.deepEqual(loadConfig(), {});
  assert.equal(values.has(STORAGE_KEYS.MESSAGES), false);
  useAuthStore.getState().auth.setUser({ id: 11, username: 'first', role: 1 });
  assert.equal(getMessageContent(loadMessages()[0]), 'first-account');
  assert.equal(loadConfig().model, 'first-model');
});

test('a delayed save from an unmounted account cannot write into the next account', () => {
  const oldMessages = [createUserMessage('private first conversation')];
  useAuthStore.getState().auth.setUser({ id: 22, username: 'second', role: 1 });
  saveMessages(oldMessages, 11);
  saveConfig({ model: 'private-model' }, 11);
  assert.equal(loadMessages(), null);
  assert.deepEqual(loadConfig(), {});
});

test('saved history is bounded before storage and pending replies recover after reload', () => {
  const messages = Array.from({ length: 110 }, (_, index) => createUserMessage('message-' + index));
  saveMessages(messages);
  const loaded = loadMessages();
  assert.equal(loaded.length, 100);
  assert.equal(getMessageContent(loaded[0]), 'message-10');
  const pending = applyStreamingChunk(createLoadingAssistantMessage(), 'content', '中'.repeat(600_000));
  saveMessages([...messages, pending]);
  assert.ok(new TextEncoder().encode(values.get(STORAGE_KEYS.MESSAGES + ':11')).length <= 1024 * 1024);
  const last = loadMessages().at(-1);
  assert.equal(last.status, 'complete');
  assert.ok(getMessageContent(last).length <= 40_000);
  assert.ok(getMessageContent(last).endsWith('[...]'));
});

test('legitimate repeated sections and repeated content deltas remain intact', () => {
  const text = '## 1. Example\n' + 'Repeated content. '.repeat(150);
  saveMessages([createUserMessage(text.repeat(3))]);
  assert.equal(getMessageContent(loadMessages()[0]), text.repeat(3));
  let reply = createLoadingAssistantMessage();
  for (const chunk of ['ha', 'ha', 'hahaha']) reply = applyStreamingChunk(reply, 'content', chunk);
  assert.equal(getMessageContent(completeAssistantMessage(reply)), 'ha'.repeat(5));
});

test('invalid stored data falls back without executing or accepting another schema', (t) => {
  t.mock.method(console, 'error', () => {});
  values.set(STORAGE_KEYS.MESSAGES + ':11', '{invalid');
  values.set(STORAGE_KEYS.CONFIG + ':11', JSON.stringify({ model: 99 }));
  assert.equal(loadMessages(), null);
  assert.deepEqual(loadConfig(), {});
});

test('editing and regenerating build the intended conversation branch and request parameters', () => {
  const first = appendUserMessagePair([], 'original');
  first[1] = completeAssistantMessage(applyStreamingChunk(first[1], 'content', 'old answer'));
  const messages = appendUserMessagePair(first, 'later');
  const result = applyMessageEdit(messages, first[0].key, 'edited', true);
  assert.equal(result.shouldSend, true);
  assert.equal(result.messages.length, 2);
  assert.equal(getMessageContent(result.messages[0]), 'edited');
  const regenerated = createRegeneratedMessages(messages, first[1].key);
  assert.equal(regenerated.length, 2);
  const payload = buildChatCompletionPayload(result.messages, { ...DEFAULT_CONFIG, seed: 0 }, { ...DEFAULT_PARAMETER_ENABLED, seed: true });
  assert.deepEqual(payload.messages, [{ role: 'user', content: 'edited' }]);
  assert.equal(payload.seed, 0);
  assert.equal('max_tokens' in payload, false);
});

test('reasoning and split think tags are separated from the visible reply', () => {
  let reply = createLoadingAssistantMessage();
  for (const chunk of ['<thi', 'nk>secret', '</think>', 'answer']) reply = applyStreamingChunk(reply, 'content', chunk);
  const completed = completeAssistantMessage(reply);
  assert.equal(getMessageContent(completed), 'answer');
  assert.equal(completed.reasoning.content, 'secret');
  assert.equal(completed.isReasoningStreaming, false);
});

function streamFixture(getHeaders = async () => ({ Authorization: 'Bearer fixture' })) {
  const sources = [];
  const updates = [];
  const errors = [];
  let completions = 0;
  const controller = createStreamRequestController({
    getHeaders, setStreaming: () => {},
    createSource: () => {
      const listeners = new Map();
      const source = {
        readyState: 1, status: 200, started: false, closed: false,
        addEventListener: (name, handler) => listeners.set(name, handler),
        stream: () => { source.started = true; },
        emit: (name, event) => listeners.get(name)?.(event),
        close: () => { source.closed = true; source.readyState = 2; source.emit('readystatechange', { readyState: 2 }); },
      };
      sources.push(source);
      return source;
    },
  });
  const callbacks = { onUpdate: (...value) => updates.push(value), onError: (...value) => errors.push(value), onComplete: () => completions++ };
  return { controller, callbacks, sources, updates, errors, completions: () => completions };
}

test('stream DONE completes exactly once and preserves consecutive equal deltas', async () => {
  const fixture = streamFixture();
  await fixture.controller.send({}, fixture.callbacks);
  for (const content of ['ha', 'ha']) fixture.sources[0].emit('message', { data: JSON.stringify({ choices: [{ delta: { content } }] }) });
  fixture.sources[0].emit('message', { data: '[DONE]' });
  fixture.sources[0].emit('message', { data: 'late invalid data' });
  assert.deepEqual(fixture.updates, [['content', 'ha'], ['content', 'ha']]);
  assert.equal(fixture.completions(), 1);
  assert.deepEqual(fixture.errors, []);
});

test('stop during authentication prevents a late request from starting', async () => {
  let resolveHeaders;
  const fixture = streamFixture(() => new Promise((resolve) => { resolveHeaders = resolve; }));
  const request = fixture.controller.send({}, fixture.callbacks);
  fixture.controller.stop();
  resolveHeaders({});
  await request;
  assert.equal(fixture.sources.length, 0);
});

test('replacing a request ignores events from its old source', async () => {
  const fixture = streamFixture();
  await fixture.controller.send({}, fixture.callbacks);
  const oldSource = fixture.sources[0];
  await fixture.controller.send({}, fixture.callbacks);
  oldSource.emit('message', { data: JSON.stringify({ choices: [{ delta: { content: 'old' } }] }) });
  fixture.sources[1].emit('message', { data: JSON.stringify({ choices: [{ delta: { content: 'new' } }] }) });
  assert.equal(oldSource.closed, true);
  assert.deepEqual(fixture.updates, [['content', 'new']]);
});

test('EOF before DONE ends generation with an error instead of leaving it pending', async () => {
  const fixture = streamFixture();
  await fixture.controller.send({}, fixture.callbacks);
  fixture.sources[0].emit('readystatechange', { readyState: 2 });
  assert.equal(fixture.errors.length, 1);
  assert.equal(fixture.sources[0].closed, true);
  assert.equal(fixture.completions(), 0);
});

test('an error sent within a successful SSE response retains its code and terminates once', async () => {
  const fixture = streamFixture();
  await fixture.controller.send({}, fixture.callbacks);
  fixture.sources[0].emit('message', { data: JSON.stringify({ error: { code: 'model_price_error', message: 'No price' } }) });
  assert.deepEqual(fixture.errors, [['No price', 'model_price_error']]);
  assert.equal(fixture.sources[0].closed, true);
});

test('nonstreaming errors display the relay explanation and code instead of the HTTP client fallback', () => {
  assert.deepEqual(parseRequestErrorDetails({
    message: 'Request failed with status code 400',
    response: { data: { error: { code: 'mock_rejection', message: 'mock rejection' } } },
  }), { errorCode: 'mock_rejection', errorMessage: 'mock rejection' });
});
