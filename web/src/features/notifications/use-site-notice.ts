import { useQuery } from '@tanstack/react-query';
import { API } from '../../helpers';
import type { ApiEnvelope } from '../../types/api';

export function useSiteNotice() {
  return useQuery({
    queryKey: ['site-notice'], retry: false, gcTime: 0, staleTime: 60_000, refetchOnMount: 'always',
    queryFn: async ({ signal }) => {
      const { data } = await API.get<ApiEnvelope<unknown>>('/api/notice', { signal, skipAuthRefresh: true, skipErrorHandler: true, disableDuplicate: true, headers: { 'Cache-Control': null } });
      signal.throwIfAborted();
      if (!data.success || typeof data.data !== 'string') throw new Error('Unable to load site notice');
      return data.data.trim();
    },
  });
}
