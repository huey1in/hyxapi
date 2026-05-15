import React, { useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, ChevronDown, Copy, Globe, Megaphone, HelpCircle, Activity } from 'lucide-react';
import { API, renderNumber, renderQuota, showSuccess, copy, getRelativeTime, isAdmin } from '../../helpers';
import { UserContext } from '../../context/User';
import { StatusContext } from '../../context/Status';
import { IconButton, Loading } from '../../components/ui';
import { UPTIME_STATUS_MAP } from '../../constants/dashboard.constants';
import useIsMobile from '../../hooks/useIsMobile';
import useIsDark from '../../hooks/useIsDark';

const MONTHS = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];

const BarChart = ({ data, height = 180 }) => {
  if (!data || data.length === 0) {
    return <p className='text-sm text-[#999] py-8 text-center'>暂无数据</p>;
  }
  const max = Math.max(1, ...data.map((d) => d.value));
  const ticks = 6;
  const step = Math.ceil(max / ticks);
  const yLabels = Array.from({ length: ticks + 1 }, (_, i) => step * (ticks - i));

  return (
    <div className='flex gap-2' style={{ height }}>
      <div className='flex flex-col justify-between text-[12px] text-[#999] tabular-nums pr-1' style={{ width: 44, whiteSpace: 'nowrap' }}>
        {yLabels.map((v, i) => (
          <span key={i}>{v >= 1000 ? `${(v/1000).toFixed(v >= 10000 ? 0 : 1)}K` : v}</span>
        ))}
      </div>
      <div className='flex-1 flex items-end gap-[3px]'>
        {data.map((d, i) => {
          const pct = max > 0 ? (d.value / max) * 100 : 0;
          return (
            <div key={i} className='flex-1 flex flex-col items-center gap-1'>
              <div className='w-full flex justify-center' style={{ height: height - 24 }}>
                <div
                  className='w-full max-w-[28px] rounded-t transition-all'
                  style={{ height: `${pct}%`, background: 'var(--ui-accent)' }}
                />
              </div>
              <span className='text-[11px] text-[#999]' style={{ whiteSpace: 'nowrap' }}>{d.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const StatMini = ({ label, value }) => (
  <div style={{ paddingBlock: 16, paddingInline: 16, border: '1px solid var(--ui-border)', borderRadius: 16 }}>
    <div style={{ fontSize: 12, color: 'var(--ui-text-3)', marginBottom: 4 }}>{label}</div>
    <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--ui-text)', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
  </div>
);

const Dashboard = () => {
  const navigate = useNavigate();
  const [userState] = useContext(UserContext);
  const [statusState] = useContext(StatusContext);
  const [stats, setStats] = useState(null);
  const [liveStats, setLiveStats] = useState({ quota: 0, rpm: 0, tpm: 0 });
  const [monthlyData, setMonthlyData] = useState([]);
  const [modelStats, setModelStats] = useState([]);
  const [userRanking, setUserRanking] = useState([]);
  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(false);
  const isMobile = useIsMobile();
  const isDark = useIsDark();

  useEffect(() => {
    (async () => {
      try {
        const res = await API.get('/api/user/self');
        if (res.data?.success) setStats(res.data.data);
      } catch {} finally { setLoading(false); }
    })();
    loadChart();
    loadUptime();
    loadLiveStats();
    if (isAdmin()) loadAdminData();
  }, []);

  const loadAdminData = async () => {
    const end = Math.floor(Date.now() / 1000);
    const start = end - 30 * 86400;
    try {
      const [modelRes, userRes] = await Promise.all([
        API.get(`/api/data/?start_timestamp=${start}&end_timestamp=${end}`),
        API.get(`/api/data/users?start_timestamp=${start}&end_timestamp=${end}`),
      ]);
      if (modelRes.data?.success) {
        const byModel = new Map();
        (modelRes.data.data || []).forEach((it) => {
          const name = it.model_name || 'unknown';
          const cur = byModel.get(name) || { name, count: 0, quota: 0, tokens: 0 };
          cur.count += it.count || 0;
          cur.quota += it.quota || 0;
          cur.tokens += it.token_used || 0;
          byModel.set(name, cur);
        });
        setModelStats([...byModel.values()].sort((a, b) => b.quota - a.quota).slice(0, 15));
      }
      if (userRes.data?.success) {
        const byUser = new Map();
        (userRes.data.data || []).forEach((it) => {
          const name = it.username || 'unknown';
          const cur = byUser.get(name) || { name, count: 0, quota: 0, tokens: 0 };
          cur.count += it.count || 0;
          cur.quota += it.quota || 0;
          cur.tokens += it.token_used || 0;
          byUser.set(name, cur);
        });
        setUserRanking([...byUser.values()].sort((a, b) => b.quota - a.quota).slice(0, 10));
      }
    } catch {}
  };

  const loadLiveStats = async () => {
    try {
      const url = isAdmin() ? '/api/log/stat' : '/api/log/self/stat';
      const res = await API.get(url);
      if (res.data?.success) setLiveStats(res.data.data || { quota: 0, rpm: 0, tpm: 0 });
    } catch {}
  };

  const loadChart = async () => {
    setChartLoading(true);
    try {
      const end = Math.floor(Date.now() / 1000);
      const start = end - 365 * 86400;
      const res = await API.get(`/api/data/${isAdmin() ? '' : 'self/'}?start_timestamp=${start}&end_timestamp=${end}&default_time=month`);
      const list = res.data?.success ? (res.data.data || []) : [];
      const byMonth = new Map();
      list.forEach((it) => {
        const k = it.Day || it.day || it.Time || it.created_at || '';
        const q = it.Quota || it.quota || 0;
        const month = new Date(k).getMonth();
        if (!isNaN(month)) byMonth.set(month, (byMonth.get(month) || 0) + q);
      });
      const now = new Date();
      const result = [];
      for (let i = 11; i >= 0; i--) {
        const m = (now.getMonth() - i + 12) % 12;
        result.push({ label: MONTHS[m], value: byMonth.get(m) || 0 });
      }
      setMonthlyData(result);
    } catch { setMonthlyData([]); }
    finally { setChartLoading(false); }
  };

  const [uptimeData, setUptimeData] = useState([]);
  const [uptimeLoading, setUptimeLoading] = useState(false);

  const loadUptime = async () => {
    setUptimeLoading(true);
    try {
      const res = await API.get('/api/uptime/status');
      if (res.data?.success) setUptimeData(res.data.data || []);
    } catch {} finally { setUptimeLoading(false); }
  };

  const status = statusState?.status || {};
  const announcements = useMemo(() => {
    return (status.announcements || []).slice(0, 10).map((it) => {
      const d = it?.publishDate ? new Date(it.publishDate) : null;
      const time = d && !isNaN(d.getTime())
        ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        : '';
      return { ...it, time, relative: getRelativeTime(it.publishDate) };
    });
  }, [status.announcements]);
  const apiInfoData = status.api_info || [];
  const faqData = status.faq || [];

  const apiInfoEnabled = status.api_info_enabled ?? true;
  const announcementsEnabled = status.announcements_enabled ?? true;
  const faqEnabled = status.faq_enabled ?? true;
  const uptimeEnabled = status.uptime_kuma_enabled ?? true;

  const u = stats || userState?.user || {};

  if (loading) return <div className='p-8'><Loading /></div>;

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
        {/* 本月消费 */}
        <div style={{ display: 'flex', alignItems: 'center', paddingBlock: 26, paddingInline: 20, border: '1px solid var(--ui-border)', borderRadius: 26 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 400, color: 'var(--ui-text-3)', marginBottom: 8 }}>本月消费</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--ui-text)' }}>
              {renderQuota(monthlyData.length > 0 ? monthlyData[monthlyData.length - 1].value : 0)}
            </div>
          </div>
        </div>
      </div>

      {/* 实时统计 */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 12 }}>
        <StatMini label='总请求数' value={renderNumber(u.request_count || 0)} />
        <StatMini label='总消费' value={renderQuota(u.used_quota || 0)} />
        <StatMini label='当前 RPM' value={renderNumber(liveStats.rpm || 0)} />
        <StatMini label='当前 TPM' value={renderNumber(liveStats.tpm || 0)} />
      </div>

      {/* 每月用量 */}
      <div style={{ paddingBlock: '16px 8px', paddingInline: 16, border: '1px solid var(--ui-border)', borderRadius: 26 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBlockEnd: 8 }}>
          <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--ui-text)' }}>每月用量</span>
          <IconButton icon={RefreshCw} onClick={loadChart} disabled={chartLoading} title='刷新' />
        </div>
        <div style={{ position: 'relative' }}>
          <div style={{ opacity: chartLoading ? 0.4 : 1, transition: 'opacity 0.3s ease' }}>
            <BarChart data={monthlyData} />
          </div>
          {chartLoading && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Loading size='sm' />
            </div>
          )}
        </div>
      </div>

      {/* 管理员数据面板 */}
      {isAdmin() && modelStats.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
          {/* 模型统计 */}
          <div style={{ padding: '16px 20px', border: '1px solid var(--ui-border)', borderRadius: 26, overflow: 'hidden' }}>
            <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--ui-text)' }}>模型调用 Top 15（近30天）</span>
            <div style={{ marginTop: 12, maxHeight: 360, overflowY: 'auto' }}>
              {modelStats.map((m, i) => {
                const maxQ = modelStats[0]?.quota || 1;
                return (
                  <div key={m.name} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 11, color: 'var(--ui-text-3)', width: 18, textAlign: 'right' }}>{i + 1}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 2 }}>
                        <span style={{ color: 'var(--ui-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</span>
                        <span style={{ color: 'var(--ui-text-3)', flexShrink: 0, marginLeft: 8 }}>{renderNumber(m.count)} 次</span>
                      </div>
                      <div style={{ height: 4, borderRadius: 2, background: 'var(--ui-bg-subtle)' }}>
                        <div style={{ height: '100%', borderRadius: 2, width: `${(m.quota / maxQ) * 100}%`, background: 'var(--ui-accent)' }} />
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--ui-text-3)', marginTop: 2 }}>
                        消费 {renderQuota(m.quota)} · Token {renderNumber(m.tokens)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 用户消费排行 */}
          <div style={{ padding: '16px 20px', border: '1px solid var(--ui-border)', borderRadius: 26, overflow: 'hidden' }}>
            <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--ui-text)' }}>用户消费 Top 10（近30天）</span>
            <div style={{ marginTop: 12, maxHeight: 360, overflowY: 'auto' }}>
              {userRanking.map((u, i) => {
                const maxQ = userRanking[0]?.quota || 1;
                return (
                  <div key={u.name} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 11, color: 'var(--ui-text-3)', width: 18, textAlign: 'right' }}>{i + 1}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 2 }}>
                        <span style={{ color: 'var(--ui-text)' }}>{u.name}</span>
                        <span style={{ color: 'var(--ui-text-3)', flexShrink: 0, marginLeft: 8 }}>{renderQuota(u.quota)}</span>
                      </div>
                      <div style={{ height: 4, borderRadius: 2, background: 'var(--ui-bg-subtle)' }}>
                        <div style={{ height: '100%', borderRadius: 2, width: `${(u.quota / maxQ) * 100}%`, background: 'var(--ui-accent)' }} />
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--ui-text-3)', marginTop: 2 }}>
                        {renderNumber(u.count)} 次 · Token {renderNumber(u.tokens)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 信息面板 */}
      <InfoPanels
        apiInfoEnabled={apiInfoEnabled}
        announcementsEnabled={announcementsEnabled}
        faqEnabled={faqEnabled}
        uptimeEnabled={uptimeEnabled}
        apiInfoData={apiInfoData}
        announcements={announcements}
        faqData={faqData}
        uptimeData={uptimeData}
        uptimeLoading={uptimeLoading}
      />
    </div>
  );
};

