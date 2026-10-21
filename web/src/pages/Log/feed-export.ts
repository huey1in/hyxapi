import { z } from 'zod';
import { feedItemSchema, feedModel, projectFeedItem } from './feed-data';

const columns = [
  ['time', 'Time'], ['source', 'Log source'], ['type', 'Type'], ['model', 'Model / task'],
  ['username', 'User'], ['token_name', 'Token name'], ['group', 'Group'],
  ['prompt_tokens', 'Input tokens'], ['completion_tokens', 'Output tokens'], ['quota', 'Quota'],
  ['use_time', 'Duration (s)'], ['request_id', 'Request ID'], ['upstream_request_id', 'Upstream Request ID'],
  ['task_id', 'Task ID'], ['status', 'Status'], ['action', 'Action'], ['platform', 'Plugin / platform'],
  ['channel', 'Channel'], ['content', 'Content'], ['other', 'Details'],
] as const;
const sourceLabels = { usage: 'Request logs', tasks: 'Async tasks', midjourney: 'Midjourney' };
const types: Record<number, string> = { 1: 'Top up', 2: 'Consumption', 3: 'Management', 4: 'System', 5: 'Error', 6: 'Refund', 7: 'Login' };
const cell = (value: unknown) => {
  let text = String(value ?? '');
  if (/^[\s]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
};

export function feedToCSV(ndjson: string, role: number, translate: (key: string) => string = (key) => key) {
  let records: unknown[];
  try { records = ndjson.trim().split('\n').filter(Boolean).map((line) => JSON.parse(line)); }
  catch { throw new Error('Log export did not finish'); }
  const completion = z.object({ success: z.literal(true), data: z.object({ count: z.number().int().nonnegative() }) }).safeParse(records.pop());
  if (!completion.success || completion.data.data.count !== records.length) throw new Error('Log export did not finish');
  const fields = columns.filter(([key]) => (role >= 10 || key !== 'channel') && (role >= 100 || key !== 'upstream_request_id'));
  const rows = [fields.map(([, title]) => cell(translate(title))).join(',')];
  for (const record of records) {
    const result = feedItemSchema.safeParse(record);
    if (!result.success) throw new Error('Log export did not finish');
    const row = projectFeedItem(result.data, role);
    const data = row.source === 'usage' ? { ...row.log, type: translate(types[row.log.type] || 'System'), other: JSON.stringify(row.log._rawOther) }
      : row.source === 'tasks' ? { ...row.task, task_id: row.task.task_id, channel: row.task.channel_id, username: row.task.username || row.task.user_id, other: JSON.stringify(row.task) }
        : { ...row.midjourney, task_id: row.midjourney.mj_id, channel: row.midjourney.channel_id, username: row.midjourney.user_id, other: JSON.stringify(row.midjourney) };
    const values: Record<string, unknown> = { ...data, time: new Date(row.time).toISOString(), source: translate(sourceLabels[row.source]), model: feedModel(row) };
    rows.push(fields.map(([key]) => cell(values[key])).join(','));
  }
  return '\uFEFF' + rows.join('\r\n') + '\r\n';
}
