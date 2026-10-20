import { z } from 'zod';

const numeric = z.object({ balance: z.number().finite(), balance_updated_time: z.number().int().positive(), raw_response: z.never().optional() });
const raw = z.object({ raw_response: z.string().min(1).refine((value) => { try { JSON.parse(value); return true; } catch { return false; } }), balance: z.never().optional() });
const response = z.union([numeric, raw]);
export type BalanceResult = { kind: 'balance'; balance: number; updatedAt: number } | { kind: 'raw'; json: string };

export function parseBalanceResult(value: unknown): BalanceResult | null {
  const parsed = response.safeParse(value);
  if (!parsed.success) return null;
  if ('balance' in parsed.data && typeof parsed.data.balance === 'number') return { kind: 'balance', balance: parsed.data.balance, updatedAt: parsed.data.balance_updated_time };
  return { kind: 'raw', json: parsed.data.raw_response as string };
}
