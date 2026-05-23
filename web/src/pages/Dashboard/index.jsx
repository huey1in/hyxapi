import React, { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { API, renderNumber, renderQuota, isAdmin, timestamp2string } from '../../helpers';
import { UserContext } from '../../context/User';
import { IconButton, Loading } from '../../components/ui';
import useIsMobile from '../../hooks/useIsMobile';
import useIsDark from '../../hooks/useIsDark';

const StatMini = ({ label, value }) => (
  <div style={{ paddingBlock: 16, paddingInline: 16, border: '1px solid var(--ui-border)', borderRadius: 16 }}>
    <div style={{ fontSize: 12, color: 'var(--ui-text-3)', marginBottom: 4 }}>{label}</div>
    <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--ui-text)', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
  </div>
);

const Dashboard = () => {
  const navigate = useNavigate();
  const [userState] = useContext(UserContext);
  const [stats, setStats] = useState(null);
  const [liveStats, setLiveStats] = useState({ quota: 0, rpm: 0, tpm: 0 });
  const [recentLogs, setRecentLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(false);
  const isMobile = useIsMobile();
  const isDark = useIsDark();

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await API.get('/api/user/self');
        if (res.data?.success) setStats(res.data.data);
      } catch {} finally { setLoading(false); }
    })();
    loadRecentLogs();
    loadLiveStats();
  }, [userState?.user]);

  const loadLiveStats = async () => {
    try {
      const url = isAdmin() ? '/api/log/stat' : '/api/log/self/stat';
      const res = await API.get(url);
      if (res.data?.success) setLiveStats(res.data.data || { quota: 0, rpm: 0, tpm: 0 });
    } catch {}
  };

  const loadRecentLogs = async () => {
    setLogsLoading(true);
    try {
      const url = isAdmin() ? '/api/log/?p=1&size=10&type=0' : '/api/log/self/?p=1&size=10&type=0';
      const res = await API.get(url);
      if (res.data?.success) setRecentLogs(res.data.data?.items || res.data.data || []);
    } catch { setRecentLogs([]); }
    finally { setLogsLoading(false); }
  };

  const u = stats || userState?.user || {};

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
            onClick={() => navigate('/console/topup')}
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
            <div style={{ fontSize: 12, color: 'var(--ui-text-3)', marginTop: 4 }}>累计消费: {renderQuota(u.used_quota || 0)}</div>
          </div>
        </div>
      </div>

      {/* 实时统计 */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 12 }}>
        <StatMini label='总 Tokens' value={fmtTokens(liveStats.tokens || 0)} />
        <StatMini label='总消费' value={renderQuota(u.used_quota || 0)} />
        <StatMini label='当前 RPM' value={renderNumber(liveStats.rpm || 0)} />
        <StatMini label='当前 TPM' value={renderNumber(liveStats.tpm || 0)} />
      </div>

      {/* 最近活动 */}
      <div style={{ border: '1px solid var(--ui-border)', borderRadius: 26, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--ui-divider)' }}>
          <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--ui-text)' }}>最近活动</span>
          <IconButton icon={RefreshCw} onClick={loadRecentLogs} disabled={logsLoading} title='刷新' />
        </div>
        {logsLoading ? (
          <div style={{ padding: '32px 0', display: 'flex', justifyContent: 'center' }}><Loading size='sm' /></div>
        ) : recentLogs.length === 0 ? (
          <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--ui-text-3)', fontSize: 13 }}>暂无记录</div>
        ) : (
          <div>
            {recentLogs.map((r, i) => <LogRow key={r.id || i} r={r} last={i === recentLogs.length - 1} navigate={navigate} isMobile={isMobile} />)}
          </div>
        )}
      </div>

    </div>
  );
};

const parseOther = (other) => {
  if (!other) return {};
  try { return typeof other === 'string' ? JSON.parse(other) : other; } catch { return {}; }
};

const fmtTokens = (n) => {
  if (n == null || n === 0) return '0';
  if (n >= 1000000000) return (n / 1000000000).toFixed(2) + 'B';
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return String(n);
};

const PILL = { display: 'inline-flex', alignItems: 'center', height: 20, paddingInline: 6, borderRadius: 5, fontSize: 11, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' };

const LogRow = ({ r, last, navigate, isMobile }) => {
  const o = parseOther(r.other);
  const cacheTokens = o.cache_tokens || 0;
  const cacheCreationTokens = o.cache_creation_tokens || 0;
  const hasCache = cacheTokens > 0 || cacheCreationTokens > 0;

  return (
    <div
      onClick={() => navigate('/console/log')}
      style={{
        padding: isMobile ? '10px 14px' : '10px 20px',
        borderBottom: last ? 'none' : '1px solid var(--ui-divider)',
        cursor: 'pointer', transition: 'background 0.15s',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--ui-bg-subtle)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
    >
      {/* 第一行：模型名 + 分组 + 扣费 + 时间 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1 }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--ui-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: "'JetBrains Mono', monospace" }}>
            {r.model_name || '—'}
          </span>
          {r.group && (
            <span style={{ ...PILL, color: 'var(--ui-text-3)', border: '1px solid var(--ui-border)' }}>{r.group}</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {r.quota > 0 && (
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ui-text)', fontVariantNumeric: 'tabular-nums' }}>
              {renderQuota(r.quota, 6)}
            </span>
          )}
          <span style={{ fontSize: 11, color: 'var(--ui-text-3)', whiteSpace: 'nowrap' }}>
            {timestamp2string(r.created_at)}
          </span>
        </div>
      </div>
      {/* 第二行：Token 用量 */}
      {(r.prompt_tokens > 0 || r.completion_tokens > 0) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 5, flexWrap: 'wrap' }}>
          <span style={{ ...PILL, color: 'var(--ui-text-2)', background: 'var(--ui-bg-subtle)' }}>
            入 {fmtTokens(r.prompt_tokens)}
          </span>
          <span style={{ ...PILL, color: 'var(--ui-text-2)', background: 'var(--ui-bg-subtle)' }}>
            出 {fmtTokens(r.completion_tokens)}
          </span>
          {hasCache && cacheTokens > 0 && (
            <span style={{ ...PILL, color: '#16a34a', background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
              缓存 {fmtTokens(cacheTokens)}
            </span>
          )}
          {hasCache && cacheCreationTokens > 0 && (
            <span style={{ ...PILL, color: '#ca8a04', background: '#fefce8', border: '1px solid #fef08a' }}>
              写缓存 {fmtTokens(cacheCreationTokens)}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default Dashboard;