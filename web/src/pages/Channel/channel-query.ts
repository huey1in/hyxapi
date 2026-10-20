import { z } from 'zod';
import { API } from '../../helpers';
import type { ApiEnvelope } from '../../types/api';

export async function channelRequest<T extends z.ZodType>(
  method: string,
  path: string,
  schema: T,
  signal: AbortSignal,
  body?: unknown,
): Promise<z.output<T>> {
  const { data } = await API.request<ApiEnvelope<unknown>>({
    method,
    url: path,
    data: body,
    signal,
    timeout: 30000,
    skipErrorHandler: true,
    disableDuplicate: true,
  });
  signal.throwIfAborted();
  if (!data.success)
    throw new Error(data.message || 'Unable to complete channel operation');
  const parsed = schema.safeParse(data.data);
  if (!parsed.success)
    throw new Error('Invalid channel data; reload and try again.');
  return parsed.data;
}
