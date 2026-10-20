import { z } from 'zod';

const positive = (value: unknown, fallback = 1) => Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : fallback;
const currency = z.string().regex(/^[A-Z]{3}$/);
const positiveNumber = z.number().finite().positive();
const minimum = z.number().finite().nonnegative();
export const paymentInfoSchema = z.object({
  payment_compliance_confirmed: z.boolean(),
  enable_invitation_rewards: z.boolean().default(false),
  enable_online_topup: z.boolean().optional(), enable_alipay_topup: z.boolean().optional(),
  enable_stripe_topup: z.boolean().optional(), enable_creem_topup: z.boolean().optional(),
  enable_waffo_topup: z.boolean().optional(), enable_waffo_pancake_topup: z.boolean().optional(),
  enable_stripe_subscription: z.boolean().optional(), enable_creem_subscription: z.boolean().optional(),
  enable_waffo_pancake_subscription: z.boolean().optional(), enable_redemption: z.boolean().optional(),
  min_topup: minimum.optional(), alipay_min_topup: minimum.optional(),
  stripe_min_topup: minimum.optional(), waffo_min_topup: minimum.optional(),
  waffo_pancake_min_topup: minimum.optional(), waffo_currency: currency.optional(),
  quota_display_type: z.string().optional(), quota_per_unit: positiveNumber,
  amount_options: z.array(z.number().int().positive().safe()).nullish(),
  pay_methods: z.unknown().optional(), creem_products: z.unknown().optional(), waffo_pay_methods: z.unknown().optional(),
  topup_link: z.string().optional(),
});
export type PaymentConfiguration = z.infer<typeof paymentInfoSchema>;
export type PaymentRequest = { url: string; body: Record<string, unknown> };
type Info = Partial<PaymentConfiguration>;
const record = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const array = (value: unknown): Record<string, unknown>[] => {
  try { const parsed: unknown = typeof value === 'string' ? JSON.parse(value) : value; return Array.isArray(parsed) ? parsed.map(record) : []; } catch { return []; }
};
const text = (value: unknown, fallback: string) => typeof value === 'string' && value ? value : fallback;

export type PaymentMethod = {
  id: string;
  name: string;
  provider: 'epay' | 'alipay' | 'stripe' | 'creem' | 'waffo' | 'waffo_pancake' | 'balance';
  type?: string;
  index?: number;
  min: number;
  currency: string;
  productId?: string;
  price?: number;
  quota?: number;
};

const reserved = new Set(['stripe', 'creem', 'waffo', 'waffo_pancake', 'balance']);

export function paymentMethods(info: Info | null): PaymentMethod[] {
  if (!info?.payment_compliance_confirmed) return [];
  const methods: PaymentMethod[] = [];
  if (info.enable_online_topup) {
    for (const method of array(info.pay_methods)) {
      if (typeof method?.type !== 'string' || !method.type || reserved.has(method.type)) continue;
      methods.push({ id: `epay:${method.type}`, name: text(method.name, method.type), provider: 'epay', type: method.type, min: positive(method.min_topup, positive(info.min_topup)), currency: 'CNY' });
    }
  }
  if (info.enable_alipay_topup) methods.push({ id: 'alipay-official', name: 'Alipay desktop checkout', provider: 'alipay', min: positive(info.alipay_min_topup), currency: 'CNY' });
  if (info.enable_stripe_topup) methods.push({ id: 'stripe', name: 'Stripe', provider: 'stripe', min: positive(info.stripe_min_topup), currency: 'USD' });
  if (info.enable_creem_topup) {
    for (const product of array(info.creem_products)) {
      if (typeof product.productId !== 'string' || !product.productId || typeof product.price !== 'number' || !Number.isFinite(product.price) || product.price <= 0 || typeof product.quota !== 'number' || !Number.isSafeInteger(product.quota) || product.quota <= 0 || (product.currency !== undefined && !currency.safeParse(product.currency).success)) continue;
      methods.push({ id: `creem:${product.productId}`, name: `Creem · ${text(product.name, product.productId)}`, provider: 'creem', productId: product.productId, min: 1, currency: text(product.currency, 'USD'), price: product.price, quota: product.quota });
    }
  }
  if (info.enable_waffo_pancake_topup) methods.push({ id: 'waffo_pancake', name: 'Waffo Pancake', provider: 'waffo_pancake', min: positive(info.waffo_pancake_min_topup), currency: 'USD' });
  if (info.enable_waffo_topup) {
    const list = array(info.waffo_pay_methods);
    (list.length ? list : [{ name: 'Waffo' }]).forEach((method, index) => methods.push({ id: `waffo:${index}`, name: `Waffo · ${text(method.name, 'Waffo')}`, provider: 'waffo', index: list.length ? index : undefined, min: positive(info.waffo_min_topup), currency: info.waffo_currency || 'USD' }));
  }
  return methods.filter((method, index) => methods.findIndex((item) => item.id === method.id) === index);
}

