import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { renderQuota } from '../../helpers';
import { Button, Input, Loading, Modal, Pagination, Switch, Table, Tabs } from '../../components/ui';
import type { TableColumn } from '../../components/ui/layout/Table';
import { useAuthStore } from '../../stores/auth-store';
import { apiErrorMessage } from '../../lib/api-error';
import { emptyTaskFilters, midjourneyPageSchema, midjourneyVideos, parseTaskMetadata, safeTaskMediaURL, taskDate, taskFilterError, taskQueryParams, taskStatusLabels } from './task-data';
import type { MidjourneyRow } from './task-data';
import { readTaskData } from './task-query';

function MidjourneyDetails({ row, onClose }: { row: MidjourneyRow; onClose: () => void }) {
  const { t, i18n } = useTranslation(); const [preview, setPreview] = useState(false);
  const image = safeTaskMediaURL(row.image_url, window.location.origin); const videos = midjourneyVideos(row, window.location.origin);
  const date = (value: number) => taskDate(value, i18n.language, true);
  return <Modal open width={800} title={t('Midjourney task details')} hideFooter onClose={onClose}><div className='space-y-4 pb-4 text-sm'>
    <p className='break-all'>{row.mj_id}</p><p>{row.action} · {t(taskStatusLabels[row.status] || row.status || 'Queued')} · {row.progress || '0%'} · {renderQuota(row.quota)}</p>
    <dl className='space-y-1 text-xs text-ui-text-3'>{[[t('Submitted at'), date(row.submit_time)], [t('Started at'), date(row.start_time)], [t('Finished at'), date(row.finish_time)]].map(([label, value]) => <div key={label}><dt className='inline'>{label}: </dt><dd className='inline'>{value}</dd></div>)}</dl>
    {row.fail_reason && <p className='whitespace-pre-wrap break-all text-ui-danger'>{row.fail_reason}</p>}
    {[[t('Prompt'), row.prompt], [t('English prompt'), row.prompt_en], [t('Description'), row.description]].map(([label, value]) => value && <div key={label}><p className='text-xs text-ui-text-3'>{label}</p><p className='whitespace-pre-wrap break-all'>{value}</p></div>)}
    {(image || videos.length > 0) && <Button size='sm' variant='toggle' onClick={() => setPreview((value) => !value)}>{t(preview ? 'Hide results' : 'View generated results')}</Button>}
    {preview && <div className='space-y-3'>{image && <a href={image} target='_blank' rel='noreferrer'><img src={image} alt={t('Midjourney generated result')} className='max-h-96 max-w-full rounded-xl' /></a>}{videos.map((url, index) => <div key={url}><video src={url} controls preload='none' className='max-h-96 w-full rounded-xl' /><a href={url} target='_blank' rel='noreferrer' className='text-xs underline'>{t('Open / download video {{index}}', { index: index + 1 })}</a></div>)}</div>}
    {(row.buttons || row.properties) && <details><summary className='text-xs text-ui-text-3'>{t('Task parameters and actions')}</summary><pre className='mt-2 whitespace-pre-wrap break-all text-xs'>{JSON.stringify({ buttons: parseTaskMetadata(row.buttons), properties: parseTaskMetadata(row.properties) }, null, 2)}</pre></details>}
  </div></Modal>;
}
function MidjourneyPage({ identity, admin }: { identity: string; admin: boolean }) {
  const { t, i18n } = useTranslation(); const [scope, setScope] = useState('self'); const all = admin && scope === 'all';
  const [filters, setFilters] = useState(emptyTaskFilters); const [applied, setApplied] = useState(emptyTaskFilters); const [badDates, setBadDates] = useState<Record<string, boolean>>({});
  const [page, setPage] = useState(1); const [refresh, setRefresh] = useState(false); const [selected, setSelected] = useState<MidjourneyRow | null>(null);
  const validation = Object.values(badDates).some(Boolean) ? 'Invalid time range' : taskFilterError(filters, all);
  const query = useQuery({ queryKey: ['midjourney', identity, all, applied, page], gcTime: 0, retry: false, refetchInterval: refresh ? 5000 : false, queryFn: ({ signal }) => {
    const params = taskQueryParams(applied, page, all, true); delete params.task_id; if (applied.task_id.trim()) params.mj_id = applied.task_id.trim();
    return readTaskData(all ? '/api/mj/' : '/api/mj/self', midjourneyPageSchema, signal, params);
  } });
  const rows = query.isError ? [] : query.data?.items ?? [];
  const columns: TableColumn<MidjourneyRow>[] = [
    { key: 'id', title: t('Task'), render: (row) => <div className='max-w-64 break-all text-xs'>{row.mj_id}<div className='text-ui-text-3'>{row.action}</div></div> },
    { key: 'status', title: t('Status'), render: (row) => <span>{t(taskStatusLabels[row.status] || row.status || 'Queued')} · {row.progress || '0%'}</span> },
    { key: 'quota', title: t('Cost'), render: (row) => renderQuota(row.quota) },
    { key: 'time', title: t('Submitted at'), render: (row) => <span className='whitespace-nowrap text-xs'>{taskDate(row.submit_time, i18n.language, true)}</span> },
    ...(all ? [{ key: 'channel', title: t('Channel'), render: (row: MidjourneyRow) => row.channel_id }] : []),
    { key: 'detail', title: t('Details'), render: (row) => <Button size='sm' variant='toggle' onClick={() => setSelected(row)}>{t('View task')}</Button> },
  ];
  return <div className='space-y-4'>
    <div className='flex flex-wrap items-center justify-between gap-3'><h1 className='text-xl font-semibold text-ui-text'>{t('Midjourney tasks')}</h1><div className='flex flex-wrap items-center gap-3'><label className='flex items-center gap-2 text-xs text-ui-text-3'><Switch checked={refresh} onChange={setRefresh} />{t('Auto refresh')}</label><Button size='sm' variant='toggle' loading={query.isFetching} onClick={() => void query.refetch()}>{t('Refresh')}</Button></div></div>
    {admin && <Tabs value={scope} onChange={(value) => { setScope(value); setPage(1); setSelected(null); }} items={[{ value: 'self', label: t('My tasks') }, { value: 'all', label: t('All tasks') }]} />}
    <form className='grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-4' onSubmit={(event) => { event.preventDefault(); if (!validation) { setApplied({ ...filters }); setPage(1); setSelected(null); } }}>
      <label className='grid gap-1 text-xs text-ui-text-3'>{t('Task ID')}<Input aria-label={t('Task ID')} value={filters.task_id} onChange={(value) => setFilters((previous) => ({ ...previous, task_id: value }))} /></label>
      {all && <label className='grid gap-1 text-xs text-ui-text-3'>{t('Channel ID')}<Input aria-label={t('Channel ID')} value={filters.channel_id} onChange={(value) => setFilters((previous) => ({ ...previous, channel_id: value }))} /></label>}
      {(['start', 'end'] as const).map((key) => <label key={key} className='grid min-w-0 gap-1 text-xs text-ui-text-3'>{t(key === 'start' ? 'Submission start time' : 'Submission end time')}<Input aria-label={t(key === 'start' ? 'Submission start time' : 'Submission end time')} type='datetime-local' value={filters[key]} onChange={(value, event) => { setFilters((previous) => ({ ...previous, [key]: value })); setBadDates((previous) => ({ ...previous, [key]: event?.target.validity.badInput ?? false })); }} /></label>)}
      <div className='flex flex-wrap gap-2'><Button type='submit' variant='toggle' disabled={Boolean(validation)}>{t('Search')}</Button><Button type='button' variant='link' onClick={() => { setFilters(emptyTaskFilters()); setApplied(emptyTaskFilters()); setBadDates({}); setPage(1); setSelected(null); }}>{t('Reset')}</Button></div>
    </form>
    {validation && <p role='alert' className='text-sm text-ui-danger'>{t(validation)}</p>}
    {query.isError ? <div role='alert' className='space-y-2 text-sm text-ui-danger'><p>{t(apiErrorMessage(query.error))}</p><Button onClick={() => void query.refetch()}>{t('Retry')}</Button></div> : query.isFetching && !query.data ? <Loading /> : <><Table rows={rows} rowKey='id' minWidth={720} emptyText={t('No Midjourney tasks')} columns={columns} /><Pagination page={page} pageSize={20} total={query.data?.total || 0} onChange={(value: number) => { setPage(value); setSelected(null); }} /></>}
    {selected && <MidjourneyDetails key={selected.id} row={selected} onClose={() => setSelected(null)} />}
  </div>;
}
export default function MidjourneyAccount() {
  const identity = useAuthStore((state) => `${state.auth.user?.id}:${state.auth.session?.sid}:${state.auth.user?.role}`); const admin = useAuthStore((state) => (state.auth.user?.role ?? 1) >= 10);
  return <MidjourneyPage key={identity} identity={identity} admin={admin} />;
}
