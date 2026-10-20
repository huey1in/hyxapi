import axios from 'axios';

export class AuthOperationError extends Error {
  constructor(message: string, readonly code?: string, options?: ErrorOptions) {
    super(message, options); this.name = 'AuthOperationError';
  }
  static from(error: unknown, fallback = '验证失败，请重试'): AuthOperationError {
    if (error instanceof AuthOperationError) return error;
    if (axios.isAxiosError(error)) return new AuthOperationError(error.response?.data?.message || error.message || fallback, error.response?.data?.code, { cause: error });
    return new AuthOperationError(error instanceof Error ? error.message : fallback, undefined, { cause: error });
  }
}
export const authRequestOptions = { skipErrorHandler: true };
export async function authResult<T>(request: Promise<{ data: { success: boolean; message?: string; code?: string; data?: T } }>): Promise<T> {
  try {
    const { data } = await request;
    if (!data.success || data.data === undefined) throw new AuthOperationError(data.message || '操作失败，请重试', data.code);
    return data.data;
  } catch (error) {
    if (axios.isCancel(error) || (error instanceof DOMException && error.name === 'AbortError')) throw error;
    throw AuthOperationError.from(error);
  }
}
