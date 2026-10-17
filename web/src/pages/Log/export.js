const fields = [
  ['created_at', 'Time', '时间'], ['type', 'Type', '类型'],
  ['model_name', 'Model', '模型'], ['username', 'User', '用户'],
  ['token_name', 'Token', '令牌'], ['group', 'Group', '分组'],
  ['prompt_tokens', 'Input tokens', '输入 Tokens'], ['completion_tokens', 'Output tokens', '输出 Tokens'],
  ['quota', 'Quota', '额度'], ['use_time', 'Duration (s)', '耗时（秒）'],
  ['request_id', 'Request ID', '请求 ID'], ['ip', 'IP', 'IP'],
  ['channel', 'Channel', '渠道'], ['content', 'Content', '内容'], ['other', 'Details', '详情'],
];

const cell = (value) => {
  let text = String(value ?? '');
  // Spreadsheet programs must treat user-controlled values as text.
  if (/^[\s]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
};

export function logsToCSV(ndjson, language = 'zh-CN', admin = false) {
  const entries = String(ndjson).trim().split('\n').filter(Boolean).map((line) => JSON.parse(line));
  const result = entries.pop();
  if (!result?.success || result.data?.count !== entries.length) {
    throw new Error(result?.message || 'Log export did not finish');
  }
  const columns = fields.filter(([key]) => admin || key !== 'channel');
  const rows = [columns.map((field) => cell(field[language.startsWith('zh') ? 2 : 1])).join(',')];
  entries.forEach((entry) => rows.push(columns.map(([key]) => cell(
    key === 'created_at' ? new Date(entry[key] * 1000).toISOString() : entry[key],
  )).join(',')));
  return '\uFEFF' + rows.join('\r\n') + '\r\n';
}

export function logQuery(filters, admin) {
  const params = new URLSearchParams({ type: String(filters.type || 0) });
  ['token_name', 'model_name', 'group', 'request_id'].forEach((key) => {
    if (filters[key]) params.set(key, filters[key]);
  });
  ['start_timestamp', 'end_timestamp'].forEach((key) => {
    const date = filters[key];
    params.set(key, date ? String(Math.floor(new Date(date).getTime() / 1000)) : '0');
  });
  if (admin) ['channel', 'username'].forEach((key) => {
    if (filters[key]) params.set(key, filters[key]);
  });
  return params;
}
