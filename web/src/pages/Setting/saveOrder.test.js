import test from 'node:test';
import assert from 'node:assert/strict';
import { orderSettingKeysForSave } from './saveOrder.js';

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
  assert.deepEqual(orderSettingKeysForSave(['RetryTimes', 'ServerAddress']), [
    'RetryTimes',
    'ServerAddress',
  ]);
});