// ── Info Panels ─────────────────────────────────────────

const TABS = [
  { key: 'api', label: 'API 信息', Icon: Globe },
  { key: 'news', label: '系统公告', Icon: Megaphone },
  { key: 'faq', label: '常见问答', Icon: HelpCircle },
  { key: 'uptime', label: '服务状态', Icon: Activity },
];

const InfoPanels = ({ apiInfoEnabled, announcementsEnabled, faqEnabled, uptimeEnabled, apiInfoData, announcements, faqData, uptimeData, uptimeLoading }) => {
  const tabs = useMemo(() => {
    const out = [];
    if (apiInfoEnabled) out.push(TABS[0]);
    if (announcementsEnabled) out.push(TABS[1]);
    if (faqEnabled) out.push(TABS[2]);
    if (uptimeEnabled) out.push(TABS[3]);
    return out;
  }, [apiInfoEnabled, announcementsEnabled, faqEnabled, uptimeEnabled]);

  const [active, setActive] = useState(tabs[0]?.key || 'api');
  const [uptimeGroup, setUptimeGroup] = useState('0');

  if (tabs.length === 0) return null;

  return (
    <div style={{ border: '1px solid var(--ui-border)', borderRadius: 26, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '12px 16px', borderBottom: '1px solid var(--ui-divider)', overflowX: 'auto' }}>
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActive(key)}
            style={{
              cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5,
              height: 30, paddingInline: 12, borderRadius: 15, border: 'none',
              fontSize: 13, fontWeight: active === key ? 500 : 400, whiteSpace: 'nowrap',
              color: active === key ? 'var(--ui-text)' : 'var(--ui-text-2)',
              background: active === key ? 'var(--ui-bg-subtle)' : 'transparent',
              transition: 'background 0.15s, color 0.15s',
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <div style={{ maxHeight: 420, overflowY: 'auto' }}>
        {active === 'api' && <ApiInfoSection data={apiInfoData} />}
        {active === 'news' && <AnnouncementsSection data={announcements} />}
        {active === 'faq' && <FaqSection data={faqData} />}
        {active === 'uptime' && <UptimeSection data={uptimeData} loading={uptimeLoading} group={uptimeGroup} setGroup={setUptimeGroup} />}
      </div>
    </div>
  );
};

const EmptyState = ({ text }) => (
  <div style={{ padding: '48px 16px', textAlign: 'center', color: 'var(--ui-text-3)', fontSize: 13 }}>{text}</div>
);

const ApiInfoSection = ({ data }) => {
  if (!data?.length) return <EmptyState text='暂无 API 信息' />;
  return (
    <div>
      {data.map((item, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', borderBottom: i < data.length - 1 ? '1px solid #eeeeee' : 'none' }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ui-text)', marginBottom: 2 }}>{item.route || item.name || '-'}</div>
            <div style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--ui-text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.url}</div>
          </div>
          <button
            onClick={async () => { if (await copy(item.url)) showSuccess('已复制'); }}
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, border: 'none', borderRadius: 6, background: 'transparent', color: 'var(--ui-text-3)', flexShrink: 0 }}
          >
            <Copy size={14} />
          </button>
        </div>
      ))}
    </div>
  );
};

