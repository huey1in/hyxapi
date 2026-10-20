import { z } from 'zod';

const text = z.string().nullish().transform((value) => value ?? '');
export const announcementSchema = z.object({
  id: z.union([z.string(), z.number()]).nullish(), content: z.string(), publishDate: text,
  extra: text, type: text, title: text, link: text,
});
export type Announcement = z.infer<typeof announcementSchema>;
export type NotificationReadState = { notice: string; announcements: string[] };
const readSchema = z.object({ notice: z.string().default(''), announcements: z.array(z.string()).default([]) });
export function parseNotificationReadState(raw: string): NotificationReadState {
  try { const result = readSchema.safeParse(JSON.parse(raw)); if (result.success) return result.data; } catch { /* optional browser storage */ }
  return { notice: '', announcements: [] };
}
export function parseAnnouncements(value: unknown): Announcement[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => { const result = announcementSchema.safeParse(item); return result.success && result.data.content.trim() ? [result.data] : []; });
}
export function announcementKey(item: Announcement): string {
  if (item.id !== undefined && item.id !== null) return `id:${item.id}`;
  // Include the entire content: an edit after the first 30 characters must
  // become unread, even when the publication time has not changed.
  return `content:${JSON.stringify([item.publishDate, item.content.trim(), item.extra.trim(), item.type, item.title.trim(), item.link.trim()])}`;
}
export function safeAnnouncementLink(value: string): string {
  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    try { const url = new URL(trimmed); return url.username || url.password ? '' : url.href; } catch { return ''; }
  }
  return trimmed.startsWith('/') && !trimmed.startsWith('//') && !trimmed.includes('\\') ? trimmed : '';
}
export function mergedNotificationReadState(current: NotificationReadState, notice: string, keys: string[]): NotificationReadState {
  return { notice: notice || current.notice, announcements: [...new Set([...current.announcements, ...keys])].slice(-1000) };
}
