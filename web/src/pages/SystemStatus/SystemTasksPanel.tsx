import { ParagraphSkeleton } from '../../components/ui/feedback/ContentSkeleton';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { API } from '../../helpers';
import { Button, ConfirmDialog, Input, Modal, Pagination, Select, Switch, Table, showSuccess } from '../../components/ui';
import { useAuthStore } from '../../stores/auth-store';
import { useOwnedOperation } from '../../hooks/useOwnedOperation';
import { apiErrorMessage } from '../../lib/api-error';
import type { ApiEnvelope } from '../../types/api';
import { taskDate } from '../Task/task-data';
import { cleanupTimestamp, systemTaskFilterParams, systemTaskListSchema, systemTaskSchema, systemTaskStatuses, systemTaskTypes } from './status-data';
import type { SystemTaskFilters } from './status-data';
import { readSystemData } from './status-query';

type Cleanup = { type: 'logs'; timestamp: number } | { type: 'history'; filters: SystemTaskFilters };
function CleanupDialog({ action, onClose, onSaved }: { action: Cleanup; onClose: () => void; onSaved: (id?: string) => void }) {
  const { t, i18n } = useTranslation(); const { busy, run } = useOwnedOperation();
  return <ConfirmDialog open loading={busy} closeOnConfirm={false} onClose={onClose} title={t(action.type === 'logs' ? 'Confirm usage log cleanup' : 'Confirm task history cleanup')} confirmText={t('Confirm cleanup')} cancelText={t('Cancel')}
    description={action.type === 'logs' ? t('Delete usage logs before {{time}}. This cannot be undone.', { time: taskDate(action.timestamp, i18n.language) }) : t('Delete finished records in the selected filters, keeping the latest record of each task type. This cannot be undone.')} onConfirm={() => void run(async (signal) => {
      const config = { signal, skipErrorHandler: true, disableDuplicate: true, timeout: 30000 };
      const { data } = action.type === 'logs' ? await API.post<ApiEnvelope<unknown>>('/api/system-task/log-cleanup', undefined, { ...config, params: { target_timestamp: action.timestamp } }) : await API.delete<ApiEnvelope<unknown>>('/api/system-task/history', { ...config, params: systemTaskFilterParams({ ...action.filters, scope: 'history' }) });
      signal.throwIfAborted(); if (!data.success) throw new Error(data.message || 'Unable to complete operation');
      if (action.type === 'logs') {
        const result = systemTaskSchema.safeParse(data.data); showSuccess(t('Usage log cleanup task submitted')); onSaved(result.success ? result.data.task_id : undefined);
      } else {
        const result = z.object({ deleted_count: z.number().int().nonnegative().safe() }).safeParse(data.data);
        showSuccess(result.success ? t('Deleted {{count}} task records', { count: result.data.deleted_count }) : t('Task history cleanup completed')); onSaved();
      }
      onClose();
    })} />;
}
function SystemTaskDetails({ id, identity, onClose }: { id: string; identity: string; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const query = useQuery({ queryKey: ['system-task-detail', identity, id], gcTime: 0, retry: false, queryFn: async ({ signal }) => {
    const row = await readSystemData(`/api/system-task/${encodeURIComponent(id)}`, systemTaskSchema, signal); if (row.task_id !== id) throw new Error('Invalid system data; reload and try again.'); return row;
  } });
  const row = query.isError ? undefined : query.data;
  return <Modal open width={760} title={t('System task details')} onClose={onClose} footer={<div className='flex flex-wrap justify-end gap-2'><Button variant='secondary' onClick={onClose}>{t('Close')}</Button><Button loading={query.isFetching} onClick={() => void query.refetch()}>{t('Refresh details')}</Button></div>}>
    {query.isError ? <p role='alert' className='text-sm text-ui-danger'>{t(apiErrorMessage(query.error))}</p> : !row ? <ParagraphSkeleton /> : <div className='space-y-3 text-sm'><p className='break-all'>{t(systemTaskTypes[row.type] || row.type)} · {row.task_id}</p><p>{t(systemTaskStatuses[row.status])} · {taskDate(row.updated_at, i18n.language)}</p>
      {row.error && <p role='alert' className='whitespace-pre-wrap break-all text-ui-danger'>{row.error}</p>}
      {(['state', 'result', 'payload'] as const).map((key) => <div key={key}><p className='text-xs text-ui-text-3'>{t(({ state: 'Execution progress', result: 'Execution result', payload: 'Task parameters' })[key])}</p><pre className='mt-1 whitespace-pre-wrap break-all text-xs'>{JSON.stringify(row[key], null, 2)}</pre></div>)}
      {row.locked_by && <p className='break-all text-xs text-ui-text-3'>{t('Runner: {{node}}', { node: row.locked_by })}</p>}
    </div>}
  </Modal>;
}
function SystemTasksSession({ identity }: { identity: string }) {
  const { t, i18n } = useTranslation(); const [filters, setFilters] = useState<SystemTaskFilters>({ type: '', status: '', scope: '' }); const [page, setPage] = useState(1); const [refresh, setRefresh] = useState(false);
  const [selected, setSelected] = useState<string | null>(null); const [before, setBefore] = useState(''); const [badDate, setBadDate] = useState(false); const [action, setAction] = useState<Cleanup | null>(null);
  const query = useQuery({ queryKey: ['system-tasks', identity, filters, page], gcTime: 0, retry: false, refetchInterval: refresh ? 5000 : false, queryFn: ({ signal }) => readSystemData('/api/system-task/list', systemTaskListSchema, signal, { ...systemTaskFilterParams(filters), offset: (page - 1) * 10, limit: 10 }, true) });
  const rows = query.isError ? [] : query.data?.data ?? []; const timestamp = badDate ? null : cleanupTimestamp(before);
  const update = (key: keyof SystemTaskFilters) => (value: string) => { setFilters((current) => ({ ...current, [key]: value })); setPage(1); };
  return <div className='space-y-4'><div className='flex flex-wrap items-center justify-between gap-3'><h2 className='text-base font-semibold text-ui-text'>{t('System tasks')}</h2><div className='flex flex-wrap items-center gap-3'><label className='flex items-center gap-2 text-xs text-ui-text-3'><Switch checked={refresh} onChange={setRefresh} />{t('Auto refresh tasks')}</label><Button size='sm' variant='toggle' loading={query.isFetching} onClick={() => void query.refetch()}>{t('Refresh tasks')}</Button></div></div>
    <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4'>
      <Select width='full' aria-label={t('System task type')} value={filters.type} onChange={update('type')} options={[{ value: '', label: t('All task types') }, ...Object.entries(systemTaskTypes).map(([value, label]) => ({ value, label: t(label) }))]} />
      <Select width='full' aria-label={t('System task status')} value={filters.status} onChange={update('status')} options={[{ value: '', label: t('All task statuses') }, ...Object.entries(systemTaskStatuses).map(([value, label]) => ({ value, label: t(label) }))]} />
      <Select width='full' aria-label={t('System task scope')} value={filters.scope} onChange={update('scope')} options={[{ value: '', label: t('All records') }, { value: 'active', label: t('Active tasks') }, { value: 'history', label: t('History') }]} />
      <Button size='sm' variant='link' disabled={Boolean(action) || filters.scope === 'active' || ['pending', 'running'].includes(filters.status)} onClick={() => setAction({ type: 'history', filters: { ...filters } })}>{t('Clean task history')}</Button>
    </div>
    {query.isError ? <div role='alert' className='space-y-2 text-sm text-ui-danger'><p>{t(apiErrorMessage(query.error))}</p><Button onClick={() => void query.refetch()}>{t('Retry')}</Button></div> : <><Table loading={query.isPending} rows={rows} rowKey='task_id' minWidth={600} emptyText={t('No system tasks')} columns={[
      { key: 'type', title: t('Task'), render: (row) => <div>{t(systemTaskTypes[row.type] || row.type)}<div className='break-all text-xs text-ui-text-3'>{row.task_id}</div></div> },
      { key: 'status', title: t('Status'), render: (row) => t(systemTaskStatuses[row.status]) },
      { key: 'progress', title: t('Progress'), render: (row) => { const progress = row.state?.progress; return typeof progress === 'number' && Number.isFinite(progress) ? `${progress}%` : '—'; } },
      { key: 'updated', title: t('Updated at'), render: (row) => <span className='whitespace-nowrap text-xs'>{taskDate(row.updated_at, i18n.language)}</span> },
      { key: 'detail', title: t('Details'), render: (row) => <Button size='sm' variant='toggle' onClick={() => setSelected(row.task_id)}>{t('View record')}</Button> },
    ]} /><Pagination page={page} pageSize={10} total={query.data?.total || 0} onChange={(value: number) => setPage(value)} /></>}
    <div className='flex flex-wrap items-end gap-3 border-t border-ui-border pt-4'><label className='grid min-w-0 gap-1.5 text-xs text-ui-text-3'>{t('Clean usage logs before')}<Input aria-label={t('Clean usage logs before')} type='datetime-local' value={before} onChange={(value, event) => { setBefore(value); setBadDate(event?.target.validity.badInput ?? false); }} /></label><Button size='sm' variant='toggle' disabled={Boolean(action) || timestamp === null} onClick={() => { if (timestamp !== null) setAction({ type: 'logs', timestamp }); }}>{t('Create usage log cleanup task')}</Button></div>
    {(before || badDate) && timestamp === null && <p role='alert' className='text-sm text-ui-danger'>{t('Choose a valid past time')}</p>}
    {action && <CleanupDialog key={action.type} action={action} onClose={() => setAction(null)} onSaved={(id) => { setPage(1); void query.refetch(); if (id) setSelected(id); }} />}
    {selected && <SystemTaskDetails key={selected} id={selected} identity={identity} onClose={() => setSelected(null)} />}
  </div>;
}
export default function SystemTasksPanel() {
  const identity = useAuthStore((state) => `${state.auth.user?.id}:${state.auth.session?.sid}:${state.auth.user?.role}`); const root = useAuthStore((state) => state.auth.user?.role === 100);
  return root ? <SystemTasksSession key={identity} identity={identity} /> : null;
}
