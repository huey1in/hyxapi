import { useEffect, useState } from 'react';
import type { CSSProperties, PropsWithChildren, ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../stores/auth-store';
import { apiErrorMessage } from '../../lib/api-error';
import { systemStatusSchema } from './status-data';
import type { SystemStatus as StatusData, PoolStatus, ChannelRisk, ModelRisk } from './status-data';
import { readSystemData } from './status-query';
import { RefreshCw } from 'lucide-react';
import { renderQuota, renderNumber } from '../../helpers';
import SystemTasksPanel from './SystemTasksPanel';
import InstancesPanel from '../../features/operations/InstancesPanel';
import MaintenancePanel from '../../features/operations/MaintenancePanel';
import { Button, Loading, IconButton, Table } from '../../components/ui';
import useIsMobile from '../../hooks/useIsMobile';
import type { TableColumn } from '../../components/ui/layout/Table';

/* ─── helpers ─── */

const fmtUptime = (s = 0) => {
  if (!s || s < 0) return '0m';
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  parts.push(`${m}m`);
  return parts.join(' ');
};

const fmtBytes = (b = 0) => {
  if (!b || b <= 0) return '0 B';
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0, v = b;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(i === 0 ? 0 : 2)} ${u[i]}`;
};

const fmtTokens = (n = 0) => {
  if (!n) return '0';
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k';
  return String(n);
};

const fmtPct = (n = 0) => `${Number(n || 0).toFixed(1)}%`;

const fmtRPM = (n = 0) => {
  const v = Number(n || 0);
  if (v >= 100) return v.toFixed(0);
  if (v >= 10) return v.toFixed(1);
  return v.toFixed(2);
};

const fmtLatency = (n = 0) => {
  const v = Number(n || 0);
  if (v <= 0) return '-';
  if (v < 1) return `${Math.round(v * 1000)}ms`;
  return `${v.toFixed(1)}s`;
};

/* ─── atoms ─── */

const StatMini = ({ label, value, sub }: { label: ReactNode; value: ReactNode; sub?: ReactNode }) => (
  <div style={{ paddingBlock: 16, paddingInline: 16, border: '1px solid var(--ui-border)', borderRadius: 16 }}>
    <div style={{ fontSize: 12, color: 'var(--ui-text-3)', marginBottom: 4 }}>{label}</div>
    <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--ui-text)', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    {sub && <div style={{ fontSize: 12, color: 'var(--ui-text-3)', marginTop: 2 }}>{sub}</div>}
  </div>
);

const MiniBar = ({ value, max = 100, color }: { value: number; max?: number; color?: string }) => {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const c = color || (pct > 80 ? '#e53e3e' : pct > 60 ? '#d69e2e' : 'var(--ui-text)');
  return (
    <div style={{ width: '100%', height: 4, borderRadius: 2, background: 'var(--ui-bg-subtle)', marginTop: 6 }}>
      <div style={{ width: `${Math.max(pct, pct > 0 ? 1 : 0)}%`, height: '100%', borderRadius: 2, background: c, transition: 'width 0.3s' }} />
    </div>
  );
};

const ResourceCard = ({ label, value, detail }: { label: ReactNode; value: number; detail?: ReactNode }) => {
  const pct = typeof value === 'number' ? value : 0;
  const color = pct > 80 ? '#e53e3e' : pct > 60 ? '#d69e2e' : 'var(--ui-text)';
  return (
    <div style={{ paddingBlock: 16, paddingInline: 16, border: '1px solid var(--ui-border)', borderRadius: 16 }}>
      <div style={{ fontSize: 12, color: 'var(--ui-text-3)', marginBottom: 4 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontSize: 24, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>{pct.toFixed(1)}%</span>
        {detail && <span style={{ fontSize: 12, color: 'var(--ui-text-3)' }}>{detail}</span>}
      </div>
      <MiniBar value={pct} />
    </div>
  );
};

const Section = ({ title, right, children }: PropsWithChildren<{ title: ReactNode; right?: ReactNode }>) => (
  <div>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
      <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--ui-text)' }}>{title}</span>
      {right && <span style={{ fontSize: 13, color: 'var(--ui-text-3)' }}>{right}</span>}
    </div>
    {children}
  </div>
);

const PoolCard = ({ title, data }: { title: ReactNode; data: PoolStatus }) => {
  const { t } = useTranslation();
  if (data.open === undefined) return null;
  const usePct = data.max_open && data.max_open > 0 ? ((data.in_use ?? 0) / data.max_open) * 100 : 0;
  return (
    <div style={{ padding: 16, border: '1px solid var(--ui-border)', borderRadius: 16, flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ui-text)', marginBottom: 10 }}>{title}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
        <KV label={t('In use')} value={data.in_use} />
        <KV label={t('Idle')} value={data.idle} />
        <KV label={t('Open connections')} value={data.open} />
        <KV label={t('Maximum connections')} value={data.max_open} />
        <KV label={t('Wait count')} value={data.wait_count} />
        <KV label={t('Wait duration')} value={data.wait_duration_ms != null ? `${data.wait_duration_ms}ms` : '-'} />
      </div>
      <MiniBar value={usePct} />
    </div>
  );
};

const KV = ({ label, value }: { label: ReactNode; value: ReactNode }) => (
  <div>
    <div style={{ fontSize: 11, color: 'var(--ui-text-3)' }}>{label}</div>
    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ui-text)', fontVariantNumeric: 'tabular-nums' }}>{value ?? '-'}</div>
  </div>
);

const StatusPill = ({ status }: { status: StatusData['health']['status'] }) => {
  const { t } = useTranslation();
  const map = {
    ok: { text: 'Healthy', color: '#16a34a' },
    warning: { text: 'Warning', color: '#d69e2e' },
    critical: { text: 'Critical', color: '#e53e3e' },
  };
  const item = map[status] || map.ok;
  return (
    <span style={{ color: item.color, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
      {t(item.text)}
    </span>
  );
};

/* ─── page ─── */

function StatusCards({ data, isMobile }: { data: StatusData; isMobile: boolean }) {
  const { t } = useTranslation();
  const { system, health, resources, runtime: rt, database, log_database, redis,
    request_stats: rs, request_health: rh, risk, disk_cache: dc, channel_affinity: ca, channels } = data;

  const grid = (cols: number): CSSProperties => ({ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : `repeat(${cols}, 1fr)`, gap: isMobile ? 8 : 12 });
  const enabledChannels = channels?.enabled || 0;
  const disabledChannels = channels?.disabled || 0;
  const channelRiskRows = risk?.channels || [];
  const modelRiskRows = risk?.models || [];
  const channelRiskColumns: TableColumn<ChannelRisk>[] = [
    { key: 'name', title: t('Channel'), render: (r) => <span style={{ fontWeight: 500 }}>{r.channel_name || `#${r.channel_id}`}</span> },
    { key: 'errors', title: t('Errors'), align: 'right', render: (r) => renderNumber(r.error_requests || 0) },
    { key: 'rate', title: t('Error rate'), align: 'right', render: (r) => fmtPct(r.error_rate) },
    ...(!isMobile ? [
      { key: 'latency', title: t('Average latency'), align: 'right' as const, render: (r: ChannelRisk | ModelRisk) => fmtLatency(r.avg_latency_seconds) },
      { key: 'total', title: t('Requests'), align: 'right' as const, render: (r: ChannelRisk | ModelRisk) => renderNumber(r.total_requests || 0) },
    ] : []),
  ];
  const modelRiskColumns: TableColumn<ModelRisk>[] = [
    { key: 'model', title: t('Model'), render: (r) => <span style={{ fontWeight: 500, maxWidth: isMobile ? 150 : 320, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', verticalAlign: 'bottom' }} title={r.model_name}>{r.model_name}</span> },
    { key: 'errors', title: t('Errors'), align: 'right', render: (r) => renderNumber(r.error_requests || 0) },
    { key: 'rate', title: t('Error rate'), align: 'right', render: (r) => fmtPct(r.error_rate) },
    ...(!isMobile ? [
      { key: 'latency', title: t('Average latency'), align: 'right' as const, render: (r: ChannelRisk | ModelRisk) => fmtLatency(r.avg_latency_seconds) },
      { key: 'total', title: t('Requests'), align: 'right' as const, render: (r: ChannelRisk | ModelRisk) => renderNumber(r.total_requests || 0) },
    ] : []),
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 20 : 28 }}>
      {/* S1: Health overview */}
      <div style={grid(4)}>
        <StatMini label={t('Service health')} value={<StatusPill status={health?.status} />} sub={health.warnings.length ? t(health.warnings[0]) : t('Last 5 minutes')} />
        <StatMini label={t('RPM in last 5 minutes')} value={fmtRPM(rh?.rpm)} sub={t('{{count}} requests', { count: rh.total_requests })} />
        <StatMini label={t('Success rate')} value={fmtPct(rh?.success_rate)} sub={t('{{count}} errors', { count: rh.error_requests })} />
        <StatMini label={t('Average latency')} value={fmtLatency(rh?.avg_latency_seconds)} sub={t('Successful requests')} />
      </div>

      {/* S2: Resources */}
      <Section title={t('Resources and connections')}>
        <div style={grid(4)}>
          <ResourceCard label='CPU' value={resources?.cpu_usage} />
          <ResourceCard label={t('Memory')} value={resources?.memory_usage} />
          <ResourceCard label={t('Disk')} value={resources?.disk_usage}
            detail={resources?.disk_total ? t('{{size}} free', { size: fmtBytes(resources.disk_free) }) : null} />
          <StatMini label={t('Active connections')} value={(system?.active_connections || 0).toLocaleString()} sub={t('Uptime {{time}}', { time: fmtUptime(system.uptime_seconds) })} />
        </div>
      </Section>

      {/* S3: Request Stats */}
      <Section title={t('Request health')}>
        <div style={grid(isMobile ? 2 : 5)}>
          <StatMini label={t('Requests today')} value={renderNumber(rs?.today_requests || 0)} />
          <StatMini label={t('Errors in last 5 minutes')} value={renderNumber(rh?.error_requests || 0)} sub={t('Last 5 minutes')} />
          <StatMini label={t('Tokens today')} value={fmtTokens(rs?.today_tokens)} />
          <StatMini label={t('Cost today')} value={renderQuota(rs?.today_quota || 0)} />
          <StatMini label='Goroutines' value={(system?.goroutines || 0).toLocaleString()} />
        </div>
      </Section>

      {/* S4: Channel health */}
      <Section title={t('Channel health')} right={t('{{enabled}} enabled / {{disabled}} disabled', { enabled: enabledChannels, disabled: disabledChannels })}>
        <Table columns={channelRiskColumns} rows={channelRiskRows} rowKey='channel_id' size='sm' emptyText={t('No channel risk data today')} />
      </Section>

      {/* S5: Model risk */}
      <Section title={t('Model risk')} right={`Top ${modelRiskRows.length}`}>
        <Table columns={modelRiskColumns} rows={modelRiskRows} rowKey='model_name' size='sm' emptyText={t('No model risk data today')} />
      </Section>

      {/* S6: Dependencies */}
      <Section title={t('Dependencies')}>
        <div style={{ display: 'flex', gap: isMobile ? 8 : 12, flexDirection: isMobile ? 'column' : 'row' }}>
          <PoolCard title={t('Main database')} data={database} />
          <PoolCard title={t('Log database')} data={log_database} />
          <div style={{ padding: 16, border: '1px solid var(--ui-border)', borderRadius: 16, flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ui-text)', marginBottom: 10 }}>
              Redis
              {redis && !redis.enabled && <span style={{ fontSize: 11, color: 'var(--ui-text-3)', marginLeft: 6 }}>{t('Disabled')}</span>}
            </div>
            {redis?.enabled ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                <KV label={t('Total connections')} value={redis.total_conns} />
                <KV label={t('Idle')} value={redis.idle_conns} />
                <KV label={t('Timeouts')} value={redis.timeouts || 0} />
                <KV label={t('Key count')} value={redis.db_size != null ? redis.db_size.toLocaleString() : '-'} />
              </div>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--ui-text-3)' }}>{t('Running in memory mode')}</div>
            )}
          </div>
        </div>
      </Section>

      {/* S7: Cache System */}
      <Section title={t('Cache and capacity')}>
        <div style={{ display: 'flex', gap: isMobile ? 8 : 12, flexDirection: isMobile ? 'column' : 'row' }}>
          <div style={{ padding: 16, border: '1px solid var(--ui-border)', borderRadius: 16, flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ui-text)', marginBottom: 10 }}>{t('Disk cache')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
              <KV label={t('Disk files')} value={(dc?.active_disk_files || 0).toLocaleString()} />
              <KV label={t('Disk usage')} value={fmtBytes(dc?.disk_usage_bytes)} />
              <KV label={t('Memory buffers')} value={(dc?.active_memory_bufs || 0).toLocaleString()} />
              <KV label={t('Memory usage')} value={fmtBytes(dc?.memory_usage_bytes)} />
            </div>
            {dc?.disk_max_bytes > 0 && <MiniBar value={dc.disk_usage_bytes || 0} max={dc.disk_max_bytes} />}
          </div>
          <div style={{ padding: 16, border: '1px solid var(--ui-border)', borderRadius: 16, flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ui-text)', marginBottom: 10 }}>{t('Channel affinity cache')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
              <KV label={t('Status')} value={t(ca.enabled ? 'Enabled' : 'Disabled')} />
              <KV label={t('Algorithm')} value={ca?.cache_algo || '-'} />
              <KV label={t('Entries')} value={(ca?.total || 0).toLocaleString()} />
              <KV label={t('Capacity')} value={(ca?.cache_capacity || 0).toLocaleString()} />
            </div>
            {ca?.cache_capacity > 0 && <MiniBar value={ca?.total || 0} max={ca.cache_capacity} />}
          </div>
        </div>
      </Section>

      {/* S8: Advanced runtime */}
      {rt && (
        <Section title={t('Advanced runtime')} right={system?.go_version}>
          <div style={grid(isMobile ? 2 : 6)}>
            <StatMini label='Heap Alloc' value={fmtBytes(rt.heap_alloc)} />
            <StatMini label='Heap Sys' value={fmtBytes(rt.heap_sys)} />
            <StatMini label='Heap Idle' value={fmtBytes(rt.heap_idle)} />
            <StatMini label='Heap InUse' value={fmtBytes(rt.heap_inuse)} />
            <StatMini label='Stack InUse' value={fmtBytes(rt.stack_inuse)} />
            <StatMini label={t('GC count')} value={(rt.num_gc || 0).toLocaleString()} sub={rt.gc_pause_avg_us ? t('Average pause {{time}}µs', { time: rt.gc_pause_avg_us }) : null} />
          </div>
        </Section>
      )}

      {/* S9: All-time counters */}
      <Section title={t('All-time counters')}>
        <div style={grid(3)}>
          <StatMini label={t('Total requests')} value={renderNumber(rs?.total_requests || 0)} />
          <StatMini label={t('Total tokens')} value={fmtTokens(rs?.total_tokens)} />
          <StatMini label={t('Total cost')} value={renderQuota(rs?.total_quota || 0)} />
        </div>
      </Section>

    </div>
  );
}

function SystemStatusSession({ identity, root }: { identity: string; root: boolean }) {
  const { t } = useTranslation(); const isMobile = useIsMobile(); const [countdown, setCountdown] = useState(5);
  const query = useQuery({ queryKey: ['system-status', identity], gcTime: 0, retry: false, refetchInterval: 5000, queryFn: ({ signal }) => readSystemData('/api/system-status', systemStatusSchema, signal) });
  useEffect(() => {
    const tick = () => setCountdown(Math.max(0, Math.ceil((query.dataUpdatedAt + 5000 - Date.now()) / 1000)));
    tick(); const timer = setInterval(tick, 1000); return () => clearInterval(timer);
  }, [query.dataUpdatedAt]);
  const data = query.isError ? undefined : query.data;
  return <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 20 : 28, width: '100%', maxWidth: 960, marginInline: 'auto', padding: isMobile ? '16px' : '24px 16px' }}>
    <div className='flex flex-wrap items-center justify-between gap-3'><div className='flex flex-wrap items-center gap-3'><h1 className='text-lg font-semibold text-ui-text'>{t('System status')}</h1><span className='text-xs tabular-nums text-ui-text-3'>{t('Refresh in {{seconds}}s', { seconds: countdown })}</span></div><IconButton icon={RefreshCw} onClick={() => void query.refetch()} disabled={query.isFetching} aria-label={t('Refresh system status')} /></div>
    {query.isError ? <div role='alert' className='space-y-2 text-sm text-ui-danger'><p>{t(apiErrorMessage(query.error))}</p><Button onClick={() => void query.refetch()}>{t('Retry')}</Button></div> : !data ? <Loading /> : <StatusCards data={data} isMobile={isMobile} />}
    {root && <><InstancesPanel /><MaintenancePanel /><SystemTasksPanel /></>}
    {data && <div className='pb-2 text-right text-xs text-ui-text-3'>{data.system.go_version} · {data.system.version}</div>}
  </div>;
}
export default function SystemStatusAccount() {
  const identity = useAuthStore((state) => `${state.auth.user?.id}:${state.auth.session?.sid}:${state.auth.user?.role}`); const root = useAuthStore((state) => state.auth.user?.role === 100);
  return <SystemStatusSession key={identity} identity={identity} root={root} />;
}
