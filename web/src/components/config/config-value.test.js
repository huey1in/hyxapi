import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTestModules } from '../../../scripts/load-test-modules.mjs';

const { entry0: values, entry1: settings, entry2: payments, entry3: groups, entry4: shapes } = await loadTestModules([
  './src/components/config/config-value.ts', './src/pages/Setting/setting-data.ts',
  './src/features/payments/payment-setup-data.ts', './src/pages/Setting/group-pricing-rules.ts',
  './src/pages/Setting/setting-config-shapes.ts',
]);

test('visual fields round trip nested configuration without coercing values or dropping unknown fields', () => {
  const fixtures = [null, false, 0, '', [], {}, {
    model: { headers: { 'X-Flags': ['first', '', 'second'] } },
    facts: { enabled: false, count: 0, description: 'false', optional: null, nested: [{ future: true }] },
  }, JSON.parse('{"__proto__":{"safe":true},"constructor":"literal","":"empty key"}')];
  for (const fixture of fixtures) {
    assert.deepEqual(JSON.parse(values.serializeConfig(values.configNode(fixture))), fixture);
  }
  assert.equal({}.safe, undefined);
});

test('incomplete and duplicate fields remain drafts instead of overwriting saved values', () => {
  const node = values.configNode({ first: 1, second: 2 });
  node.children[1].key = 'first';
  assert.equal(values.serializeConfig(node), null);
  node.children[1].key = 'second';
  for (const value of ['', ' ', 'Infinity', 'NaN']) {
    node.children[1].node.value = value;
    assert.equal(values.serializeConfig(node), null);
  }
  node.children[1].node.value = '0';
  assert.deepEqual(JSON.parse(values.serializeConfig(node)), { first: 1, second: 0 });
});

test('editing affinity sources and templates retains optional legacy flags and future fields', () => {
  const fixture = [{ name: 'session', key_sources: [{ type: 'gjson', path: 'metadata.session', future: ['keep'] }],
    ttl_seconds: 0, session_mode: 'inherit', model_regex: null,
    param_override_template: { temperature: 0, stream: false, metadata: { note: '123', flag: null } }, future: { keep: true } }];
  const node = values.configNode(fixture);
  const source = node.children[0].node.children.find((child) => child.key === 'key_sources').node.children[0].node;
  source.children.find((child) => child.key === 'path').node.value = 'metadata.session_id';
  const serialized = values.serializeConfig(node, (raw) => settings.parseJSON(raw, settings.settingJSON['channel_affinity_setting.rules']) !== null);
  assert.ok(serialized);
  const expected = structuredClone(fixture); expected[0].key_sources[0].path = 'metadata.session_id';
  assert.deepEqual(JSON.parse(serialized), expected);
});

test('group rules and payment drafts keep zero prices, directive prefixes, order and provider metadata', () => {
  const fixtures = {
    GroupGroupRatio: { vip: { default: 0, premium: 0.8 } },
    'group_ratio_setting.group_special_usable_group': { vip: { '+:premium': 'Premium', '-:default': '', standard: 'Standard' } },
    TopupGroupRatio: { vip: 0.8 },
    'payment_setting.amount_options': [30, 10, 20],
    'payment_setting.amount_discount': { 10: 1, 30: 0.9 },
    CreemProducts: [{ productId: 'prod_test', price: 10, currency: 'USD', quota: 5000000, future: { retain: true } }],
    WaffoPayMethods: [{ name: 'Card', payMethodType: 'CREDITCARD,DEBITCARD', payMethodName: '', future: false }],
  };
  for (const [key, fixture] of Object.entries(fixtures)) {
    const validate = (raw) => key.startsWith('Group') || key.startsWith('group_ratio') ? groups.validGroupPricingRule(key, raw) : payments.validPaymentSetting(key, raw);
    const serialized = values.serializeConfig(values.configNode(fixture), validate);
    assert.ok(serialized, key);
    assert.deepEqual(JSON.parse(serialized), fixture);
  }
  const invalidProduct = values.configNode([{ productId: '', price: 0, quota: 0, currency: 'USD' }]);
  assert.equal(values.serializeConfig(invalidProduct, (raw) => payments.validPaymentSetting('CreemProducts', raw)), null);
});

test('response policy validates all visual selectors and preserves extension fields', () => {
  const key = 'global.chat_completions_to_responses_policy';
  const valid = { enabled: true, all_channels: false, channel_ids: [1], channel_types: [1, 14], model_patterns: ['gpt-*'], future: { keep: false } };
  assert.deepEqual(JSON.parse(values.serializeConfig(values.configNode(valid), (raw) => settings.parseJSON(raw, settings.settingJSON[key]) !== null)), valid);
  for (const patch of [{ channel_ids: ['1'] }, { channel_ids: [1.5] }, { channel_types: [-1] }, { model_patterns: [true] }]) {
    assert.deepEqual(settings.invalidSettingKeys({ [key]: JSON.stringify({ ...valid, ...patch }) }, {}), [key]);
  }
});

test('new announcement rows receive a publication timestamp only when created', () => {
  const shape = shapes.settingConfigShapes['console_setting.announcements'].entry;
  const row = values.initialValue(shape);
  assert.ok(Number.isFinite(Date.parse(row.publishDate)));
  const existing = { content: 'Existing', type: 'default', publishDate: '2025-01-01T00:00:00Z', extra: '' };
  assert.deepEqual(values.readConfig(values.configNode(existing)), existing);
});