export function topUpRequest(method: PaymentMethod, units: number, info: Info, quote = false): PaymentRequest | null {
  if (!Number.isSafeInteger(units) || units < method.min) throw new Error('Enter a whole credit amount at or above the payment minimum.');
  if (method.provider === 'creem') {
    if (quote) return null;
    return { url: '/api/user/creem/pay', body: { product_id: method.productId, payment_method: 'creem' } };
  }
  let amount = units;
  if (method.provider !== 'alipay' && info.quota_display_type === 'TOKENS') amount *= positive(info.quota_per_unit, 500000);
  if (!Number.isSafeInteger(amount)) throw new Error('Top-up amount is too large.');
  const base = '/api/user';
  if (method.provider === 'alipay') return { url: quote ? `${base}/alipay/amount` : `${base}/payment/alipay/checkout`, body: { amount } };
  if (method.provider === 'epay') return { url: quote ? `${base}/amount` : `${base}/pay`, body: { amount, payment_method: method.type } };
  return { url: `${base}/${method.provider.replaceAll('_', '-')}/${quote ? 'amount' : 'pay'}`, body: { amount, payment_method: method.provider, ...(method.index !== undefined ? { pay_method_index: method.index } : {}) } };
}

export function paymentSucceeded(value: unknown) {
  const response = record(value);
  return response.success !== false && (response.success === true || response.message === 'success');
}

export function paymentError(value: unknown): string {
  const response = record(value);
  return text(typeof response.data === 'string' && response.message === 'error' ? response.data : response.message, 'Payment request failed');
}

export function safePaymentURL(value: unknown, origin: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error('Payment link is empty');
  const url = new URL(value, origin);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('Invalid payment link');
  return url.href;
}

export function checkoutDestination(value: unknown, origin: string) {
  const response = record(value);
  if (!paymentSucceeded(response)) throw new Error(paymentError(response));
  if (response.url && response.data && typeof response.data === 'object' && !Array.isArray(response.data)) {
    const fields: Record<string, string> = {};
    for (const [key, value] of Object.entries(response.data)) {
      if (!['string', 'number', 'boolean'].includes(typeof value) || (typeof value === 'number' && !Number.isFinite(value))) throw new Error('Invalid payment form');
      fields[key] = String(value);
    }
    return { url: safePaymentURL(response.url, origin), fields };
  }
  const data = record(response.data);
  return { url: safePaymentURL(data.pay_url || data.pay_link || data.checkout_url || data.payment_url, origin), fields: null };
}

// Construct form nodes through DOM APIs; gateway strings never become HTML.
export function navigateCheckout(response: unknown, popup: Window, origin: string) {
  const destination = checkoutDestination(response, origin);
  if (popup.closed) throw new Error('Payment window is closed');
  if (!destination.fields) { popup.location.replace(destination.url); return; }
  const form = popup.document.createElement('form');
  form.method = 'POST';
  form.action = destination.url;
  for (const [name, value] of Object.entries(destination.fields)) {
    const input = popup.document.createElement('input');
    input.type = 'hidden'; input.name = name; input.value = value;
    form.appendChild(input);
  }
  popup.document.body.appendChild(form);
  form.submit();
}

export function subscriptionMethods(plan: { allow_balance_pay?: boolean | null; stripe_price_id?: string; creem_product_id?: string; waffo_pancake_product_id?: string }, info: Info): PaymentMethod[] {
  if (!info.payment_compliance_confirmed) return [];
  const result: PaymentMethod[] = [];
  const entry = (provider: PaymentMethod['provider'], name: string, type?: string): PaymentMethod => ({ id: type ? `${provider}:${type}` : provider, provider, name, type, min: 1, currency: provider === 'epay' ? 'CNY' : 'USD' });
  if (plan.allow_balance_pay !== false) result.push(entry('balance', 'Account balance'));
  result.push(...paymentMethods(info).filter((method) => method.provider === 'epay'));
  if (info.enable_stripe_subscription && plan.stripe_price_id) result.push(entry('stripe', 'Stripe'));
  if (info.enable_creem_subscription && plan.creem_product_id) result.push(entry('creem', 'Creem'));
  if (info.enable_waffo_pancake_subscription && plan.waffo_pancake_product_id) result.push(entry('waffo_pancake', 'Waffo Pancake'));
  return result;
}
