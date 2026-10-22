import type { LogFilters } from './log-data';

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
  if (admin && filters.username) params.set('username', filters.username);
  if (root && filters.upstream_request_id) params.set('upstream_request_id', filters.upstream_request_id);
  return params;
}
