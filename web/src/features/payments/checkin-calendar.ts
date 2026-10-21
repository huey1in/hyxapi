import { z } from 'zod';

export const checkinStatusSchema = z.object({
  enabled: z.boolean(), min_quota: z.number().nonnegative(), max_quota: z.number().nonnegative(),
  today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  stats: z.object({
    total_quota: z.number(), total_checkins: z.number().int().nonnegative(),
    checkin_count: z.number().int().nonnegative(), checked_in_today: z.boolean(),
    records: z.array(z.object({ checkin_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), quota_awarded: z.number().nonnegative() })),
  }),
});
export type CheckinStatus = z.infer<typeof checkinStatusSchema>;

export const monthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
export function moveMonth(month: string, delta: number) {
  const [year = 2000, number = 1] = month.split('-').map(Number);
  return monthKey(new Date(year, number - 1 + delta, 1));
}
export function calendarDays(month: string): (string | null)[] {
  const [year = 2000, number = 1] = month.split('-').map(Number);
  const start = new Date(year, number - 1, 1).getDay();
  const count = new Date(year, number, 0).getDate();
  return Array.from({ length: Math.ceil((start + count) / 7) * 7 }, (_, index) => {
    const day = index - start + 1;
    return day < 1 || day > count ? null : `${month}-${String(day).padStart(2, '0')}`;
  });
}
