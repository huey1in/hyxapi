import test from 'node:test';
import assert from 'node:assert/strict';
import { paymentInfoSchema, paymentMethods, topUpRequest, checkoutDestination, safePaymentURL, subscriptionMethods } from './payment-core.ts';

const info = { enable_online_topup: true, pay_methods: [{ type: 'alipay' }, { type: 'stripe' }, { type: 'alipay' }], min_topup: 2, enable_stripe_topup: true, stripe_min_topup: 1 };

test('USDT is explicitly enabled, prices USD credits and preserves units in token display mode', () => {
  const config = { enable_usdt_topup: true, usdt_min_topup: 5, quota_display_type: 'TOKENS', quota_per_unit: 500000 };
  const [method] = paymentMethods(config);
  assert.equal(method.currency, 'USD');
  assert.deepEqual(topUpRequest(method, 10, config), { url: '/api/user/usdt/pay', body: { amount: 10, payment_method: 'usdt' } });
  assert.equal(topUpRequest(method, 10, config, true).url, '/api/user/usdt/amount');
  assert.throws(() => topUpRequest(method, 4, config));
  assert.equal(paymentMethods({ enable_online_topup: true, pay_methods: [{ type: 'usdt' }] }).length, 0);
  assert.equal(paymentMethods({ enable_usdt_topup: false }).length, 0);
});

test('wallet invitation rewards require an explicit boolean opt-in', () => {
  const config = { ...info, quota_per_unit: 500000 };
  assert.equal(paymentInfoSchema.parse(config).enable_invitation_rewards, false);
  assert.equal(paymentInfoSchema.parse({ ...config, enable_invitation_rewards: true }).enable_invitation_rewards, true);
  assert.equal(paymentInfoSchema.safeParse({ ...config, enable_invitation_rewards: 'true' }).success, false);
});

test('only enabled providers produce selectable methods', () => {
  assert.deepEqual(paymentMethods(null), []);
  assert.deepEqual(paymentMethods({}), []);
  assert.deepEqual(paymentMethods(info).map((m) => m.id), ['epay:alipay', 'stripe']);
  assert.equal(paymentMethods({ ...info, enable_online_topup: false })[0].provider, 'stripe');
});

test('quotes and checkouts use identical canonical amount units; legacy Alipay retains USD units', () => {
  const tokens = { ...info, quota_display_type: 'TOKENS', quota_per_unit: 500000, enable_alipay_topup: true };
  const [epay, alipay, stripe] = paymentMethods(tokens);
  for (const method of [epay, stripe]) {
    assert.equal(topUpRequest(method, 20, tokens, true).body.amount, 10000000);
    assert.equal(topUpRequest(method, 20, tokens).body.amount, 10000000);
  }
  assert.equal(topUpRequest(alipay, 20, tokens).body.amount, 20);
  assert.throws(() => topUpRequest(stripe, 1.5, tokens));
  assert.throws(() => topUpRequest(epay, 1, tokens));
  assert.throws(() => topUpRequest(stripe, Number.MAX_SAFE_INTEGER, tokens));
});

test('Creem fixed products retain quota units and Waffo sends server method index', () => {
  const list = paymentMethods({ ...info, enable_creem_topup: true, creem_products: JSON.stringify([{ productId: 'p1', name: 'Starter', price: 3, quota: 500000 }, { productId: 'bad', price: -1, quota: 1 }]), enable_waffo_topup: true, waffo_pay_methods: [{ name: 'Card' }, { name: 'Apple Pay' }] });
  const product = list.find((m) => m.provider === 'creem');
  assert.equal(product.quota, 500000);
  assert.equal(topUpRequest(product, 1, info, true), null);
  assert.equal(topUpRequest(product, 1, info).body.product_id, 'p1');
  assert.equal(topUpRequest(list.find((m) => m.id === 'waffo:1'), 2, info).body.pay_method_index, 1);
});

test('checkout URLs and form fields reject active content and malformed results', () => {
  const origin = 'https://hyxware.example';
  for (const value of ['javascript:alert(1)', 'data:text/html,test', 'https://user:secret@pay.example', '']) assert.throws(() => safePaymentURL(value, origin));
  assert.equal(safePaymentURL('/payment', origin), `${origin}/payment`);
  for (const field of ['pay_url', 'pay_link', 'checkout_url', 'payment_url']) assert.equal(checkoutDestination({ message: 'success', data: { [field]: 'https://pay.example/checkout' } }, origin).url, 'https://pay.example/checkout');
  const fields = { name: '<img src=x onerror=alert(1)>', sign: 'signature' };
  assert.deepEqual(checkoutDestination({ message: 'success', url: 'https://pay.example/submit', data: fields }, origin).fields, fields);
  assert.throws(() => checkoutDestination({ success: false, message: 'success', data: { pay_url: '/checkout' } }, origin));
  assert.throws(() => checkoutDestination({ message: 'success', url: '/checkout', data: { nested: {} } }, origin));
});

test('subscription payment choices respect per-plan IDs and disabled balance without requiring topup products', () => {
  const config = { enable_stripe_subscription: true, enable_creem_subscription: true, enable_waffo_pancake_subscription: true };
  const plan = { stripe_price_id: 'price_1', creem_product_id: 'prod_1', waffo_pancake_product_id: 'p1', allow_balance_pay: false };
  assert.deepEqual(subscriptionMethods(plan, config).map((m) => m.provider), ['stripe', 'creem', 'waffo_pancake']);
  assert.deepEqual(subscriptionMethods({}, config).map((m) => m.provider), ['balance']);
});
