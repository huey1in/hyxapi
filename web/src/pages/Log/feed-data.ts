import { z } from 'zod';
import { enrichLog, emptyLogFilters, logSchema, validateLogFilters } from './log-data';
import { midjourneySchema, projectTaskRow, taskSchema } from './task-data';
import { logQuery } from './export';

const base = { key: z.string().min(1), time: z.number().int().nonnegative().max(8640000000000000) };
export const feedItemSchema = z.discriminatedUnion('source', [
  z.object({ ...base, source: z.literal('usage'), log: logSchema }),
  z.object({ ...base, source: z.literal('tasks'), task: taskSchema }),
  z.object({ ...base, source: z.literal('midjourney'), midjourney: midjourneySchema }),
]);
export const feedPageSchema = z.object({ items: z.array(feedItemSchema), total: z.number().int().nonnegative().safe(), next_cursor: z.string() });
export type FeedItem = z.infer<typeof feedItemSchema>;
export function projectFeedItem(item: FeedItem, role: number) {
  if (item.source === 'usage') return { ...item, log: enrichLog(item.log, role) };
  if (item.source === 'tasks') return { ...item, task: projectTaskRow(item.task, role) };
  return item;
}
export type FeedRow = ReturnType<typeof projectFeedItem>;
export const emptyFeedFilters = () => ({ ...emptyLogFilters(), source: '', task_id: '', platform: '', status: '', action: '' });
export type FeedFilters = ReturnType<typeof emptyFeedFilters>;

export function changeFeedSource(filters: FeedFilters, source: string): FeedFilters {
  return { ...emptyFeedFilters(), source, start_timestamp: filters.start_timestamp, end_timestamp: filters.end_timestamp, channel: filters.channel, username: filters.username };
}

export function feedQuery(filters: FeedFilters, all: boolean, role: number, sources: readonly string[]) {
  const params = logQuery(filters, all, all && role >= 100);
  params.set('sources', sources.join(','));
  for (const key of ['source', 'task_id', 'platform', 'status', 'action'] as const) if (filters[key]) params.set(key, filters[key].trim());
  return params;
}

export function validateFeedFilters(filters: FeedFilters, all: boolean) {
  const error = validateLogFilters(filters, all);
  if (error) return error;
  if (all && filters.channel && !Number.isSafeInteger(Number(filters.channel))) return 'Channel ID must be a positive integer';
  return '';
}

export function feedModel(row: FeedRow) {
  if (row.source === 'usage') return row.log.model_name;
  if (row.source === 'tasks') return row.task.properties?.origin_model_name || row.task.platform;
  return 'Midjourney';
}

export function feedStatus(row: FeedRow) {
  if (row.source === 'tasks') return row.task.status;
  if (row.source === 'midjourney') return row.midjourney.status || 'NOT_START';
  return row.log.type === 5 ? 'FAILURE' : row.log.type === 2 ? 'SUCCESS' : '';
}
