import { useContext, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Filter, RefreshCw } from 'lucide-react';
import { API } from '../../helpers';
import { FormField, Button, IconButton, Input, Modal, Pagination, Select, Switch, showError } from '../../components/ui';
import { useAuthStore } from '../../stores/auth-store';
import { StatusContext } from '../../context/Status';
import { apiErrorMessage } from '../../lib/api-error';
import type { ApiEnvelope } from '../../types/api';
import { changeFeedSource, emptyFeedFilters, feedPageSchema, feedQuery, projectFeedItem, validateFeedFilters } from './feed-data';
import type { FeedFilters, FeedRow } from './feed-data';
import type { LogSourceOption } from './log-navigation';
import LogsTable from './LogsTable';
import LogExportButton from './LogExportButton';
import LogDetails from './LogDetails';
import { taskStatusLabels } from './task-data';

const PAGE_SIZE = 20;
const LOG_TYPES = ['All', 'Top up', 'Consumption', 'Management', 'System', 'Error', 'Refund', 'Login'];
const TEXT_FILTERS = { token_name: 'Token name', model_name: 'Model', request_id: 'Request ID', upstream_request_id: 'Upstream Request ID', task_id: 'Task ID', action: 'Action', platform: 'Plugin / platform' } as const;
type LogScope = 'all' | 'self';

