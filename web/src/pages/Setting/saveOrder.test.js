import test from 'node:test';
import assert from 'node:assert/strict';
import { orderSettingKeysForSave } from './saveOrder.js';

test('saves USDT merchant credentials before enabling checkout', () => {
  assert.deepEqual(orderSettingKeysForSave(['usdt.enabled', 'usdt.gateway_url', 'usdt.merchant_id', 'usdt.api_key']), ['usdt.gateway_url', 'usdt.merchant_id', 'usdt.api_key', 'usdt.enabled']);
});

test('saves Alipay credentials before enabling Alipay', () => {
  const keys = [
    'AlipayEnabled',
    'AlipayAppId',
    'AlipayPrivateKey',
    'AlipayPublicKey',
    'AlipayGateway',
  ];

  assert.deepEqual(orderSettingKeysForSave(keys), [
    'AlipayAppId',
    'AlipayPrivateKey',
    'AlipayPublicKey',
    'AlipayGateway',
    'AlipayEnabled',
  ]);
});

test('preserves the order of unrelated settings', () => {
  assert.deepEqual(orderSettingKeysForSave(['RetryTimes', 'SMTPServer']), [
    'RetryTimes',
    'SMTPServer',
  ]);
});

test('saves OAuth credentials before enabling the provider', () => {
  assert.deepEqual(orderSettingKeysForSave(['TelegramOAuthEnabled', 'telegram.client_id', 'telegram.client_secret']), [
    'telegram.client_id', 'telegram.client_secret', 'TelegramOAuthEnabled',
  ]);
});

test('saves Google credentials before enabling Google sign-in', () => {
  assert.deepEqual(orderSettingKeysForSave(['google.enabled', 'google.client_id', 'google.client_secret']), [
    'google.client_id', 'google.client_secret', 'google.enabled',
  ]);
});

test('saves both reward amounts before enabling invitation rewards', () => {
  assert.deepEqual(orderSettingKeysForSave([
    'payment_setting.invitation_rewards_enabled', 'QuotaForInviter', 'QuotaForInvitee',
  ]), ['QuotaForInviter', 'QuotaForInvitee', 'payment_setting.invitation_rewards_enabled']);
});
