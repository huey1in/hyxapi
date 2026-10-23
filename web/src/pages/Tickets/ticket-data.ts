import { z } from 'zod';
import { API } from '../../helpers';
import type { ApiEnvelope } from '../../types/api';

const ticketSchema = z.object({
  id: z.number().int().positive(), user_id: z.number().int().positive(),
  subject: z.string(), category: z.enum(['account', 'billing', 'api', 'other']),
  priority: z.enum(['low', 'normal', 'high']),
  status: z.enum(['open', 'waiting_user', 'resolved', 'closed']),
  assignee_id: z.number().int().nonnegative(), created_at: z.number(), updated_at: z.number(),
});
export type SupportTicket = z.infer<typeof ticketSchema>;
const messageSchema = z.object({
  id: z.number().int().positive(), author_id: z.number().int().positive(), author_role: z.number(),
  body: z.string(), internal: z.boolean(), kind: z.enum(['message', 'event']), created_at: z.number(),
});
export const ticketDetailSchema = z.object({ ticket: ticketSchema, messages: z.array(messageSchema), has_more: z.boolean(), can_handle: z.boolean() });
export const ticketPageSchema = z.object({ items: z.array(ticketSchema), total: z.number().int().nonnegative() });
export const ticketAgentsSchema = z.array(z.object({ id: z.number().int().positive(), username: z.string() })).nullable().transform((value) => value ?? []);
export const ticketLabels: Record<string, string> = {
  open: 'Awaiting support', waiting_user: 'Awaiting your reply', resolved: 'Resolved', closed: 'Closed',
  low: 'Low', normal: 'Normal', high: 'High', account: 'Account', billing: 'Billing', api: 'API', other: 'Other',
};

export async function readTickets<T extends z.ZodType>(path: string, schema: T, signal: AbortSignal) {
  const { data } = await API.get<ApiEnvelope<unknown>>(path, { signal, skipErrorHandler: true, disableDuplicate: true });
  signal.throwIfAborted();
  if (!data.success) throw new Error(data.message || 'Unable to load tickets');
  return schema.parse(data.data);
}

export async function writeTicket(path: string, method: 'post' | 'patch', body: Record<string, unknown>, signal: AbortSignal) {
  const { data } = await API.request<ApiEnvelope<unknown>>({ url: path, method, data: body, signal, skipErrorHandler: true, disableDuplicate: true });
  signal.throwIfAborted();
  if (!data.success) throw new Error(data.message || 'Unable to save ticket');
  return ticketSchema.parse(data.data);
}
