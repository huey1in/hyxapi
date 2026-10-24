import { z } from 'zod';

const count = z.number().int().nonnegative();
const model = z.object({ model_name: z.string(), requests: count, tokens: count, share: z.number().min(0).max(1) }).strict();
export const leaderboardSchema = z.object({
  period: z.enum(['today', 'week', 'month']), metric: z.enum(['tokens', 'requests']),
  timezone: z.literal('Asia/Shanghai'), start_at: count, updated_at: count,
  active_users: count, requests: count, tokens: count, my_rank: count.positive().nullable(),
  users: z.array(z.object({
    rank: count.positive(), username: z.string(), requests: count, tokens: count,
    is_me: z.boolean(), preferences: z.array(model).max(3),
  }).strict()).max(100),
  models: z.array(model).max(8),
}).strict();
export type LeaderboardData = z.infer<typeof leaderboardSchema>;
export type LeaderboardPeriod = LeaderboardData['period'];
export type LeaderboardMetric = LeaderboardData['metric'];

export function compactUsage(value: number, language: string) {
  return new Intl.NumberFormat(language, { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}