const AnnouncementsSection = ({ data }) => {
  if (!data?.length) return <EmptyState text='暂无公告' />;
  const colorMap = { success: '#22c55e', warning: '#f59e0b', error: '#ef4444' };
  return (
    <div>
      {data.map((item, i) => (
        <div key={i} style={{ padding: '12px 18px', borderBottom: i < data.length - 1 ? '1px solid #eeeeee' : 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: colorMap[item.type] || '#999', flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: 'var(--ui-text-3)' }}>{item.relative ? `${item.relative} · ` : ''}{item.time}</span>
          </div>
          <div style={{ fontSize: 14, color: 'var(--ui-text)', lineHeight: 1.6, paddingLeft: 14 }}>{item.content}</div>
        </div>
      ))}
    </div>
  );
};

const FaqSection = ({ data }) => {
  if (!data?.length) return <EmptyState text='暂无问答' />;
  return (
    <div>
      {data.map((item, i) => <FaqItem key={i} item={item} last={i === data.length - 1} />)}
    </div>
  );
};

const FaqItem = ({ item, last }) => {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: last ? 'none' : '1px solid #eeeeee' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          width: '100%', padding: '12px 18px', border: 'none', background: 'transparent',
          fontSize: 14, color: 'var(--ui-text)', textAlign: 'left',
        }}
      >
        <span style={{ flex: 1 }}>{item.question}</span>
        <ChevronDown size={14} style={{ color: 'var(--ui-text-3)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </button>
      {open && (
        <div style={{ padding: '0 18px 12px', fontSize: 13, color: 'var(--ui-text-2)', lineHeight: 1.6 }}>{item.answer}</div>
      )}
    </div>
  );
};

