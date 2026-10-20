const MODELS = [
  { name: 'gpt-4.1', group: 'production' },
  { name: 'gpt-4o-mini', group: 'default' },
  { name: 'claude-sonnet-4', group: 'production' },
  { name: 'gemini-2.5-flash', group: 'default' },
  { name: 'deepseek-chat', group: 'default' },
  { name: 'grok-4', group: 'production' },
];

const pick = (items, random) => items[Math.floor(random() * items.length) % items.length];
const integer = (min, max, random) => Math.floor(min + random() * (max - min + 1));

export const previewKeys = [{ id: 1, name: 'production' }, { id: 2, name: 'development' }];

const createLog = (nowMs, random, id) => {
  const model = pick(MODELS, random);
  return {
    id,
    token_id: pick(previewKeys, random).id,
    created_at: Math.floor(nowMs / 1000),
    model_name: model.name,
    group: model.group,
    prompt_tokens: integer(420, 5200, random),
    completion_tokens: integer(160, 1800, random),
    quota: integer(45, 780, random),
  };
};

export const createPreviewState = (nowMs = Date.now(), random = Math.random) => ({
  user: { quota: 862000, used_quota: 1438000 },
  logs: Array.from({ length: 180 }, (_, index) => {
    const date = new Date(nowMs); date.setDate(date.getDate() - Math.floor(index / 6));
    return { ...createLog(date.getTime() - (index % 6) * 8000, random, Math.floor(nowMs) - index), token_id: index % 2 + 1 };
  }),
});

export const advancePreviewState = (state, nowMs = Date.now(), random = Math.random) => {
  const log = createLog(nowMs, random, Math.floor(nowMs));
  return {
    user: { ...state.user, quota: Math.max(0, state.user.quota - log.quota), used_quota: state.user.used_quota + log.quota },
    logs: [log, ...state.logs].slice(0, 360),
  };
};

export const getPreviewStats = (state, range, tokenID = 0) => state.logs.reduce((totals, log) => {
  if (log.created_at < range.start_timestamp || log.created_at > range.end_timestamp || (tokenID && log.token_id !== tokenID)) return totals;
  return { quota: totals.quota + log.quota, tokens: totals.tokens + log.prompt_tokens + log.completion_tokens, requests: totals.requests + 1 };
}, { quota: 0, tokens: 0, requests: 0 });

export const getPreviewUsage = (state, range, tokenID = 0) => {
  const first = new Date(range.start_timestamp * 1000);
  const last = new Date(range.end_timestamp * 1000);
  const cursor = new Date(first);
  const duration = range.end_timestamp - range.start_timestamp;
  /** @type {'hour' | 'day' | 'month' | 'year'} */
  let interval = 'day';
  cursor.setHours(0, 0, 0, 0);
  if (duration < 2 * 86400) {
    interval = 'hour';
    cursor.setTime(first.getTime() - first.getMinutes() * 60000 - first.getSeconds() * 1000);
  } else if (duration > 120 * 86400) {
    interval = last.getFullYear() * 12 + last.getMonth() - (first.getFullYear() * 12 + first.getMonth()) >= 120 ? 'year' : 'month';
    cursor.setDate(1);
    if (interval === 'year') cursor.setMonth(0);
  }
  const points = [];
  while (cursor <= last && points.length < 128) {
    points.push({ timestamp: cursor.getTime() / 1000, quota: 0 });
    if (interval === 'hour') cursor.setTime(cursor.getTime() + 3600000);
    else if (interval === 'day') cursor.setDate(cursor.getDate() + 1);
    else if (interval === 'month') cursor.setMonth(cursor.getMonth() + 1);
    else cursor.setFullYear(cursor.getFullYear() + 1);
  }
  for (const log of state.logs) {
    if (log.created_at < range.start_timestamp || log.created_at > range.end_timestamp || (tokenID && log.token_id !== tokenID)) continue;
    const index = points.findLastIndex((point) => point.timestamp <= log.created_at);
    if (index >= 0) points[index].quota += log.quota;
  }
  return { ...getPreviewStats(state, range, tokenID), trend: { interval, points } };
};
