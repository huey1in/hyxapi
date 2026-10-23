import { z } from 'zod';

const count = z.number().int().nonnegative().safe();
const seconds = count.max(8640000000000);
const milliseconds = count.max(8640000000000000);
const record = z.record(z.string(), z.unknown());
export const taskStatusLabels: Record<string, string> = { NOT_START: 'Queued', SUBMITTED: 'Submitted', QUEUED: 'Queued', IN_PROGRESS: 'Processing', SUCCESS: 'Completed', FAILURE: 'Failed', UNKNOWN: 'Unknown' };
export const taskSchema = z.object({
  id: count, task_id: z.string().min(1), platform: z.string(), action: z.string(), status: z.string(), progress: z.string(),
  quota: count, created_at: seconds, submit_time: seconds, start_time: seconds, finish_time: seconds,
  user_id: count, channel_id: count, username: z.string().optional(), group: z.string().optional(), fail_reason: z.string(),
  result_discarded: z.boolean().optional(),
  properties: z.object({ origin_model_name: z.string().optional() }).nullish(),
  admin_info: z.object({ task_plugin: z.object({ name: z.string() }).passthrough().optional() }).passthrough().optional(),
  root_info: record.optional(),
});
export type TaskRow = z.infer<typeof taskSchema>;
export const midjourneySchema = z.object({
  id: count, mj_id: z.string(), action: z.string(), status: z.string(), progress: z.string(), quota: count,
  submit_time: milliseconds, start_time: milliseconds, finish_time: milliseconds, channel_id: count, user_id: count.default(0),
  prompt: z.string(), prompt_en: z.string(), description: z.string(), fail_reason: z.string(),
  image_url: z.string(), video_url: z.string(), video_urls: z.string(), buttons: z.string(), properties: z.string(),
});
export type MidjourneyRow = z.infer<typeof midjourneySchema>;

export function safeTaskMediaURL(value: string, origin: string) {
  if (!value.trim()) return '';
  try { const url = new URL(value, origin); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : ''; }
  catch { return ''; }
}
const mediaURL = z.string().min(1).refine((value) => Boolean(safeTaskMediaURL(value, 'https://local.invalid')), 'Invalid media URL');
export const taskArtifactsSchema = z.object({
  task_id: z.string().min(1), artifacts: z.array(z.object({ key: z.string().min(1), type: z.enum(['video', 'audio', 'image', 'file']), content_url: mediaURL })),
});
export function projectTaskRow(row: TaskRow, role: number) { return { ...row, admin_info: role >= 10 ? row.admin_info : undefined, root_info: role >= 100 ? row.root_info : undefined }; }
export function taskDate(timestamp: number, locale: string, millis = false) {
  return timestamp ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'medium' }).format(new Date(timestamp * (millis ? 1 : 1000))) : '—';
}
export function midjourneyVideos(row: MidjourneyRow, origin: string) {
  let items: unknown = [];
  try { items = JSON.parse(row.video_urls || '[]'); } catch { /* Legacy malformed metadata does not hide valid result URLs. */ }
  return [...new Set([row.video_url, ...(Array.isArray(items) ? items.map((item: unknown) => typeof item === 'string' ? item : item && typeof item === 'object' && 'url' in item && typeof item.url === 'string' ? item.url : '') : [])].map((value) => safeTaskMediaURL(value, origin)).filter(Boolean))];
}
export function parseTaskMetadata(value: string): unknown { try { return JSON.parse(value); } catch { return value; } }
