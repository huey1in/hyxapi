import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { API } from '../../helpers';
import { Button, ConfirmDialog, Input, Modal } from '../../components/ui';
import { hasPermission } from '../../lib/admin-permissions';
import { useAuthStore } from '../../stores/auth-store';

const names = z.array(z.string()).nullable().transform((value) => value ?? []);
const previewSchema = z.object({ channel_id: z.number().int().positive(), channel_name: z.string(), add_models: names, remove_models: names, last_check_time: z.number(), revision: z.string().min(1) });
const resultSchema = z.object({ added_models: names, removed_models: names, remaining_models: names, remaining_remove_models: names });
const batchSchema = z.object({ processed_channels: z.number().int().nonnegative(), added_models: z.number().int().nonnegative(), removed_models: z.number().int().nonnegative(), failed_channel_ids: z.array(z.number().int()) });
type Preview = z.infer<typeof previewSchema>;
type Result = z.infer<typeof resultSchema>;
type Props = { channel: { id: number; name: string }; onClose: () => void; onChanged: () => void };

function ModelSelection({ title, models, selected, onChange, disabled }: { title: string; models: string[]; selected: Set<string>; onChange: (value: Set<string>) => void; disabled: boolean }) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const visible = models.filter((name) => name.toLowerCase().includes(search.trim().toLowerCase()));
  const all = visible.length > 0 && visible.every((name) => selected.has(name));
  const toggle = (model: string) => { const next = new Set(selected); if (next.has(model)) next.delete(model); else next.add(model); onChange(next); };
  return <section aria-label={title} className='min-w-0 space-y-2'>
    <h4 className='font-medium text-sm'>{title} ({selected.size}/{models.length})</h4>
    <Input aria-label={`${t('Search models')} · ${title}`} value={search} onChange={setSearch} disabled={disabled} placeholder={t('Search models')} />
    <label className='flex gap-2 items-center text-sm'><input className='accent-ui-accent' type='checkbox' checked={all} disabled={disabled || !visible.length} onChange={() => {
      const next = new Set(selected); for (const name of visible) { if (all) next.delete(name); else next.add(name); } onChange(next);
    }} />{t('Select visible models')}</label>
    <div className='max-h-60 overflow-y-auto rounded-lg border border-ui-border p-3 space-y-2'>
      {visible.length ? visible.map((model) => <label key={model} className='flex gap-2 items-start text-sm break-all'><input className='mt-1 shrink-0 accent-ui-accent' type='checkbox' checked={selected.has(model)} disabled={disabled} onChange={() => toggle(model)} /><code>{model}</code></label>)
        : <p className='text-sm text-ui-text-3'>{t('No matching models')}</p>}
    </div>
  </section>;
}

