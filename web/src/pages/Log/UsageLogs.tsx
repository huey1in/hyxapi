import { useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Filter, RefreshCw } from 'lucide-react';
import { API, renderNumber, renderQuota, timestamp2string } from '../../helpers';
import { useAuthStore } from '../../stores/auth-store';
import { StatusContext } from '../../context/Status';
import type { ApiEnvelope } from '../../types/api';
import { logQuery } from './export';
import { emptyLogFilters, enrichLog, getBillingPriceFields, logPageSchema, logSchema, validateLogFilters } from './log-data';
import type { EnrichedLog, LogFilters } from './log-data';
import { logStatsSchema } from './log-data';
import LogExportButton from './LogExportButton';
import type { TableColumn } from '../../components/ui/layout/Table';
import { Button, IconButton, Input, Select, Pagination, Table, showError } from '../../components/ui';
import useIsMobile from '../../hooks/useIsMobile';
import { ExpressionBillingLog } from '../../features/pricing/ExpressionBillingLog';
import ToolSurcharges from '../../features/pricing/ToolSurcharges';

const PAGE_SIZE = 20;
const PREVIEW_MODELS = ['gpt-4.1', 'claude-sonnet-4', 'gemini-2.5-flash', 'deepseek-chat', 'grok-4', 'mistral-large'];
const PREVIEW_USAGE = [
  { input: 12840, output: 3240, cache: 11200, frt: 186 },
  { input: 7640, output: 1180, cache: 6140, frt: 241 },
  { input: 23180, output: 6840, cache: 18900, frt: 328 },
  { input: 9820, output: 2360, cache: 0, frt: 214 },
  { input: 31560, output: 9120, cache: 22400, frt: 472 },
  { input: 6740, output: 840, cache: 5800, frt: 163 },
  { input: 18720, output: 4560, cache: 13600, frt: 296 },
  { input: 44200, output: 12700, cache: 30700, frt: 538 },
  { input: 15480, output: 3280, cache: 0, frt: 257 },
];
const PREVIEW_LOGS = Array.from({ length: 9 }, (_, index) => logSchema.parse({
  id: index + 1,
  created_at: Math.floor(Date.now() / 1000) - index * 17,
  type: 2,
  model_name: PREVIEW_MODELS[index % PREVIEW_MODELS.length],
  token_name: index % 2 ? 'development' : 'production',
  group: index % 3 ? 'default' : 'production',
  prompt_tokens: PREVIEW_USAGE[index].input,
  completion_tokens: PREVIEW_USAGE[index].output,
  quota: 286 + index * 73,
  use_time: 0.68 + index * 0.11,
  other: JSON.stringify({ frt: PREVIEW_USAGE[index].frt, cache_tokens: PREVIEW_USAGE[index].cache }),
}));

const TYPE_OPTIONS = [
  { value: 0, label: 'All' },
  { value: 1, label: 'Top up' },
  { value: 2, label: 'Consumption' },
  { value: 3, label: 'Management' },
  { value: 4, label: 'System' },
  { value: 5, label: 'Error' },
  { value: 6, label: 'Refund' },
  { value: 7, label: 'Login' },
];

const TYPE_LABELS: Record<number, string> = {
  1: 'Top up', 2: 'Consumption', 3: 'Management', 4: 'System', 5: 'Error', 6: 'Refund', 7: 'Login',
};

const TYPE_COLORS: Record<number, string> = {
  1: '#22c55e', 2: '#000', 3: '#3b82f6', 4: '#8b5cf6', 5: '#ef4444', 6: '#f59e0b',
};

