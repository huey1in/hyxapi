import { z } from 'zod';
import { API } from '../../helpers';
import type { ApiEnvelope } from '../../types/api';
import { pluginUsageSchema, PluginUsageError } from './task-plugin-data';

export async function pluginRequest<T extends z.ZodType>(method: string, path: string, schema: T, signal: AbortSignal, body?: unknown): Promise<z.output<T>> {
  const { data } = await API.request<ApiEnvelope<unknown>>({ method, url: path, data: body, signal, timeout: 30000, skipErrorHandler: true, disableDuplicate: true });
  signal.throwIfAborted();
  if (!data.success) {
    const usage = pluginUsageSchema.safeParse(data.data);
    if (usage.success && (usage.data.channels.length || usage.data.in_flight_count)) throw new PluginUsageError(usage.data);
    throw new Error(data.message || 'Unable to complete plugin operation');
  }
  const result = schema.safeParse(data.data);
  if (!result.success) throw new Error('Invalid plugin data; reload and try again.');
  return result.data;
}
