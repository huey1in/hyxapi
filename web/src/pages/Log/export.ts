import { z } from 'zod';
import type { LogFilters } from './log-data';

const fields = [
  ['created_at', 'Time', '时间'], ['type', 'Type', '类型'],
  ['model_name', 'Model', '模型'], ['username', 'User', '用户'],
  ['token_name', 'Token', '令牌'], ['group', 'Group', '分组'],
  ['prompt_tokens', 'Input tokens', '输入 Tokens'], ['completion_tokens', 'Output tokens', '输出 Tokens'],
  ['quota', 'Quota', '额度'], ['use_time', 'Duration (s)', '耗时（秒）'],
  ['request_id', 'Request ID', '请求 ID'], ['ip', 'IP', 'IP'],
  ['upstream_request_id', 'Upstream Request ID', '上游请求 ID'],
  ['channel', 'Channel', '渠道'], ['content', 'Content', '内容'], ['other', 'Details', '详情'],
] as const;

const cell = (value: unknown) => {
  let text = String(value ?? '');
  // Spreadsheet programs must treat user-controlled values as text.
  if (/^[\s]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
};

export function logsToCSV(ndjson: string, language = 'zh-CN', admin = false, root = false, translate?: (key: string) => string) {
  let entries: unknown[];
  try { entries = ndjson.trim().split('\n').filter(Boolean).map((line) => JSON.parse(line)); }
  catch { throw new Error('Log export did not finish'); }
  const result = entries.pop();
  const completion = z.object({ success: z.literal(true), data: z.object({ count: z.number().int().nonnegative() }) }).safeParse(result);
  if (!completion.success || completion.data.data.count !== entries.length) {
    const error = z.object({ success: z.literal(false), message: z.string().min(1) }).safeParse(result);
    throw new Error(error.success ? error.data.message : 'Log export did not finish');
  }
  const columns = fields.filter(([key]) => (admin || key !== 'channel') && (root || key !== 'upstream_request_id'));
  const rows = [columns.map((field) => cell(translate ? translate(field[1]) : field[language.startsWith('zh') ? 2 : 1])).join(',')];
  entries.forEach((raw) => {
    const entry = z.object({ created_at: z.number().finite().nonnegative().max(8640000000000) }).catchall(z.unknown()).safeParse(raw);
    if (!entry.success) throw new Error('Log export did not finish');
    rows.push(columns.map(([key]) => cell(key === 'created_at' ? new Date(entry.data.created_at * 1000).toISOString() : entry.data[key])).join(','));
  });
  return '\uFEFF' + rows.join('\r\n') + '\r\n';
}

export function logQuery(filters: Partial<LogFilters>, admin: boolean, root = false) {
  const params = new URLSearchParams({ type: String(filters.type || 0) });
  (['token_name', 'model_name', 'group', 'request_id'] as const).forEach((key) => {
    if (filters[key]) params.set(key, filters[key]);
  });
  (['start_timestamp', 'end_timestamp'] as const).forEach((key) => {
    const date = filters[key];
    const timestamp = date ? Math.floor(new Date(date).getTime() / 1000) : 0;
    if (!Number.isFinite(timestamp) || timestamp < 0) throw new Error('Invalid time range');
    params.set(key, String(timestamp));
  });
  if (admin) (['channel', 'username'] as const).forEach((key) => {
    if (filters[key]) params.set(key, filters[key]);
  });
  if (root && filters.upstream_request_id) params.set('upstream_request_id', filters.upstream_request_id);
  return params;
}
