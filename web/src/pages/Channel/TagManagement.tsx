import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { API, showSuccess } from '../../helpers';
import { Button, ConfirmDialog, Input, Modal, Textarea } from '../../components/ui';
import { hasPermission } from '../../lib/admin-permissions';
import { useAuthStore } from '../../stores/auth-store';
import { buildTagEdit, tagFields } from './tag-edit';
import type { TagEdit, TagField, TagValues } from './tag-edit';

const labels: Record<TagField, string> = { new_tag: 'Tag name', models: 'Channel models', groups: 'Groups', priority: 'Priority', weight: 'Weight', model_mapping: 'Model mapping', param_override: 'Parameter override', header_override: 'Header override' };
const multiline = new Set<TagField>(['models', 'model_mapping', 'param_override', 'header_override']);
type Confirmation = { kind: 'edit'; body: TagEdit } | { kind: 'status'; enabled: boolean };

export default function TagManagement({ tag, onClose, onChanged }: { tag: string; onClose: () => void; onChanged: () => void }) {
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.auth.user);
  const canWrite = hasPermission(user, 'channel', 'write');
  const sensitive = hasPermission(user, 'channel', 'sensitive_write');
  const canOperate = hasPermission(user, 'channel', 'operate');
  const id = useId();
  const [values, setValues] = useState<TagValues>({ new_tag: tag, models: '', groups: '', priority: '0', weight: '0', model_mapping: '', param_override: '', header_override: '' });
  const [selected, setSelected] = useState<Set<TagField>>(new Set());
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const owner = useRef<AbortController | null>(null);
  const lock = useRef(false);
  useEffect(() => {
    const controller = new AbortController(); owner.current = controller;
    return () => { controller.abort(); owner.current = null; };
  }, [tag, user?.id]);
  const reference = useQuery({ queryKey: ['channel-tag-models', user?.id, tag], queryFn: async ({ signal }) => {
    const { data } = await API.get('/api/channel/tag/models', { params: { tag }, signal, skipErrorHandler: true });
    signal.throwIfAborted();
    if (!data.success || typeof data.data !== 'string') throw new Error(data.message || t('Unable to load tag models'));
    return data.data;
  }, retry: false, gcTime: 0, refetchOnWindowFocus: false });
  const review = () => {
    try { setConfirmation({ kind: 'edit', body: buildTagEdit(tag, selected, values, sensitive) }); setError(''); }
    catch (cause) { setError(cause instanceof Error ? t(cause.message) : t('Unable to update tag')); }
  };
  const apply = async () => {
    const lifetime = owner.current;
    if (!confirmation || !lifetime || lifetime.signal.aborted || lock.current || (confirmation.kind === 'edit' ? !canWrite : !canOperate)) return;
    lock.current = true; setBusy(true); setError('');
    try {
      const config = { signal: lifetime.signal, skipErrorHandler: true };
      const { data } = confirmation.kind === 'edit' ? await API.put('/api/channel/tag', confirmation.body, config) : await API.post(`/api/channel/tag/${confirmation.enabled ? 'enabled' : 'disabled'}`, { tag }, config);
      lifetime.signal.throwIfAborted();
      if (!data.success) throw new Error(data.message || t('Unable to update tag'));
      if (!Number.isSafeInteger(data.data) || data.data < 0) throw new Error(t('Invalid tag response'));
      showSuccess(`${t('Updated channels')}: ${data.data}`); onChanged(); onClose();
    } catch (cause) { if (!lifetime.signal.aborted) setError(cause instanceof Error ? t(cause.message) : t('Unable to update tag')); }
    finally { if (!lifetime.signal.aborted) { lock.current = false; setBusy(false); setConfirmation(null); } }
  };
  const close = () => { if (!lock.current && !confirmation) onClose(); };
  return <>
    <Modal open title={`${t('Manage channel tag')} · ${tag}`} width={560} onClose={close} onConfirm={close} footer={<>
      <Button variant='secondary' disabled={busy} onClick={close}>{t('Close')}</Button>{canWrite && <Button disabled={busy || !selected.size} onClick={review}>{t('Review tag changes')}</Button>}
    </>}>
      <p className='text-sm text-ui-text-2'>{t('Changes apply to every channel with this tag, including channels outside the current filters.')}</p>
      {canOperate && <div className='flex flex-wrap gap-2'><Button size='sm' variant='secondary' disabled={busy} onClick={() => setConfirmation({ kind: 'status', enabled: true })}>{t('Enable tagged channels')}</Button><Button size='sm' variant='secondary' disabled={busy} onClick={() => setConfirmation({ kind: 'status', enabled: false })}>{t('Disable tagged channels')}</Button></div>}
      <details className='text-xs text-ui-text-3'><summary>{t('Reference models from this tag')}</summary><pre className='max-h-24 overflow-auto whitespace-pre-wrap break-all mt-2'>{reference.isPending ? t('Loading') : reference.isError ? reference.error.message : reference.data || '—'}</pre></details>
      <p className='text-xs text-ui-text-3'>{t('Only checked fields change. A checked blank value clears that field; clearing models or groups removes routing.')}</p>
      {canWrite && <div className='space-y-4'>{tagFields.filter((field) => sensitive || !['param_override', 'header_override'].includes(field)).map((field) => <div key={field} className='space-y-1'>
        <label htmlFor={`${id}-${field}`} className='flex gap-2 items-center text-sm'><input id={`${id}-${field}`} className='accent-ui-accent' type='checkbox' checked={selected.has(field)} disabled={busy} onChange={(event) => { const next = new Set(selected); if (event.target.checked) next.add(field); else next.delete(field); setSelected(next); }} />{t(labels[field])}</label>
        {multiline.has(field) ? <Textarea aria-label={t(labels[field])} value={values[field]} onChange={(value) => setValues((previous) => ({ ...previous, [field]: value }))} rows={field === 'models' ? 2 : 3} disabled={busy || !selected.has(field)} />
          : <Input aria-label={t(labels[field])} value={values[field]} type={['priority', 'weight'].includes(field) ? 'number' : 'text'} step='1' onChange={(value) => setValues((previous) => ({ ...previous, [field]: value }))} disabled={busy || !selected.has(field)} />}
      </div>)}</div>}
      {error && <p role='alert' className='text-sm text-ui-danger break-words'>{error}</p>}
    </Modal>
    {confirmation && <ConfirmDialog open title={t('Apply changes to all tagged channels?')} description={<span className='space-y-2 block'><span className='block break-all'>{tag}</span><span className='block'>{t('Changes apply to every channel with this tag, including channels outside the current filters.')}</span><span className='block'>{confirmation.kind === 'edit' ? Object.keys(confirmation.body).filter((key) => key !== 'tag').map((key) => t(labels[key as TagField])).join(', ') : t(confirmation.enabled ? 'Enable tagged channels' : 'Disable tagged channels')}</span></span>} confirmText={t('Confirm')} cancelText={t('Cancel')} loading={busy} closeOnConfirm={false} onConfirm={() => void apply()} onClose={() => { if (!lock.current) setConfirmation(null); }} />}
  </>;
}

