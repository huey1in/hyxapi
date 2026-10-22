import { z } from 'zod';

const text = z.string().nullish().transform((value) => value ?? '');
const announcementSchema = z.object({
  id: z.union([z.string(), z.number()]).nullish(), content: z.string(), publishDate: text,
  extra: text, type: text, title: text, link: text,
});
type Announcement = z.infer<typeof announcementSchema>;
type NotificationReadState = { announcements: string[] };
const readSchema = z.object({ announcements: z.array(z.string()).catch([]) });
export function parseNotificationReadState(raw: string): NotificationReadState {
  try { const result = readSchema.safeParse(JSON.parse(raw)); if (result.success) return result.data; } catch { /* optional browser storage */ }
  return { announcements: [] };
}
export function parseAnnouncements(value: unknown): Announcement[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => { const result = announcementSchema.safeParse(item); return result.success && result.data.content.trim() ? [result.data] : []; });
}
export function announcementKey(item: Announcement): string {
  if (item.id !== undefined && item.id !== null) return `id:${item.id}`;
  return `content:${JSON.stringify([item.publishDate, item.content.trim(), item.extra.trim(), item.type, item.title.trim(), item.link.trim()])}`;
}
export function mergedNotificationReadState(current: NotificationReadState, keys: string[]): NotificationReadState {
  return { announcements: [...new Set([...current.announcements, ...keys])].slice(-1000) };
}
export function safeAnnouncementLink(value: string): string {
  const trimmed = value.trim();
  if (/[\u0000-\u001f\u007f]/.test(trimmed)) return '';
  if (/^https?:\/\//i.test(trimmed)) {
    try { const url = new URL(trimmed); return url.username || url.password ? '' : url.href; } catch { return ''; }
  }
  return trimmed.startsWith('/') && !trimmed.startsWith('//') && !trimmed.includes('\\') ? trimmed : '';
}
