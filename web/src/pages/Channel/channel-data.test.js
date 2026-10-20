import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTestModules } from '../../../scripts/load-test-modules.mjs';

const {
  entry0: {
    createChannelDraft,
    serializeChannelDraft,
    channelPageSchema,
    readOverridePairs,
    writeOverridePairs,
  },
} = await loadTestModules(['./src/pages/Channel/channel-data.ts']);
test('channel edits preserve unknown settings, polling mode and server counters', () => {
  const original = {
    id: 7,
    name: 'Channel',
    type: 1,
    key: '',
    priority: -2,
    weight: 3,
    setting: '{"system_prompt":"Saved","future":{"a":1}}',
    settings: '{"advanced_future":{"b":2}}',
    channel_info: {
      is_multi_key: true,
      multi_key_mode: 'polling',
      multi_key_size: 2,
    },
    balance: 8,
    used_quota: 100,
  };
  const draft = createChannelDraft(original);
  assert.equal(draft.multi_key_mode, 'polling');
  const payload = serializeChannelDraft(draft, original, '');
  assert.deepEqual(JSON.parse(payload.setting), {
    system_prompt: 'Saved',
    future: { a: 1 },
  });
  assert.equal(payload.settings, original.settings);
  assert.equal(payload.multi_key_mode, 'polling');
  assert.equal('balance' in payload, false);
  assert.equal('used_quota' in payload, false);
});
test('channel drafts reject blank numeric fields and malformed JSON rather than overwriting configuration', () => {
  const original = { name: 'New', type: 1 };
  const draft = createChannelDraft(original);
  for (const patch of [
    { priority: '' },
    { weight: '' },
    { weight: -1 },
    { weight: 1.5 },
    { priority: Number.MAX_SAFE_INTEGER + 1 },
    { param_override: '[]' },
  ])
    assert.throws(() =>
      serializeChannelDraft({ ...draft, ...patch }, original, ''),
    );
  for (const setting of ['null', '[]', 'broken'])
    assert.throws(() => createChannelDraft({ ...original, setting }));
});
test('channel serialization uses actual protocol setting keys and validates page counts', () => {
  const original = { name: 'New', type: 1 };
  const draft = createChannelDraft(original);
  draft.setting = {
    force_format: true,
    thinking_to_content: true,
    proxy: 'socks5://localhost:1',
    system_prompt: 'Hello',
  };
  assert.deepEqual(
    JSON.parse(serializeChannelDraft(draft, original, '').setting),
    draft.setting,
  );
  assert.equal(
    channelPageSchema.safeParse({ items: [], total: -1 }).success,
    false,
  );
  assert.equal(
    channelPageSchema.safeParse({ items: [{ id: 1 }], total: 1 }).success,
    false,
  );
});

test('editing an override preserves nested objects and types of untouched values', () => {
  const pairs = readOverridePairs(
    '{"nested":{"tools":[1]},"number":2,"flag":true,"text":"123"}',
  );
  pairs[1] = { ...pairs[1], v: '3', changed: true };
  assert.deepEqual(JSON.parse(writeOverridePairs(pairs, true)), {
    nested: { tools: [1] },
    number: 3,
    flag: true,
    text: '123',
  });
  assert.equal(
    JSON.parse(
      writeOverridePairs(
        [{ k: 'X-ID', v: '123', original: '', changed: true }],
        false,
      ),
    )['X-ID'],
    '123',
  );
  assert.throws(() => readOverridePairs('[]'));
});
