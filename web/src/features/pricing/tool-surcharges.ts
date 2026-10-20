import { z } from 'zod';

const chargeSchema = z.object({ name: z.string().min(1), count: z.number().int().positive(), price: z.number().finite().nonnegative() });
export type ToolSurcharge = z.infer<typeof chargeSchema>;
export function parseToolSurcharges(value: unknown) {
  if (!Array.isArray(value)) return { items: [], invalid: value != null };
  const items: ToolSurcharge[] = [];
  let invalid = false;
  for (const item of value) {
    const result = chargeSchema.safeParse(item);
    if (result.success) items.push(result.data); else invalid = true;
  }
  return { items, invalid };
}
