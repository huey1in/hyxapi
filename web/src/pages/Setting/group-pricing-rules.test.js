import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTestModules } from '../../../scripts/load-test-modules.mjs';
const { entry0: { validGroupPricingRule, invalidGroupPricingChanges } } = await loadTestModules(['./src/pages/Setting/group-pricing-rules.ts']);

test('account group multipliers accept explicit free prices and reject missing or invalid amounts', () => {
  assert.equal(validGroupPricingRule('GroupGroupRatio', '{"vip":{"default":0,"premium":0.8}}'), true);
  for (const raw of ['', 'null', '[]', '{"vip":null}', '{"vip":{"default":null}}', '{"vip":{"default":-1}}', '{"vip":{"default":"0.8"}}', '{"vip":{"default":1e999}}']) assert.equal(validGroupPricingRule('GroupGroupRatio', raw), false, raw);
});

test('usable group rules preserve explicit add/remove syntax and invalid drafts block saving across tabs', () => {
  const key = 'group_ratio_setting.group_special_usable_group';
  assert.equal(validGroupPricingRule(key, '{"vip":{"+:premium":"Premium","-:default":"","other":"Other"}}'), true);
  for (const raw of ['null', '{"vip":{"+:":"Premium"}}', '{"vip":{"default":null}}', '{"vip":{"default":1}}']) assert.equal(validGroupPricingRule(key, raw), false, raw);
  assert.equal(invalidGroupPricingChanges({ [key]: '{', OtherSetting: 'value' }), true);
  assert.equal(invalidGroupPricingChanges({ GroupGroupRatio: '{}', [key]: '{}' }), false);
  assert.equal(invalidGroupPricingChanges({ OtherSetting: '{' }), false);
});
