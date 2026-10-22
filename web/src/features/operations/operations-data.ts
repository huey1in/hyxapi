import { z } from 'zod';

const count = z.number().int().nonnegative().safe();
const amount = z.number().finite().nonnegative();
const percent = amount.max(100);
const timestamp = count.max(8640000000000);
export const instanceSchema = z.object({
  node_name: z.string().min(1), status: z.enum(['online', 'stale']), started_at: timestamp, last_seen_at: timestamp, stale_after_seconds: count,
  info: z.object({
    node: z.object({ source: z.string(), manually_configured: z.boolean(), should_configure_manually: z.boolean() }).optional(),
    role: z.object({ is_master: z.boolean() }).optional(), runtime: z.object({ version: z.string(), goos: z.string(), goarch: z.string() }).optional(),
    resources: z.object({ cpu: z.object({ usage_percent: percent }).optional(), memory: z.object({ usage_percent: percent }).optional(), storage: z.object({ used_percent: percent }).optional() }).optional(),
  }).nullable(),
});
export const instancesSchema = z.array(instanceSchema).nullable().transform((rows) => rows ?? []);
export type Instance = z.infer<typeof instanceSchema>;
export const logFileSchema = z.object({ name: z.string().min(1), size: count, mod_time: z.string().refine((value) => Number.isFinite(new Date(value).getTime())), active: z.boolean() });
export const logFilesSchema = z.object({ enabled: z.boolean(), log_dir: z.string(), file_count: count, total_size: count, files: z.array(logFileSchema).nullable().transform((rows) => rows ?? []) });
export type LogFile = z.infer<typeof logFileSchema>;
export const performanceSchema = z.object({
  cache_stats: z.object({ disk_cache_hits: count, memory_cache_hits: count }), memory_stats: z.object({ alloc: count, num_gc: count }),
  disk_cache_info: z.object({ path: z.string(), exists: z.boolean(), file_count: count, total_size: count }),
  config: z.object({ monitor_enabled: z.boolean(), monitor_cpu_threshold: percent, monitor_memory_threshold: percent, monitor_disk_threshold: percent, disk_cache_enabled: z.boolean() }),
});
const consumptionSchema = z.object({ quota: count, requests: count, tokens: count });
export const channelConsumptionSchema = consumptionSchema.extend({ channel_id: count, channel_name: z.string() });
export const groupConsumptionSchema = consumptionSchema.extend({ group: z.string() });
export const operationsReportSchema = z.object({
  period: z.object({ start_timestamp: timestamp, end_timestamp: timestamp }),
  summary: z.object({
    revenue: z.object({ range: z.object({ total_money: amount, total_amount: count, total_orders: count }) }),
    consumption: z.object({ range: consumptionSchema, all_time: consumptionSchema, average_rpm: amount }),
    active: z.object({ users: count, new_users: count }),
  }),
  charges: z.object({ channels: z.array(channelConsumptionSchema).nullable().transform((rows) => rows ?? []), groups: z.array(groupConsumptionSchema).nullable().transform((rows) => rows ?? []) }),
});
export type OperationsReport = z.infer<typeof operationsReportSchema>;
export type ChannelConsumption = z.infer<typeof channelConsumptionSchema>;
export type GroupConsumption = z.infer<typeof groupConsumptionSchema>;
export function operationsRange(days: number, now = Date.now()) {
  const start = new Date(now); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - Math.max(0, days - 1));
  return { start_timestamp: days ? Math.floor(start.getTime() / 1000) : 0, end_timestamp: Math.floor(now / 1000) };
}
export function validLogRetention(mode: string, value: string) {
  return (mode === 'by_count' || mode === 'by_days') && /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value)) && (mode !== 'by_days' || Number(value) <= 365000);
}
