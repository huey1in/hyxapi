import { z } from 'zod';

const count = z.number().finite().nonnegative();
const record = z.object({ status: z.string(), latency: count, checked_at: count, total: count, errors: count, prompt_tokens: count, cache_tokens: count });
export const healthSchema = z.array(z.object({ model: z.string(), group: z.string(), current: record.nullable(), history: z.array(record).nullable().transform((rows) => rows ?? []) })).nullable().transform((rows) => rows ?? []);
export type ModelHealthRecord = z.infer<typeof record>;
export type ModelGroupHealth = z.infer<typeof healthSchema>[number];

export function summarizeHealth(entry?: ModelGroupHealth) {
  const rows = entry?.history ?? [];
  const total = rows.reduce((sum, row) => sum + row.total, 0);
  const errors = rows.reduce((sum, row) => sum + row.errors, 0);
  const latencyRows = rows.filter((row) => row.total > 0 && row.latency > 0);
  const prompt = rows.reduce((sum, row) => sum + row.prompt_tokens, 0);
  const cached = rows.reduce((sum, row) => sum + row.cache_tokens, 0);
  return { calls: total, successRate: total > 0 ? Math.max(0, 1 - errors / total) : null, avgLatency: latencyRows.length ? latencyRows.reduce((sum, row) => sum + row.latency, 0) / latencyRows.length : null, cacheRate: prompt > 0 ? cached / prompt : null };
}