export function AssignChannelTag({ ids, onChanged }: { ids: number[]; onChanged: () => void }) {
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.auth.user);
  const [targets, setTargets] = useState<number[] | null>(null);
  const [tag, setTag] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const owner = useRef<AbortController | null>(null);
  const lock = useRef(false);
  useEffect(() => { const controller = new AbortController(); owner.current = controller; return () => { controller.abort(); owner.current = null; }; }, [user?.id]);
  const apply = async () => {
    const lifetime = owner.current;
    if (!targets || !lifetime || lifetime.signal.aborted || lock.current || !hasPermission(user, 'channel', 'write')) return;
    if ([...tag.trim()].length > 255 || /[\r\n\0]/.test(tag)) { setError(t('Invalid tag name')); return; }
    lock.current = true; setBusy(true); setError('');
    try {
      const { data } = await API.post('/api/channel/batch/tag', { ids: targets, tag: tag.trim() || null }, { signal: lifetime.signal, skipErrorHandler: true });
      lifetime.signal.throwIfAborted();
      if (!data.success) throw new Error(data.message || t('Unable to update tag'));
      if (!Number.isSafeInteger(data.data) || data.data < 0) throw new Error(t('Invalid tag response'));
      showSuccess(`${t('Updated channels')}: ${data.data}`); setTargets(null); onChanged();
    } catch (cause) { if (!lifetime.signal.aborted) setError(cause instanceof Error ? t(cause.message) : t('Unable to update tag')); }
    finally { if (!lifetime.signal.aborted) { lock.current = false; setBusy(false); } }
  };
  if (!hasPermission(user, 'channel', 'write')) return null;
  const close = () => { if (!lock.current) setTargets(null); };
  return <>
    <Button size='sm' variant='toggle' disabled={!ids.length || ids.length > 1000 || busy} onClick={() => { setTag(''); setError(''); setTargets([...ids]); }}>{t('Assign channel tag')}</Button>
    {targets && <Modal open title={t('Assign channel tag')} width={420} onClose={close} onConfirm={() => void apply()} footer={<><Button variant='secondary' disabled={busy} onClick={close}>{t('Cancel')}</Button><Button loading={busy} onClick={() => void apply()}>{t('Apply tag')}</Button></>}>
      <p className='text-sm'>{t('Selected channel IDs')}: {targets.join(', ')}</p><p className='text-xs text-ui-text-3'>{t('A blank tag removes the tag from the selected channels. Other fields stay as they are.')}</p>
      <Input aria-label={t('Tag name')} value={tag} maxLength={255} disabled={busy} onChange={setTag} />
      {error && <p role='alert' className='text-sm text-ui-danger break-words'>{error}</p>}
    </Modal>}
  </>;
}
