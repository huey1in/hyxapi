import { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API, renderNumber, renderQuota, isAdmin } from '../../helpers';
import { UserContext } from '../../context/User';
import { Loading, Tabs } from '../../components/ui';
import useIsMobile from '../../hooks/useIsMobile';
import useIsDark from '../../hooks/useIsDark';
import { advancePreviewState, createPreviewState } from './dashboardPreviewSimulation';
import { getTokenUsageRequestConfig, getUsageBucketCount } from './usageGridLayout';

const StatMini = ({ label, value }) => (
  <div className='dashboard-stat-mini'>
    <div style={{ fontSize: 12, color: 'var(--ui-text-3)', marginBottom: 4 }}>{label}</div>
    <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--ui-text)', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
  </div>
);

const USAGE_RANGE_OPTIONS = [
  { value: '1', label: '当天' },
  { value: '7', label: '最近 7 天' },
  { value: '30', label: '最近 30 天' },
];
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
  const [usageDays, setUsageDays] = useState('1');
  const isMobile = useIsMobile();
  const isDark = useIsDark();
  const usageBucketCount = getUsageBucketCount(isMobile);

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
    loadStats();
    loadRpm();
    const timer = setInterval(() => {
      loadStats();
      loadRpm();
    }, 5000);
    return () => clearInterval(timer);
  }, [userState?.user, preview]);

  useEffect(() => {
    if (!preview && usageDays !== '1') loadTokenUsage(Number(usageDays));
  }, [usageDays, userState?.user, preview, usageBucketCount]);

  const loadStats = async () => {
    try {
      const base = isAdmin() ? '/api/log/stat' : '/api/log/self/stat';
      const todayStart = Math.floor(new Date().setHours(0, 0, 0, 0) / 1000);
      const [cum, today] = await Promise.all([
        API.get(base),
        API.get(`${base}?start_timestamp=${todayStart}&bucket_seconds=${Math.ceil(86400 / usageBucketCount)}`),
      ]);
      if (cum.data?.success) setCumStats(cum.data.data || { quota: 0, tokens: 0, requests: 0 });
      if (today.data?.success) {
        setDayStats(today.data.data || { quota: 0, tokens: 0, requests: 0 });
        if (usageDays === '1' && Array.isArray(today.data.data?.token_usage)) setRecentLogs(today.data.data.token_usage);
      }
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

  const loadTokenUsage = async (days) => {
    setLogsLoading(true);
    try {
      const base = isAdmin() ? '/api/log/token-usage' : '/api/log/self/token-usage';
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      start.setDate(start.getDate() - Math.max(0, days - 1));
      const rangeSeconds = days * 86400;
      const bucketSeconds = Math.ceil(rangeSeconds / usageBucketCount);
      const url = `${base}?start_timestamp=${Math.floor(start.getTime() / 1000)}&end_timestamp=${Math.floor(Date.now() / 1000)}&bucket_seconds=${bucketSeconds}`;
      const res = await API.get(url, getTokenUsageRequestConfig());
      if (res.data?.success) setRecentLogs(res.data.data || []);
    } catch { setRecentLogs([]); }
    finally { setLogsLoading(false); }
  };

  const activeCumStats = preview ? previewState.cumulative : cumStats;
  const activeDayStats = preview ? previewState.today : dayStats;
  const activeRpm = preview ? previewState.rpm : rpm;
  const activeRecentLogs = preview ? createPreviewUsage(Number(usageDays), usageBucketCount) : recentLogs;
  const u = preview ? previewState.user : (stats || userState?.user || {});

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}><Loading /></div>;

  return (
    <div className='dashboard-overview'>
      {/* 页面标题 */}
      <h1 style={{ fontSize: 18, fontWeight: 600, color: 'var(--ui-text)', paddingBlockEnd: 8 }}>{isAdmin() ? '全局用量' : '用量信息'}</h1>

      {/* 统计卡片 */}
      <div className='dashboard-primary-stats'>
        {/* 积分余额 */}
        <div className='dashboard-primary-card'>
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
        <div className='dashboard-primary-card'>
          <div>
            <div style={{ fontSize: 14, fontWeight: 400, color: 'var(--ui-text-3)', marginBottom: 8 }}>总请求数</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--ui-text)' }}>{renderNumber(u.request_count || 0)}</div>
            <div style={{ fontSize: 12, color: 'var(--ui-text-3)', marginTop: 4 }}>累计 Token: {fmtTokens(activeCumStats.tokens || 0)}</div>
          </div>
        </div>
      </div>

      {/* 今日统计 */}
      <div className='dashboard-secondary-stats'>
        <StatMini label='今日 Token' value={fmtTokens(activeDayStats.tokens || 0)} />
        <StatMini label='今日消费' value={renderQuota(activeDayStats.quota || 0)} />
        <StatMini label='今日请求数' value={renderNumber(activeDayStats.requests || 0)} />
        <StatMini label='当前 RPM' value={renderNumber(activeRpm)} />
      </div>

      {/* Token 使用情况 */}
      <div className='dashboard-token-usage'>
        <div className='dashboard-token-usage__header'>
          <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--ui-text)' }}>Token 使用情况</span>
          <Tabs value={usageDays} onChange={setUsageDays} items={USAGE_RANGE_OPTIONS} variant='pill' size='sm' />
        </div>
        {logsLoading ? (
          <div style={{ padding: '32px 0', display: 'flex', justifyContent: 'center' }}><Loading size='sm' /></div>
        ) : (
          <TokenUsageGrid data={activeRecentLogs} days={Number(usageDays)} bucketCount={usageBucketCount} />
        )}
      </div>

    </div>
  );
};

