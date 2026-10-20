import { z } from 'zod';
import { paymentError, paymentSucceeded } from './payment-core';

const id = z.string().trim().min(1);
const positive = z.number().finite().positive();
const quota = z.number().int().positive().safe();
const product = z.object({ id, name: z.string(), status: z.string() });
export const pancakeCatalogSchema = z.object({
  stores: z
    .array(
      z.object({
        id,
        name: z.string(),
        status: z.string(),
        prodEnabled: z.boolean(),
        onetimeProducts: z
          .array(product)
          .nullable()
          .transform((value) => value ?? []),
      }),
    )
    .nullable()
    .transform((value) => value ?? []),
});
export const pancakeBindingSchema = z.object({ store_id: id, product_id: id });
export const complianceConfirmationSchema = z.object({
  confirmed: z.literal(true),
  terms_version: id,
  confirmed_at: z.number().int().positive().safe(),
  confirmed_by: z.number().int().positive().safe(),
});
export type PancakeStore = z.output<
  typeof pancakeCatalogSchema
>['stores'][number];
export type PancakeCredentials = {
  merchant_id: string;
  private_key: string;
  return_url: string;
};

export class PancakeOrphanStoreError extends Error {
  storeID: string;
  constructor(storeID: string) {
    super(
      'The store was created, but the product failed. The store ID is preserved; select a product before binding.',
    );
    this.storeID = storeID;
  }
}

export function parsePaymentSetupReply<T extends z.ZodType>(
  value: unknown,
  schema: T,
): z.output<T> {
  if (!paymentSucceeded(value)) {
    const orphan = z
      .object({
        data: z.object({ orphan_store: z.literal(true), store_id: id }),
      })
      .safeParse(value);
    if (orphan.success)
      throw new PancakeOrphanStoreError(orphan.data.data.store_id);
    const details = z
      .object({ data: z.object({ error: z.string().min(1) }) })
      .safeParse(value);
    throw new Error(
      details.success ? details.data.data.error : paymentError(value),
    );
  }
  const envelope = z.object({ data: z.unknown() }).safeParse(value);
  if (!envelope.success)
    throw new Error('Invalid payment configuration response');
  const parsed = schema.safeParse(envelope.data.data);
  if (!parsed.success)
    throw new Error('Invalid payment configuration response');
  return parsed.data;
}

const positiveRatioMap = z.record(id, positive);
const creemProducts = z
  .array(
    z.object({
      productId: id,
      price: positive,
      quota,
      name: z.string().optional(),
      currency: z.string().regex(/^[A-Za-z]{3}$/),
    }),
  )
  .refine(
    (rows) => new Set(rows.map((row) => row.productId)).size === rows.length,
  );
const waffoMethods = z.array(z.object({ name: id, payMethodType: id }));
const paymentJSON: Record<string, z.ZodType> = {
  TopupGroupRatio: positiveRatioMap,
  'payment_setting.amount_options': z.array(quota).max(30),
  'payment_setting.amount_discount': z.record(
    z.string().regex(/^[1-9]\d*$/),
    positive,
  ),
  CreemProducts: creemProducts,
  WaffoPayMethods: waffoMethods,
};
const unitPrices = new Set([
  'Price',
  'StripeUnitPrice',
  'WaffoUnitPrice',
  'WaffoPancakeUnitPrice',
]);
const minimums = new Set([
  'MinTopUp',
  'StripeMinTopUp',
  'WaffoMinTopUp',
  'WaffoPancakeMinTopUp',
]);
export function validPaymentSetting(key: string, value: string): boolean {
  if (unitPrices.has(key))
    return value.trim() !== '' && positive.safeParse(Number(value)).success;
  if (minimums.has(key))
    return value.trim() !== '' && quota.safeParse(Number(value)).success;
  if (key === 'WaffoCurrency') return /^[A-Z]{3}$/.test(value);
  const schema = paymentJSON[key];
  if (!schema) return true;
  if (value === '' && (key === 'CreemProducts' || key === 'WaffoPayMethods'))
    return true;
  try {
    return schema.safeParse(JSON.parse(value)).success;
  } catch {
    return false;
  }
}
export function invalidPaymentSettings(
  changes: Record<string, string>,
): boolean {
  return Object.entries(changes).some(
    ([key, value]) => !validPaymentSetting(key, value),
  );
}

// A provider action can persist a subset while other settings remain unsaved.
// Retain any newer edits made after the action captured its request.
export function remainingSettingDrafts(
  pending: Record<string, string>,
  persisted: Record<string, string>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(pending).filter(([key, value]) => persisted[key] !== value),
  );
}
