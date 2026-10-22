import { ReportSection, StatCard, StatisticsSkeleton } from '../../components/layout/PageSkeletons';
import { useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../stores/auth-store';
import { readOperationsData, errorText } from '../../features/operations/api';
import { operationsReportSchema, operationsRange } from '../../features/operations/operations-data';
import type { OperationsReport, ChannelConsumption, GroupConsumption } from '../../features/operations/operations-data';
import type { TableColumn } from '../../components/ui/layout/Table';
import { ChartColumn, ChartNoAxesCombined, RefreshCw } from 'lucide-react';
import { renderQuota, renderNumber } from '../../helpers';
import { Button, Table, IconButton } from '../../components/ui';
import useIsMobile from '../../hooks/useIsMobile';

/* ─── helpers ─── */

const fmtMoney = (value = 0, locale = 'en') => new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);

const fmtTokens = (n = 0) => {
  if (!n) return '0';
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k';
  return String(n);
};

const fmtRPM = (v = 0) => {
  const n = Number(v || 0);
  if (n >= 100) return n.toFixed(0);
  if (n >= 10) return n.toFixed(1);
  return n.toFixed(2);
};

const RANGES = [
  { label: 'Today', days: 1 },
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: 'All time', days: 0 },
];

/* ─── atoms ─── */

const StatMini = StatCard;

const MiniBar = ({ value, max = 100, color }: { value: number; max?: number; color?: string }) => {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const c = color || (pct > 80 ? '#e53e3e' : pct > 60 ? '#d69e2e' : 'var(--ui-text)');
  return (
    <div style={{ width: '100%', height: 4, borderRadius: 2, background: 'var(--ui-bg-subtle)', marginTop: 4 }}>
      <div style={{ width: `${Math.max(pct, pct > 0 ? 1 : 0)}%`, height: '100%', borderRadius: 2, background: c, transition: 'width 0.3s' }} />
    </div>
  );
};

const Section = ReportSection;

/* ─── page ─── */

function OperationsCards({ data, isMobile, selectedRangeLabel }: { data: OperationsReport; isMobile: boolean; selectedRangeLabel: string }) {
  const { t, i18n } = useTranslation();
  const { summary, charges } = data;
  const rev = summary.revenue;
  const con = summary.consumption;
  const active = summary.active;
  const rangeRev = rev.range;
  const rangeCon = con.range;
  const averageRPM = con.average_rpm || 0;

  /* ── rankings ── */
  const channelRanking = charges.channels;
  const groupRanking = charges.groups;
  const totalChargeQuota = rangeCon.quota || 0;

  const grid = (cols: number): CSSProperties => ({ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : `repeat(${cols}, 1fr)`, gap: isMobile ? 8 : 12 });

  /* ── channel ranking (consumption breakdown) ── */
  const channelRankCols: TableColumn<ChannelConsumption>[] = [
    { key: 'rank', title: '#', width: 40, render: (_, i) => <span style={{ color: 'var(--ui-text-3)' }}>{i + 1}</span> },
    { key: 'name', title: t('Channel'), render: (r) => <span style={{ fontWeight: 500, maxWidth: isMobile ? 130 : 240, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', verticalAlign: 'bottom' }} title={r.channel_name}>{r.channel_name || `#${r.channel_id}`}</span> },
    { key: 'quota', title: t('Usage charges'), align: 'right' as const, render: (r: ChannelConsumption | GroupConsumption) => <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{renderQuota(r.quota || 0)}</span> },
    { key: 'requests', title: t('Requests'), align: 'right' as const, render: (r: ChannelConsumption | GroupConsumption) => <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--ui-text-2)' }}>{renderNumber(r.requests || 0)}</span> },
    { key: 'tokens', title: 'Token', align: 'right' as const, render: (r: ChannelConsumption | GroupConsumption) => <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--ui-text-2)' }}>{fmtTokens(r.tokens || 0)}</span> },
    { key: 'share', title: t('Share of charges'), align: 'right' as const, width: 100, render: (r: ChannelConsumption | GroupConsumption) => {
      const pct = totalChargeQuota > 0 ? ((r.quota || 0) / totalChargeQuota * 100) : 0;
      return (
        <div style={{ minWidth: 60 }}>
          <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--ui-text-2)', fontSize: 12 }}>{pct.toFixed(1)}%</span>
          <MiniBar value={r.quota || 0} max={totalChargeQuota} color='#999' />
        </div>
      );
    } },
  ];

  /* ── group ranking ── */
  const groupRankCols: TableColumn<GroupConsumption>[] = [
    { key: 'rank', title: '#', width: 40, render: (_, i) => <span style={{ color: 'var(--ui-text-3)' }}>{i + 1}</span> },
    { key: 'group', title: t('Group'), render: (r) => <span style={{ fontWeight: 500 }}>{r.group || t('Default')}</span> },
    { key: 'quota', title: t('Usage charges'), align: 'right' as const, render: (r: ChannelConsumption | GroupConsumption) => <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{renderQuota(r.quota || 0)}</span> },
    { key: 'requests', title: t('Requests'), align: 'right' as const, render: (r: ChannelConsumption | GroupConsumption) => <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--ui-text-2)' }}>{renderNumber(r.requests || 0)}</span> },
    { key: 'tokens', title: 'Token', align: 'right' as const, render: (r: ChannelConsumption | GroupConsumption) => <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--ui-text-2)' }}>{fmtTokens(r.tokens || 0)}</span> },
    { key: 'share', title: t('Share of charges'), align: 'right' as const, width: 100, render: (r: ChannelConsumption | GroupConsumption) => {
      const pct = totalChargeQuota > 0 ? ((r.quota || 0) / totalChargeQuota * 100) : 0;
      return (
        <div style={{ minWidth: 60 }}>
          <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--ui-text-2)', fontSize: 12 }}>{pct.toFixed(1)}%</span>
          <MiniBar value={r.quota || 0} max={totalChargeQuota} color='#999' />
        </div>
      );
    } },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 20 : 28 }}>
      {/* S1: 周期经营报告 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 8 : 12 }}>
        <div style={grid(4)}>
          <StatMini label={t('Recorded payment amount')} value={fmtMoney(rangeRev.total_money, i18n.language)} sub={selectedRangeLabel} />
          <StatMini label={t('Top-up orders')} value={renderNumber(rangeRev.total_orders || 0)} sub={selectedRangeLabel} />
          <StatMini label={t('Average RPM')} value={data.period.start_timestamp ? fmtRPM(averageRPM) : '—'} sub={selectedRangeLabel} />
          <StatMini label={t('Usage credit charged')} value={renderQuota(rangeCon.quota || 0)} sub={selectedRangeLabel} />
        </div>
        <div style={grid(4)}>
          <StatMini label={t('Requests')} value={renderNumber(rangeCon.requests || 0)} sub={selectedRangeLabel} />
          <StatMini label={t('Token consumption')} value={fmtTokens(rangeCon.tokens)} sub={selectedRangeLabel} />
          <StatMini label={t('Active users')} value={renderNumber(active.users || 0)} sub={selectedRangeLabel} />
          <StatMini label={t('New users')} value={renderNumber(active.new_users || 0)} sub={selectedRangeLabel} />
        </div>
      </div>

      {/* S2: 分组扣费 */}
      <Section title={t('Charges by group')} right={`${selectedRangeLabel} Top ${groupRanking.length}`}>
        <Table columns={groupRankCols} rows={groupRanking} rowKey='group' size='sm' emptyIcon={ChartNoAxesCombined} emptyText={t('No group charges in this period')} />
      </Section>

      {/* S3: 渠道扣费 */}
      <Section title={t('Charges by channel')} right={`${selectedRangeLabel} Top ${channelRanking.length}`}>
        <Table columns={channelRankCols} rows={channelRanking} rowKey='channel_id' size='sm' emptyIcon={ChartColumn} emptyText={t('No channel charges in this period')} />
      </Section>

    </div>
  );
 }

