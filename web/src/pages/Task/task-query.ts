import { z } from 'zod';
import { API } from '../../helpers';
import type { ApiEnvelope } from '../../types/api';

export async function readTaskData<T extends z.ZodType>(url: string, schema: T, signal: AbortSignal, params?: Record<string, string | number>): Promise<z.output<T>> {
  const { data } = await API.get<ApiEnvelope<unknown>>(url, { signal, params, timeout: 30000, skipErrorHandler: true, disableDuplicate: true });
  signal.throwIfAborted(); if (!data.success) throw new Error(data.message || 'Unable to load tasks');
  const result = schema.safeParse(data.data); if (!result.success) throw new Error('Invalid task data; reload and try again.');
  return result.data;
}
