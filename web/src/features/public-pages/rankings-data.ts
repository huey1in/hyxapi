import { z } from 'zod';
export { modelPricingLink } from '../../lib/model-pricing-route';

const count = z.number().finite().nonnegative();
const rank = z.number().int().positive();
const share = z.number().finite().min(0).max(1);
const growth = z.number().finite();
const rows = <T extends z.ZodType>(schema: T) => z.array(schema).nullable().transform((value) => value ?? []);
const entity = { vendor: z.string(), vendor_icon: z.string().optional(), total_tokens: count, share, growth_pct: growth };
const rankedModel = z.object({ ...entity, rank, previous_rank: rank.optional(), model_name: z.string(), category: z.string() });
const rankedVendor = z.object({ ...entity, rank, models_count: count, top_model: z.string() });
const mover = z.object({ model_name: z.string(), vendor: z.string(), vendor_icon: z.string().optional(), rank_delta: z.number().int(), current_rank: rank, growth_pct: growth });
export const rankingsSchema = z.object({
  models: rows(rankedModel), vendors: rows(rankedVendor), top_movers: rows(mover), top_droppers: rows(mover),
  models_history: z.object({ points: rows(z.object({ ts: z.string(), label: z.string(), model: z.string(), vendor: z.string(), tokens: count })), models: rows(z.object({ name: z.string(), vendor: z.string(), total: count })), buckets: count }),
  vendor_share_history: z.object({ points: rows(z.object({ ts: z.string(), label: z.string(), vendor: z.string(), tokens: count, share })), vendors: rows(z.object({ name: z.string(), total: count, share })), buckets: count }),
});
export type RankingsSnapshot = z.infer<typeof rankingsSchema>;
export type RankingPeriod = 'today' | 'week' | 'month' | 'year';
export const rankingPeriods: { value: RankingPeriod; label: string }[] = [{ value: 'today', label: 'Today' }, { value: 'week', label: 'Week' }, { value: 'month', label: 'Month' }, { value: 'year', label: 'Year' }];
export function rankingPeriod(raw: string | null): RankingPeriod { return raw === 'today' || raw === 'month' || raw === 'year' ? raw : 'week'; }
export const vendorPricingLink = (vendor: string) => '/pricing?' + new URLSearchParams({ vendor }).toString();

export interface HistoryPoint { ts: string; label: string; name: string; value: number }
export interface HistoryBucket { ts: string; label: string; values: Record<string, number>; total: number }
export function historyMatrix(points: HistoryPoint[], order: string[]): { entities: string[]; buckets: HistoryBucket[] } {
  const entities = [...new Set([...order, ...points.map((point) => point.name)])];
  const grouped = new Map<string, HistoryBucket>();
  for (const point of points) {
    const bucket = grouped.get(point.ts) ?? { ts: point.ts, label: point.label, values: Object.create(null) as Record<string, number>, total: 0 };
    bucket.values[point.name] = (bucket.values[point.name] ?? 0) + point.value;
    bucket.total += point.value; grouped.set(point.ts, bucket);
  }
  return { entities, buckets: [...grouped.values()].sort((a, b) => a.ts.localeCompare(b.ts)) };
}
