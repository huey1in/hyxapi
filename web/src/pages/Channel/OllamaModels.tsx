import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { API } from '../../helpers';
import { Button, ConfirmDialog, Input, Modal, Table } from '../../components/ui';
import type { TableColumn } from '../../components/ui/layout/Table';
import { hasPermission } from '../../lib/admin-permissions';
import { getFreshAuthHeaders } from '../../lib/auth-session';
import { useAuthStore } from '../../stores/auth-store';
import { downloadPercent, readOllamaProgress } from './ollama-progress';
import type { OllamaProgress } from './ollama-progress';

const modelSchema = z.object({
  name: z.string().min(1), size: z.number().finite().nonnegative(),
  details: z.object({ family: z.string().optional(), parameter_size: z.string().optional(), quantization_level: z.string().optional() }).optional(),
});
const snapshotSchema = z.object({ models: z.array(modelSchema), configured_models: z.array(z.string()) });
type ModelRow = { name: string; installed: boolean; configured: boolean; model?: z.infer<typeof modelSchema> };
type Operation = { action: 'pull'; name: string } | { action: 'delete'; name: string }
  | { action: 'add'; names: string[] } | { action: 'remove'; names: string[] };
type Props = { channel: { id: number; name: string }; onClose: () => void; onChanged: () => void };

function bytes(value: number): string {
  if (value < 1024) return `${value} B`;
  const power = Math.min(4, Math.floor(Math.log(value) / Math.log(1024)));
  return `${(value / 1024 ** power).toFixed(1)} ${['B', 'KiB', 'MiB', 'GiB', 'TiB'][power]}`;
}

