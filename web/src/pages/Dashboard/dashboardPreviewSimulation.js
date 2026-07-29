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

const createLog = (nowMs, random, id) => {
  const model = pick(MODELS, random);
  return {
    id,
    created_at: Math.floor(nowMs / 1000),
    model_name: model.name,
    group: model.group,
    prompt_tokens: integer(420, 5200, random),
    completion_tokens: integer(160, 1800, random),
    quota: integer(45, 780, random),
  };
};

export const createPreviewState = (nowMs = Date.now(), random = Math.random) => ({
  user: { quota: 862000, used_quota: 1438000, request_count: 24891 },
  cumulative: { quota: 1438000, tokens: 18400000, requests: 24891 },
  today: { quota: 64200, tokens: 684200, requests: 1284 },
  rpm: integer(14, 22, random),
  logs: Array.from({ length: 6 }, (_, index) =>
    createLog(nowMs - index * 8000, random, Math.floor(nowMs) - index),
  ),
});

export const advancePreviewState = (state, nowMs = Date.now(), random = Math.random) => {
  const log = createLog(nowMs, random, Math.floor(nowMs));
  const tokens = log.prompt_tokens + log.completion_tokens;
  return {
    user: { ...state.user, quota: Math.max(0, state.user.quota - log.quota), used_quota: state.user.used_quota + log.quota, request_count: state.user.request_count + 1 },
    cumulative: { quota: state.cumulative.quota + log.quota, tokens: state.cumulative.tokens + tokens, requests: state.cumulative.requests + 1 },
    today: { quota: state.today.quota + log.quota, tokens: state.today.tokens + tokens, requests: state.today.requests + 1 },
    rpm: Math.max(8, Math.min(32, state.rpm + integer(-2, 3, random))),
    logs: [log, ...state.logs].slice(0, 6),
  };
};
