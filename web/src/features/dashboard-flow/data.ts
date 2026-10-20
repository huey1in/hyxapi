import { z } from 'zod';

const integer = z.number().int().nonnegative();
const text = z.string().nullish().transform((value) => value ?? '');
export const flowRowsSchema = z.array(z.object({
  user_id: integer.optional(), username: text, node_name: text,
  token_id: integer.optional(), token_name: text, channel_id: integer.optional(), channel_name: text,
  use_group: text, model_name: text, token_used: integer.default(0), count: integer.default(0), quota: z.number().finite().default(0),
})).nullish().transform((rows) => rows ?? []);

export function flowTimeRange(days: number, now = new Date()) {
  const start = new Date(now); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - days + 1);
  return { start_timestamp: Math.floor(start.getTime() / 1000), end_timestamp: Math.floor(now.getTime() / 1000) };
}
