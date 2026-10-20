import { isAxiosError, isCancel } from 'axios';

export function apiErrorMessage(error: unknown, fallback = 'Unable to complete operation'): string {
  if (isCancel(error) || (error instanceof DOMException && error.name === 'AbortError')) return '';
  if (isAxiosError<{ message?: string }>(error)) {
    if (error.response?.status === 401) return '';
    return error.response?.data?.message || error.message || fallback;
  }
  return error instanceof Error ? error.message : typeof error === 'string' ? error : fallback;
}
