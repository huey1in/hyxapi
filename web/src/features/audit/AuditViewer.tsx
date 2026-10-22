import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { useTranslation } from 'react-i18next';
import { Filter, RefreshCw, ShieldCheck } from 'lucide-react';
import { API } from '../../helpers';
import { Button, IconButton, Input, Pagination, Select, Table } from '../../components/ui';
import type { TableColumn } from '../../components/ui/layout/Table';
import useIsMobile from '../../hooks/useIsMobile';
import type { ApiEnvelope } from '../../types/api';
import { apiErrorMessage } from '../../lib/api-error';
import { accessAuditParams, auditPageSchema, auditParams, emptyAuditFilters, formatAuditDate } from './types';
import type { AuditFilters, AuditLog, AuditScope, TokenAuditScope } from './types';
import { buildAuditDetails } from './audit-details';
import AuditDetails from './AuditDetails';

export default function AuditViewer({ identity, scope, onDenied, accessOnly = false, currentTokenRef, defaultTokenScope = 'all' }: { identity: string; scope: AuditScope; onDenied?: () => void; accessOnly?: boolean; currentTokenRef?: string; defaultTokenScope?: TokenAuditScope }) {
  const { t, i18n } = useTranslation();
  const isMobile = useIsMobile();
  const [showFilters, setShowFilters] = useState(false);
  const [draft, setDraft] = useState<AuditFilters>(emptyAuditFilters);
  const [filters, setFilters] = useState<AuditFilters>(emptyAuditFilters);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [attempt, setAttempt] = useState(0);
  const [validationError, setValidationError] = useState('');
  const [selected, setSelected] = useState<AuditLog | null>(null);
  const [tokenScope, setTokenScope] = useState<TokenAuditScope>(defaultTokenScope);
  const canQuery = !accessOnly || tokenScope === 'all' || (currentTokenRef !== undefined && (tokenScope === 'historical' || !!currentTokenRef));
  const paramsFor = (value: AuditFilters, targetPage: number) => {
    const params = auditParams(value, scope, targetPage, pageSize);
    return accessOnly ? accessAuditParams(params, tokenScope, currentTokenRef) : params;
  };
  const query = useQuery({
    queryKey: ['audit-records', identity, scope, accessOnly, currentTokenRef, tokenScope, filters, page, pageSize, attempt],
    queryFn: async ({ signal }) => {
      const response = await API.get<ApiEnvelope<unknown>>(scope === 'all' ? '/api/audit' : '/api/audit/self', {
        params: paramsFor(filters, page), signal, skipErrorHandler: true, disableDuplicate: true,
      });
      signal.throwIfAborted(); if (!response.data.success) throw new Error(response.data.message || 'Failed to load audit records');
      return auditPageSchema.parse(response.data.data);
    }, enabled: canQuery, retry: false, gcTime: 0, refetchOnWindowFocus: false,
  });
  const accessDenied = scope === 'all' && isAxiosError(query.error) && query.error.response?.status === 403;
  useEffect(() => { if (accessDenied) onDenied?.(); }, [accessDenied, onDenied]);
  const set = <K extends keyof AuditFilters>(key: K, value: AuditFilters[K]) => setDraft((previous) => ({ ...previous, [key]: value }));
  const search = () => {
    try { paramsFor(draft, 1); setValidationError(''); setSelected(null); setPage(1); setFilters({ ...draft }); setAttempt((value) => value + 1); }
    catch (error) { setValidationError(apiErrorMessage(error, 'Invalid audit filters')); }
  };
  const reset = () => { setTokenScope(defaultTokenScope); setDraft(emptyAuditFilters()); setFilters(emptyAuditFilters()); setValidationError(''); setSelected(null); setPage(1); setAttempt((value) => value + 1); };
  const refresh = () => { setSelected(null); setAttempt((value) => value + 1); };
  const rows = query.isError ? [] : query.data?.items ?? [];
  const total = query.isError ? 0 : query.data?.total ?? 0;
  const resultBadge = (row: AuditLog) => <span className='inline-flex items-center gap-1.5 whitespace-nowrap text-xs'><span style={{ width: 7, height: 7, borderRadius: '50%', background: row.success ? '#22c55e' : '#ef4444' }} />{t(row.success ? 'Success' : 'Failed')}</span>;
  const eventColumn: TableColumn<AuditLog> = { key: 'event', title: t('Event'), mobileRole: 'wide', render: (row) => {
    const details = buildAuditDetails(row, t);
    const operation = details.operation;
    return <div className='space-y-1' style={{ maxWidth: isMobile ? '100%' : 280 }}>
      {operation ? <>
        <div className='flex min-w-0 items-baseline gap-1'><span className='min-w-0 truncate font-medium' title={operation.summary}>{operation.headline}</span>{operation.identifier && <span className='shrink-0 whitespace-nowrap text-xs'>{operation.identifier}</span>}</div>
        {operation.description && <p className='line-clamp-2 break-words text-ui-text-2' title={operation.description}>{operation.description}</p>}
      </> : <span className={isMobile ? 'line-clamp-2 break-words' : 'block truncate'} title={details.summary}>{details.summary}</span>}
    </div>;
  } };
  const columns: TableColumn<AuditLog>[] = [
    { key: 'time', title: t('Time'), render: (row) => <span className='whitespace-nowrap text-xs text-ui-text-2'>{formatAuditDate(row.created_at, i18n.language)}</span> },
    { key: 'username', title: t('Username'), render: (row: AuditLog) => <span className='whitespace-nowrap font-medium'>{row.username || '—'}</span> }, eventColumn,
    { key: 'ip', title: 'IP', render: (row: AuditLog) => <span className='whitespace-nowrap text-xs font-mono text-ui-text-3'>{row.ip || '—'}</span> },
    { key: 'result', title: t('Result'), render: resultBadge },
    { key: 'details', title: t('Details'), mobileRole: 'actions', render: (row) => <Button variant='link' size='sm' onClick={() => setSelected(row)}>{t('Details')}</Button> },
  ];
  const input = (key: keyof AuditFilters, label: string, type = 'text') => <label className='block space-y-1 text-xs text-ui-text-3'>
    <span>{t(label)}</span><Input type={type} aria-label={t(label)} value={draft[key]} onChange={(value) => set(key, value)} width='full' step={type === 'datetime-local' ? 1 : undefined} />
  </label>;
  const error = query.isError ? apiErrorMessage(query.error, 'Failed to load audit records') || 'Failed to load audit records' : '';
  return <div className='space-y-5'>
    <div className='flex flex-wrap justify-end gap-1.5'>
      {accessOnly && <Select aria-label={t('Token scope')} value={tokenScope} options={[{ value: 'all', label: t('All tokens') }, { value: 'current', label: t('Current token'), disabled: !currentTokenRef }, { value: 'historical', label: t('Historical tokens'), disabled: currentTokenRef === undefined }]} onChange={(value) => { setTokenScope(value); setSelected(null); setPage(1); }} width={200} />}
      <IconButton icon={Filter} title={t('Filters')} aria-label={t('Filters')} selected={showFilters} onClick={() => setShowFilters((value) => !value)} />
      <IconButton icon={RefreshCw} title={t('Refresh')} aria-label={t('Refresh')} disabled={query.isFetching} onClick={refresh} />
    </div>
    {showFilters && <form onSubmit={(event) => { event.preventDefault(); if (!query.isFetching) search(); }} className='p-4 border border-ui-border rounded-2xl space-y-3'>
      <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
        <label className='block space-y-1 text-xs text-ui-text-3'><span>{t('Result')}</span><Select width='full' aria-label={t('Result')} value={draft.success} onChange={(value) => set('success', value)} options={[{ value: '', label: t('All results') }, { value: 'true', label: t('Success') }, { value: 'false', label: t('Failed') }]} /></label>
        {!accessOnly && <label className='block space-y-1 text-xs text-ui-text-3'><span>{t('Category')}</span><Select width='full' aria-label={t('Category')} value={draft.category} onChange={(value) => set('category', value)} options={[{ value: '', label: t('All categories') }, { value: 'login', label: t('Login') }, { value: 'security', label: t('Account security') }, { value: 'operation', label: t('Operation audit') }, { value: 'access_token', label: t('Access Token') }]} /></label>}
        {input('start', 'Start time', 'datetime-local')}{input('end', 'End time', 'datetime-local')}
        {!accessOnly && <>{input('token_ref', 'Token identifier')}{input('request_id', 'Request ID')}</>}
        {scope === 'all' && input('username', 'Username')}
      </div>
      {validationError && <p role='alert' className='text-sm text-ui-danger'>{t(validationError)}</p>}
      <div className='flex justify-end gap-2'><Button variant='toggle' onClick={reset} disabled={query.isFetching}>{t('Reset')}</Button><Button type='submit' loading={query.isFetching}>{t('Search')}</Button></div>
    </form>}
    {error && <div role='alert' className='text-sm text-ui-text-2 flex items-center gap-3'><span>{t(error)}</span><Button variant='link' onClick={refresh}>{t('Retry')}</Button></div>}
    {<>
      <Table loading={query.isPending && canQuery} columns={columns} rows={rows} rowKey='event_id' size={isMobile ? 'sm' : 'md'} emptyIcon={ShieldCheck} emptyText={t(query.isError ? 'Failed to load audit records' : 'No audit records')} />
      <div className='flex flex-wrap justify-end items-center gap-2'>
        <Select aria-label={t('Rows per page')} value={pageSize} disabled={query.isFetching || query.isError} options={[20, 50, 100]} onChange={(value) => { setSelected(null); setPageSize(value); setPage(1); }} width={85} />
        <Pagination total={total} pageSize={pageSize} page={page} onChange={(value: number) => { if (!query.isFetching && !query.isError) { setSelected(null); setPage(value); } }} />
      </div>
    </>}
    {selected && !query.isError && <AuditDetails entry={selected} identity={identity} onClose={() => setSelected(null)} />}
  </div>;
}