export default function UpstreamUpdates({ channel, onClose, onChanged }: Props) {
  const { t, i18n } = useTranslation();
  const user = useAuthStore((state) => state.auth.user);
  const canDetect = hasPermission(user, 'channel', 'operate');
  const canApply = hasPermission(user, 'channel', 'write');
  const client = useQueryClient();
  const queryKey = ['channel-upstream-preview', user?.id, channel.id];
  const [add, setAdd] = useState<Set<string>>(new Set());
  const [remove, setRemove] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<'detect' | 'apply' | null>(null);
  const [confirmation, setConfirmation] = useState<{ revision: string; add: string[]; remove: string[] } | null>(null);
  const [error, setError] = useState('');
  const [result, setResult] = useState<Result>();
  const owner = useRef<AbortController | null>(null);
  const lock = useRef(false);
  useEffect(() => {
    const controller = new AbortController(); owner.current = controller;
    return () => { controller.abort(); owner.current = null; };
  }, [channel.id, user?.id]);
  const query = useQuery({
    queryKey,
    queryFn: async ({ signal }): Promise<Preview> => {
      const { data } = await API.get(`/api/channel/${channel.id}/upstream_updates`, { signal, skipErrorHandler: true });
      signal.throwIfAborted();
      if (!data.success) throw new Error(data.message || t('Unable to load model preview'));
      const parsed = previewSchema.safeParse(data.data);
      if (!parsed.success || parsed.data.channel_id !== channel.id) throw new Error(t('Invalid model preview response'));
      return parsed.data;
    },
    retry: false, gcTime: 0, refetchOnWindowFocus: false,
  });
  useEffect(() => { if (query.data) { setAdd(new Set(query.data.add_models)); setRemove(new Set()); } }, [query.data]);
  const disabled = !!busy || query.isFetching || !query.isSuccess || !!error;
  const refresh = async () => { if (!lock.current) { setError(''); setResult(undefined); await query.refetch(); } };
  const detect = async () => {
    const lifetime = owner.current;
    if (!lifetime || lifetime.signal.aborted || lock.current || !canDetect) return;
    lock.current = true; setBusy('detect'); setError(''); setResult(undefined);
    try {
      const { data } = await API.post('/api/channel/upstream_updates/detect', { id: channel.id }, { signal: lifetime.signal, skipErrorHandler: true });
      lifetime.signal.throwIfAborted();
      if (!data.success) throw new Error(data.message || t('Model detection failed'));
      const parsed = previewSchema.safeParse(data.data);
      if (!parsed.success || parsed.data.channel_id !== channel.id) throw new Error(t('Invalid model preview response'));
      client.setQueryData(queryKey, parsed.data); setAdd(new Set(parsed.data.add_models)); setRemove(new Set()); onChanged();
    } catch (cause) { if (!lifetime.signal.aborted) setError(cause instanceof Error ? t(cause.message) : t('Model detection failed')); }
    finally { if (!lifetime.signal.aborted) { lock.current = false; setBusy(null); } }
  };
  const apply = async () => {
    const lifetime = owner.current;
    if (!lifetime || lifetime.signal.aborted || !confirmation || lock.current || !canApply) return;
    lock.current = true; setBusy('apply'); setError('');
    try {
      const { data } = await API.post('/api/channel/upstream_updates/apply', { id: channel.id, expected_revision: confirmation.revision, add_models: confirmation.add, remove_models: confirmation.remove, ignore_models: [] }, { signal: lifetime.signal, skipErrorHandler: true });
      lifetime.signal.throwIfAborted();
      if (!data.success) throw new Error(data.message || t('Unable to apply model changes'));
      const parsed = resultSchema.safeParse(data.data);
      if (!parsed.success) throw new Error(t('Invalid model update response'));
      setResult(parsed.data); onChanged();
    } catch (cause) { if (!lifetime.signal.aborted) setError(cause instanceof Error ? t(cause.message) : t('Unable to apply model changes')); }
    finally { if (!lifetime.signal.aborted) { setConfirmation(null); lock.current = false; setBusy(null); } }
  };
  const close = () => { if (!confirmation && busy !== 'apply') onClose(); };
  const selectedCount = add.size + remove.size;
  const list = (title: string, models: string[]) => <section className='min-w-0 space-y-1'><h4 className='font-medium text-sm'>{t(title)} ({models.length})</h4><pre className='text-xs whitespace-pre-wrap break-all max-h-40 overflow-y-auto rounded-lg border border-ui-border p-3'>{models.join('\n') || '—'}</pre></section>;
  return <>
    <Modal open title={`${t('Upstream model updates')} · ${channel.name}`} width={900} onClose={close} onConfirm={close} footer={<>
      <Button variant='secondary' disabled={busy === 'apply'} onClick={close}>{t('Close')}</Button>
      {!result && canApply && <Button disabled={disabled || !selectedCount || selectedCount > 1000} onClick={() => { if (query.data) setConfirmation({ revision: query.data.revision, add: [...add], remove: [...remove] }); }}>{t('Review selected changes')}</Button>}
    </>}>
      <div className='flex flex-wrap items-center gap-2'>
        <Button size='sm' variant='secondary' disabled={!!busy || query.isFetching} onClick={() => void refresh()}>{t('Refresh preview')}</Button>
        {canDetect && <Button size='sm' variant='secondary' loading={busy === 'detect'} disabled={!!busy || query.isFetching} onClick={() => void detect()}>{t('Check upstream now')}</Button>}
      </div>
      <p className='text-xs text-ui-text-3'>{t('Detection only stages changes. Channel models change after confirmation.')}</p>
      {query.isPending && <p role='status'>{t('Loading model preview')}</p>}
      {query.isError && <p role='alert' className='text-sm text-ui-danger break-words'>{query.error.message}</p>}
      {error && <p role='alert' className='text-sm text-ui-danger break-words'>{error}</p>}
      {query.data && <p className='text-xs text-ui-text-3'>{t('Last checked')}: {query.data.last_check_time > 0 ? new Date(query.data.last_check_time * 1000).toLocaleString(i18n.language) : t('Not checked yet')}</p>}
      {busy === 'detect' && <p role='status' className='text-sm'>{t('Checking upstream models')}</p>}
      {result ? <div className='space-y-3'>
        <p role='status' className='font-medium text-sm'>{t('Model changes applied')}</p>
        <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>{list('Added models', result.added_models)}{list('Removed models', result.removed_models)}{list('Pending additions', result.remaining_models)}{list('Pending removals', result.remaining_remove_models)}</div>
        <Button size='sm' variant='secondary' onClick={() => void refresh()}>{t('Review remaining changes')}</Button>
      </div> : query.data && <>
        {!!error && <p className='text-xs text-ui-text-3'>{t('Previous model snapshot; refresh before making changes')}</p>}
        <p className='text-xs text-ui-text-3'>{t('Additions are selected initially. Select removals explicitly.')}</p>
        {selectedCount > 1000 && <p role='alert'>{t('Select at most 1000 models')}</p>}
        <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
          <ModelSelection title={t('Pending additions')} models={query.data.add_models} selected={add} onChange={setAdd} disabled={disabled || !canApply} />
          <ModelSelection title={t('Pending removals')} models={query.data.remove_models} selected={remove} onChange={setRemove} disabled={disabled || !canApply} />
        </div>
      </>}
    </Modal>
    {confirmation && <ConfirmDialog open title={t('Apply selected model changes?')} description={<span className='space-y-2 block'>
      <span className='block'>{t('Only the selected names will change. Unselected models remain pending.')}</span>
      <span className='block text-xs whitespace-pre-wrap break-all max-h-48 overflow-y-auto'>{t('Added models')}: {confirmation.add.join(', ') || '—'}{'\n'}{t('Removed models')}: {confirmation.remove.join(', ') || '—'}</span>
    </span>} confirmText={t('Confirm')} cancelText={t('Cancel')} loading={busy === 'apply'} closeOnConfirm={false} onConfirm={() => void apply()} onClose={() => { if (!lock.current) setConfirmation(null); }} />}
  </>;
}

