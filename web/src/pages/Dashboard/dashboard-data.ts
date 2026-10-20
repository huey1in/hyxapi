import { z } from 'zod';

const count = z.number().int().nonnegative();
export const dashboardStatsSchema = z.object({
  quota: z.number().finite(), tokens: count, requests: count, rpm: count, tpm: count,
});
export const dashboardProfileSchema = z.object({ quota: z.number().finite(), used_quota: z.number().finite(), request_count: count });
export function dashboardTodayRange(now = new Date()) {
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  return { start_timestamp: Math.floor(start.getTime() / 1000), end_timestamp: Math.floor(now.getTime() / 1000) };
}