const TypeBadge = ({ type }: { type: number }) => {
  const { t } = useTranslation();
  const color = TYPE_COLORS[type] || '#999';
  return (
    <span title={t(TYPE_LABELS[type] || 'System')} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap', maxWidth: '100%', minWidth: 0 }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
      <span style={{ fontSize: 13, color: 'var(--ui-text)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t(TYPE_LABELS[type] || 'System')}</span>
    </span>
  );
};

const Num = ({ value, compact = false }: { value: number; compact?: boolean }) => (
  value > 0
    ? <span style={{ fontVariantNumeric: 'tabular-nums' }}>{compact && value >= 1000 ? `${(value / 1000).toFixed(1)}k` : renderNumber(value)}</span>
    : <span style={{ color: 'var(--ui-text-3)' }}>—</span>
);

const Quota = ({ row }: { row: EnrichedLog }) => {
  // 充值 / 退款：绿色正数；从 content 解析充值金额
  if (row.type === 1 || row.type === 6) {
    let amount = row.quota;
    if (!amount && row.content) {
      const m = row.content.match(/[＄$]\s*([\d.]+)/);
      const quotaPerUnit = Number(localStorage.getItem('quota_per_unit'));
      if (m) amount = parseFloat(m[1]) * (Number.isFinite(quotaPerUnit) && quotaPerUnit > 0 ? quotaPerUnit : 500000);
    }
    if (amount > 0) {
      return <span style={{ color: '#22c55e', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>+{renderQuota(amount, 4)}</span>;
    }
    return <span style={{ color: 'var(--ui-text-3)' }}>—</span>;
  }
  if (row.quota > 0) {
    return <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{renderQuota(row.quota, 4)}</span>;
  }
  return <span style={{ color: 'var(--ui-text-3)' }}>—</span>;
};

const TruncatedField = ({ value, muted = false }: { value: string; muted?: boolean }) => (
  <span
    title={value || undefined}
    style={{
      display: 'block',
      width: '100%',
      minWidth: 0,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      color: muted ? 'var(--ui-text-2)' : undefined,
    }}
  >
    {value || '—'}
  </span>
);

const LogContent = ({ preview = false }: { preview?: boolean }) => {
  const { t } = useTranslation();
  const auth = useAuthStore((state) => state.auth);
  const [statusState] = useContext(StatusContext);
  const role = preview ? 0 : auth.user?.role ?? 0;
  const isAdmin = role >= 10; const isRoot = role >= 100;
  const [query, setQuery] = useState({ page: 1, filters: emptyLogFilters() });
  const page = query.page;
  const [showFilters, setShowFilters] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const isMobile = useIsMobile();
  const [filters, setFilters] = useState(emptyLogFilters);
  const f = <K extends keyof LogFilters>(key: K) => (value: LogFilters[K]) => setFilters((current) => ({ ...current, [key]: value }));
  const base = isAdmin ? '/api/log' : '/api/log/self';
  const identity = `${auth.user?.id}:${auth.session?.sid}:${role}`;
  const queryString = logQuery(query.filters, isAdmin, isRoot).toString();
  const common = { enabled: !preview && !!auth.user, retry: false, gcTime: 0, refetchOnMount: 'always' as const };
  const logs = useQuery({ ...common, queryKey: ['consumption-logs', identity, queryString, page], queryFn: async ({ signal }) => {
    const params = new URLSearchParams(queryString); params.set('p', String(page)); params.set('size', String(PAGE_SIZE));
    const { data } = await API.get<ApiEnvelope<unknown>>(`${base}/?${params}`, { signal, timeout: 15000, disableDuplicate: true, skipErrorHandler: true });
    signal.throwIfAborted();
    if (!data.success) throw new Error(data.message || 'Unable to load logs');
    return logPageSchema.parse(data.data);
  } });
  const stats = useQuery({ ...common, queryKey: ['consumption-log-stat', identity, queryString], queryFn: async ({ signal }) => {
    const { data } = await API.get<ApiEnvelope<unknown>>(`${base}/stat?${queryString}`, { params: { include_rates: true }, signal, timeout: 15000, disableDuplicate: true, skipErrorHandler: true });
    signal.throwIfAborted();
    if (!data.success) throw new Error(data.message || 'Unable to load log statistics');
    return logStatsSchema.parse(data.data);
  } });
  const refresh = () => void Promise.allSettled([logs.refetch(), stats.refetch()]);
  const load = (p = 1, fl = query.filters) => {
    const error = validateLogFilters(fl, isAdmin, statusState.status?.log_max_range_days);
    if (error) { showError(t(error)); return; }
    setExpanded(null);
    if (p === page && logQuery(fl, isAdmin, isRoot).toString() === queryString) refresh();
    else setQuery({ page: p, filters: { ...fl } });
  };
  const reset = () => { const empty = emptyLogFilters(); setFilters(empty); load(1, empty); };
  const rows = preview ? PREVIEW_LOGS : logs.error ? [] : logs.data?.items ?? [];
  const total = preview ? PREVIEW_LOGS.length : logs.error ? 0 : logs.data?.total ?? 0;
  const loading = !preview && logs.isPending;
  const enriched = useMemo(() => rows.map((row) => enrichLog(row, role)), [rows, role]);

  const columns = useMemo<TableColumn<EnrichedLog>[]>(() => {
    if (isMobile && preview) {
      return [
        { key: 'model', title: t('Model'), render: (r) => <TruncatedField value={r.model_name} /> },
        { key: 'input', title: t('Input'), align: 'right', render: (r) => <Num value={r.prompt_tokens || 0} compact /> },
        { key: 'output', title: t('Output'), align: 'right', render: (r) => <Num value={r.completion_tokens || 0} compact /> },
        { key: 'cache', title: t('Cache'), align: 'right', render: (r) => <Num value={r._cache} compact /> },
      ];
    }
    if (isMobile) {
      return [
        { key: 'model', title: t('Model'), width: '65%', render: (r) => <TruncatedField value={r.model_name} /> },
        {
          key: 'quota',
          title: t('Quota'),
          width: '35%',
          align: 'right',
          render: (r) => <span className='log-mobile-quota'><Quota row={r} /></span>,
        },
      ];
    }
    const cols: TableColumn<EnrichedLog>[] = [
      { key: 'time', title: t('Time'), width: 175, render: (r) => <span title={timestamp2string(r.created_at)} style={{ whiteSpace: 'nowrap', color: 'var(--ui-text-2)' }}>{timestamp2string(r.created_at)}</span> },
      { key: 'type', title: t('Type'), width: 135, render: (r) => <TypeBadge type={r.type} /> },
      { key: 'model', title: t('Model'), width: 150, render: (r) => <TruncatedField value={r.model_name} /> },
    ];
    if (isAdmin) {
      cols.push({ key: 'username', title: t('User'), width: 110, render: (r) => <TruncatedField value={r.username} /> });
    }
    cols.push(
      { key: 'token', title: t('Token'), width: 110, render: (r) => <TruncatedField value={r.token_name} muted /> },
      { key: 'group', title: t('Group'), width: 96, render: (r) => <TruncatedField value={r.group} muted /> },
      { key: 'input', title: t('Input'), align: 'right', width: 88, render: (r) => <Num value={r.prompt_tokens || 0} compact={preview} /> },
      { key: 'output', title: t('Output'), align: 'right', width: 88, render: (r) => <Num value={r.completion_tokens || 0} compact={preview} /> },
      { key: 'cache', title: t('Cache'), align: 'right', width: 88, render: (r) => <Num value={r._cache} compact={preview} /> },
      { key: 'frt', title: t('First response'), align: 'right', width: 100, render: (r) => {
        const frt = r._other?.frt;
        // 流式：用真实首字时间；非流式（同步）：无首字概念，用总响应时长代替
        let ms;
        if (frt && frt > 0) {
          ms = Math.round(frt);
        } else if (r.use_time > 0) {
          ms = Math.round(r.use_time * 1000);
        } else {
          return <span style={{ color: 'var(--ui-text-3)' }}>—</span>;
        }
        const color = ms > 3000 ? '#e53e3e' : ms > 1000 ? '#d69e2e' : 'var(--ui-text-2)';
        const text = ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${ms}ms`;
        return <span style={{ whiteSpace: 'nowrap', color, fontVariantNumeric: 'tabular-nums' }}>{text}</span>;
      } },
      { key: 'quota', title: t('Quota'), align: 'right', width: 100, render: (r) => <Quota row={r} /> },
    );
    return cols.map((column) => ({ ...column, title: <span className='block whitespace-normal'>{column.title}</span> }));
  }, [isMobile, isAdmin, preview, t]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: preview && !isMobile ? 28 : 20, width: '100%', maxWidth: preview ? 1160 : undefined, marginInline: 'auto', padding: preview ? (isMobile ? '16px' : '24px 16px') : 0, minWidth: 0, overflow: 'hidden' }}>
      {/* 标题 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: preview ? 'space-between' : 'flex-end', flexWrap: 'wrap', gap: 8 }}>
        {preview && <h1 style={{ fontSize: 18, fontWeight: 600, color: 'var(--ui-text)' }}>{t('Usage logs')}</h1>}
        {!preview && <div style={{ display: 'flex', gap: 6 }}>
          {(isAdmin || statusState.status?.log_export_enabled !== false) && <LogExportButton key={identity + queryString} filters={query.filters} role={role} maxDays={statusState.status?.log_max_range_days} />}
          <IconButton icon={Filter} title={t('Filters')} selected={showFilters} onClick={() => setShowFilters((s) => !s)} />
          <IconButton icon={RefreshCw} title={t('Refresh')} disabled={logs.isFetching || stats.isFetching} onClick={refresh} />
        </div>}
      </div>

      {!preview && <div className='flex flex-col gap-2 text-xs text-ui-text-3'>
        <div className='flex flex-wrap gap-x-5 gap-y-2' aria-label={t('Consumption totals')}>
          <span>{t('Consumption')}: <strong className='font-medium text-ui-text'>{stats.data && !stats.error ? renderQuota(stats.data.quota, 4) : '—'}</strong></span>
          <span>{t('Tokens')}: <strong className='font-medium text-ui-text'>{stats.data && !stats.error ? renderNumber(stats.data.tokens) : '—'}</strong></span>
          <span>{t('Requests')}: <strong className='font-medium text-ui-text'>{stats.data && !stats.error ? renderNumber(stats.data.requests) : '—'}</strong></span>
          <span>{t('Current RPM')}: <strong className='font-medium text-ui-text'>{stats.data && !stats.error ? renderNumber(stats.data.rpm) : '—'}</strong></span>
          <span>{t('Current TPM')}: <strong className='font-medium text-ui-text'>{stats.data && !stats.error ? renderNumber(stats.data.tpm) : '—'}</strong></span>
        </div>
        {(query.filters.request_id || query.filters.upstream_request_id || query.filters.type !== 0) && <p>{t('Request ID and log type filters apply to the table and export only.')}</p>}
        {typeof statusState.status?.log_max_range_days === 'number' && <p>{t(isAdmin ? 'Maximum export range: {{days}} days' : 'Maximum query/export range: {{days}} days', { days: statusState.status.log_max_range_days })}</p>}
      </div>}
      {!preview && (logs.error || stats.error) && <div role='alert' className='flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ui-border p-4 text-sm text-ui-text-2'>
        <span>{t(logs.error ? 'Unable to load logs' : 'Unable to load log statistics')}</span><Button variant='toggle' onClick={refresh}>{t('Retry')}</Button>
      </div>}

      {/* 筛选面板 */}
      {showFilters && (
        <div style={{ padding: 16, border: '1px solid var(--ui-border)', borderRadius: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
            {(['start_timestamp', 'end_timestamp'] as const).map((key) => <label key={key} style={{ fontSize: 12, color: 'var(--ui-text-3)' }}>
              {key === 'start_timestamp' ? t('Start time') : t('End time')}
              <Input type='datetime-local' aria-label={key === 'start_timestamp' ? t('Start time') : t('End time')} value={filters[key] || ''} onChange={f(key)} width='full' />
            </label>)}
            <div>
              <div style={{ fontSize: 12, color: 'var(--ui-text-3)', marginBottom: 4 }}>{t('Type')}</div>
              <Select value={filters.type} onChange={(v) => f('type')(Number(v))} options={TYPE_OPTIONS.map((option) => ({ ...option, label: t(option.label) }))} aria-label={t('Type')} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--ui-text-3)', marginBottom: 4 }}>{t('Token name')}</div>
              <Input aria-label={t('Token name')} value={filters.token_name} onChange={f('token_name')} width='full' />
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--ui-text-3)', marginBottom: 4 }}>{t('Model')}</div>
              <Input aria-label={t('Model')} value={filters.model_name} onChange={f('model_name')} width='full' />
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--ui-text-3)', marginBottom: 4 }}>{t('Group')}</div>
              <Input aria-label={t('Group')} value={filters.group} onChange={f('group')} width='full' />
            </div>
            {isAdmin && (
              <>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--ui-text-3)', marginBottom: 4 }}>{t('Channel ID')}</div>
                  <Input aria-label={t('Channel ID')} value={filters.channel} onChange={f('channel')} width='full' />
                </div>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--ui-text-3)', marginBottom: 4 }}>{t('Username')}</div>
                  <Input aria-label={t('Username')} value={filters.username} onChange={f('username')} width='full' />
                </div>
              </>
            )}
            <div>
              <div style={{ fontSize: 12, color: 'var(--ui-text-3)', marginBottom: 4 }}>{t('Request ID')}</div>
              <Input aria-label={t('Request ID')} value={filters.request_id} onChange={f('request_id')} width='full' />
            </div>
            {isRoot && <div>
              <div style={{ fontSize: 12, color: 'var(--ui-text-3)', marginBottom: 4 }}>{t('Upstream Request ID')}</div>
              <Input aria-label={t('Upstream Request ID')} value={filters.upstream_request_id} onChange={f('upstream_request_id')} width='full' />
            </div>}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button variant='toggle' onClick={reset}>{t('Reset')}</Button>
            <Button onClick={() => load(1, filters)}>{t('Search')}</Button>
          </div>
        </div>
      )}

      {/* 表格 */}
      {(
        <>
          {!logs.error && <div className={isMobile ? 'log-table-mobile' : undefined} style={{ fontFamily: "'JetBrains Mono', 'Noto Sans SC', monospace", maxWidth: '100%', overflow: 'hidden' }}>
            <Table
              loading={loading}
              columns={columns}
              rows={enriched}
              size={isMobile && preview ? 'sm' : 'md'}
              rowKey='id'
              tableLayout={isMobile && preview ? 'auto' : 'fixed'}
              minWidth={isMobile ? undefined : (isAdmin ? 1340 : 1230)}
              emptyText={t('No data')}
              onRowClick={preview ? undefined : (r) => setExpanded((prev) => prev === r.id ? null : r.id)}
              rowProps={preview ? undefined : (r) => ({ tabIndex: 0, 'aria-expanded': expanded === r.id, onKeyDown: (event) => {
                if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setExpanded((previous) => previous === r.id ? null : r.id); }
              } })}
              expandedKey={expanded}
              renderExpanded={preview ? undefined : (r) => <LogDetail row={r} isAdmin={isAdmin} isRoot={isRoot} isMobile={isMobile} onClose={() => setExpanded(null)} />}
            />
          </div>}

          {!logs.error && <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Pagination total={total} pageSize={PAGE_SIZE} page={page} onChange={(p: number) => load(p)} />
          </div>}
        </>
      )}
    </div>
  );
};

// ── 详情面板 ──────────────────────────────────────────

const LogDetail = ({ row: r, isAdmin, isRoot, isMobile, onClose }: { row: EnrichedLog; isAdmin: boolean; isRoot: boolean; isMobile: boolean; onClose: () => void }) => {
  const { t } = useTranslation();
  const other = r._other;
  const source = other.billing_source || other.wallet;
  const conversion = other.request_conversion?.join(' → ') || other.request_convert;
  const formatUnitPrice = (value: number, unit: string) => {
    const numeric = Number(value);
    const formatted = Number.isFinite(numeric)
      ? numeric.toLocaleString('en-US', { maximumFractionDigits: 10 })
      : String(value);
    return `${formatted} USD / ${t(unit)}`;
  };
  return (
    <div style={{ padding: '16px 18px', background: 'var(--ui-bg-subtle)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', minWidth: 0, gap: 8 }}>
          <TypeBadge type={r.type} />
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ui-text)', overflowWrap: 'anywhere' }}>{r.model_name || t('System operation')}</span>
          <span style={{ fontSize: 12, color: 'var(--ui-text-3)' }}>{timestamp2string(r.created_at)}</span>
        </div>
        <button onClick={onClose} style={{ cursor: 'pointer', background: 'none', border: 'none', fontSize: 12, color: 'var(--ui-text-3)', flexShrink: 0, whiteSpace: 'nowrap' }}>{t('Collapse')}</button>
      </div>
      {r._metadataInvalid && <p role='alert' className='mb-3 text-xs text-ui-text-3'>{t('Some legacy log details could not be read.')}</p>}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '8px 24px', fontSize: 13 }}>
        <DetailItem label={t('Token name')} value={r.token_name || '-'} />
        <DetailItem label={t('Group')} value={r.group || '-'} />
        <DetailItem label={t('Input tokens')} value={renderNumber(r.prompt_tokens || 0)} />
        <DetailItem label={t('Output tokens')} value={renderNumber(r.completion_tokens || 0)} />
        {r._cacheHit > 0 && <DetailItem label={t('Cache read tokens')} value={renderNumber(r._cacheHit)} />}
        {r._cacheWrite > 0 && <DetailItem label={t('Cache write tokens')} value={renderNumber(r._cacheWrite)} />}
        {other.cache_creation_tokens_5m != null && <DetailItem label={t('Cache write tokens (5m)')} value={renderNumber(other.cache_creation_tokens_5m)} />}
        {other.cache_creation_tokens_1h != null && <DetailItem label={t('Cache write tokens (1h)')} value={renderNumber(other.cache_creation_tokens_1h)} />}
        {other.input_tokens_total != null && <DetailItem label={t('Normalized input tokens')} value={renderNumber(other.input_tokens_total)} />}
        {getBillingPriceFields(other).map(({ key, label, unit, value }) => (
          <DetailItem key={key} label={t(label)} value={formatUnitPrice(value, unit)} />
        ))}
        {other?.tool_surcharges != null && <div style={{ gridColumn: '1 / -1' }}><ToolSurcharges value={other.tool_surcharges} /></div>}
        {other?.billing_mode === 'tiered_expr' && <>
          <DetailItem label={t('Billing mode')} value={t('Expression billing')} />
          <DetailItem label={t('Matched tier')} value={other.matched_tier || '-'} />
          <DetailItem label={t('Billing unit')} value={other.billing_unit || '-'} />
          {other.fixed_price != null && <DetailItem label={t('Request price')} value={`${other.fixed_price} USD`} />}
          {other.image_count != null && <DetailItem label={t('Billed images')} value={other.image_count} />}
          {other.billing_tokens != null && <div style={{ gridColumn: '1 / -1' }}><BodyBlock label={t('Billing token details')} value={JSON.stringify(other.billing_tokens)} /></div>}
          <div style={{ gridColumn: '1 / -1' }}><ExpressionBillingLog other={other} modelName={r.model_name} /></div>
        </>}
        {other?.group_ratio != null && <DetailItem label={t('Group multiplier')} value={other.group_ratio} />}
        {r.use_time > 0 && <DetailItem label={t('Duration (s)')} value={`${r.use_time}s`} />}
        {other?.frt != null && other.frt > 0 && <DetailItem label={t('First response time')} value={`${other.frt}ms`} />}
        {source && <DetailItem label={t('Billing source')} value={source === 'wallet' ? t('Wallet') : source === 'subscription' ? t('Subscription') : source} />}
        {other.subscription_id != null && <DetailItem label={t('Subscription ID')} value={other.subscription_id} />}
        {other.subscription_plan_title && <DetailItem label={t('Subscription plan')} value={other.subscription_plan_title} />}
        {other.subscription_consumed != null && <DetailItem label={t('Subscription charged')} value={renderQuota(other.subscription_consumed, 4)} />}
        {other.subscription_used != null && <DetailItem label={t('Subscription used')} value={renderQuota(other.subscription_used, 4)} />}
        {other.subscription_total != null && <DetailItem label={t('Subscription allowance')} value={renderQuota(other.subscription_total, 4)} />}
        {other.subscription_remain != null && <DetailItem label={t('Subscription remaining')} value={renderQuota(other.subscription_remain, 4)} />}
        {other.wallet_quota_deducted != null && <DetailItem label={t('Wallet charged')} value={renderQuota(other.wallet_quota_deducted, 4)} />}
        {conversion && <DetailItem label={t('Request conversion')} value={conversion} />}
        {other?.request_path && <DetailItem label={t('Request path')} value={other.request_path} mono />}
        {other?.usage_semantic && <DetailItem label={t('Usage semantics')} value={other.usage_semantic} />}
        {other?.stream_status && <DetailItem label={t('Stream status')} value={`${other.stream_status.status || ''}${other.stream_status.end_reason ? ' (' + other.stream_status.end_reason + ')' : ''}`} />}
        {isAdmin && <DetailItem label={t('Channel ID')} value={r.channel || other.channel_id || '—'} />}
        <DetailItem label={t('Request ID')} value={r.request_id || '-'} mono />
        {isRoot && r.upstream_request_id && <DetailItem label={t('Upstream Request ID')} value={r.upstream_request_id} mono />}
        <DetailItem label='IP' value={r.ip || '-'} mono />
        {isAdmin && <DetailItem label={t('User')} value={r.username || '-'} />}
        {r.content && (
          <div style={{ gridColumn: '1 / -1' }}>
            <DetailItem label={t('Content')} value={r.content} multiline />
          </div>
        )}
        {isAdmin && Array.isArray(other?.admin_info?.request_policy) && (
          <div style={{ gridColumn: '1 / -1' }}>
            <BodyBlock label={t('Request policy decisions')} value={JSON.stringify(other.admin_info.request_policy, null, 2)} />
          </div>
        )}
        {other?.request_body && (
          <div style={{ gridColumn: '1 / -1' }}>
            <BodyBlock label={t('Request body')} value={other.request_body} />
          </div>
        )}
        {other?.response_body && (
          <div style={{ gridColumn: '1 / -1' }}>
            <BodyBlock label={t('Response body')} value={other.response_body} />
          </div>
        )}
        {Object.keys(r._rawOther).length > 0 && <div style={{ gridColumn: '1 / -1' }}><BodyBlock label={t('Additional details')} value={JSON.stringify(r._rawOther, null, 2)} /></div>}
      </div>
    </div>
  );
};

// ── 请求/响应内容折叠区块 ──────────────────────────────

const BodyBlock = ({ label, value }: { label: string; value: string }) => {
  const [open, setOpen] = useState(false);
  let display = value;
  try { display = JSON.stringify(JSON.parse(value), null, 2); } catch {}
  return (
    <div style={{ marginTop: 4 }}>
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} style={{
        cursor: 'pointer', background: 'none', border: 'none', padding: 0,
        fontSize: 12, color: 'var(--ui-text-3)', display: 'flex', alignItems: 'center', gap: 4,
      }}>
        <span style={{ transform: open ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform 0.15s', display: 'inline-block' }}>▶</span>
        {label}
      </button>
      {open && (
        <pre style={{
          marginTop: 6, padding: 12, background: '#F2F0E9', borderRadius: 10,
          fontSize: 12, fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.5,
          whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: 320, overflow: 'auto',
          color: 'var(--ui-text)',
        }}>{display}</pre>
      )}
    </div>
  );
};

// ── 详情行 ──────────────────────────────────────────────

const DetailItem = ({ label, value, mono, multiline }: { label: string; value: ReactNode; mono?: boolean; multiline?: boolean }) => (
  <div style={{ display: 'flex', gap: 8, minWidth: 0 }}>
    <span style={{ color: 'var(--ui-text-3)', width: 110, flexShrink: 0, fontSize: 12 }}>{label}</span>
    <span style={{
      color: 'var(--ui-text)', fontSize: 13, minWidth: 0,
      fontFamily: mono ? "'JetBrains Mono', monospace" : 'inherit',
      whiteSpace: multiline ? 'pre-wrap' : 'normal',
      wordBreak: 'break-all',
      overflow: 'hidden', textOverflow: 'ellipsis',
    }}>{value}</span>
  </div>
);

export default function UsageLogs({ preview = false }: { preview?: boolean }) {
  const auth = useAuthStore((state) => state.auth);
  const identity = preview ? 'public-preview' : `${auth.user?.id}:${auth.session?.sid}:${auth.user?.role}`;
  return <LogContent key={identity} preview={preview} />;
}
