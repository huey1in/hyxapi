import { z } from 'zod';

const count = z.number().int().nonnegative();
export const usageBucketSchema = z.object({
  bucket_start: count, quota: z.number().finite().default(0), requests: count.default(0),
  tokens: count.default(0), prompt_tokens: count.default(0), completion_tokens: count.default(0), cache_tokens: count.default(0),
});
export const usageRowsSchema = z.array(usageBucketSchema).nullish().transform((rows) => rows ?? []);
export const dashboardStatsSchema = z.object({
  quota: z.number().finite(), tokens: count, requests: count, rpm: count, tpm: count,
  token_usage: usageRowsSchema.optional(),
});
export const dashboardProfileSchema = z.object({ quota: z.number().finite(), used_quota: z.number().finite(), request_count: count });
export type UsageBucket = z.infer<typeof usageBucketSchema>;
export function dashboardRange(days: number, bucketCount: number, now = new Date()) {
  const start = new Date(now); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - days + 1);
  return { start_timestamp: Math.floor(start.getTime() / 1000), end_timestamp: Math.floor(now.getTime() / 1000), bucket_seconds: Math.ceil(days * 86400 / bucketCount) };
}
export function allowedUsageDays(role: number, maxRangeDays: unknown): number[] {
  return [1, 7, 30].filter((days) => role >= 10 || typeof maxRangeDays !== 'number' || maxRangeDays <= 0 || days <= maxRangeDays);
}
