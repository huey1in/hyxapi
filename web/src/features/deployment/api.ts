import { API } from '../../helpers';

export type Settings = { enabled: boolean; configured: boolean; can_connect: boolean };
export type Deployment = { id: string; deployment_name: string; status: string; hardware_name: string; hardware_info?: string; hardware_id?: number; hardware_quantity?: number; instance_count: number; created_at: number; compute_minutes_remaining: number; amount_paid?: number; gpus_per_container?: number; locations?: { id: number; name: string }[]; container_config?: { image_url?: string; env_variables?: Record<string, string>; entrypoint?: string[]; traffic_port?: number } };
export type Hardware = { id: number; name: string; max_gpus: number; available: boolean; available_count: number };
export type Location = { id: number; name: string; available: number };
export type Replica = { location_id: number; location_name: string; available_count: number };
export type Quote = { estimated_cost: number; currency: string; estimation_valid: boolean; price_breakdown: { hourly_rate: number } };
export type Container = { container_id: string; status: string; hardware: string; public_url: string; events: { time: number; message: string }[]; created_at: number; device_id: string; uptime_percent: number };
export type Page = { items: Deployment[]; total: number };

export async function request<T>(method: 'get' | 'post' | 'put' | 'delete', path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const { data } = await API.request({ method, url: path, data: body, signal, skipErrorHandler: true });
  if (!data?.success) throw new Error(data?.message || '操作失败');
  return data.data as T;
}
export function errorText(error: unknown): string {
  const cause = error as { response?: { data?: { message?: string } }; message?: string };
  return cause?.response?.data?.message || cause?.message || '操作失败';
}
export function date(value: number) { return value > 0 ? new Date(value * 1000).toLocaleString() : '—'; }
export const statuses: Record<string, string> = { running: '运行中', completed: '已完成', failed: '失败', 'deployment requested': '部署申请中', 'termination requested': '终止申请中', destroyed: '已终止' };