function OperationsSession({ identity }: { identity: string }) {
  const { t } = useTranslation(); const isMobile = useIsMobile();
  const [range, setRange] = useState(() => ({ index: 0, params: operationsRange(1), generation: 0 }));
  const refresh = (index = range.index) => setRange((previous) => ({ index, params: operationsRange(RANGES[index].days), generation: previous.generation + 1 }));
  const query = useQuery({ queryKey: ['operations-report', identity, range], gcTime: 0, retry: false, queryFn: async ({ signal }) => {
    const data = await readOperationsData('/api/operations/enhanced', operationsReportSchema, signal, range.params);
    if (data.period.start_timestamp !== range.params.start_timestamp || data.period.end_timestamp !== range.params.end_timestamp) throw new Error('Invalid operations data; reload and try again.'); return data;
  } });
  const data = query.isError ? undefined : query.data;
  return <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 20 : 28, width: '100%', maxWidth: 960, marginInline: 'auto', padding: isMobile ? '16px' : '24px 16px' }}>
    <div className='flex flex-wrap items-center justify-between gap-3'><h1 className='text-lg font-semibold text-ui-text'>{t('Operations report')}</h1><div className='flex flex-wrap items-center gap-1.5'><div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: 3, background: 'var(--ui-bg-subtle)', borderRadius: 16 }}>{RANGES.map((item, index) => <button key={item.days} aria-pressed={range.index === index} onClick={() => refresh(index)} style={{ height: 28, paddingInline: 12, borderRadius: 14, fontSize: 13, border: 'none', cursor: 'pointer', color: range.index === index ? 'var(--ui-text)' : 'var(--ui-text-3)', background: range.index === index ? 'var(--page-bg)' : 'transparent', fontWeight: range.index === index ? 500 : 400, boxShadow: range.index === index ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>{t(item.label)}</button>)}</div><IconButton icon={RefreshCw} onClick={() => refresh()} disabled={query.isFetching} aria-label={t('Refresh operations report')} /></div></div>
    {query.isError ? <div role='alert' className='space-y-2 text-sm text-ui-danger'><p>{t(errorText(query.error))}</p><Button onClick={() => refresh()}>{t('Retry')}</Button></div> : !data ? <StatisticsSkeleton /> : <OperationsCards data={data} isMobile={isMobile} selectedRangeLabel={t(RANGES[range.index].label)} />}
  </div>;
}
export default function OperationsAccount() {
  const identity = useAuthStore((state) => `${state.auth.user?.id}:${state.auth.session?.sid}:${state.auth.user?.role}`);
  return <OperationsSession key={identity} identity={identity} />;
}
