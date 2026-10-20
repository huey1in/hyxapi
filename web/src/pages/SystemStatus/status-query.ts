import { z } from 'zod';
import { API } from '../../helpers';
import type { ApiEnvelope } from '../../types/api';

export async function readSystemData<T extends z.ZodType>(url: string, schema: T, signal: AbortSignal, params?: Record<string, string | number>, envelope = false): Promise<z.output<T>> {
  const { data } = await API.get<ApiEnvelope<unknown>>(url, { signal, params, skipErrorHandler: true, disableDuplicate: true, timeout: 30000 });
  signal.throwIfAborted(); if (!data.success) throw new Error(data.message || 'Unable to load system data');
  const result = schema.safeParse(envelope ? data : data.data); if (!result.success) throw new Error('Invalid system data; reload and try again.');
  return result.data;
}