export default function OllamaModels({ channel, onClose, onChanged }: Props) {
  const { t, i18n } = useTranslation();
  const user = useAuthStore((state) => state.auth.user);
  const canManage = hasPermission(user, 'channel', 'sensitive_write');
  const canWrite = hasPermission(user, 'channel', 'write');
  const [search, setSearch] = useState('');
  const [modelName, setModelName] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmation, setConfirmation] = useState<Operation | null>(null);
  const [busy, setBusy] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [progress, setProgress] = useState<OllamaProgress>();
  const [feedback, setFeedback] = useState<{ error: boolean; message: string }>();
  const lifetime = useRef<AbortController | null>(null);
  const active = useRef<AbortController | null>(null);
  const lock = useRef(false);
  useEffect(() => {
    const owner = new AbortController(); lifetime.current = owner;
    return () => { owner.abort(); active.current?.abort(); lifetime.current = null; };
  }, [channel.id, user?.id]);
  const query = useQuery({
    queryKey: ['ollama-models', user?.id, channel.id], enabled: canManage,
    queryFn: async ({ signal }) => {
      const { data } = await API.get(`/api/channel/${channel.id}/ollama/models`, { signal, skipErrorHandler: true });
      signal.throwIfAborted();
      if (!data.success) throw new Error(data.message || t('Unable to load Ollama models'));
      const parsed = snapshotSchema.safeParse(data.data);
      if (!parsed.success) throw new Error(t('Invalid Ollama model response'));
      return parsed.data;
    },
    retry: false, gcTime: 0, refetchOnWindowFocus: false,
  });
  const version = useQuery({
    queryKey: ['ollama-version', user?.id, channel.id], enabled: canManage,
    queryFn: async ({ signal }) => {
      const { data } = await API.get(`/api/channel/ollama/version/${channel.id}`, { signal, skipErrorHandler: true });
      signal.throwIfAborted();
      if (!data.success || typeof data.data?.version !== 'string') throw new Error(data.message || t('Unable to load Ollama version'));
      return data.data.version as string;
    },
    retry: false, gcTime: 0, refetchOnWindowFocus: false,
  });
  const snapshot = query.data;
  const disabled = busy || query.isFetching || !query.isSuccess || !canManage;
  const rows = new Map<string, ModelRow>();
  for (const name of snapshot?.configured_models ?? []) rows.set(name, { name, installed: false, configured: true });
  for (const model of snapshot?.models ?? []) rows.set(model.name, { name: model.name, installed: true, configured: rows.get(model.name)?.configured ?? false, model });
  const visible = [...rows.values()].filter((row) => row.name.toLowerCase().includes(search.trim().toLowerCase())).sort((a, b) => a.name.localeCompare(b.name));
  const allVisibleSelected = visible.length > 0 && visible.every((row) => selected.has(row.name));
  const toggle = (name: string) => setSelected((current) => { const next = new Set(current); if (next.has(name)) next.delete(name); else next.add(name); return next; });
  const toggleVisible = () => setSelected((current) => {
    const next = new Set(current);
    for (const row of visible) { if (allVisibleSelected) next.delete(row.name); else next.add(row.name); }
    return next;
  });
  const request = (operation: Operation) => {
    if (disabled || (['add', 'remove'].includes(operation.action) && !canWrite)) return;
    setFeedback(undefined); setConfirmation(operation);
  };
  const apply = async () => {
    const owner = lifetime.current;
    const operation = confirmation;
    if (!owner || owner.signal.aborted || !operation || lock.current || !canManage || (['add', 'remove'].includes(operation.action) && !canWrite)) return;
    const controller = new AbortController(); active.current = controller;
    const abort = () => controller.abort(); owner.signal.addEventListener('abort', abort, { once: true });
    lock.current = true; setBusy(true); setPulling(operation.action === 'pull'); setProgress(undefined);
    try {
      if (operation.action === 'pull') {
        setConfirmation(null);
        const headers = await getFreshAuthHeaders();
        controller.signal.throwIfAborted();
        if (useAuthStore.getState().auth.user?.id !== user?.id) throw new Error(t('Account changed'));
        const response = await fetch(API.getUri({ url: '/api/channel/ollama/pull/stream' }), {
          method: 'POST', credentials: 'include', signal: controller.signal,
          headers: { ...headers, Accept: 'text/event-stream', 'Accept-Language': i18n.language },
          body: JSON.stringify({ channel_id: channel.id, model_name: operation.name }),
        });
        await readOllamaProgress(response, controller.signal, (value) => { if (!owner.signal.aborted) setProgress(value); });
        setFeedback({ error: false, message: t('Model download completed') });
      } else if (operation.action === 'delete') {
        const { data } = await API.delete('/api/channel/ollama/delete', { data: { channel_id: channel.id, model_name: operation.name }, signal: controller.signal, skipErrorHandler: true });
        controller.signal.throwIfAborted();
        if (!data.success) throw new Error(data.message || t('Model deletion failed'));
        setFeedback({ error: false, message: t('Model deleted from Ollama') });
      } else {
        const { data } = await API.post(`/api/channel/${channel.id}/ollama/models`, { action: operation.action, models: operation.names }, { signal: controller.signal, skipErrorHandler: true });
        controller.signal.throwIfAborted();
        if (!data.success) throw new Error(data.message || t('Unable to update channel models'));
        setSelected(new Set());
        setFeedback({ error: false, message: t('Channel models updated') }); onChanged();
      }
    } catch (error) {
      if (!owner.signal.aborted) setFeedback({ error: true, message: controller.signal.aborted
        ? t('Stopped waiting. Ollama may continue downloading the model.')
        : error instanceof Error ? t(error.message) : t('Ollama operation failed') });
    } finally {
      owner.signal.removeEventListener('abort', abort); active.current = null;
      if (!owner.signal.aborted) {
        setConfirmation(null); setPulling(false);
        await query.refetch();
        if (!owner.signal.aborted) { lock.current = false; setBusy(false); }
      }
    }
  };
  const columns: TableColumn<ModelRow>[] = [
    { key: 'select', mobileRole: 'selection', title: <input className='accent-ui-accent' type='checkbox' aria-label={t('Select visible models')} checked={allVisibleSelected} disabled={disabled} onChange={toggleVisible} />, render: (row) => <input className='accent-ui-accent' type='checkbox' aria-label={`${t('Select model')} ${row.name}`} checked={selected.has(row.name)} disabled={disabled} onChange={() => toggle(row.name)} /> },
    { key: 'name', title: t('Model'), render: (row) => <code className='break-all'>{row.name}</code> },
    { key: 'details', title: t('Details'), render: (row) => <span className='break-words'>{[row.model?.details?.family, row.model?.details?.parameter_size, row.model?.details?.quantization_level].filter(Boolean).join(' · ') || '—'}</span> },
    { key: 'size', title: t('Size'), render: (row) => row.model ? bytes(row.model.size) : '—' },
    { key: 'configured', title: t('Channel routing'), render: (row) => t(row.configured ? 'Configured' : 'Not configured') },
    { key: 'installed', title: t('Installation'), render: (row) => t(row.installed ? 'Installed' : 'Not installed') },
    { key: 'actions', mobileRole: 'actions' as const, title: t('Actions'), render: (row) => <div className='flex gap-1'>
      <Button size='sm' variant='secondary' disabled={disabled} onClick={() => request({ action: 'pull', name: row.name })}>{t('Download model')}</Button>
      {row.installed && <Button size='sm' variant='secondary' disabled={disabled} onClick={() => request({ action: 'delete', name: row.name })}>{t('Delete')}</Button>}
    </div> },
  ];
  const percent = downloadPercent(progress);
  const close = () => { if (!confirmation && (!lock.current || pulling)) { active.current?.abort(); onClose(); } };
  const title = confirmation?.action === 'pull' ? 'Download this model?' : confirmation?.action === 'delete' ? 'Delete this installed model?' : 'Update channel models?';
  const description = confirmation?.action === 'pull' ? 'The model server will download files and use its disk space.'
    : confirmation?.action === 'delete' ? 'This removes the files from Ollama. Channel routing configuration is retained.'
      : 'Selected names will be added to or removed from the latest channel model list. Other names are retained.';
  return <>
    <Modal open title={`${t('Ollama models')} · ${channel.name}`} width={1100} onClose={close} onConfirm={close} footer={<Button disabled={busy && !pulling} onClick={close}>{t('Close')}</Button>}>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <span className='text-sm text-ui-text-2'>{t('Ollama version')}: {version.isSuccess ? version.data : version.isError ? t('Unavailable') : '…'}</span>
        <Button size='sm' variant='secondary' disabled={busy || query.isFetching || version.isFetching} onClick={() => { void query.refetch(); void version.refetch(); }}>{t('Refresh')}</Button>
      </div>
      {version.isError && <p role='status' className='text-xs text-ui-text-3 break-words'>{version.error.message}</p>}
      <div className='space-y-1'>
        <label htmlFor='ollama-download-name' className='text-sm text-ui-text-2'>{t('Model name to download')}</label>
        <div className='flex flex-wrap items-center gap-2'>
          <div className='min-w-0 grow'><Input id='ollama-download-name' value={modelName} onChange={setModelName} placeholder='qwen3:8b' maxLength={255} disabled={busy} /></div>
          <Button variant='secondary' disabled={disabled || !modelName.trim()} onClick={() => request({ action: 'pull', name: modelName.trim() })}>{t('Download model')}</Button>
        </div>
      </div>
      {pulling && <div role='status' className='space-y-2 rounded-lg border border-ui-border p-3'>
        <p className='text-sm break-words'>{progress?.status || t('Waiting for download progress')}</p>
        {progress?.digest && <code className='block text-xs text-ui-text-3 break-all'>{progress.digest}</code>}
        {percent !== undefined && <><div role='progressbar' aria-label={t('Download progress')} aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} className='h-1.5 rounded bg-ui-border overflow-hidden'><div className='h-full bg-ui-text-2' style={{ width: `${percent}%` }} /></div><p className='text-xs text-ui-text-2'>{percent.toFixed(1)}% · {bytes(progress?.completed ?? 0)} / {bytes(progress?.total ?? 0)}</p></>}
        <Button size='sm' variant='secondary' onClick={() => active.current?.abort()}>{t('Stop waiting')}</Button>
        <p className='text-xs text-ui-text-3'>{t('Ollama may continue downloading after this request is canceled.')}</p>
      </div>}
      {feedback && <p role={feedback.error ? 'alert' : 'status'} className={`text-sm break-words ${feedback.error ? 'text-ui-danger' : 'text-ui-text-2'}`}>{feedback.message}</p>}
      {!canManage && <p role='alert'>{t('Sensitive channel permission is required')}</p>}
      {query.isPending && canManage && <p role='status'>{t('Loading models')}</p>}
      {query.isError && <p role='alert' className='text-sm text-ui-danger break-words'>{query.error.message}{snapshot && ` · ${t('Previous model snapshot; refresh before making changes')}`}</p>}
      {snapshot && <>
        <Input aria-label={t('Search models')} placeholder={t('Search models')} value={search} onChange={setSearch} disabled={busy} />
        <div className='flex flex-wrap items-center gap-2'>
          <span className='text-sm text-ui-text-2'>{t('Selected')}: {selected.size}</span>
          <Button size='sm' variant='secondary' disabled={busy || !selected.size} onClick={() => setSelected(new Set())}>{t('Clear selection')}</Button>
          {canWrite && <>
            <Button size='sm' variant='secondary' disabled={disabled || !selected.size || selected.size > 1000} onClick={() => request({ action: 'add', names: [...selected] })}>{t('Add selected to channel')}</Button>
            <Button size='sm' variant='secondary' disabled={disabled || !selected.size || selected.size > 1000} onClick={() => request({ action: 'remove', names: [...selected] })}>{t('Remove selected from channel')}</Button>
          </>}
        </div>
        {selected.size > 1000 && <p role='alert'>{t('Select at most 1000 models')}</p>}
        <Table columns={columns} rows={visible} rowKey='name' minWidth={920} emptyText={t('No matching models')} />
      </>}
    </Modal>
    {confirmation && <ConfirmDialog open title={t(title)} description={<><span>{t(description)}</span><span className='block mt-2 text-sm break-all'>{'name' in confirmation ? confirmation.name : `${t('Selected')}: ${confirmation.names.length}`}</span></>}
      confirmText={t('Confirm')} cancelText={t('Cancel')} loading={busy} closeOnConfirm={false} onConfirm={() => void apply()} onClose={() => { if (!lock.current) setConfirmation(null); }} />}
  </>;
}
