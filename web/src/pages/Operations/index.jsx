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
  const [rangeIdx, setRangeIdx] = useState(1);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [trendPage, setTrendPage] = useState(1);
  const trendPageSize = 10;

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
  useEffect(() => { setTrendPage(1); }, [rangeIdx]);

  if (loading && !data) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}><Loading /></div>;
  }
  if (!data) return null;

  const { summary, trend, rankings, errors, platform } = data;
  const rev = summary?.revenue || {};
  const con = summary?.consumption || {};
  const todayRev = rev.today || {};
  const allRev = rev.all_time || {};
  const todayCon = con.today || {};
  const allCon = con.all_time || {};

  /* ── merge trend ── */
  const mergedTrend = (() => {
    const map = {};
    (trend?.revenue || []).forEach((r) => { map[r.date] = { date: r.date, money: r.total_money || 0, orders: r.orders || 0 }; });
    (trend?.consumption || []).forEach((c) => {
      if (!map[c.date]) map[c.date] = { date: c.date, money: 0, orders: 0 };
      map[c.date].quota = c.quota || 0;
      map[c.date].requests = c.requests || 0;
      map[c.date].tokens = c.tokens || 0;
    });
    return Object.values(map).sort((a, b) => b.date.localeCompare(a.date)); // 降序：新到旧
  })();
  const trendMaxMoney = Math.max(...mergedTrend.map((r) => r.money || 0), 1);
  const trendMaxQuota = Math.max(...mergedTrend.map((r) => r.quota || 0), 1);

  // 分页
  const totalTrendPages = Math.ceil(mergedTrend.length / trendPageSize);
  const paginatedTrend = mergedTrend.slice((trendPage - 1) * trendPageSize, trendPage * trendPageSize);

  /* ── rankings ── */
  const userRanking = rankings?.users || [];
  const modelRanking = rankings?.models || [];
  const channelRanking = rankings?.channels || [];
  const groupRanking = rankings?.groups || [];
  const totalUserQuota = userRanking.reduce((s, r) => s + (r.quota || 0), 0);
  const totalModelQuota = modelRanking.reduce((s, r) => s + (r.quota || 0), 0);

  const grid = (cols) => ({ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : `repeat(${cols}, 1fr)`, gap: isMobile ? 8 : 12 });

  /* ── trend table ── */
  const trendColumns = isMobile ? [
    { key: 'date', title: '日期', render: (r) => <span style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{(r.date || '').slice(5)}</span> },
    { key: 'money', title: '充值', align: 'right', render: (r) => (
      <div style={{ minWidth: 60 }}>
        <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>{fmtMoney(r.money)}</span>
        <MiniBar value={r.money || 0} max={trendMaxMoney} />
      </div>
    ) },
    { key: 'quota', title: '消费', align: 'right', render: (r) => (
      <div style={{ minWidth: 60 }}>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{renderQuota(r.quota || 0)}</span>
        <MiniBar value={r.quota || 0} max={trendMaxQuota} color='#999' />
      </div>
    ) },
  ] : [
    { key: 'date', title: '日期', render: (r) => <span style={{ whiteSpace: 'nowrap', color: 'var(--ui-text-2)' }}>{r.date}</span> },
    { key: 'money', title: '充值金额', align: 'right', render: (r) => (
      <div style={{ minWidth: 80 }}>
        <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>{fmtMoney(r.money)}</span>
        <MiniBar value={r.money || 0} max={trendMaxMoney} />
      </div>
    ) },
    { key: 'orders', title: '订单', align: 'right', render: (r) => <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--ui-text-2)' }}>{renderNumber(r.orders || 0)}</span> },
    { key: 'quota', title: '消费额度', align: 'right', render: (r) => (
      <div style={{ minWidth: 80 }}>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{renderQuota(r.quota || 0)}</span>
        <MiniBar value={r.quota || 0} max={trendMaxQuota} color='#999' />
      </div>
    ) },
    { key: 'requests', title: '请求', align: 'right', render: (r) => <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--ui-text-2)' }}>{renderNumber(r.requests || 0)}</span> },
    { key: 'tokens', title: 'Token', align: 'right', render: (r) => <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--ui-text-2)' }}>{fmtTokens(r.tokens || 0)}</span> },
  ];

  /* ── user ranking ── */
  const userColumns = [
    { key: 'rank', title: '#', width: 40, render: (_, i) => <span style={{ color: 'var(--ui-text-3)' }}>{i + 1}</span> },
    { key: 'username', title: '用户', render: (r) => <span style={{ fontWeight: 500 }}>{r.username || `uid:${r.user_id}`}</span> },
    { key: 'quota', title: '消费', align: 'right', render: (r) => <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{renderQuota(r.quota || 0)}</span> },
    ...(!isMobile ? [
      { key: 'requests', title: '请求', align: 'right', render: (r) => <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--ui-text-2)' }}>{renderNumber(r.requests || 0)}</span> },
      { key: 'tokens', title: 'Token', align: 'right', render: (r) => <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--ui-text-2)' }}>{fmtTokens(r.tokens || 0)}</span> },
      { key: 'avg', title: '均次消费', align: 'right', render: (r) => {
        const avg = r.requests > 0 ? Math.round((r.quota || 0) / r.requests) : 0;
        return <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--ui-text-2)' }}>{renderQuota(avg)}</span>;
      } },
      { key: 'pct', title: '占比', align: 'right', width: 80, render: (r) => {
        const pct = totalUserQuota > 0 ? ((r.quota || 0) / totalUserQuota * 100) : 0;
        return (
          <div style={{ minWidth: 50 }}>
            <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--ui-text-2)', fontSize: 12 }}>{pct.toFixed(1)}%</span>
            <MiniBar value={r.quota || 0} max={totalUserQuota} color='#999' />
          </div>
        );
      } },
    ] : []),
  ];

  /* ── model ranking ── */
  const modelColumns = [
    { key: 'rank', title: '#', width: 40, render: (_, i) => <span style={{ color: 'var(--ui-text-3)' }}>{i + 1}</span> },
    { key: 'model_name', title: '模型', render: (r) => (
      <span style={{ fontWeight: 500, maxWidth: isMobile ? 120 : 200, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', verticalAlign: 'bottom' }} title={r.model_name}>
        {r.model_name}
      </span>
    ) },
    { key: 'quota', title: '消费', align: 'right', render: (r) => <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{renderQuota(r.quota || 0)}</span> },
    ...(!isMobile ? [
      { key: 'requests', title: '请求', align: 'right', render: (r) => <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--ui-text-2)' }}>{renderNumber(r.requests || 0)}</span> },
      { key: 'avg_tokens', title: '均次Token', align: 'right', render: (r) => {
        const avg = r.requests > 0 ? Math.round((r.tokens || 0) / r.requests) : 0;
        return <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--ui-text-2)' }}>{fmtTokens(avg)}</span>;
      } },
      { key: 'pct', title: '占比', align: 'right', width: 80, render: (r) => {
        const pct = totalModelQuota > 0 ? ((r.quota || 0) / totalModelQuota * 100) : 0;
        return (
          <div style={{ minWidth: 50 }}>
            <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--ui-text-2)', fontSize: 12 }}>{pct.toFixed(1)}%</span>
            <MiniBar value={r.quota || 0} max={totalModelQuota} color='#999' />
          </div>
        );
      } },
    ] : []),
  ];

  /* ── channel ranking (consumption breakdown) ── */
  const channelRankCols = [
    { key: 'name', title: '渠道', render: (r) => <span style={{ fontWeight: 500, maxWidth: 140, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', verticalAlign: 'bottom' }} title={r.channel_name}>{r.channel_name || `#${r.channel_id}`}</span> },
    { key: 'quota', title: '消费', align: 'right', render: (r) => <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{renderQuota(r.quota || 0)}</span> },
    ...(!isMobile ? [
      { key: 'requests', title: '请求', align: 'right', render: (r) => <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--ui-text-2)' }}>{renderNumber(r.requests || 0)}</span> },
    ] : []),
  ];

  /* ── group ranking ── */
  const groupRankCols = [
    { key: 'group', title: '分组', render: (r) => <span style={{ fontWeight: 500 }}>{r.group || '默认'}</span> },
    { key: 'quota', title: '消费', align: 'right', render: (r) => <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{renderQuota(r.quota || 0)}</span> },
    ...(!isMobile ? [
      { key: 'requests', title: '请求', align: 'right', render: (r) => <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--ui-text-2)' }}>{renderNumber(r.requests || 0)}</span> },
    ] : []),
  ];

  /* ── error models ── */
  const topErrors = errors?.top_models || [];
  const maxErrors = topErrors.length > 0 ? topErrors[0].errors : 1;
  const errorModelCols = [
    { key: 'rank', title: '#', width: 40, render: (_, i) => <span style={{ color: 'var(--ui-text-3)' }}>{i + 1}</span> },
    { key: 'model_name', title: '模型', render: (r) => (
      <span style={{ fontWeight: 500, maxWidth: isMobile ? 140 : 250, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', verticalAlign: 'bottom' }} title={r.model_name}>{r.model_name}</span>
    ) },
    { key: 'errors', title: '错误数', align: 'right', render: (r) => (
      <div style={{ minWidth: 60 }}>
        <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: '#e53e3e' }}>{renderNumber(r.errors || 0)}</span>
        <MiniBar value={r.errors || 0} max={maxErrors} color='#e53e3e' />
      </div>
    ) },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 20 : 28, width: '100%', maxWidth: 960, marginInline: 'auto', padding: isMobile ? '16px' : '24px 16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--ui-text)' }}>线索运营</span>
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

      {/* S1: 核心指标 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 8 : 12 }}>
        <div style={grid(4)}>
          <StatMini label='今日收入' value={fmtMoney(todayRev.total_money)} />
          <StatMini label='今日消费' value={renderQuota(todayCon.quota || 0)} />
          <StatMini label='今日请求' value={renderNumber(todayCon.requests || 0)} />
          <StatMini label='今日 Token' value={fmtTokens(todayCon.tokens)} />
        </div>
        <div style={grid(4)}>
          <StatMini label='累计收入' value={fmtMoney(allRev.total_money)} sub={`${renderNumber(allRev.total_orders || 0)} 笔订单`} />
          <StatMini label='累计消费' value={renderQuota(allCon.quota || 0)} />
          <StatMini label='注册用户' value={renderNumber(platform?.total_users || 0)} />
          <StatMini label='启用渠道' value={renderNumber(platform?.enabled_channels || 0)} />
        </div>
      </div>

      {/* S2: 收支趋势 */}
      {mergedTrend.length > 0 && (
        <Section title='收支趋势' right={`${mergedTrend.length} 天`}>
          <Table columns={trendColumns} rows={paginatedTrend} rowKey='date' size='sm' />
          {totalTrendPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 12, fontSize: 13 }}>
              <button
                onClick={() => setTrendPage(p => Math.max(1, p - 1))}
                disabled={trendPage === 1}
                style={{
                  padding: '6px 12px',
                  border: '1px solid var(--ui-border)',
                  borderRadius: 6,
                  background: trendPage === 1 ? 'var(--ui-bg-2)' : 'var(--ui-bg)',
                  color: trendPage === 1 ? 'var(--ui-text-3)' : 'var(--ui-text)',
                  cursor: trendPage === 1 ? 'not-allowed' : 'pointer',
                  fontSize: 13
                }}
              >
                上一页
              </button>
              <span style={{ color: 'var(--ui-text-2)' }}>
                {trendPage} / {totalTrendPages}
              </span>
              <button
                onClick={() => setTrendPage(p => Math.min(totalTrendPages, p + 1))}
                disabled={trendPage === totalTrendPages}
                style={{
                  padding: '6px 12px',
                  border: '1px solid var(--ui-border)',
                  borderRadius: 6,
                  background: trendPage === totalTrendPages ? 'var(--ui-bg-2)' : 'var(--ui-bg)',
                  color: trendPage === totalTrendPages ? 'var(--ui-text-3)' : 'var(--ui-text)',
                  cursor: trendPage === totalTrendPages ? 'not-allowed' : 'pointer',
                  fontSize: 13
                }}
              >
                下一页
              </button>
            </div>
          )}
        </Section>
      )}

      {/* S3: 消费构成 */}
      {(channelRanking.length > 0 || groupRanking.length > 0) && (
        <Section title='消费构成'>
          <div style={{ display: 'flex', gap: isMobile ? 8 : 12, flexDirection: isMobile ? 'column' : 'row' }}>
            {channelRanking.length > 0 && (
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ui-text)', marginBottom: 8 }}>按渠道</div>
                <Table columns={channelRankCols} rows={channelRanking} rowKey='channel_id' size='sm' />
              </div>
            )}
            {groupRanking.length > 0 && (
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ui-text)', marginBottom: 8 }}>按分组</div>
                <Table columns={groupRankCols} rows={groupRanking} rowKey='group' size='sm' />
              </div>
            )}
          </div>
        </Section>
      )}

      {/* S4: 用户分析 */}
      {userRanking.length > 0 && (
        <Section title='用户分析' right={`Top ${userRanking.length}`}>
          <Table columns={userColumns} rows={userRanking} rowKey='user_id' size='sm' />
        </Section>
      )}

      {/* S5: 模型热度 */}
      {modelRanking.length > 0 && (
        <Section title='模型热度' right={`Top ${modelRanking.length}`}>
          <Table columns={modelColumns} rows={modelRanking} rowKey='model_name' size='sm' />
        </Section>
      )}

      {/* S8: 错误概况 */}
      <Section title='错误概况'>
        <div style={{ ...grid(3), marginBottom: topErrors.length > 0 ? 12 : 0 }}>
          <StatMini label='区间错误' value={renderNumber(errors?.range?.total_errors || 0)} />
          <StatMini label='今日错误' value={renderNumber(errors?.today?.total_errors || 0)} />
          <StatMini label='涉及模型' value={topErrors.length} />
        </div>
        {topErrors.length > 0 && <Table columns={errorModelCols} rows={topErrors} rowKey='model_name' size='sm' />}
      </Section>

    </div>
  );
};

export default Operations;