const fmtTokens = (n) => {
  if (n == null || n === 0) return '0';
  if (n >= 1000000000) return (n / 1000000000).toFixed(2) + 'B';
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return String(n);
};

const createPreviewUsage = (days, bucketCount) => {
  const result = [];
  const start = new Date(); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - days + 1);
  const bucketSeconds = Math.ceil(days * 86400 / bucketCount);
  const nowSeconds = Math.floor(Date.now() / 1000);
  for (let index = 0; index < bucketCount; index += 1) {
    const bucketStart = Math.floor(start.getTime() / 1000) + index * bucketSeconds;
    if (bucketStart > nowSeconds) break;
    const seed = (index * 17 + days * 31) % 29;
    if (seed < 9) continue;
    const prompt = (seed + 3) * 1820;
    result.push({ bucket_start: bucketStart, prompt_tokens: prompt, completion_tokens: Math.round(prompt * 0.28), cache_tokens: Math.round(prompt * 0.62), tokens: Math.round(prompt * 1.28), requests: seed * 3 });
  }
  return result;
};

const TokenUsageGrid = ({ data, days, bucketCount }) => {
  const start = new Date(); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - days + 1);
  const startSeconds = Math.floor(start.getTime() / 1000);
  const bucketSeconds = Math.ceil(days * 86400 / bucketCount);
  const byBucket = new Map();
  data.forEach((item) => {
    const itemStart = Number(item.bucket_start);
    const index = Math.floor((itemStart - startSeconds) / bucketSeconds);
    if (index < 0 || index >= bucketCount) return;
    const previous = byBucket.get(index) || {};
    byBucket.set(index, {
      ...previous,
      bucket_start: startSeconds + index * bucketSeconds,
      quota: Number(previous.quota || 0) + Number(item.quota || 0),
      requests: Number(previous.requests || 0) + Number(item.requests || 0),
      tokens: Number(previous.tokens || 0) + Number(item.tokens || 0),
      prompt_tokens: Number(previous.prompt_tokens || 0) + Number(item.prompt_tokens || 0),
      completion_tokens: Number(previous.completion_tokens || 0) + Number(item.completion_tokens || 0),
      cache_tokens: Number(previous.cache_tokens || 0) + Number(item.cache_tokens || 0),
    });
  });
  const cells = Array.from({ length: bucketCount }, (_, index) => {
    const bucketStart = startSeconds + index * bucketSeconds;
    return { key: bucketStart, bucket_start: bucketStart, future: bucketStart > Date.now() / 1000, ...(byBucket.get(index) || {}) };
  });
  const nonZero = cells.map((cell) => Number(cell.tokens || 0)).filter(Boolean).sort((a, b) => a - b);
  const level = (tokens) => {
    if (!tokens || !nonZero.length) return 0;
    const rank = nonZero.findIndex((value) => value >= tokens) / Math.max(1, nonZero.length - 1);
    return Math.min(4, Math.max(1, Math.ceil(rank * 4)));
  };
  return (
    <div className='token-usage-card'>
      <div className='token-usage-grid'>
        {cells.map((cell) => {
          const total = Number(cell.tokens || 0);
          const from = new Date(cell.bucket_start * 1000);
          const to = new Date((cell.bucket_start + bucketSeconds) * 1000);
          const timeLabel = `${from.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })} - ${to.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`;
          const title = `${timeLabel}\n总 Token: ${fmtTokens(total)}\n输入: ${fmtTokens(cell.prompt_tokens || 0)} · 输出: ${fmtTokens(cell.completion_tokens || 0)} · 缓存: ${fmtTokens(cell.cache_tokens || 0)}`;
          return <span key={cell.key} className={`token-usage-cell level-${cell.future ? 0 : level(total)}`} title={title} aria-label={title} />;
        })}
      </div>
    </div>
  );
};

export default Dashboard;
