import { z } from 'zod';

const count = z.number().int().nonnegative().safe();
const amount = z.number().finite().nonnegative();
const percent = amount.max(100);
const poolSchema = z.object({ max_open: count.optional(), open: count.optional(), in_use: count.optional(), idle: count.optional(), wait_count: count.optional(), wait_duration_ms: count.optional() });
const riskSchema = z.object({ total_requests: count, error_requests: count, error_rate: percent, avg_latency_seconds: amount });
export const systemStatusSchema = z.object({
  system: z.object({ version: z.string(), go_version: z.string(), uptime_seconds: count, goroutines: count, active_connections: count }),
  health: z.object({ status: z.enum(['ok', 'warning', 'critical']), warnings: z.array(z.string()).nullable().transform((values) => values ?? []) }),
  resources: z.object({ cpu_usage: percent, memory_usage: percent, disk_usage: percent, disk_total: count, disk_free: count }),
  runtime: z.object({ heap_alloc: count, heap_sys: count, heap_idle: count, heap_inuse: count, stack_inuse: count, num_gc: count, gc_pause_avg_us: count }),
  database: poolSchema, log_database: poolSchema,
  redis: z.object({ enabled: z.boolean(), total_conns: count.optional(), idle_conns: count.optional(), timeouts: count.optional(), db_size: count.optional() }),
  request_stats: z.object({ today_requests: count, today_tokens: count, today_quota: amount, total_requests: count, total_tokens: count, total_quota: amount }),
  request_health: z.object({ rpm: amount, total_requests: count, error_requests: count, success_rate: percent, avg_latency_seconds: amount }),
  risk: z.object({ channels: z.array(riskSchema.extend({ channel_id: count, channel_name: z.string() })).nullable().transform((rows) => rows ?? []), models: z.array(riskSchema.extend({ model_name: z.string() })).nullable().transform((rows) => rows ?? []) }),
  disk_cache: z.object({ active_disk_files: count, disk_usage_bytes: count, active_memory_bufs: count, memory_usage_bytes: count, disk_max_bytes: count }),
  channel_affinity: z.object({ enabled: z.boolean(), cache_algo: z.string(), total: count, cache_capacity: count }),
  channels: z.object({ enabled: count, disabled: count }),
});
export type SystemStatus = z.infer<typeof systemStatusSchema>;
export type PoolStatus = z.infer<typeof poolSchema>;
export type ChannelRisk = SystemStatus['risk']['channels'][number];
export type ModelRisk = SystemStatus['risk']['models'][number];

export const systemTaskTypes: Record<string, string> = { log_cleanup: 'Usage log cleanup', channel_test: 'Channel test', model_update: 'Model update', midjourney_poll: 'Midjourney polling', async_task_poll: 'Async task polling' };
export const systemTaskStatuses: Record<string, string> = { pending: 'Pending', running: 'Running', succeeded: 'Completed', failed: 'Failed' };
export const systemTaskSchema = z.object({
  id: count.positive(), task_id: z.string().min(1), type: z.string().min(1), status: z.enum(['pending', 'running', 'succeeded', 'failed']),
  updated_at: count.max(8640000000000), created_at: count.max(8640000000000), locked_by: z.string(), error: z.string(),
  state: z.record(z.string(), z.unknown()).nullable(), result: z.unknown(), payload: z.unknown(),
});
export type SystemTask = z.infer<typeof systemTaskSchema>;
export const systemTaskListSchema = z.object({ success: z.literal(true), data: z.array(systemTaskSchema).nullable().transform((rows) => rows ?? []), total: count });
export type SystemTaskFilters = { type: string; status: string; scope: string };
export function systemTaskFilterParams(filters: SystemTaskFilters) { return Object.fromEntries(Object.entries(filters).filter(([, value]) => value)); }
export function cleanupTimestamp(value: string, now = Date.now()) {
  if (!value) return null; const time = Math.floor(new Date(value).getTime() / 1000);
  return Number.isSafeInteger(time) && time > 0 && time <= now / 1000 ? time : null;
}
