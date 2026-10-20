import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTestModules } from '../../../scripts/load-test-modules.mjs';
const { entry0: data } = await loadTestModules([
  './src/pages/Setting/setting-data.ts',
]);

test('settings reject malformed option/policy/domain responses before they enter drafts', () => {
  assert.deepEqual(
    data.parseSettingReply(
      { success: true, data: [{ key: 'RetryTimes', value: '3' }] },
      data.optionsSchema,
    ),
    { RetryTimes: '3' },
  );
  for (const response of [
    { success: false, data: [] },
    { success: true, data: [{ key: 'RetryTimes', value: 3 }] },
    { data: [] },
  ])
    assert.throws(() => data.parseSettingReply(response, data.optionsSchema));
  assert.throws(() =>
    data.parseSettingReply(
      { success: true, data: { options: { RetryTimes: 3 } } },
      data.policySchema,
    ),
  );
  assert.equal(
    data.domainImpactSchema.safeParse({
      confirmation_required: true,
      removed_rp_ids: [],
    }).success,
    false,
  );
});
test('numeric and financial drafts reject blanks without converting them to zero', () => {
  for (const value of ['', ' ', 'NaN', 'Infinity', '-1', '1.5'])
    assert.equal(data.validNumericSetting('RetryTimes', value), false, value);
  assert.equal(data.validNumericSetting('RetryTimes', '0'), true);
  assert.equal(
    data.validNumericSetting('monitor_setting.channel_test_concurrency', '33'),
    false,
  );
  assert.equal(
    data.validNumericSetting(
      'monitor_setting.auto_test_channel_minutes',
      '0.5',
    ),
    true,
  );
  assert.notDeepEqual(data.invalidSettingKeys({ StripeUnitPrice: '' }, {}), []);
});
test('hidden-tab validation checks nested headers, check-in, site links and policy JSON', () => {
  const stored = {
    'checkin_setting.min_quota': '0',
    'checkin_setting.max_quota': '10',
  };
  for (const changes of [
    { 'checkin_setting.min_quota': '' },
    { 'checkin_setting.min_quota': '11' },
    { 'checkin_setting.max_quota': '1.5' },
    { HeaderNavModules: '[]' },
    { 'claude.model_headers_settings': '{"model":"[object Object]"}' },
    { 'channel_affinity_setting.rules': '{}' },
    { 'global.chat_completions_to_responses_policy': '{"enabled":"true"}' },
    { 'general_setting.docs_link': 'https://user:password@example.com' },
  ])
    assert.notDeepEqual(
      data.invalidSettingKeys(changes, stored),
      [],
      JSON.stringify(changes),
    );
  assert.deepEqual(
    data.invalidSettingKeys(
      {
        'checkin_setting.min_quota': '0',
        'checkin_setting.max_quota': '0',
        'claude.model_headers_settings': '{"model":{"X-Custom":["one","two"]}}',
      },
      stored,
    ),
    [],
  );
});
test('pair editing preserves deliberate zero and prevents duplicate or blank keys losing rows', () => {
  assert.equal(
    data.serializePairs([{ key: 'free', value: '0' }], true),
    '{\n  "free": 0\n}',
  );
  for (const rows of [
    [{ key: '', value: '1' }],
    [{ key: 'a', value: '' }],
    [
      { key: 'a', value: '1' },
      { key: ' a ', value: '2' },
    ],
    [{ key: 'a', value: 'NaN' }],
  ])
    assert.equal(data.serializePairs(rows, true), null);
});
test('affinity rules retain unknown fields and nested conversion templates', () => {
  const input = [
    {
      name: 'test',
      model_regex: [],
      path_regex: [],
      user_agent_include: ['Agent'],
      key_sources: [
        { type: 'gjson', path: 'metadata.user_id', custom: { a: 1 } },
      ],
      ttl_seconds: 0,
      session_mode: 'prefer',
      param_override_template: { custom: [1, { a: true }] },
      future: { enabled: true },
    },
  ];
  assert.deepEqual(
    data.parseJSON(
      JSON.stringify(input),
      data.settingJSON['channel_affinity_setting.rules'],
    ),
    input,
  );
  assert.equal(
    data.parseJSON(
      JSON.stringify([{ ...input[0], ttl_seconds: '' }]),
      data.settingJSON['channel_affinity_setting.rules'],
    ),
    null,
  );
});

test('adapter settings keep zero max tokens and Gemini fallback while rejecting invalid thresholds', () => {
  for (const changes of [
    { 'claude.default_max_tokens': '{"default":-1}' },
    { 'claude.default_max_tokens': '{"default":1.5}' },
    { 'gemini.safety_settings': '{"default":"BLOCK_SOME"}' },
  ])
    assert.notDeepEqual(data.invalidSettingKeys(changes, {}), []);
  for (const changes of [
    { 'claude.default_max_tokens': '{"default":0}' },
    { 'gemini.safety_settings': '{"default":""}' },
    { 'gemini.safety_settings': '{"default":"BLOCK_ONLY_HIGH"}' },
  ])
    assert.deepEqual(data.invalidSettingKeys(changes, {}), []);
});
