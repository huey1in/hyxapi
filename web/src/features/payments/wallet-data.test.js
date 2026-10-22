import test from 'node:test';
import assert from 'node:assert/strict';
import { affiliateURL, isUnknownSubscriptionCode, transferQuota, walletProfileSchema, topUpPageSchema, subscriptionOffersSchema } from './wallet-data.ts';
import { paymentInfoSchema, paymentMethods } from './payment-core.ts';

test('wallet financial fields reject corrupted values without disguising them as zero; debt balances remain valid', () => {
  const user = { id: 1, username: 'user', role: 1, quota: -10, used_quota: 0, aff_count: 0, aff_quota: 500000, aff_history_quota: 500000 };
  assert.equal(walletProfileSchema.parse(user).quota, -10);
  for (const patch of [{ quota: NaN }, { used_quota: -1 }, { aff_quota: Infinity }, { aff_quota: 1.5 }, { aff_count: '1' }, { id: 0 }]) assert.equal(walletProfileSchema.safeParse({ ...user, ...patch }).success, false);
});
test('payment configuration and product currencies validate before they become payment choices', () => {
  const info = { quota_per_unit: 500000, enable_creem_topup: true, creem_products: [{ productId: 'unsafe', price: 1, quota: 1, currency: 'javascript:' }] };
  assert.equal(paymentInfoSchema.safeParse(info).success, true);
  assert.equal(paymentInfoSchema.safeParse({ ...info, min_topup: 0 }).success, true);
  assert.deepEqual(paymentMethods(info), []);
  for (const patch of [{ quota_per_unit: 0 }, { min_topup: -1 }, { amount_options: [1, 1.5] }, { waffo_currency: 'notcurrency' }]) assert.equal(paymentInfoSchema.safeParse({ ...info, ...patch }).success, false);
});
test('reward transfers enforce integer quota, minimum, available balance and full-balance rounding', () => {
  for (const amount of ['', ' ', '0', '-1', '0.99', 'Infinity', 'NaN', '1.500002', '9007199254740991']) assert.equal(transferQuota(amount, 500000, 750000), null);
  assert.equal(transferQuota('1', 500000, 750000), 500000);
  assert.equal(transferQuota(String(750001 / 500000), 500000, 750001), 750001);
  assert.equal(transferQuota('1', 0, 750000), null);
  assert.equal(transferQuota('1', 500000, NaN), null);
});
test('subscription code fallback only accepts explicit missing-code errors', () => {
  assert.equal(isUnknownSubscriptionCode({ success: false, message: '无效的兑换码' }), true);
  assert.equal(isUnknownSubscriptionCode({ success: false, message: 'Invalid redemption code' }), true);
  for (const message of ['该兑换码已被使用', '该兑换码已过期', 'invalid user', 'invalid database connection', 'Network Error', '']) assert.equal(isUnknownSubscriptionCode({ success: false, message }), false);
  assert.equal(isUnknownSubscriptionCode({ success: true, message: '无效的兑换码' }), false);
  assert.equal(isUnknownSubscriptionCode(null), false);
});
test('invitation links use the merged site origin and encode the exact affiliate code', () => {
  const link = new URL(affiliateURL('a&mode=login#测试', 'https://hyxware.example/console'));
  assert.equal(link.origin, 'https://hyxware.example'); assert.equal(link.pathname, '/auth');
  assert.equal(link.searchParams.get('mode'), 'register'); assert.equal(link.searchParams.get('aff'), 'a&mode=login#测试'); assert.equal(link.hash, '');
});
test('history requires valid money and pagination, and accepts an empty backend list', () => {
  const page = { total: 0, page: 1, page_size: 20, items: null };
  assert.deepEqual(topUpPageSchema.parse(page).items, []);
  const row = { id: 1, user_id: 1, amount: 1, money: 1, trade_no: 'trade', payment_method: 'alipay', payment_provider: 'epay', create_time: 0, complete_time: 0, status: 'pending' };
  assert.equal(topUpPageSchema.safeParse({ ...page, total: 1, items: [row] }).success, true);
  assert.equal(topUpPageSchema.safeParse({ ...page, items: [{ ...row, money: -1 }] }).success, false);
  assert.equal(topUpPageSchema.safeParse({ ...page, page_size: 0 }).success, false);
});
test('subscription prices and custom duration do not turn invalid data into free purchases', () => {
  const plan = { id: 1, title: 'Plan', subtitle: '', currency: 'USD', price_amount: 0, duration_unit: 'custom', duration_value: 0, custom_seconds: 60, total_amount: 0, max_purchase_per_user: 0, upgrade_group: '', stripe_price_id: '', creem_product_id: '', waffo_pancake_product_id: '' };
  assert.equal(subscriptionOffersSchema.safeParse([{ plan }]).success, true);
  for (const patch of [{ price_amount: -1 }, { price_amount: '1' }, { price_amount: NaN }, { currency: '' }, { custom_seconds: 0 }, { duration_unit: 'month', duration_value: 0 }]) assert.equal(subscriptionOffersSchema.safeParse([{ plan: { ...plan, ...patch } }]).success, false);
});
