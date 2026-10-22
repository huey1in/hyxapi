import type { ConfigShape } from '../../components/config/config-value';

const text: ConfigShape = { type: 'string' };
const positive: ConfigShape = { type: 'number', min: 0 };
export const paymentConfigShapes: Record<string, ConfigShape> = {
  TopupGroupRatio: { type: 'object', keyLabel: 'Group name', entry: { ...positive, initial: 1 } },
  'payment_setting.amount_options': { type: 'array', itemLabel: 'Top-up amount', entry: { ...positive, initial: 10 } },
  'payment_setting.amount_discount': { type: 'object', keyLabel: 'Top-up amount', entry: { ...positive, initial: 1 } },
  CreemProducts: {
    type: 'array', itemLabel: 'Product', entry: {
      type: 'object', initial: { productId: '', name: '', price: 10, currency: 'USD', quota: 5000000 },
      fields: {
        productId: { ...text, label: 'Product ID' }, name: { ...text, label: 'Name' },
        price: { ...positive, label: 'Price' }, currency: { ...text, label: 'Currency' },
        quota: { ...positive, label: 'Credited quota (internal units)' },
      },
    },
  },
  WaffoPayMethods: {
    type: 'array', itemLabel: 'Payment method', entry: {
      type: 'object', initial: { name: '', payMethodType: 'CREDITCARD,DEBITCARD', payMethodName: '' },
      fields: {
        name: { ...text, label: 'Name' }, payMethodType: { ...text, label: 'Payment method types' },
        payMethodName: { ...text, label: 'Payment method name' },
      },
    },
  },
};