export default function UnifiedLogs({ sources }: { sources: LogSourceOption[] }) {
  const { t } = useTranslation();
  const auth = useAuthStore((state) => state.auth);
  const [status] = useContext(StatusContext);
  const role = auth.user?.role ?? 1; const admin = role >= 10;
  const identity = `${auth.user?.id}:${auth.session?.sid}:${role}`;
  const defaultScope: LogScope = admin ? 'all' : 'self';
  const [scope, setScope] = useState<LogScope>(defaultScope); const all = admin && scope === 'all';
  const [draftScope, setDraftScope] = useState<LogScope>(defaultScope); const draftAll = admin && draftScope === 'all';
  const [filters, setFilters] = useState(emptyFeedFilters);
  const [applied, setApplied] = useState(emptyFeedFilters);
  const [showFilters, setShowFilters] = useState(false);
  const [badDates, setBadDates] = useState<Record<string, boolean>>({});
  const [pagination, setPagination] = useState({ page: 1, cursors: [''] });
  const [revision, setRevision] = useState(0);
  const [refresh, setRefresh] = useState(false);
  const [selected, setSelected] = useState<FeedRow | null>(null);
  const enabledSources = sources.map((source) => source.value);
  const queryString = feedQuery(applied, all, role, enabledSources).toString();
  const cursor = pagination.cursors[pagination.page - 1];
  const query = useQuery({
    queryKey: ['log-feed', identity, all, queryString, cursor, revision], gcTime: 0, retry: false,
    refetchInterval: refresh ? 5000 : false,
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams(queryString); params.set('size', String(PAGE_SIZE)); if (cursor) params.set('cursor', cursor);
      const { data } = await API.get<ApiEnvelope<unknown>>(`${all ? '/api/log' : '/api/log/self'}/feed?${params}`, { signal, timeout: 30000, disableDuplicate: true, skipErrorHandler: true });
      signal.throwIfAborted();
      if (!data.success) throw new Error(data.message || 'Unable to load logs');
      return feedPageSchema.parse(data.data);
    },
  });
  const viewerRole = all ? role : 1;
  const rows = useMemo(() => query.isError ? [] : query.data?.items.map((row) => projectFeedItem(row, viewerRole)) ?? [], [query.data, query.isError, viewerRole]);
  const resetPage = () => { setPagination({ page: 1, cursors: [''] }); setSelected(null); };
  const reload = () => { resetPage(); setRevision((value) => value + 1); };
  const apply = (value: FeedFilters, nextScope: LogScope) => {
    const error = validateFeedFilters(value);
    if (error) { showError(t(error)); return; }
    setScope(nextScope); setDraftScope(nextScope);
    setApplied({ ...value }); setShowFilters(false); reload();
  };
  const reset = () => { const value = emptyFeedFilters(); setFilters(value); setBadDates({}); apply(value, defaultScope); };
  const field = <K extends keyof FeedFilters>(key: K) => (value: FeedFilters[K]) => setFilters((previous) => ({ ...previous, [key]: value }));
  const validation = Object.values(badDates).some(Boolean) ? 'Invalid time range' : validateFeedFilters(filters);
  const active = scope !== defaultScope || JSON.stringify(applied) !== JSON.stringify(emptyFeedFilters());
  const nextPage = (page: number) => {
    if (page > pagination.page) {
      if (!query.data?.next_cursor) return;
      setPagination((previous) => ({ page, cursors: [...previous.cursors.slice(0, page - 1), query.data!.next_cursor] }));
    } else setPagination((previous) => ({ ...previous, page }));
    setSelected(null);
  };
  const specificFields: (keyof typeof TEXT_FILTERS)[] = filters.source === 'usage'
    ? ['token_name', 'model_name', 'request_id', ...(draftAll && role >= 100 ? ['upstream_request_id'] as const : [])]
    : filters.source === 'tasks' ? ['task_id', 'action', 'platform'] : filters.source === 'midjourney' ? ['task_id', 'action'] : [];

  return <div className='min-w-0 space-y-5'>
    <div className='grid grid-cols-[auto_minmax(0,1fr)] items-start gap-2 md:flex md:flex-wrap md:items-center md:justify-between md:gap-3'>
      <div className='flex flex-col items-start gap-2 md:flex-row md:items-center'><Button size='md' variant='toggle' icon={Filter} selected={active} onClick={() => { setFilters({ ...applied }); setDraftScope(scope); setBadDates({}); setShowFilters(true); }}>{t('Filters')}</Button>{active && <Button size='sm' variant='link' onClick={reset}>{t('Reset filters')}</Button>}</div>
      <div className='flex min-w-0 flex-wrap items-center justify-end gap-1 md:justify-start md:gap-3'>
        <label className='flex min-h-[38px] shrink-0 items-center gap-2 whitespace-nowrap text-sm text-ui-text-2'><span>{t('Auto refresh')}</span><Switch aria-label={t('Auto refresh')} checked={refresh} onChange={setRefresh} /></label>
        {(admin || status.status?.log_export_enabled !== false) && <LogExportButton key={`${identity}:${all}:${queryString}`} filters={applied} role={role} all={all} sources={enabledSources} />}
        <IconButton icon={RefreshCw} title={t('Refresh')} disabled={query.isFetching} onClick={reload} />
      </div>
    </div>
    {query.isError ? <div role='alert' className='flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ui-border p-4 text-sm text-ui-text-2'><span>{t(apiErrorMessage(query.error))}</span><Button variant='toggle' onClick={reload}>{t('Retry')}</Button></div> : <>
      <LogsTable rows={rows} loading={query.isPending} all={all} onSelect={setSelected} />
      <Pagination page={pagination.page} pageSize={PAGE_SIZE} total={query.data?.total ?? 0} onChange={nextPage} />
    </>}
    <Modal open={showFilters} title={t('Filters')} width={520} onClose={() => setShowFilters(false)} footer={<><Button variant='toggle' onClick={reset}>{t('Reset')}</Button><Button disabled={Boolean(validation)} onClick={() => apply(filters, draftScope)}>{t('Apply')}</Button></>}>
      <div className='space-y-4 pb-2'>
        {admin && <FormField label={t('Log scope')}><Select<LogScope> aria-label={t('Log scope')} width='full' popover value={draftScope} onChange={(value) => { setDraftScope(value); if (value === 'self') setFilters((previous) => ({ ...previous, username: '', upstream_request_id: '' })); }} options={[{ value: 'all', label: t('All logs') }, { value: 'self', label: t('My logs') }]} /></FormField>}
        <FormField label={t('Log source')}><Select width='full' popover aria-label={t('Log source')} value={filters.source} onChange={(value) => setFilters((previous) => changeFeedSource(previous, value))} options={[{ value: '', label: t('All types') }, ...sources.map((source) => ({ value: source.value, label: t(source.label) }))]} /></FormField>
        {(['start_timestamp', 'end_timestamp'] as const).map((key) => <FormField key={key} label={t(key === 'start_timestamp' ? 'Start time' : 'End time')}><Input width='full' aria-label={t(key === 'start_timestamp' ? 'Start time' : 'End time')} type='datetime-local' value={filters[key]} onChange={(value, event) => { field(key)(value); setBadDates((previous) => ({ ...previous, [key]: event?.target.validity.badInput ?? false })); }} /></FormField>)}
        {draftAll && <FormField label={t('Username')}><Input width='full' aria-label={t('Username')} value={filters.username} onChange={field('username')} /></FormField>}
        {(!filters.source || filters.source === 'usage') && <FormField label={t('Group')}><Input width='full' aria-label={t('Group')} value={filters.group} onChange={field('group')} /></FormField>}
        {filters.source === 'usage' && <FormField label={t('Type')}><Select width='full' popover aria-label={t('Type')} value={filters.type} onChange={field('type')} options={LOG_TYPES.map((label, value) => ({ value, label: t(label) }))} /></FormField>}
        {specificFields.map((key) => <FormField key={key} label={t(TEXT_FILTERS[key])}><Input width='full' aria-label={t(TEXT_FILTERS[key])} value={filters[key]} onChange={field(key)} /></FormField>)}
        {(filters.source === 'tasks' || filters.source === 'midjourney') && <FormField label={t('Status')}><Select width='full' popover aria-label={t('Task status')} value={filters.status} onChange={field('status')} options={[{ value: '', label: t('All statuses') }, ...Object.entries(taskStatusLabels).map(([value, label]) => ({ value, label: t(label) }))]} /></FormField>}
        {validation && <p role='alert' className='text-sm text-ui-danger'>{t(validation)}</p>}
      </div>
    </Modal>
    {selected && <LogDetails key={selected.key} row={selected} identity={identity} isAdmin={all} isRoot={all && role >= 100} onClose={() => setSelected(null)} />}
  </div>;
}
