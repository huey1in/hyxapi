import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTestModules } from '../../../scripts/load-test-modules.mjs';
const { entry0: { createPlanDraft, serializePlan, codeGenerationDraft } } = await loadTestModules(['./src/pages/Subscription/plan-data.ts']);
const toQuota = (amount) => Math.round(amount * 500000);

test('blank financial fields never silently create a free or unlimited subscription', () => {
  const draft = { ...createPlanDraft(), title: 'Plan' };
  assert.equal(serializePlan(draft, toQuota).price_amount, 0);
  for (const field of ['price_amount','total_amount','max_purchase_per_user','duration_value','custom_seconds','sort_order','quota_reset_custom_seconds','concurrent_limit','rpm_limit']) {
    assert.throws(() => serializePlan({ ...draft, [field]: '' }, toQuota));
    assert.throws(() => serializePlan({ ...draft, [field]: NaN }, toQuota));
  }
});
test('subscription payload validates bounds, custom periods and exact quota conversion', () => {
  const draft = { ...createPlanDraft(), title: ' Plan ', price_amount: 2, total_amount: 0.000002, allowed_models: ['gpt-test'], allowed_groups: ['pro'] };
  const result = serializePlan(draft, toQuota);
  assert.equal(result.title, 'Plan'); assert.equal(result.total_amount, 1); assert.equal(result.currency, 'USD'); assert.equal(result.allowed_models, '["gpt-test"]'); assert.equal('id' in result, false);
  for (const patch of [{ price_amount: -1 }, { price_amount: 10000 }, { price_amount: 0.0000001 }, { total_amount: -1 }, { total_amount: -0.0000001 }, { total_amount: 0.0000001 }, { max_purchase_per_user: 1.5 }, { duration_value: 0 }, { duration_unit: 'custom', custom_seconds: 0 }, { quota_reset_period: 'custom', quota_reset_custom_seconds: 0 }]) assert.throws(() => serializePlan({ ...draft, ...patch }, toQuota));
  assert.throws(() => serializePlan(draft, () => Infinity));
  assert.equal(serializePlan({ ...draft, duration_unit: 'custom', duration_value: 0, custom_seconds: 60, quota_reset_period: 'custom', quota_reset_custom_seconds: 30 }, toQuota).custom_seconds, 60);
});
test('activation code generation preserves invalid drafts and rejects past or malformed expiry', () => {
  for (const count of ['',0,-1,1.5,201,NaN,Infinity]) assert.equal(codeGenerationDraft(count, ''), null);
  for (const expiry of ['invalid','2020-01-01T00:00']) assert.equal(codeGenerationDraft(1, expiry), null);
  assert.deepEqual(codeGenerationDraft(200, ''), { count: 200, expired_time: 0 });
  assert.equal(codeGenerationDraft(1, '2030-01-01T00:00', Date.UTC(2026,0,1)).count, 1);
});
