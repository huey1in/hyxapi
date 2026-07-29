import React, { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { API, renderNumber, renderQuota, isAdmin, timestamp2string } from '../../helpers';
import { UserContext } from '../../context/User';
import { IconButton, Loading, Table } from '../../components/ui';
import useIsMobile from '../../hooks/useIsMobile';
import useIsDark from '../../hooks/useIsDark';
import { advancePreviewState, createPreviewState } from './dashboardPreviewSimulation';

const StatMini = ({ label, value }) => (
  <div style={{ paddingBlock: 16, paddingInline: 16, border: '1px solid var(--ui-border)', borderRadius: 16 }}>
    <div style={{ fontSize: 12, color: 'var(--ui-text-3)', marginBottom: 4 }}>{label}</div>
    <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--ui-text)', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
  </div>
);

const Dashboard = ({ preview = false }) => {
  const navigate = useNavigate();
  const [userState] = useContext(UserContext);
  const [previewState, setPreviewState] = useState(() => preview ? createPreviewState() : null);
  const [stats, setStats] = useState(null);
  const [cumStats, setCumStats] = useState({ quota: 0, tokens: 0, requests: 0 });
  const [dayStats, setDayStats] = useState({ quota: 0, tokens: 0, requests: 0 });
  const [rpm, setRpm] = useState(0);
  const [recentLogs, setRecentLogs] = useState([]);
  const [loading, setLoading] = useState(!preview);
  const [logsLoading, setLogsLoading] = useState(false);
  const isMobile = useIsMobile();
  const isDark = useIsDark();

  useEffect(() => {
    if (preview) {
      const timer = setInterval(() => {
        setPreviewState((current) => advancePreviewState(current));
      }, 2400);
      return () => clearInterval(timer);
    }
    (async () => {
      setLoading(true);
      try {
        const res = await API.get('/api/user/self');
        if (res.data?.success) setStats(res.data.data);
      } catch {} finally { setLoading(false); }
    })();
    loadRecentLogs();
    loadStats();
    loadRpm();
    const timer = setInterval(() => {
      loadStats();
      loadRecentLogs(true);
      loadRpm();
    }, 5000);
    return () => clearInterval(timer);
  }, [userState?.user, preview]);

  const loadStats = async () => {
    try {
      const base = isAdmin() ? '/api/log/stat' : '/api/log/self/stat';
      const todayStart = Math.floor(new Date().setHours(0, 0, 0, 0) / 1000);
      const [cum, today] = await Promise.all([
        API.get(base),
        API.get(`${base}?start_timestamp=${todayStart}`),
      ]);
      if (cum.data?.success) setCumStats(cum.data.data || { quota: 0, tokens: 0, requests: 0 });
      if (today.data?.success) setDayStats(today.data.data || { quota: 0, tokens: 0, requests: 0 });
    } catch {}
  };

  const loadRpm = async () => {
    try {
      const base = isAdmin() ? '/api/log/stat' : '/api/log/self/stat';
      const since = Math.floor(Date.now() / 1000) - 60;
      const res = await API.get(`${base}?start_timestamp=${since}`);
      if (res.data?.success) setRpm(res.data.data?.requests || 0);
    } catch {}
  };

  const loadRecentLogs = async (silent = false) => {
    if (!silent) setLogsLoading(true);
    try {
      const url = isAdmin() ? '/api/log/?p=1&size=10&type=0' : '/api/log/self/?p=1&size=10&type=0';
      const res = await API.get(url);
      if (res.data?.success) setRecentLogs(res.data.data?.items || res.data.data || []);
    } catch { if (!silent) setRecentLogs([]); }
    finally { if (!silent) setLogsLoading(false); }
  };

  const activeCumStats = preview ? previewState.cumulative : cumStats;
  const activeDayStats = preview ? previewState.today : dayStats;
  const activeRpm = preview ? previewState.rpm : rpm;
  const activeRecentLogs = preview ? previewState.logs : recentLogs;
  const u = preview ? previewState.user : (stats || userState?.user || {});

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}><Loading /></div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 20 : 28, width: '100%', maxWidth: 960, marginInline: 'auto', padding: isMobile ? '16px' : '24px 16px' }}>
      {/* 页面标题 */}
      <h1 style={{ fontSize: 18, fontWeight: 600, color: 'var(--ui-text)', paddingBlockEnd: 8 }}>{isAdmin() ? '全局用量' : '用量信息'}</h1>

      {/* 统计卡片 */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: 12 }}>
        {/* 积分余额 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBlock: 26, paddingInline: 20, border: '1px solid var(--ui-border)', borderRadius: 26 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 400, color: 'var(--ui-text-3)', marginBottom: 8 }}>可用额度</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--ui-text)' }}>{renderQuota(u.quota || 0)}</div>
            <div style={{ fontSize: 12, color: 'var(--ui-text-3)', marginTop: 4 }}>累计已使用: {renderQuota(u.used_quota || 0)}</div>
          </div>
          <button
            onClick={preview ? undefined : () => navigate('/console/topup')}
            disabled={preview}
            style={{
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              height: 32, paddingInline: 16, border: 'none', borderRadius: 24,
              fontSize: 14, fontWeight: 500, color: 'var(--ui-text)',
              background: isDark
                ? 'var(--ui-bg-subtle)'
                : 'linear-gradient(136deg, #daf5fe, #ffeddf, #daf5fe, #ffeddf)',
              backgroundSize: '300% 300%',
            }}
          >+ 充值</button>
        </div>
        {/* 总请求 */}
        <div style={{ display: 'flex', alignItems: 'center', paddingBlock: 26, paddingInline: 20, border: '1px solid var(--ui-border)', borderRadius: 26 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 400, color: 'var(--ui-text-3)', marginBottom: 8 }}>总请求数</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--ui-text)' }}>{renderNumber(u.request_count || 0)}</div>
            <div style={{ fontSize: 12, color: 'var(--ui-text-3)', marginTop: 4 }}>累计 Token: {fmtTokens(activeCumStats.tokens || 0)}</div>
          </div>
        </div>
      </div>

      {/* 今日统计 */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: isMobile ? 8 : 12 }}>
        <StatMini label='今日 Token' value={fmtTokens(activeDayStats.tokens || 0)} />
        <StatMini label='今日消费' value={renderQuota(activeDayStats.quota || 0)} />
        <StatMini label='今日请求数' value={renderNumber(activeDayStats.requests || 0)} />
        <StatMini label='当前 RPM' value={renderNumber(activeRpm)} />
      </div>

      {/* 最近活动 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--ui-text)' }}>最近活动</span>
          <IconButton icon={RefreshCw} onClick={preview ? undefined : loadRecentLogs} disabled={preview || logsLoading} title='刷新' />
        </div>
        {logsLoading ? (
          <div style={{ padding: '32px 0', display: 'flex', justifyContent: 'center' }}><Loading size='sm' /></div>
        ) : (
          <div style={{ fontFamily: "'JetBrains Mono', 'Noto Sans SC', monospace" }}>
            <Table
              size='sm'
              rowKey='id'
              emptyText='暂无记录'
              onRowClick={preview ? undefined : () => navigate('/console/log')}
              columns={recentColumns(isMobile)}
              rows={activeRecentLogs}
            />
          </div>
        )}
      </div>

    </div>
  );
};

const parseOther = (other) => {
  if (!other) return {};
  try { const p = typeof other === 'string' ? JSON.parse(other) : other; return p || {}; } catch { return {}; }
};

const fmtTokens = (n) => {
  if (n == null || n === 0) return '0';
  if (n >= 1000000000) return (n / 1000000000).toFixed(2) + 'B';
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return String(n);
};

const NumCell = ({ value }) => (
  value > 0
    ? <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtTokens(value)}</span>
    : <span style={{ color: 'var(--ui-text-3)' }}>—</span>
);

const recentColumns = (isMobile) => {
  if (isMobile) {
    return [
      { key: 'time', title: '时间', render: (r) => <span style={{ whiteSpace: 'nowrap', fontSize: 11, color: 'var(--ui-text-2)' }}>{timestamp2string(r.created_at)}</span> },
      { key: 'model', title: '模型', render: (r) => <span style={{ whiteSpace: 'nowrap' }}>{r.model_name || '—'}</span> },
      { key: 'quota', title: '积分', align: 'right', render: (r) => r.quota > 0 ? <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{renderQuota(r.quota, 6)}</span> : <span style={{ color: 'var(--ui-text-3)' }}>—</span> },
    ];
  }
  return [
    { key: 'time', title: '时间', render: (r) => <span style={{ whiteSpace: 'nowrap', color: 'var(--ui-text-2)' }}>{timestamp2string(r.created_at)}</span> },
    { key: 'model', title: '模型', render: (r) => <span style={{ whiteSpace: 'nowrap', maxWidth: 200, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', verticalAlign: 'bottom' }} title={r.model_name}>{r.model_name || '—'}</span> },
    { key: 'group', title: '分组', render: (r) => <span style={{ whiteSpace: 'nowrap', color: 'var(--ui-text-2)' }}>{r.group || '—'}</span> },
    { key: 'input', title: '输入', align: 'right', render: (r) => <NumCell value={r.prompt_tokens || 0} /> },
    { key: 'output', title: '输出', align: 'right', render: (r) => <NumCell value={r.completion_tokens || 0} /> },
    { key: 'cache', title: '缓存', align: 'right', render: (r) => { const o = parseOther(r.other); return <NumCell value={(o.cache_tokens || 0) + (o.cache_creation_tokens || 0)} />; } },
    { key: 'quota', title: '积分', align: 'right', render: (r) => r.quota > 0 ? <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{renderQuota(r.quota, 6)}</span> : <span style={{ color: 'var(--ui-text-3)' }}>—</span> },
  ];
};

export default Dashboard;
