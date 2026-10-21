import { useCallback, useContext, useMemo, useSyncExternalStore } from 'react';
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
  const [{ status }] = useContext(StatusContext);
  const userId = useAuthStore((state) => state.auth.user?.id);
  const storageKey = `hyxware-notification-read:${userId ?? 'guest'}`;
  const snapshot = useSyncExternalStore(subscribe, useCallback(() => stored(storageKey), [storageKey]), () => '');
  const read = useMemo(() => parseNotificationReadState(snapshot), [snapshot]);
  const announcements = useMemo(() => enabled && status?.announcements_enabled !== false ? parseAnnouncements(status?.announcements) : [], [enabled, status?.announcements_enabled, status?.announcements]);
  const readKeys = new Set(read.announcements);
  const unread = announcements.filter((item) => !readKeys.has(announcementKey(item))).length;
  const markRead = useCallback((keys: string[]) => {
    const current = stored(storageKey);
    const next = JSON.stringify(mergedNotificationReadState(parseNotificationReadState(current), keys));
    if (current === next) return;
    try { localStorage.setItem(storageKey, next); memory.delete(storageKey); } catch { memory.set(storageKey, next); }
    window.dispatchEvent(new Event(changed));
  }, [storageKey]);
  return { announcements, unread, read, markRead };
}
