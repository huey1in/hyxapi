import { API } from '../../helpers';
export async function request<T>(method: 'get' | 'post' | 'patch' | 'put', url: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const { data } = await API.request({ method, url, data: body, signal, skipErrorHandler: true });
  if (!data?.success) throw new Error(data?.message || '操作失败');
  return data.data as T;
}
export function errorText(error: unknown) {
  const cause = error as { response?: { data?: { message?: string } }; message?: string };
  return cause?.response?.data?.message || cause?.message || '操作失败';
}