export function ApplyAllUpstreamUpdates({ onChanged }: { onChanged: () => void }) {
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.auth.user);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<z.infer<typeof batchSchema>>();
  const [error, setError] = useState('');
  const owner = useRef<AbortController | null>(null);
  const lock = useRef(false);
  useEffect(() => { const controller = new AbortController(); owner.current = controller; return () => { controller.abort(); owner.current = null; }; }, [user?.id]);
  const permitted = hasPermission(user, 'channel', 'write');
  const apply = async () => {
    const lifetime = owner.current;
    if (!lifetime || lifetime.signal.aborted || lock.current || !permitted) return;
    lock.current = true; setBusy(true); setError('');
    try {
      const { data } = await API.post('/api/channel/upstream_updates/apply_all', {}, { signal: lifetime.signal, skipErrorHandler: true });
      lifetime.signal.throwIfAborted();
      if (!data.success) throw new Error(data.message || t('Unable to apply model changes'));
      const parsed = batchSchema.safeParse(data.data);
      if (!parsed.success) throw new Error(t('Invalid model update response'));
      setResult(parsed.data); setOpen(false); onChanged();
    } catch (cause) { if (!lifetime.signal.aborted) { setError(cause instanceof Error ? t(cause.message) : t('Unable to apply model changes')); setOpen(false); } }
    finally { if (!lifetime.signal.aborted) { lock.current = false; setBusy(false); } }
  };
  if (!permitted) return null;
  return <>
    <Button size='sm' variant='toggle' disabled={busy} onClick={() => { setResult(undefined); setError(''); setOpen(true); }}>{t('Apply all staged model changes')}</Button>
    {open && <ConfirmDialog open title={t('Apply all staged model changes?')} description={t('This applies staged additions and removals for enabled channels with update checks enabled. Review individual previews first.')} confirmText={t('Confirm')} cancelText={t('Cancel')} loading={busy} closeOnConfirm={false} onConfirm={() => void apply()} onClose={() => { if (!lock.current) setOpen(false); }} />}
    {(result || error) && <Modal open title={t('Model update results')} width={580} onClose={() => { setResult(undefined); setError(''); }} onConfirm={() => { setResult(undefined); setError(''); }} footer={<Button onClick={() => { setResult(undefined); setError(''); }}>{t('Close')}</Button>}>
      {error && <p role='alert' className='text-sm text-ui-danger break-words'>{error}</p>}
      {result && <div className='space-y-2 text-sm'><p>{t('Updated channels')}: {result.processed_channels}</p><p>{t('Added models')}: {result.added_models}</p><p>{t('Removed models')}: {result.removed_models}</p><p className='break-all'>{t('Failed channel IDs')}: {result.failed_channel_ids.join(', ') || '—'}</p></div>}
    </Modal>}
  </>;
}
