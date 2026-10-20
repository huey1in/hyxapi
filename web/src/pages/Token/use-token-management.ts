import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { API, copy, showSuccess } from '../../helpers';
import { showError } from '../../components/ui';
import type { ApiEnvelope } from '../../types/api';
import { useAuthStore } from '../../stores/auth-store';
import { tokenErrorMessage, tokenListItemSchema, tokenPageSchema, tokenSchema } from './token-management';
import type { ManagedToken, TokenListItem, TokenSelection } from './token-management';

const pageSize = 20;

export function useTokenManagement(preview: boolean, previewRows: unknown[]) {
  const { t } = useTranslation();
  const userID = useAuthStore((state) => state.auth.user?.id);
  const sessionID = useAuthStore((state) => state.auth.session?.sid);
  const identity = preview ? 'preview' : `${userID ?? ''}:${sessionID ?? ''}`;
  const client = useQueryClient();
  const [pageOwner, setPageOwner] = useState(identity);
  const [storedPage, setPage] = useState(1);
  // Render safe defaults immediately when ownership changes, before effects run
  // so a new user's query cannot inherit the previous session's page.
  const page = pageOwner === identity ? storedPage : 1;
  const [selection, setSelection] = useState<{ owner: string; values: TokenSelection }>({ owner: identity, values: {} });
  const secretValues = useRef<{ owner: string; values: Record<string, string> }>({ owner: identity, values: {} });
  const [pendingOwner, setPendingOwner] = useState('');
  const lifetime = useRef<AbortController | null>(null);
  const actionLock = useRef(false);
  const selected = selection.owner === identity ? selection.values : {};
  useEffect(() => {
    const owner = new AbortController(); lifetime.current = owner; actionLock.current = false;
    setPageOwner(identity);
    setPage(1); setPendingOwner('');
    setSelection({ owner: identity, values: {} });
    secretValues.current = { owner: identity, values: {} };
    return () => { owner.abort(); if (lifetime.current === owner) lifetime.current = null; };
  }, [identity]);

  const list = useQuery({
    queryKey: ['managed-tokens', identity, page],
    enabled: !preview && !!userID,
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
  const rows = preview ? previewRows.map((row) => tokenListItemSchema.parse(row)) : list.data?.items ?? [];
  const total = preview ? rows.length : list.data?.total ?? 0;
  useEffect(() => {
    if (list.data && page > Math.max(1, Math.ceil(total / pageSize))) setPage(Math.max(1, Math.ceil(total / pageSize)));
  }, [list.data, page, pageSize, total]);

  const resolveKeys = useCallback(async (tokens: { id: number }[], signal = lifetime.current?.signal) => {
    if (!signal || signal.aborted) return {};
    const existing = secretValues.current.owner === identity ? secretValues.current.values : {};
    const values = { ...existing };
    const missing = [...new Set(tokens.map((row) => row.id))].filter((id) => !values[id]);
    for (let start = 0; start < missing.length; start += 100) {
      const { data } = await API.post<ApiEnvelope<{ keys: Record<string, string> }>>('/api/token/batch/keys', { ids: missing.slice(start, start + 100) }, { signal, skipErrorHandler: true });
      signal.throwIfAborted();
      if (!data.success || !data.data?.keys) throw new Error(data.message || 'Unable to load API keys');
      for (const [id, key] of Object.entries(data.data.keys)) {
        if (typeof key === 'string' && key) values[id] = key.startsWith('sk-') ? key : `sk-${key}`;
      }
    }
    signal.throwIfAborted();
    const next = { owner: identity, values: { ...(secretValues.current.owner === identity ? secretValues.current.values : {}), ...values } };
    secretValues.current = next;
    return values;
  }, [identity]);

  const refresh = () => client.invalidateQueries({ queryKey: ['managed-tokens', identity] });
  const clearSelection = () => setSelection({ owner: identity, values: {} });
  const toggleSelection = (tokens: TokenListItem[], checked: boolean) => {
    const next = { ...selected };
    for (const token of tokens) { if (checked) next[token.id] = { id: token.id, name: token.name }; else delete next[token.id]; }
    if (Object.keys(next).length > 1000) { showError(t('Select at most 1000 API keys')); return; }
    setSelection({ owner: identity, values: next });
  };
  const runAction = async (action: (owner: AbortController) => Promise<void>): Promise<boolean> => {
    const owner = lifetime.current;
    if (!owner || owner.signal.aborted || actionLock.current || preview) return false;
    actionLock.current = true; setPendingOwner(identity);
    try { await action(owner); owner.signal.throwIfAborted(); return true; }
    catch (error) { const message = tokenErrorMessage(error); if (!owner.signal.aborted && message) showError(t(message)); return false; }
    finally { if (lifetime.current === owner) { actionLock.current = false; setPendingOwner(''); } }
  };
  const deleteTokens = (tokens: { id: number }[]) => runAction(async (owner) => {
    const ids = [...new Set(tokens.map((row) => row.id))];
    const { data } = await API.post<ApiEnvelope<number>>('/api/token/batch', { ids }, { signal: owner.signal, skipErrorHandler: true });
    owner.signal.throwIfAborted();
    if (!data.success || !Number.isInteger(data.data) || data.data < 0 || data.data > ids.length) throw new Error(data.message || 'Invalid API key deletion response');
    setSelection((current) => ({ owner: current.owner, values: Object.fromEntries(Object.entries(current.values).filter(([id]) => !ids.includes(Number(id)))) }));
    const retained = Object.fromEntries(Object.entries(secretValues.current.values).filter(([id]) => !ids.includes(Number(id))));
    secretValues.current = { owner: identity, values: retained };
    showSuccess(t('Deleted {{count}} of {{requested}} API keys', { count: data.data, requested: ids.length }));
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
  const copyTokens = (tokens: { id: number; name: string }[], includeNames: boolean) => runAction(async (owner) => {
    const resolved = await resolveKeys(tokens, owner.signal);
    if (tokens.some((token) => !resolved[token.id])) throw new Error('Some API keys are unavailable. Refresh the list and retry.');
    const value = tokens.map((token) => includeNames ? `${token.name}\t${resolved[token.id]}` : resolved[token.id]).join('\n');
    owner.signal.throwIfAborted();
    if (!await copy(value)) throw new Error('Failed to copy API keys');
    if (!owner.signal.aborted) showSuccess(t('Copied {{count}} API keys', { count: tokens.length }));
  });

  return {
    identity, rows, total, page, pageSize, selected,
    loading: !preview && list.isPending, fetching: list.isFetching, busy: pendingOwner === identity,
    error: list.isError ? t(tokenErrorMessage(list.error)) : '',
    setPage,
    refresh, clearSelection, toggleSelection, deleteTokens, loadToken, changeStatus, copyTokens,
  };
}
