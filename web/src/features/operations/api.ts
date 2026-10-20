import { z } from 'zod';
import { API } from '../../helpers';
import type { ApiEnvelope } from '../../types/api';
import { apiErrorMessage } from '../../lib/api-error';

export async function readOperationsData<T extends z.ZodType>(path: string, schema: T, signal: AbortSignal, params?: Record<string, string | number>): Promise<z.output<T>> {
  const { data } = await API.get<ApiEnvelope<unknown>>(path, { signal, params, skipErrorHandler: true, disableDuplicate: true, timeout: 30000 });
  signal.throwIfAborted(); if (!data.success) throw new Error(data.message || 'Unable to load operations data');
  const result = schema.safeParse(data.data); if (!result.success) throw new Error('Invalid operations data; reload and try again.');
  return result.data;
}
export const errorText = (cause: unknown) => apiErrorMessage(cause);
export function bytes(value = 0): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB']; let number = Math.max(0, value); let index = 0;
  while (number >= 1024 && index < units.length - 1) { number /= 1024; index++; }
  return `${number.toFixed(index ? 2 : 0)} ${units[index]}`;
}
export function timestamp(value: number | string, locale?: string): string {
  if (!value) return '—'; const date = new Date(typeof value === 'number' ? value * 1000 : value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString(locale);
}
