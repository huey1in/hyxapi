import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { API, copy, showSuccess } from '../../helpers';
import { showError } from '../../components/ui';
import type { ApiEnvelope } from '../../types/api';
import { useAuthStore } from '../../stores/auth-store';
import { TOKEN_PAGE_SIZE as pageSize, tokenErrorMessage, tokenPageSchema, tokenSchema } from './token-management';
import type { ManagedToken, TokenListItem } from './token-management';

export function useTokenManagement() {
  const { t } = useTranslation();
  const userID = useAuthStore((state) => state.auth.user?.id);
  const sessionID = useAuthStore((state) => state.auth.session?.sid);
  const identity = `${userID ?? ''}:${sessionID ?? ''}`;
  const client = useQueryClient();
  const [pageOwner, setPageOwner] = useState(identity);
  const [storedPage, setPage] = useState(1);
  // Render safe defaults immediately when ownership changes, before effects run
  // so a new user's query cannot inherit the previous session's page.
  const page = pageOwner === identity ? storedPage : 1;
  const secretValues = useRef<{ owner: string; values: Record<string, string> }>({ owner: identity, values: {} });
  const [pendingOwner, setPendingOwner] = useState('');
  const lifetime = useRef<AbortController | null>(null);
  const actionLock = useRef(false);
  useEffect(() => {
    const owner = new AbortController(); lifetime.current = owner; actionLock.current = false;
    setPageOwner(identity);
    setPage(1); setPendingOwner('');
    secretValues.current = { owner: identity, values: {} };
    return () => { owner.abort(); if (lifetime.current === owner) lifetime.current = null; };
  }, [identity]);

  const list = useQuery({
    queryKey: ['managed-tokens', identity, page],
    enabled: !!userID,
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams({ p: String(page), size: String(pageSize) });
      const { data } = await API.get<ApiEnvelope<unknown>>(`/api/token/?${params}`, { signal, skipErrorHandler: true });
      signal.throwIfAborted();
      if (!data.success) throw new Error(data.message || 'Unable to load API keys');
      const parsed = tokenPageSchema.safeParse(data.data);
      if (!parsed.success) throw new Error('Invalid API key list response');
      return parsed.data;
    },
    retry: false, refetchOnWindowFocus: false, gcTime: 0,
  });
  const rows = list.data?.items ?? [];
  const total = list.data?.total ?? 0;
  useEffect(() => {
    if (list.data && page > Math.max(1, Math.ceil(total / pageSize))) setPage(Math.max(1, Math.ceil(total / pageSize)));
  }, [list.data, page, pageSize, total]);

  const refresh = () => Promise.all([
    client.invalidateQueries({ queryKey: ['managed-tokens', identity] }),
    client.invalidateQueries({ queryKey: ['dashboard-keys'] }),
  ]);
  const runAction = async (action: (owner: AbortController) => Promise<void>): Promise<boolean> => {
    const owner = lifetime.current;
    if (!owner || owner.signal.aborted || actionLock.current) return false;
    actionLock.current = true; setPendingOwner(identity);
    try { await action(owner); owner.signal.throwIfAborted(); return true; }
    catch (error) { const message = tokenErrorMessage(error); if (!owner.signal.aborted && message) showError(t(message)); return false; }
    finally { if (lifetime.current === owner) { actionLock.current = false; setPendingOwner(''); } }
  };
  const deleteToken = (token: { id: number }) => runAction(async (owner) => {
    const { data } = await API.delete<ApiEnvelope<unknown>>(`/api/token/${token.id}`, { signal: owner.signal, skipErrorHandler: true });
    owner.signal.throwIfAborted();
    if (!data.success) throw new Error(data.message || 'Invalid API key deletion response');
    if (secretValues.current.owner === identity) delete secretValues.current.values[token.id];
    showSuccess(t('API key deleted'));
    await refresh();
  });
  const loadToken = async (token: TokenListItem) => {
    let detail: ManagedToken | undefined;
    const success = await runAction(async (owner) => {
      const { data } = await API.get<ApiEnvelope<unknown>>(`/api/token/${token.id}`, { signal: owner.signal, skipErrorHandler: true });
      owner.signal.throwIfAborted();
      if (!data.success) throw new Error(data.message || 'Unable to load API keys');
      const parsed = tokenSchema.safeParse(data.data);
      if (!parsed.success || parsed.data.id !== token.id) throw new Error('Invalid API key response');
      detail = parsed.data;
    });
    return success ? detail : undefined;
  };
  const changeStatus = (token: TokenListItem) => runAction(async (owner) => {
    const { data } = await API.put<ApiEnvelope<ManagedToken>>('/api/token/?status_only=true', { id: token.id, status: token.status === 1 ? 2 : 1 }, { signal: owner.signal, skipErrorHandler: true });
    owner.signal.throwIfAborted();
    if (!data.success) throw new Error(data.message || 'Unable to update API key status');
    showSuccess(t('API key status updated')); await refresh();
  });
  const copyToken = (token: { id: number }) => runAction(async (owner) => {
    let value = secretValues.current.owner === identity ? secretValues.current.values[token.id] : undefined;
    if (!value) {
      const { data } = await API.post<ApiEnvelope<{ key: string }>>(`/api/token/${token.id}/key`, undefined, { signal: owner.signal, skipErrorHandler: true });
      owner.signal.throwIfAborted();
      if (!data.success || typeof data.data?.key !== 'string' || !data.data.key) throw new Error(data.message || 'Invalid API key response');
      value = data.data.key.startsWith('sk-') ? data.data.key : `sk-${data.data.key}`;
      secretValues.current = { owner: identity, values: { ...secretValues.current.values, [token.id]: value } };
    }
    owner.signal.throwIfAborted();
    if (!await copy(value)) throw new Error('Failed to copy API keys');
    if (!owner.signal.aborted) showSuccess(t('API key copied'));
  });

  return {
    identity, rows, total, page, pageSize,
    loading: list.isPending, fetching: list.isFetching, busy: pendingOwner === identity,
    error: list.isError ? t(tokenErrorMessage(list.error)) : '',
    setPage,
    refresh, deleteToken, loadToken, changeStatus, copyToken,
  };
}
