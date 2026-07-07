import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';
import { API, renderQuota, renderNumber } from '../../helpers';
import { Table, Loading, IconButton } from '../../components/ui';
import useIsMobile from '../../hooks/useIsMobile';

/* ─── helpers ─── */

const fmtMoney = (v) => {
  if (v == null || v === 0) return '¥0.00';
  return '¥' + Number(v).toFixed(2);
};

const fmtTokens = (n) => {
  if (!n) return '0';
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k';
  return String(n);
};

const fmtRPM = (v) => {
  const n = Number(v || 0);
  if (n >= 100) return n.toFixed(0);
  if (n >= 10) return n.toFixed(1);
  return n.toFixed(2);
};

const RANGES = [
  { label: '今天', days: 1 },
  { label: '7天', days: 7 },
  { label: '30天', days: 30 },
  { label: '全部', days: 0 },
];

/* ─── atoms ─── */

const StatMini = ({ label, value, sub }) => (
  <div style={{ paddingBlock: 16, paddingInline: 16, border: '1px solid var(--ui-border)', borderRadius: 16 }}>
    <div style={{ fontSize: 12, color: 'var(--ui-text-3)', marginBottom: 4 }}>{label}</div>
    <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--ui-text)', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    {sub && <div style={{ fontSize: 12, color: 'var(--ui-text-3)', marginTop: 2 }}>{sub}</div>}
  </div>
);

const MiniBar = ({ value, max = 100, color }) => {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const c = color || (pct > 80 ? '#e53e3e' : pct > 60 ? '#d69e2e' : 'var(--ui-text)');
  return (
    <div style={{ width: '100%', height: 4, borderRadius: 2, background: 'var(--ui-bg-subtle)', marginTop: 4 }}>
      <div style={{ width: `${Math.max(pct, pct > 0 ? 1 : 0)}%`, height: '100%', borderRadius: 2, background: c, transition: 'width 0.3s' }} />
    </div>
  );
};

const Section = ({ title, right, children }) => (
  <div>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
      <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--ui-text)' }}>{title}</span>
      {right && <span style={{ fontSize: 13, color: 'var(--ui-text-3)' }}>{right}</span>}
    </div>
    {children}
  </div>
);

/* ─── page ─── */

