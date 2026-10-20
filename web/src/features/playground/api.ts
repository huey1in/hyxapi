import { API } from '../../helpers';
import { API_ENDPOINTS } from './constants.ts';
import { requireServerSuccess } from './client.ts';
import type { ChatCompletionRequest, ChatCompletionResponse, ModelOption, GroupOption } from './types.ts';

const requestConfig = { skipErrorHandler: true };

export async function sendChatCompletion(payload: ChatCompletionRequest, signal?: AbortSignal): Promise<ChatCompletionResponse> {
  const response = await API.post(API_ENDPOINTS.CHAT_COMPLETIONS, payload, { ...requestConfig, signal });
  return response.data;
}

export async function getUserModels(group: string): Promise<ModelOption[]> {
  const { data } = await API.get(API_ENDPOINTS.USER_MODELS, { ...requestConfig, params: { group } });
  requireServerSuccess(data);
  return Array.isArray(data.data) ? data.data.filter((name: unknown): name is string => typeof name === 'string').map((name: string) => ({ label: name, value: name })) : [];
}

export async function getUserGroups(): Promise<GroupOption[]> {
  const { data } = await API.get(API_ENDPOINTS.USER_GROUPS, requestConfig);
  requireServerSuccess(data);
  if (!data.data || typeof data.data !== 'object') return [];
  return Object.entries(data.data as Record<string, { desc?: string; ratio?: number | string }>).map(([group, info]) => ({
    label: group, value: group, desc: info?.desc, ratio: info?.ratio ?? 1,
  }));
}
