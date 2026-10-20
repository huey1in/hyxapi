import { cloneElement, useEffect, useId, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { Button, ConfirmDialog, Input, Loading, Modal, Switch, Textarea, showSuccess } from '../../components/ui';
import { useOwnedOperation } from '../../hooks/useOwnedOperation';
import { apiErrorMessage } from '../../lib/api-error';
import { pluginBase, pluginPath, pluginDetailSchema, pluginVersionsSchema, PluginUsageError } from './task-plugin-data';
import type { PluginAction, PluginDraft, PluginUsage } from './task-plugin-data';
import { pluginRequest } from './task-plugin-query';

export function PluginField({ label, children }: { label: string; children: ReactElement<{ id?: string }> }) {
  const id = useId();
  return <div className='grid gap-1.5 text-sm text-ui-text-2'><label htmlFor={id}>{label}</label>{cloneElement(children, { id })}</div>;
}
export function PluginConfirmation({ action, onClose, onSaved }: { action: PluginAction; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation(); const { busy, run } = useOwnedOperation(); const [usage, setUsage] = useState<PluginUsage | null>(null);
  const title = usage ? 'Plugin is still in use' : action.kind === 'delete' ? 'Delete plugin version' : action.enabled ? 'Enable plugin' : 'Disable plugin';
  const details = action.kind === 'delete' ? t('Delete {{key}} version {{version}}. This version cannot be restored from version management.', action) : t('Change routing and channel binding for {{key}}.', action);
  return <ConfirmDialog open title={t(title)} description={<>{details}{usage && <span className='mt-2 block'>{t('Bound channels: {{channels}}; {{count}} tasks in progress.', { channels: usage.channels.map((channel) => `${channel.name} (#${channel.id})`).join(', ') || t('None'), count: usage.in_flight_count })} {t(action.kind === 'status' ? 'Dedicated channels will be disabled and this plugin will be unbound from New API channels. Running tasks may be affected.' : 'Channels may no longer submit tasks after deletion. Running tasks may be affected.')}</span>}</>} confirmText={t(usage ? 'Confirm forced execution' : 'Confirm')} cancelText={t('Cancel')} onClose={onClose} loading={busy} closeOnConfirm={false} onConfirm={() => void run(async (signal) => {
    try {
      const suffix = usage ? '?cascade=true&force=true' : '';
      if (action.kind === 'status') await pluginRequest('post', `${pluginPath(action.key)}/status${suffix}`, z.unknown(), signal, { enabled: action.enabled });
      else await pluginRequest('delete', `${pluginPath(action.key)}/versions/${encodeURIComponent(action.version)}${suffix}`, z.unknown(), signal);
      showSuccess(t('Plugin operation completed')); onSaved(); onClose();
    } catch (error) { if (error instanceof PluginUsageError) setUsage(error.usage); else throw error; }
  })} />;
}

export default function TaskPluginEditor({ identity, initial, onClose, onSaved }: { identity: string; initial: PluginDraft; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation(); const { busy, run } = useOwnedOperation();
  const [draft, setDraft] = useState(initial); const [hook, setHook] = useState('buildSubmitRequest'); const [member, setMember] = useState(''); const [args, setArgs] = useState('[{}]'); const [output, setOutput] = useState('');
  const [confirmation, setConfirmation] = useState<PluginAction | null>(null); const [activate, setActivate] = useState<string | null>(null);
  const sourceFile = useRef<HTMLInputElement>(null); const iconFile = useRef<HTMLInputElement>(null);
  const query = useQuery({ queryKey: ['task-plugin-editor', identity, initial.key], enabled: Boolean(initial.key), gcTime: 0, retry: false, staleTime: Infinity, queryFn: async ({ signal }) => {
    const key = initial.key!;
    const [detail, versions] = await Promise.all([pluginRequest('get', pluginPath(key), pluginDetailSchema, signal), pluginRequest('get', `${pluginPath(key)}/versions`, pluginVersionsSchema, signal)]);
    if (detail.meta.key !== key || versions.some((version) => version.key !== key)) throw new Error('Invalid plugin data; reload and try again.');
    return { detail, versions };
  } });
  useEffect(() => { if (query.data) { const { detail } = query.data; setDraft({ key: initial.key, source: detail.source, meta: detail.meta, enabled: detail.plugin?.enabled ?? true, remark: detail.plugin?.remark ?? '', icon: '' }); setOutput(''); } }, [query.data, initial.key]);
  const pending = Boolean(initial.key && !query.data); const unavailable = query.isError || pending;
  const refresh = () => { void query.refetch(); onSaved(); };
  const readSource = (file?: File) => {
    if (!file) return;
    void run(async (signal) => { if (file.size > 8 * 1024 * 1024) throw new Error('Plugin source exceeds 8 MiB'); const source = await file.text(); signal.throwIfAborted(); setDraft((current) => ({ ...current, source, sourceSha256: undefined })); });
  };
  const readIcon = (file?: File) => {
    if (!file) return;
    void run(async (signal) => {
      if (file.size > 256 * 1024 || !['image/png', 'image/svg+xml'].includes(file.type)) throw new Error('Choose an SVG or PNG icon up to 256 KiB');
      const icon = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader(); const cancel = () => reader.abort();
        const finish = () => signal.removeEventListener('abort', cancel);
        reader.onload = () => { finish(); resolve(String(reader.result)); }; reader.onerror = () => { finish(); reject(reader.error); }; reader.onabort = () => { finish(); reject(new DOMException('Cancelled', 'AbortError')); };
        signal.addEventListener('abort', cancel, { once: true }); reader.readAsDataURL(file);
      }); signal.throwIfAborted(); setDraft((current) => ({ ...current, icon }));
    });
  };
  const viewVersion = (version: string) => void run(async (signal) => {
    const detail = await pluginRequest('get', `${pluginPath(initial.key!)}?version=${encodeURIComponent(version)}`, pluginDetailSchema, signal);
    if (detail.meta.key !== initial.key || detail.meta.version !== version) throw new Error('Invalid plugin data; reload and try again.');
    setDraft((current) => ({ ...current, source: detail.source, meta: detail.meta, sourceSha256: undefined, remark: detail.plugin?.remark ?? '', icon: '' })); setOutput('');
  });
  const save = () => void run(async (signal) => {
    if (!draft.source.trim()) return;
    const saved = await pluginRequest('post', pluginBase, pluginDetailSchema, signal, { source: draft.source, enabled: draft.enabled, remark: draft.remark, sourceSha256: draft.sourceSha256, icon: draft.icon });
    showSuccess(t(saved.plugin?.active === false ? 'Plugin saved, activation required' : 'Plugin version saved')); onSaved(); onClose();
  });
  const title = initial.key ? t('Manage plugin · {{key}}', { key: initial.key }) : draft.marketName ? t('Install plugin · {{name}}', { name: draft.marketName }) : t('Import plugin');
  return <Modal open width={880} title={title} onClose={onClose} footer={<><Button variant='secondary' onClick={onClose}>{t('Cancel')}</Button><Button loading={busy} disabled={unavailable || !draft.source.trim()} onClick={save}>{t('Save plugin')}</Button></>}>
    {query.isError ? <div role='alert' className='space-y-2 text-sm text-ui-danger'><p>{t(apiErrorMessage(query.error, 'Unable to load plugin'))}</p><Button onClick={() => void query.refetch()}>{t('Retry')}</Button></div> : pending ? <Loading /> : <fieldset disabled={busy} className='space-y-4'>
      <p className='text-xs text-ui-text-3'>{t('Saved versions are immutable. Change the source version before saving. New versions of an existing plugin require activation in version management.')}</p>
      <div className='flex flex-wrap gap-2'><Button size='sm' variant='toggle' onClick={() => sourceFile.current?.click()}>{t('Choose .js file')}</Button><Button size='sm' variant='toggle' onClick={() => iconFile.current?.click()}>{t('Choose icon')}</Button>{draft.icon && <span className='self-center text-xs text-ui-text-3'>{t('Icon selected')}</span>}</div>
      <input ref={sourceFile} type='file' accept='.js,.mjs,text/javascript' hidden onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; readSource(file); }} />
      <input ref={iconFile} type='file' accept='image/png,image/svg+xml' hidden onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; readIcon(file); }} />
      <PluginField label={t('Plugin source')}><Textarea value={draft.source} rows={18} spellCheck={false} onChange={(source) => setDraft((current) => ({ ...current, source, sourceSha256: undefined }))} /></PluginField>
      {draft.sourceSha256 && <p className='break-all text-xs text-ui-text-3'>{t('Verified SHA-256: {{hash}}', { hash: draft.sourceSha256 })}</p>}
      <PluginField label={t('Remark')}><Input value={draft.remark} onChange={(remark) => setDraft((current) => ({ ...current, remark }))} /></PluginField>
      <label className='flex items-center gap-3 text-sm'><Switch checked={draft.enabled} onChange={(enabled) => setDraft((current) => ({ ...current, enabled }))} />{t('Enable after saving')}</label>
      {draft.meta && <details><summary className='cursor-pointer text-sm'>{t('Protocols, routes, models and usage declarations')}</summary><pre className='mt-2 whitespace-pre-wrap break-all text-xs'>{JSON.stringify(draft.meta, null, 2)}</pre></details>}
      {initial.key && <>
        <details><summary className='cursor-pointer text-sm'>{t('Version management ({{count}})', { count: query.data?.versions.length ?? 0 })}</summary><div className='mt-3 space-y-2'>{query.data?.versions.map((version) => <div key={version.version} className='flex flex-wrap items-center gap-2 text-sm'>
          <span className='mr-auto'>{version.version}{version.active ? ` · ${t('Current version')}` : ''}</span><Button size='sm' variant='link' onClick={() => viewVersion(version.version)}>{t('View source')}</Button>
          {!version.active && <Button size='sm' variant='toggle' onClick={() => setActivate(version.version)}>{t('Switch version')}</Button>}<Button size='sm' variant='link' onClick={() => setConfirmation({ kind: 'delete', key: initial.key!, version: version.version })}>{t('Delete')}</Button>
        </div>)}</div></details>
        <details><summary className='cursor-pointer text-sm'>{t('Debug saved active version')}</summary><div className='mt-3 space-y-3'><p className='text-xs text-ui-text-3'>{t('Debug runs the saved active version. Unsaved source and previewed versions are not executed.')}</p>
          <PluginField label={t('Exported function')}><Input value={hook} onChange={setHook} placeholder='buildSubmitRequest' /></PluginField><PluginField label={t('Member name (optional)')}><Input value={member} onChange={setMember} /></PluginField><PluginField label={t('Argument array (JSON)')}><Textarea value={args} onChange={setArgs} rows={5} spellCheck={false} /></PluginField>
          <Button size='sm' variant='toggle' disabled={!hook.trim()} loading={busy} onClick={() => void run(async (signal) => { setOutput(''); const parsed: unknown = JSON.parse(args); if (!Array.isArray(parsed)) throw new Error('Debug arguments must be a JSON array'); const result = await pluginRequest('post', `${pluginPath(initial.key!)}/dryrun`, z.unknown(), signal, { hook: hook.trim(), member: member.trim(), args: parsed }); setOutput(JSON.stringify(result, null, 2) ?? 'null'); })}>{t('Run debug')}</Button>
          {output && <pre className='whitespace-pre-wrap break-all text-xs'>{output}</pre>}
        </div></details>
      </>}
    </fieldset>}
    {confirmation && <PluginConfirmation key={JSON.stringify(confirmation)} action={confirmation} onClose={() => setConfirmation(null)} onSaved={refresh} />}
    {activate && <ActivateVersion pluginKey={initial.key!} version={activate} onClose={() => setActivate(null)} onSaved={refresh} />}
  </Modal>;
}
function ActivateVersion({ pluginKey, version, onClose, onSaved }: { pluginKey: string; version: string; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation(); const { busy, run } = useOwnedOperation();
  return <ConfirmDialog open title={t('Switch plugin version?')} description={t('Publish {{key}} version {{version}} and reload the editor from the saved source.', { key: pluginKey, version })} onClose={onClose} closeOnConfirm={false} confirmText={t('Confirm')} cancelText={t('Cancel')} loading={busy} onConfirm={() => void run(async (signal) => { await pluginRequest('post', `${pluginPath(pluginKey)}/activate`, z.unknown(), signal, { version }); showSuccess(t('Plugin version switched')); onSaved(); onClose(); })} />;
}
