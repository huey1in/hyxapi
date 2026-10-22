export type PaymentField = [
  key: string,
  label: string,
  type?: 'json-object' | 'json-array' | 'secret' | 'number' | 'bool' | 'pem',
];
type PaymentSetupGroup = [title: string, fields: PaymentField[]];

export const paymentSetupGroups: PaymentSetupGroup[] = [
  [
    '充值选项',
    [
      ['TopUpLink', '其他充值链接'],
      ['TopupGroupRatio', '充值分组倍率', 'json-object'],
      ['payment_setting.amount_options', '预设充值数量', 'json-array'],
      ['payment_setting.amount_discount', '预设数量折扣', 'json-object'],
    ],
  ],
  [
    'Stripe',
    [
      ['StripeApiSecret', 'API Secret', 'secret'],
      ['StripeWebhookSecret', 'Webhook Secret', 'secret'],
      ['StripePriceId', '充值 Price ID'],
      ['StripeUnitPrice', '每单位价格（USD）', 'number'],
      ['StripeMinTopUp', '最低充值数量', 'number'],
      ['StripePromotionCodesEnabled', '允许促销码', 'bool'],
    ],
  ],
  [
    'Creem',
    [
      ['CreemApiKey', 'API Key', 'secret'],
      ['CreemWebhookSecret', 'Webhook Secret', 'secret'],
      ['CreemTestMode', '测试模式', 'bool'],
      ['CreemProducts', '充值商品', 'json-array'],
    ],
  ],
  [
    'Waffo',
    [
      ['WaffoEnabled', '启用 Waffo', 'bool'],
      ['WaffoSandbox', '沙箱模式', 'bool'],
      ['WaffoMerchantId', 'Merchant ID'],
      ['WaffoApiKey', 'API Key', 'secret'],
      ['WaffoPrivateKey', '私钥', 'pem'],
      ['WaffoPublicCert', '公钥证书', 'pem'],
      ['WaffoSandboxApiKey', '沙箱 API Key', 'secret'],
      ['WaffoSandboxPrivateKey', '沙箱私钥', 'pem'],
      ['WaffoSandboxPublicCert', '沙箱公钥证书', 'pem'],
      ['WaffoCurrency', '结算币种'],
      ['WaffoUnitPrice', '每单位价格', 'number'],
      ['WaffoMinTopUp', '最低充值数量', 'number'],
      ['WaffoNotifyUrl', '通知地址（可留空）'],
      ['WaffoReturnUrl', '充值返回地址（可留空）'],
      ['WaffoSubscriptionReturnUrl', '订阅返回地址（可留空）'],
      ['WaffoPayMethods', '支付方式', 'json-array'],
    ],
  ],
  [
    'Waffo Pancake',
    [
      ['WaffoPancakeMerchantID', 'Merchant ID'],
      ['WaffoPancakePrivateKey', '私钥', 'pem'],
      ['WaffoPancakeReturnURL', '返回地址（可留空）'],
      ['WaffoPancakeStoreID', 'Store ID'],
      ['WaffoPancakeProductID', '充值 Product ID'],
      ['WaffoPancakeUnitPrice', '每单位价格（USD）', 'number'],
      ['WaffoPancakeMinTopUp', '最低充值数量', 'number'],
    ],
  ],
];
