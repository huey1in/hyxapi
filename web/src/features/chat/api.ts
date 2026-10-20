import { API } from '../../helpers';
import { useAuthStore } from '../../stores/auth-store';
import { getFirstActiveKey, normalizeApiKey, type ActiveApiKey } from './chat-links';

export async function fetchActiveChatKey(ownerId: number): Promise<string> {
  const seen = new Set<number>();
  for (let page = 1; ; page++) {
    if (useAuthStore.getState().auth.user?.id !== ownerId) throw new Error('登录账户已变化，请重新打开客户端');
    const { data } = await API.get(`/api/token/?p=${page}&size=50`);
    if (useAuthStore.getState().auth.user?.id !== ownerId) throw new Error('登录账户已变化，请重新打开客户端');
    if (!data.success) throw new Error(data.message || '无法加载 API key');
    const items: ActiveApiKey[] = Array.isArray(data.data) ? data.data : data.data?.items || [];
    const active = getFirstActiveKey(items);
    if (active?.id) {
      const result = await API.post(`/api/token/${active.id}/key`);
      if (useAuthStore.getState().auth.user?.id !== ownerId) throw new Error('登录账户已变化，请重新打开客户端');
      if (!result.data.success || !result.data.data?.key) throw new Error(result.data.message || '无法加载 API key');
      return normalizeApiKey(result.data.data.key);
    }
    const added = items.filter((item) => item.id && !seen.has(item.id));
    added.forEach((item) => seen.add(item.id!));
    if (!added.length || items.length < 50 || seen.size >= (data.data?.total ?? Infinity)) break;
  }
  throw new Error('没有可用的 API key，请先创建或启用令牌');
}
