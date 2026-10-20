import { useQuery } from '@tanstack/react-query';
import { API } from '../../helpers';
import { useAuthStore } from '../../stores/auth-store';
import type { ZodType } from 'zod';
import { modelResultSchema, summaryResultSchema } from './types';

async function getMetrics<T>(path: string, params: URLSearchParams, signal: AbortSignal, schema: ZodType<T>): Promise<T> {
  const response = await API.get(`${path}?${params}`, { signal, skipErrorHandler: true, disableDuplicate: true });
  signal.throwIfAborted();
  if (!response.data?.success) throw new Error(response.data?.message || 'Unable to load performance metrics');
  return schema.parse(response.data.data);
}

export function usePerformanceSummary(recentModels: string[] = [], enabled = true) {
  const userId = useAuthStore((state) => state.auth.user?.id);
  const sid = useAuthStore((state) => state.auth.session?.sid);
  const models = [...new Set(recentModels)].filter(Boolean).slice(0, 50).sort();
  return useQuery({
    queryKey: ['perf-metrics-summary', userId, sid, 24, models], gcTime: 0,
    queryFn: ({ signal }) => {
      const params = new URLSearchParams({ hours: '24' });
      models.forEach((model) => params.append('recent_model', model));
      return getMetrics('/api/perf-metrics/summary', params, signal, summaryResultSchema);
    },
    enabled, staleTime: 60_000, refetchInterval: 60_000, retry: false,
  });
}

export function useModelPerformance(model: string, hours: number) {
  const userId = useAuthStore((state) => state.auth.user?.id);
  const sid = useAuthStore((state) => state.auth.session?.sid);
  return useQuery({
    queryKey: ['perf-metrics', userId, sid, model, hours], gcTime: 0,
    queryFn: ({ signal }) => getMetrics('/api/perf-metrics', new URLSearchParams({ model, hours: String(hours) }), signal, modelResultSchema),
    enabled: !!model, staleTime: 60_000, refetchInterval: 60_000, retry: false,
  });
}
