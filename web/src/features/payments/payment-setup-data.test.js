import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTestModules } from '../../../scripts/load-test-modules.mjs';

const {
  entry0: {
    pancakeCatalogSchema,
    pancakeBindingSchema,
    parsePaymentSetupReply,
    PancakeOrphanStoreError,
    validPaymentSetting,
    remainingSettingDrafts,
  },
} = await loadTestModules(['./src/features/payments/payment-setup-data.ts']);

test('Pancake configuration rejects malformed catalog and binding acknowledgements', () => {
  assert.deepEqual(
    parsePaymentSetupReply(
      { message: 'success', data: { stores: null } },
      pancakeCatalogSchema,
    ).stores,
    [],
  );
  for (const value of [
    { stores: {} },
    { stores: [{ id: 'store', onetimeProducts: [] }] },
  ])
    assert.throws(() =>
      parsePaymentSetupReply(
        { message: 'success', data: value },
        pancakeCatalogSchema,
      ),
    );
  for (const value of [
    { store_id: 'store' },
    { store_id: '', product_id: 'product' },
  ])
    assert.throws(() =>
      parsePaymentSetupReply(
        { message: 'success', data: value },
        pancakeBindingSchema,
      ),
    );
});
test('an orphan store is retained only after validating the explicit failure response', () => {
  assert.throws(
    () =>
      parsePaymentSetupReply(
        {
          message: 'error',
          data: {
            orphan_store: true,
            store_id: 'kept',
            error: 'product failed',
          },
        },
        pancakeBindingSchema,
      ),
    (error) =>
      error instanceof PancakeOrphanStoreError && error.storeID === 'kept',
  );
  assert.throws(() =>
    parsePaymentSetupReply(
      {
        success: false,
        message: 'success',
        data: { store_id: 's', product_id: 'p' },
      },
      pancakeBindingSchema,
    ),
  );
  assert.throws(
    () =>
      parsePaymentSetupReply(
        { message: 'error', data: { orphan_store: true, store_id: 7 } },
        pancakeBindingSchema,
      ),
    (error) => !(error instanceof PancakeOrphanStoreError),
  );
});
test('financial configuration rejects blank, nonfinite, fractional limits and corrupt products across tabs', () => {
  for (const value of ['', ' ', '0', '-1', 'NaN', 'Infinity'])
    assert.equal(validPaymentSetting('StripeUnitPrice', value), false);
  assert.equal(validPaymentSetting('StripeUnitPrice', '0.01'), true);
  for (const value of ['', '0', '1.5', '9007199254740992'])
    assert.equal(validPaymentSetting('WaffoMinTopUp', value), false);
  assert.equal(
    validPaymentSetting('payment_setting.amount_options', '[1,20]'),
    true,
  );
  assert.equal(
    validPaymentSetting('payment_setting.amount_options', 'null'),
    false,
  );
  assert.equal(validPaymentSetting('TopupGroupRatio', '{"default":0}'), false);
  assert.equal(
    validPaymentSetting('payment_setting.amount_discount', '{"20":0.9}'),
    true,
  );
  assert.equal(
    validPaymentSetting('WaffoPayMethods', '[{"name":"Card"}]'),
    false,
  );
  assert.equal(
    validPaymentSetting(
      'CreemProducts',
      '[{"productId":"p","price":1,"quota":1,"currency":"USD"},{"productId":"p","price":1,"quota":1,"currency":"USD"}]',
    ),
    false,
  );
});
test('provider confirmation clears only acknowledged settings and preserves unrelated or newer drafts', () => {
  assert.deepEqual(
    remainingSettingDrafts(
      {
        Notice: 'new',
        WaffoPancakeStoreID: 'newer',
        WaffoPancakeProductID: 'saved',
      },
      { WaffoPancakeStoreID: 'old', WaffoPancakeProductID: 'saved' },
    ),
    { Notice: 'new', WaffoPancakeStoreID: 'newer' },
  );
});