const Operations = () => {
  const isMobile = useIsMobile();
  const [rangeIdx, setRangeIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  const { start, end } = useMemo(() => {
    const r = RANGES[rangeIdx];
    const now = Math.floor(Date.now() / 1000);
    if (r.days === 0) return { start: 0, end: now };
    const todayStart = Math.floor(new Date().setHours(0, 0, 0, 0) / 1000);
    return { start: todayStart - (r.days - 1) * 86400, end: now };
  }, [rangeIdx]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await API.get(`/api/operations/enhanced?start_timestamp=${start}&end_timestamp=${end}`);
      if (res.data?.success) setData(res.data.data);
    } catch {}
    finally { setLoading(false); }
  }, [start, end]);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading && !data) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}><Loading /></div>;
  }
  if (!data) return null;

  const { summary, charges, rankings } = data;
  const rev = summary?.revenue || {};
  const con = summary?.consumption || {};
  const active = summary?.active || {};
  const rangeRev = rev.range || {};
  const rangeCon = con.range || {};
  const averageRPM = con.average_rpm || 0;
  const selectedRangeLabel = RANGES[rangeIdx]?.label || '所选周期';

  /* ── rankings ── */
  const channelRanking = charges?.channels || rankings?.channels || [];
  const groupRanking = charges?.groups || rankings?.groups || [];
  const totalChargeQuota = rangeCon.quota || 0;

  const grid = (cols) => ({ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : `repeat(${cols}, 1fr)`, gap: isMobile ? 8 : 12 });

  /* ── channel ranking (consumption breakdown) ── */
  const channelRankCols = [
    { key: 'rank', title: '#', width: 40, render: (_, i) => <span style={{ color: 'var(--ui-text-3)' }}>{i + 1}</span> },
    { key: 'name', title: '渠道', render: (r) => <span style={{ fontWeight: 500, maxWidth: isMobile ? 130 : 240, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', verticalAlign: 'bottom' }} title={r.channel_name}>{r.channel_name || `#${r.channel_id}`}</span> },
    { key: 'quota', title: '用户扣费', align: 'right', render: (r) => <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{renderQuota(r.quota || 0)}</span> },
    ...(!isMobile ? [
      { key: 'requests', title: '请求', align: 'right', render: (r) => <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--ui-text-2)' }}>{renderNumber(r.requests || 0)}</span> },
      { key: 'tokens', title: 'Token', align: 'right', render: (r) => <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--ui-text-2)' }}>{fmtTokens(r.tokens || 0)}</span> },
      { key: 'share', title: '占总扣费', align: 'right', width: 100, render: (r) => {
        const pct = totalChargeQuota > 0 ? ((r.quota || 0) / totalChargeQuota * 100) : 0;
        return (
          <div style={{ minWidth: 60 }}>
            <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--ui-text-2)', fontSize: 12 }}>{pct.toFixed(1)}%</span>
            <MiniBar value={r.quota || 0} max={totalChargeQuota} color='#999' />
          </div>
        );
      } },
    ] : []),
  ];

  /* ── group ranking ── */
  const groupRankCols = [
    { key: 'rank', title: '#', width: 40, render: (_, i) => <span style={{ color: 'var(--ui-text-3)' }}>{i + 1}</span> },
    { key: 'group', title: '分组', render: (r) => <span style={{ fontWeight: 500 }}>{r.group || '默认'}</span> },
    { key: 'quota', title: '用户扣费', align: 'right', render: (r) => <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{renderQuota(r.quota || 0)}</span> },
    ...(!isMobile ? [
      { key: 'requests', title: '请求', align: 'right', render: (r) => <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--ui-text-2)' }}>{renderNumber(r.requests || 0)}</span> },
      { key: 'tokens', title: 'Token', align: 'right', render: (r) => <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--ui-text-2)' }}>{fmtTokens(r.tokens || 0)}</span> },
      { key: 'share', title: '占总扣费', align: 'right', width: 100, render: (r) => {
        const pct = totalChargeQuota > 0 ? ((r.quota || 0) / totalChargeQuota * 100) : 0;
        return (
          <div style={{ minWidth: 60 }}>
            <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--ui-text-2)', fontSize: 12 }}>{pct.toFixed(1)}%</span>
            <MiniBar value={r.quota || 0} max={totalChargeQuota} color='#999' />
          </div>
        );
      } },
    ] : []),
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 20 : 28, width: '100%', maxWidth: 960, marginInline: 'auto', padding: isMobile ? '16px' : '24px 16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--ui-text)' }}>线索运营经营报告</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ display: 'flex', gap: 4, padding: 3, background: 'var(--ui-bg-subtle)', borderRadius: 16 }}>
            {RANGES.map((r, i) => (
              <button
                key={r.label}
                onClick={() => setRangeIdx(i)}
                style={{
                  height: 28, paddingInline: 12, borderRadius: 14,
                  fontSize: 13, border: 'none', cursor: 'pointer',
                  color: rangeIdx === i ? 'var(--ui-text)' : 'var(--ui-text-3)',
                  background: rangeIdx === i ? 'var(--page-bg)' : 'transparent',
                  fontWeight: rangeIdx === i ? 500 : 400,
                  boxShadow: rangeIdx === i ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                }}
              >{r.label}</button>
            ))}
          </div>
          <IconButton icon={RefreshCw} onClick={loadData} disabled={loading} title='刷新' />
        </div>
      </div>

      {/* S1: 周期经营报告 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 8 : 12 }}>
        <div style={grid(4)}>
          <StatMini label='用户充值金额' value={fmtMoney(rangeRev.total_money)} sub={selectedRangeLabel} />
          <StatMini label='充值订单' value={renderNumber(rangeRev.total_orders || 0)} sub={selectedRangeLabel} />
          <StatMini label='平均 RPM' value={fmtRPM(averageRPM)} sub={selectedRangeLabel} />
          <StatMini label='用户扣费额度' value={renderQuota(rangeCon.quota || 0)} sub={selectedRangeLabel} />
        </div>
        <div style={grid(4)}>
          <StatMini label='调用请求' value={renderNumber(rangeCon.requests || 0)} sub={selectedRangeLabel} />
          <StatMini label='消耗 Token' value={fmtTokens(rangeCon.tokens)} sub={selectedRangeLabel} />
          <StatMini label='活跃用户' value={renderNumber(active.users || 0)} sub={selectedRangeLabel} />
          <StatMini label='新增用户' value={renderNumber(active.new_users || 0)} sub={selectedRangeLabel} />
        </div>
      </div>

      {/* S2: 分组扣费 */}
      <Section title='分组扣费报告' right={`${selectedRangeLabel} Top ${groupRanking.length}`}>
        <Table columns={groupRankCols} rows={groupRanking} rowKey='group' size='sm' emptyText='该周期暂无分组扣费' />
      </Section>

      {/* S3: 渠道扣费 */}
      <Section title='渠道扣费报告' right={`${selectedRangeLabel} Top ${channelRanking.length}`}>
        <Table columns={channelRankCols} rows={channelRanking} rowKey='channel_id' size='sm' emptyText='该周期暂无渠道扣费' />
      </Section>

      {/* S4: 经营口径 */}
      <Section title='经营口径'>
        <div style={{ padding: 14, border: '1px solid var(--ui-border)', borderRadius: 8, color: 'var(--ui-text-2)', fontSize: 13, lineHeight: 1.7 }}>
          当前周期用户实际支付 {fmtMoney(rangeRev.total_money)}；用户调用产生扣费 {renderQuota(rangeCon.quota || 0)}，平均 RPM 为 {fmtRPM(averageRPM)}，由上方分组和渠道表拆解。
        </div>
      </Section>

    </div>
  );
};

export default Operations;
