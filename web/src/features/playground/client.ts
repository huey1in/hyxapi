import { showError } from '../../helpers';

export function requireServerSuccess<T>(value: T): T {
  if (value && typeof value === 'object' && 'success' in value && value.success === false) {
    throw new Error('message' in value && typeof value.message === 'string' ? value.message : '请求失败');
  }
  return value;
}

export function handleServerError(error: unknown, fallback?: string): void {
  showError(fallback || (error instanceof Error ? error.message : '请求失败'));
}
