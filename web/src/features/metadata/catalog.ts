import { API } from '../../helpers';

export type Vendor = { id: number; name: string; description?: string; icon?: string; version?: string; model_count?: number };
export type Model = {
  id: number; model_name: string; description?: string; icon?: string; tags?: string;
  vendor_id?: number; endpoints?: string; status: number; sync_official: number; name_rule: number;
  square_state?: string; has_metadata?: boolean; configured_channel_count?: number;
  bound_channels?: { name: string; type: number }[]; enable_groups?: string[];
  supported_endpoints?: string[]; quota_types?: number[]; matched_models?: string[];
};
export type Page<T> = { items: T[]; total: number };
export type Operation = { action: 'assign' | 'merge' | 'delete'; vendor_ids?: number[]; model_ids?: number[]; target_vendor_id?: number };
export type OperationPreview = { version: string; models: { id: number; model_name: string; vendor_name: string }[]; sources: Vendor[]; target?: Vendor };
export type SyncField = { field: string; local: unknown; upstream: unknown };
export type SyncCandidate = { model_name: string; kind: string; scope: string; record_version: string; fields: SyncField[]; vendor_to_create?: string };
export type SyncPreview = { source: { locale: string; version: string; models_url: string }; candidates: SyncCandidate[] };

export async function request<T>(method: 'get' | 'post' | 'put' | 'delete', path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await API.request({ method, url: path, data: body, signal, skipErrorHandler: true });
  if (!response.data?.success) throw new Error(response.data?.message || '操作失败');
  return response.data.data as T;
}

export function errorText(error: unknown): string {
  const cause = error as { response?: { data?: { message?: string } }; message?: string };
  return cause?.response?.data?.message || cause?.message || '操作失败';
}

export const ruleOptions = [
  { value: '0', label: '精确匹配' }, { value: '1', label: '前缀匹配' },
  { value: '2', label: '包含匹配' }, { value: '3', label: '后缀匹配' },
];
export const fieldLabels: Record<string, string> = { description: '描述', icon: '图标', tags: '标签', vendor: '供应商', endpoints: '端点配置', name_rule: '匹配规则', status: '广场可见性' };
export const stateLabels: Record<string, string> = { visible: '可用', hidden: '已隐藏', unavailable: '不可用', partial: '部分可用' };
