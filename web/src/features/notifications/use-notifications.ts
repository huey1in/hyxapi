import { useCallback, useContext, useMemo, useSyncExternalStore } from 'react';
import { useQuery } from '@tanstack/react-query';
import { API } from '../../helpers';
import type { ApiEnvelope } from '../../types/api';
import { StatusContext } from '../../context/Status';
import { useAuthStore } from '../../stores/auth-store';
import { announcementKey, mergedNotificationReadState, parseAnnouncements, parseNotificationReadState } from './notification-data';

const changed = 'hyxware-notifications-read';
const memory = new Map<string, string>();
const subscribe = (callback: () => void) => { window.addEventListener(changed, callback); window.addEventListener('storage', callback); return () => { window.removeEventListener(changed, callback); window.removeEventListener('storage', callback); }; };
function stored(key: string): string {
  if (memory.has(key)) return memory.get(key)!;
  try { return localStorage.getItem(key) ?? ''; } catch { return ''; }
}

export function useNotifications(enabled = true) {
  const [statusState] = useContext(StatusContext);
  const userId = useAuthStore((state) => state.auth.user?.id);
  const storageKey = `hyxware-notification-read:${userId ?? 'guest'}`;
  const snapshot = useSyncExternalStore(subscribe, useCallback(() => stored(storageKey), [storageKey]), () => '');
  const read = useMemo(() => parseNotificationReadState(snapshot), [snapshot]);
  const status = statusState.status;
  const announcements = useMemo(() => enabled && status?.announcements_enabled !== false ? parseAnnouncements(status?.announcements) : [], [enabled, status?.announcements_enabled, status?.announcements]);
  const notice = useQuery({
    queryKey: ['site-notice'], enabled, retry: false, gcTime: 0, staleTime: 60_000, refetchOnMount: 'always',
    queryFn: async ({ signal }) => {
      const { data } = await API.get<ApiEnvelope<unknown>>('/api/notice', { signal, skipAuthRefresh: true, skipErrorHandler: true, disableDuplicate: true, headers: { 'Cache-Control': null } });
      signal.throwIfAborted(); if (!data.success || typeof data.data !== 'string') throw new Error('Unable to load site notice');
      return data.data.trim();
    },
  });
  const content = enabled && !notice.error ? notice.data ?? '' : '';
  const readKeys = new Set(read.announcements);
  const unread = announcements.filter((item) => !readKeys.has(announcementKey(item))).length + (content && content !== read.notice ? 1 : 0);
  const markRead = useCallback((text: string, keys: string[]) => {
    const current = stored(storageKey); const next = JSON.stringify(mergedNotificationReadState(parseNotificationReadState(current), text, keys));
    if (current === next) return;
    try { localStorage.setItem(storageKey, next); memory.delete(storageKey); } catch { memory.set(storageKey, next); }
    window.dispatchEvent(new Event(changed));
  }, [storageKey]);
  return { notice, content, announcements, unread, read, markRead };
}