const UptimeSection = ({ data, loading, group, setGroup }) => {
  if (loading) return <div style={{ padding: '32px 0', textAlign: 'center' }}><Loading size='sm' /></div>;
  if (!data?.length) return <EmptyState text='暂无监控服务' />;

  const groups = data.map((g, i) => ({ key: String(i), label: g.categoryName }));
  const current = data[Number(group) || 0];
  const monitors = current?.monitorList || [];

  return (
    <div>
      {groups.length > 1 && (
        <div style={{ display: 'flex', gap: 4, padding: '10px 16px', borderBottom: '1px solid var(--ui-divider)', overflowX: 'auto' }}>
          {groups.map((g) => (
            <button
              key={g.key}
              onClick={() => setGroup(g.key)}
              style={{
                cursor: 'pointer', height: 26, paddingInline: 10, borderRadius: 13, border: 'none',
                fontSize: 12, fontWeight: group === g.key ? 500 : 400,
                color: group === g.key ? 'var(--ui-text)' : 'var(--ui-text-2)',
                background: group === g.key ? 'var(--ui-bg-subtle)' : 'transparent',
                whiteSpace: 'nowrap', transition: 'background 0.15s',
              }}
            >{g.label}</button>
          ))}
        </div>
      )}
      {monitors.length === 0 ? <EmptyState text='暂无监控' /> : (
        <div>
          {monitors.map((m, i) => {
            const statusInfo = UPTIME_STATUS_MAP[m.status] || {};
            const color = statusInfo.color || '#999';
            const pct = ((m.uptime || 0) * 100).toFixed(2);
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 18px', borderBottom: i < monitors.length - 1 ? '1px solid #eeeeee' : 'none' }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 14, color: 'var(--ui-text)' }}>{m.name}</span>
                <div style={{ width: 80, height: 4, borderRadius: 2, background: 'var(--ui-bg-subtle)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 2, background: color, width: `${pct}%`, transition: 'width 0.3s' }} />
                </div>
                <span style={{ fontSize: 12, color: 'var(--ui-text-2)', fontVariantNumeric: 'tabular-nums', width: 48, textAlign: 'right' }}>{pct}%</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Dashboard;