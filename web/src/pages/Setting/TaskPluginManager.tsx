import Skeleton from '../../components/ui/feedback/Skeleton';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Plus, Puzzle, RefreshCw } from 'lucide-react';
import { Button, Input, Pagination, Table, Tabs, ContentSkeleton } from '../../components/ui';
import { useAuthStore } from '../../stores/auth-store';
import { apiErrorMessage } from '../../lib/api-error';
import TaskPluginEditor, { PluginConfirmation } from './TaskPluginEditor';
import TaskPluginMarketplace from './PluginMarketplacePanel';
import { pluginBase, pluginListSchema, pluginRuntimeSchema, pluginSourcesSchema } from './task-plugin-data';
import type { PluginAction, PluginDraft } from './task-plugin-data';
import { pluginRequest } from './task-plugin-query';

const statusLabels = { registered: 'Registered', disabled: 'Disabled', disabled_fallback: 'Using built-in version', compile_failed: 'Compile failed', not_registered: 'Not loaded' };
const sourceLabels = { factory: 'Built-in', override: 'Installed', override_over_factory: 'Overrides built-in' };
function PluginSession({ identity }: { identity: string }) {
  const { t } = useTranslation(); const [tab, setTab] = useState('installed'); const [search, setSearch] = useState(''); const [page, setPage] = useState(1);
  const [editor, setEditor] = useState<{ draft: PluginDraft; generation: number } | null>(null); const [confirmation, setConfirmation] = useState<PluginAction | null>(null);
  const listQuery = useQuery({ queryKey: ['task-plugin-list', identity], gcTime: 0, retry: false, queryFn: ({ signal }) => pluginRequest('get', pluginBase, pluginListSchema, signal) });
  const runtimeQuery = useQuery({ queryKey: ['task-plugin-runtime', identity], gcTime: 0, retry: false, queryFn: ({ signal }) => pluginRequest('get', `${pluginBase}/runtime/status`, pluginRuntimeSchema, signal) });
  const sourcesQuery = useQuery({ queryKey: ['task-plugin-sources', identity], gcTime: 0, retry: false, queryFn: ({ signal }) => pluginRequest('get', `${pluginBase}/marketplace/sources`, pluginSourcesSchema, signal) });
  const refresh = () => { void listQuery.refetch(); void runtimeQuery.refetch(); void sourcesQuery.refetch(); };
  const items = listQuery.isError ? [] : listQuery.data ?? []; const runtime = runtimeQuery.isError ? undefined : runtimeQuery.data; const sources = sourcesQuery.isError ? undefined : sourcesQuery.data;
  const filtered = items.filter((item) => `${item.meta.key} ${item.meta.name}`.toLowerCase().includes(search.toLowerCase())); const currentPage = Math.min(page, Math.max(1, Math.ceil(filtered.length / 20)));
  const openEditor = (draft: PluginDraft) => setEditor((current) => ({ draft, generation: (current?.generation ?? 0) + 1 }));
  return <div className='space-y-4'>
    <div className='flex flex-wrap items-center justify-between gap-3'><Tabs items={[{ value: 'installed', label: t('Installed plugins') }, { value: 'market', label: t('Plugin marketplace') }]} value={tab} onChange={setTab} /><div className='flex flex-wrap gap-2'><Button variant='toggle' size='sm' icon={RefreshCw} loading={listQuery.isFetching || runtimeQuery.isFetching || sourcesQuery.isFetching} onClick={refresh}>{t('Refresh plugins')}</Button><Button size='sm' icon={Plus} onClick={() => openEditor({ source: '', remark: '', enabled: true, icon: '' })}>{t('Import plugin')}</Button></div></div>
    {runtimeQuery.isError ? <div role='alert' className='space-y-2 text-sm text-ui-danger'><p>{t(apiErrorMessage(runtimeQuery.error, 'Unable to load plugin runtime'))}</p><Button size='sm' onClick={() => void runtimeQuery.refetch()}>{t('Retry runtime')}</Button></div> : runtime && <div className='text-xs text-ui-text-3'>{t('Runtime generation {{generation}} · Last publication: {{status}}', { generation: runtime.current_generation, status: t(runtime.last_rebuild.status) })}{Object.keys(runtime.plugin_errors).length > 0 && <details className='mt-2'><summary>{t('View loading errors')}</summary><pre className='whitespace-pre-wrap break-all'>{JSON.stringify(runtime.plugin_errors, null, 2)}</pre></details>}{runtime.database_error && <p role='alert'>{runtime.database_error}</p>}</div>}
    {tab === 'installed' ? <>
      <Input aria-label={t('Search plugin name or key')} value={search} onChange={(value) => { setSearch(value); setPage(1); }} placeholder={t('Search plugin name or key')} />
      {listQuery.isError ? <div role='alert' className='space-y-2 text-sm text-ui-danger'><p>{t(apiErrorMessage(listQuery.error, 'Unable to load plugins'))}</p><Button onClick={() => void listQuery.refetch()}>{t('Retry plugins')}</Button></div> : <><Table loading={!listQuery.data} rowKey={(row) => row.meta.key} minWidth={650} rows={filtered.slice((currentPage - 1) * 20, currentPage * 20)} emptyIcon={Puzzle} columns={[
        { key: 'name', title: t('Plugin'), render: (row) => <div><div>{row.meta.name || row.meta.key}</div><div className='text-xs text-ui-text-3'>{row.meta.key} · {row.meta.version}</div></div> },
        { key: 'source', title: t('Source'), render: (row) => t(sourceLabels[row.source]) },
        { key: 'runtime', title: t('Status'), render: (row) => <div title={row.runtime_error}>{t(statusLabels[row.runtime_status])}</div> },
        { key: 'usage', title: t('In use'), render: (row) => t('{{channels}} channels / {{tasks}} tasks', { channels: row.channel_count, tasks: row.in_flight_count }) },
        { key: 'actions', mobileRole: 'actions' as const, title: t('Actions'), render: (row) => <div className='flex items-center gap-2'><Button size='sm' variant='toggle' onClick={() => openEditor({ key: row.meta.key, source: '', remark: '', enabled: true, icon: '' })}>{t('Manage')}</Button><Button size='sm' variant='link' onClick={() => setConfirmation({ kind: 'status', key: row.meta.key, enabled: !row.enabled })}>{t(row.enabled ? 'Disable' : 'Enable')}</Button></div> },
      ]} /><Pagination page={currentPage} pageSize={20} total={filtered.length} onChange={setPage} /></>}
    </> : sourcesQuery.isError ? <div role='alert' className='space-y-2 text-sm text-ui-danger'><p>{t(apiErrorMessage(sourcesQuery.error, 'Unable to load marketplace sources'))}</p><Button onClick={() => void sourcesQuery.refetch()}>{t('Retry sources')}</Button></div> : !sources ? <ContentSkeleton variant='form'><div className='flex flex-wrap items-end gap-3'><div className='min-w-40 flex-1 space-y-1.5'><Skeleton width={120} height={16} /><Skeleton height={36} rounded='rounded-full' /></div><Skeleton width={130} height={36} rounded='rounded-full' /><Skeleton width={100} height={36} rounded='rounded-full' /></div></ContentSkeleton> : <TaskPluginMarketplace key={JSON.stringify(sources)} identity={identity} sources={sources} onImport={openEditor} onSaved={() => void sourcesQuery.refetch()} />}
    {editor && <TaskPluginEditor key={`${editor.draft.key ?? 'new'}:${editor.generation}`} identity={identity} initial={editor.draft} onClose={() => setEditor(null)} onSaved={refresh} />}
    {confirmation && <PluginConfirmation key={JSON.stringify(confirmation)} action={confirmation} onClose={() => setConfirmation(null)} onSaved={refresh} />}
  </div>;
}
export default function TaskPluginManager() {
  const identity = useAuthStore((state) => `${state.auth.user?.id}:${state.auth.session?.sid}:${state.auth.user?.role}`); const root = useAuthStore((state) => state.auth.user?.role === 100);
  return root ? <PluginSession key={identity} identity={identity} /> : null;
}
