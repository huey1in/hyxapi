import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { RefreshCw } from 'lucide-react';
import { renderQuota } from '../../helpers';
import { Button, Input, Modal, Pagination, Select, Switch, Table, Tabs } from '../../components/ui';
import type { TableColumn } from '../../components/ui/layout/Table';
import { useAuthStore } from '../../stores/auth-store';
import { apiErrorMessage } from '../../lib/api-error';
import { emptyTaskFilters, projectTaskRow, taskArtifactsSchema, taskDate, taskFilterError, taskPageSchema, taskQueryParams, taskStatusLabels } from './task-data';
import type { TaskFilters, TaskRow } from './task-data';
import { readTaskData } from './task-query';

function TaskDetails({ row, identity, onClose }: { row: TaskRow; identity: string; onClose: () => void }) {
  const { t, i18n } = useTranslation(); const [requested, setRequested] = useState(false);
  const query = useQuery({ queryKey: ['task-artifacts', identity, row.id, row.platform, row.task_id], gcTime: 0, retry: false, enabled: requested, queryFn: async ({ signal }) => {
    const data = await readTaskData(`/api/task/${encodeURIComponent(row.task_id)}/artifacts`, taskArtifactsSchema, signal);
    if (data.task_id !== row.task_id) throw new Error('Invalid task data; reload and try again.'); return data;
  } });
  const artifacts = query.isError || query.isFetching ? undefined : query.data;
  const load = () => { if (requested) void query.refetch(); else setRequested(true); };
  return <Modal open width={800} title={t('Task details')} hideFooter onClose={onClose}>
    <div className='space-y-4 pb-4'>
      <dl className='grid grid-cols-1 gap-3 text-sm sm:grid-cols-2'>
        <div><dt className='text-ui-text-3'>{t('Task ID')}</dt><dd className='break-all'>{row.task_id}</dd></div>
        <div><dt className='text-ui-text-3'>{t('Status')}</dt><dd>{t(taskStatusLabels[row.status] || row.status)} · {row.progress}</dd></div>
        <div><dt className='text-ui-text-3'>{t('Plugin / platform')}</dt><dd>{row.admin_info?.task_plugin?.name || row.platform}</dd></div>
        <div><dt className='text-ui-text-3'>{t('Cost')}</dt><dd>{renderQuota(row.quota)}</dd></div>
        <div><dt className='text-ui-text-3'>{t('Model')}</dt><dd>{row.properties?.origin_model_name || '—'}</dd></div>
        <div><dt className='text-ui-text-3'>{t('Finished at')}</dt><dd>{taskDate(row.finish_time, i18n.language)}</dd></div>
      </dl>
      {row.fail_reason && <p className='whitespace-pre-wrap break-all text-sm text-ui-danger'>{row.fail_reason}</p>}
      {row.result_discarded ? <p className='text-sm text-ui-text-3'>{t('This task returned its result inline and has no saved download.')}</p> : row.status === 'SUCCESS' && <Button size='sm' variant='toggle' loading={query.isFetching} onClick={load}>{t(query.isError ? 'Retry task results' : 'Load task results')}</Button>}
      {query.isError && <p role='alert' className='text-sm text-ui-danger'>{t(apiErrorMessage(query.error))}</p>}
      {artifacts && <div className='space-y-4'>
        {artifacts.artifacts.map((item) => <div key={item.key} className='space-y-2'>
          <a className='break-all text-sm underline' href={item.content_url} target='_blank' rel='noreferrer'>{t('Open / download {{name}}', { name: item.key })}</a>
          {item.type === 'video' && <video controls preload='none' src={item.content_url} style={{ display: 'block', width: '100%', aspectRatio: '16 / 9', objectFit: 'contain' }} className='max-h-96 rounded-xl' />}
          {item.type === 'audio' && <audio controls preload='none' src={item.content_url} className='w-full' />}
          {item.type === 'image' && <img loading='lazy' alt={item.key} src={item.content_url} className='max-h-96 max-w-full rounded-xl' />}
        </div>)}
        {artifacts.legacy_content_url && <a className='block text-sm underline' href={artifacts.legacy_content_url} target='_blank' rel='noreferrer'>{t('Download video')}</a>}
        {artifacts.legacy_audio_clips?.map((clip, index) => <div key={clip.id || index}><p className='text-sm'>{clip.title || t('Audio {{index}}', { index: index + 1 })}</p><audio controls preload='none' src={clip.audio_url} className='w-full' /></div>)}
        {!artifacts.artifacts.length && !artifacts.legacy_content_url && !artifacts.legacy_audio_clips?.length && <p className='text-sm text-ui-text-3'>{t('This task has no downloadable files.')}</p>}
      </div>}
      {(row.admin_info || row.root_info) && <details className='text-xs'><summary>{t('Runtime information')}</summary><pre className='mt-2 whitespace-pre-wrap break-all'>{JSON.stringify({ admin_info: row.admin_info, root_info: row.root_info }, null, 2)}</pre></details>}
    </div>
  </Modal>;
}
function TaskPage({ identity, role }: { identity: string; role: number }) {
  const { t, i18n } = useTranslation(); const admin = role >= 10;
  const [scope, setScope] = useState('self'); const all = admin && scope === 'all';
  const [filters, setFilters] = useState(emptyTaskFilters); const [applied, setApplied] = useState(emptyTaskFilters);
  const [badDates, setBadDates] = useState<Record<string, boolean>>({}); const [page, setPage] = useState(1); const [refresh, setRefresh] = useState(false); const [selected, setSelected] = useState<TaskRow | null>(null);
  const validation = Object.values(badDates).some(Boolean) ? 'Invalid time range' : taskFilterError(filters, all);
  const query = useQuery({ queryKey: ['tasks', identity, all, applied, page], gcTime: 0, retry: false, refetchInterval: refresh ? 5000 : false, queryFn: ({ signal }) => readTaskData(all ? '/api/task/' : '/api/task/self', taskPageSchema, signal, taskQueryParams(applied, page, all)) });
  const rows = query.isError ? [] : query.data?.items.map((row) => projectTaskRow(row, all ? role : 1)) ?? [];
  const field = (key: keyof TaskFilters) => (value: string) => setFilters((previous) => ({ ...previous, [key]: value }));
  const columns: TableColumn<TaskRow>[] = [
    { key: 'created', title: t('Submitted at'), render: (row) => <span className='whitespace-nowrap text-xs'>{taskDate(row.submit_time || row.created_at, i18n.language)}</span> },
    { key: 'model', title: t('Task'), render: (row) => <div><div>{row.properties?.origin_model_name || row.platform}</div><div className='break-all text-xs text-ui-text-3'>{row.task_id}</div></div> },
    { key: 'action', title: t('Action'), render: (row) => row.action || '—' },
    { key: 'status', title: t('Status'), render: (row) => <div>{t(taskStatusLabels[row.status] || row.status)}<div className='text-xs text-ui-text-3'>{row.progress}</div></div> },
    { key: 'quota', title: t('Cost'), render: (row) => renderQuota(row.quota) },
    ...(all ? [{ key: 'user', title: t('User / channel'), render: (row: TaskRow) => <div>{row.username || row.user_id}<div className='text-xs text-ui-text-3'>#{row.channel_id}</div></div> }] : []),
    { key: 'details', title: t('Details'), render: (row) => <Button size='sm' variant='toggle' onClick={() => setSelected(row)}>{t('View task')}</Button> },
  ];
  return <div className='mx-auto max-w-7xl space-y-5 p-4 md:p-6'>
    <div className='flex flex-wrap items-center justify-between gap-3'><h1 className='text-lg font-semibold text-ui-text'>{t('Async tasks')}</h1><div className='flex flex-wrap items-center gap-3'><label className='flex items-center gap-2 text-xs text-ui-text-2'><Switch checked={refresh} onChange={setRefresh} />{t('Auto refresh')}</label><Button size='sm' variant='toggle' icon={RefreshCw} loading={query.isFetching} onClick={() => void query.refetch()}>{t('Refresh')}</Button></div></div>
    {admin && <Tabs value={scope} onChange={(value) => { setScope(value); setPage(1); setSelected(null); }} items={[{ value: 'self', label: t('My tasks') }, { value: 'all', label: t('All tasks') }]} />}
    <form className='grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-4' onSubmit={(event) => { event.preventDefault(); if (!validation) { setApplied({ ...filters }); setPage(1); setSelected(null); } }}>
      <label className='grid gap-1 text-xs text-ui-text-3'>{t('Task ID')}<Input aria-label={t('Task ID')} value={filters.task_id} onChange={field('task_id')} placeholder='task_…' /></label>
      <label className='grid gap-1 text-xs text-ui-text-3'>{t('Plugin / platform')}<Input aria-label={t('Plugin / platform')} value={filters.platform} onChange={field('platform')} placeholder={t('For example: kling, sunoapi')} /></label>
      <label className='grid gap-1 text-xs text-ui-text-3'>{t('Status')}<Select width='full' aria-label={t('Task status')} value={filters.status} onChange={field('status')} options={[{ value: '', label: t('All statuses') }, ...Object.entries(taskStatusLabels).map(([value, label]) => ({ value, label: t(label) }))]} /></label>
      <label className='grid gap-1 text-xs text-ui-text-3'>{t('Action')}<Input aria-label={t('Action')} value={filters.action} onChange={field('action')} /></label>
      {all && <label className='grid gap-1 text-xs text-ui-text-3'>{t('Channel ID')}<Input aria-label={t('Channel ID')} value={filters.channel_id} onChange={field('channel_id')} /></label>}
      {(['start', 'end'] as const).map((key) => <label key={key} className='grid min-w-0 gap-1 text-xs text-ui-text-3'>{t(key === 'start' ? 'Submission start time' : 'Submission end time')}<Input aria-label={t(key === 'start' ? 'Submission start time' : 'Submission end time')} type='datetime-local' value={filters[key]} onChange={(value, event) => { field(key)(value); setBadDates((previous) => ({ ...previous, [key]: event?.target.validity.badInput ?? false })); }} /></label>)}
      <div className='flex flex-wrap gap-2'><Button type='submit' variant='toggle' disabled={Boolean(validation)}>{t('Search')}</Button><Button type='button' variant='link' onClick={() => { setFilters(emptyTaskFilters()); setApplied(emptyTaskFilters()); setBadDates({}); setPage(1); setSelected(null); }}>{t('Reset')}</Button></div>
    </form>
    {validation && <p role='alert' className='text-sm text-ui-danger'>{t(validation)}</p>}
    {query.isError ? <div role='alert' className='space-y-2 text-sm text-ui-danger'><p>{t(apiErrorMessage(query.error))}</p><Button onClick={() => void query.refetch()}>{t('Retry')}</Button></div> : <><Table loading={query.isPending} columns={columns} rows={rows} rowKey='id' minWidth={730} emptyText={t('No tasks')} /><Pagination page={page} total={query.data?.total || 0} pageSize={20} onChange={(value: number) => { setPage(value); setSelected(null); }} /></>}
    {selected && <TaskDetails key={`${selected.id}:${selected.task_id}`} row={selected} identity={identity} onClose={() => setSelected(null)} />}
  </div>;
}
export default function TaskAccount() {
  const identity = useAuthStore((state) => `${state.auth.user?.id}:${state.auth.session?.sid}:${state.auth.user?.role}`); const role = useAuthStore((state) => state.auth.user?.role ?? 1);
  return <TaskPage key={identity} identity={identity} role={role} />;
}
