import test from 'node:test';
import assert from 'node:assert/strict';
import { subscriptionNamesSchema, subscriptionSelfSchema, userSubscriptionSchema, isActiveSubscription, subscriptionState, subscriptionUsage } from './subscription-data.ts';

const sub = { id: 1, user_id: 1, plan_id: 1, amount_total: 100, amount_used: 40, start_time: 100, end_time: 200, status: 'active', source: 'order', last_reset_time: 0, next_reset_time: 150, allowed_groups: '["pro"]', allowed_models: '["gpt-test"]', concurrent_limit: 2, rpm_limit: 10, allow_wallet_overflow: false, upgrade_group: 'pro', downgrade_group: '', prev_user_group: 'default' };
test('subscription DTO validates actual quota, restrictions and billing preference', () => {
  const data = subscriptionSelfSchema.parse({ billing_preference: 'subscription_first', all_subscriptions: [{ subscription: sub }] });
  assert.deepEqual(data.all_subscriptions[0].subscription.allowed_groups, ['pro']); assert.equal(data.all_subscriptions[0].subscription.allow_wallet_overflow, false);
  for (const patch of [{ amount_used: -1 }, { amount_total: NaN }, { amount_total: '100' }, { allowed_models: '{}' }, { allowed_models: '[1]' }, { next_reset_time: Number.MAX_SAFE_INTEGER }, { allow_wallet_overflow: 'false' }]) assert.equal(userSubscriptionSchema.safeParse({ ...sub, ...patch }).success, false);
  assert.equal(subscriptionSelfSchema.safeParse({ billing_preference: 'unrecognized', all_subscriptions: [] }).success, false);
  assert.equal(subscriptionSelfSchema.safeParse({ billing_preference: 'wallet_only', }).success, false);
});
test('restriction lists accept empty restrictions but reject objects and non-string names', () => {
  assert.deepEqual(subscriptionNamesSchema.parse(''), []); assert.deepEqual(subscriptionNamesSchema.parse('[]'), []);
  for (const raw of ['null', '{}', '"pro"', '[null]', '[{}]', '[true]', '{invalid']) assert.equal(subscriptionNamesSchema.safeParse(raw).success, false);
});
test('active and expired states match backend strict end time and preserve cancellation', () => {
  assert.equal(isActiveSubscription(sub, 199), true); assert.equal(isActiveSubscription(sub, 200), false);
  assert.equal(isActiveSubscription({ ...sub, end_time: 0 }, 100), false);
  assert.equal(isActiveSubscription({ ...sub, status: 'cancelled' }, 199), false);
  assert.equal(subscriptionState(sub, 200), 'Expired'); assert.equal(subscriptionState({ ...sub, status: 'cancelled' }, 300), 'Cancelled');
  assert.equal(subscriptionState({ ...sub, end_time: 0 }, 100), 'Inactive');
});
test('usage distinguishes unlimited from exhausted and clamps overshoot for display', () => {
  assert.deepEqual(subscriptionUsage(sub), { unlimited: false, remaining: 60, percent: 40 });
  assert.deepEqual(subscriptionUsage({ amount_total: 0, amount_used: 200 }), { unlimited: true, remaining: null, percent: 0 });
  assert.deepEqual(subscriptionUsage({ amount_total: 100, amount_used: 110 }), { unlimited: false, remaining: 0, percent: 100 });
});
