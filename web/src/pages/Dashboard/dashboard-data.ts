import { z } from 'zod';

const count = z.number().int().nonnegative();
export const dashboardStatsSchema = z.object({
  quota: z.number().finite(), tokens: count, requests: count,
});
export const dashboardProfileSchema = z.object({ quota: z.number().finite(), used_quota: z.number().finite() });
export const dashboardKeysSchema = z.array(z.object({ id: z.number().int().positive(), name: z.string() }));
export const dashboardPeriods = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'week', label: 'Last 7 days' },
  { value: 'month', label: 'Last 30 days' },
] as const;
export type DashboardPeriod = typeof dashboardPeriods[number]['value'];
export type DashboardRange = DashboardPeriod | { start_timestamp: number; end_timestamp: number };

// Use local calendar days, including DST transitions, rather than 24-hour offsets.
export function dashboardRange(range: DashboardRange, now = new Date()) {
  if (typeof range !== 'string') return range;
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  if (range === 'yesterday') { end.setTime(start.getTime() - 1000); start.setDate(start.getDate() - 1); }
  if (range === 'week' || range === 'month') start.setDate(start.getDate() - (range === 'week' ? 6 : 29));
  return { start_timestamp: Math.floor(start.getTime() / 1000), end_timestamp: Math.floor(end.getTime() / 1000) };
}

export function dashboardCustomRange(start: string, end: string, now = new Date()) {
  const startTime = new Date(start).getTime(); const endTime = new Date(end).getTime();
  if (!start || !end || !Number.isFinite(startTime) || !Number.isFinite(endTime) || startTime < 0 || startTime > endTime || endTime > now.getTime()) throw new Error('Invalid time range');
  return { start_timestamp: Math.floor(startTime / 1000), end_timestamp: Math.floor(endTime / 1000) };
}

export function dashboardLocalTime(value: number) {
  const date = new Date(value * 1000);
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
