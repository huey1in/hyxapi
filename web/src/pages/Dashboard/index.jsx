import React, { useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wallet, TrendingUp, Activity, KeyRound } from 'lucide-react';
import { API, renderQuota, renderNumber } from '../../helpers';
import { UserContext } from '../../context/User';
import { PageShell, Card, Button, Loading } from '../../components/ui';

const StatCard = ({ icon: Icon, label, value, hint }) => (
  <Card>
    <div className='flex items-center justify-between mb-3'>
      <span className='text-sm text-ui-text-2'>{label}</span>
      <Icon size={18} className='text-ui-text-3' />
    </div>
    <div className='text-2xl font-semibold text-ui-text-1'>{value}</div>
    {hint && <div className='text-xs text-ui-text-3 mt-1'>{hint}</div>}
  </Card>
);

const Sparkline = ({ points, height = 160 }) => {
  if (!points || points.length === 0) {
    return <p className='text-sm text-ui-text-3 py-8 text-center'>暂无数据</p>;
  }
  const W = 800;
  const H = height;
  const max = Math.max(1, ...points.map((p) => p.value));
  const min = 0;
  const range = max - min || 1;
  const stepX = W / Math.max(1, points.length - 1);
  const coords = points.map((p, i) => [i * stepX, H - ((p.value - min) / range) * (H - 24) - 4]);
  const path = coords.map((c, i) => (i === 0 ? `M${c[0]},${c[1]}` : `L${c[0]},${c[1]}`)).join(' ');
  const area = `${path} L${coords[coords.length - 1][0]},${H} L0,${H} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className='w-full' preserveAspectRatio='none' height={H}>
      <defs>
        <linearGradient id='spark-fill' x1='0' y1='0' x2='0' y2='1'>
          <stop offset='0%' stopColor='var(--ui-accent)' stopOpacity='0.35' />
          <stop offset='100%' stopColor='var(--ui-accent)' stopOpacity='0' />
        </linearGradient>
      </defs>
      <path d={area} fill='url(#spark-fill)' />
      <path d={path} fill='none' stroke='var(--ui-accent)' strokeWidth='2' />
      {coords.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r='2' fill='var(--ui-accent)' />
      ))}
    </svg>
  );
};

const PIE_COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#a3a3a3'];

const Donut = ({ slices, size = 180 }) => {
  if (!slices || slices.length === 0) {
    return <p className='text-sm text-ui-text-3 py-8 text-center'>暂无数据</p>;
  }
  const total = slices.reduce((s, x) => s + x.value, 0) || 1;
  const r = size / 2 - 10;
  const cx = size / 2;
  const cy = size / 2;
  let acc = 0;
  const arcs = slices.map((s, i) => {
    const a0 = (acc / total) * Math.PI * 2;
    acc += s.value;
    const a1 = (acc / total) * Math.PI * 2;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const x0 = cx + r * Math.sin(a0);
    const y0 = cy - r * Math.cos(a0);
    const x1 = cx + r * Math.sin(a1);
    const y1 = cy - r * Math.cos(a1);
    const d = `M${cx},${cy} L${x0},${y0} A${r},${r} 0 ${large} 1 ${x1},${y1} Z`;
    return { d, color: PIE_COLORS[i % PIE_COLORS.length], label: s.label, value: s.value, pct: (s.value / total) * 100 };
  });
  return (
    <div className='flex items-center gap-6 flex-wrap'>
      <svg width={size} height={size}>
        {arcs.map((a, i) => <path key={i} d={a.d} fill={a.color} />)}
        <circle cx={cx} cy={cy} r={r * 0.55} fill='var(--page-bg)' />
      </svg>
      <ul className='flex-1 min-w-[200px] space-y-1.5 text-sm'>
        {arcs.map((a, i) => (
          <li key={i} className='flex items-center justify-between gap-3'>
            <span className='flex items-center gap-2 min-w-0'>
              <span className='w-2.5 h-2.5 rounded-sm shrink-0' style={{ background: a.color }} />
              <span className='text-ui-text-1 truncate font-mono text-xs'>{a.label}</span>
            </span>
            <span className='text-ui-text-3 tabular-nums text-xs whitespace-nowrap'>{a.pct.toFixed(1)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

const RANGE_OPTIONS = [
  { value: 1, label: '近 1 天' },
  { value: 7, label: '近 7 天' },
  { value: 30, label: '近 30 天' },
];

const Dashboard = () => {
  const navigate = useNavigate();
  const [userState] = useContext(UserContext);
  const [stats, setStats] = useState(null);
  const [series, setSeries] = useState([]);
  const [modelSlices, setModelSlices] = useState([]);
  const [range, setRange] = useState(7);
  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await API.get('/api/user/self');
        const { success, data } = res.data || {};
        if (success) setStats(data);
      } catch {} finally { setLoading(false); }
    })();
  }, []);

  const loadChart = async (days) => {
    setChartLoading(true);
    try {
      const end = Math.floor(Date.now() / 1000);
      const start = end - days * 86400;
      const res = await API.get(`/api/data/self/?start_timestamp=${start}&end_timestamp=${end}&default_time=hour`);
      const list = res.data?.success ? (res.data.data || []) : [];
      // aggregate by created_at (string) → sum quota
      const map = new Map();
      const byModel = new Map();
      list.forEach((it) => {
        const k = it.Day || it.day || it.Time || it.created_at;
        const q = it.Quota || it.quota || 0;
        if (k) map.set(k, (map.get(k) || 0) + q);
        const m = it.ModelName || it.model_name || 'unknown';
        byModel.set(m, (byModel.get(m) || 0) + q);
      });
      const arr = Array.from(map.entries())
        .sort(([a], [b]) => String(a).localeCompare(String(b)))
        .map(([time, value]) => ({ time, value }));
      setSeries(arr);
      const slices = Array.from(byModel.entries())
        .filter(([, v]) => v > 0)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([label, value]) => ({ label, value }));
      setModelSlices(slices);
    } catch {
      setSeries([]); setModelSlices([]);
    } finally {
      setChartLoading(false);
    }
  };
  useEffect(() => { loadChart(range); }, [range]);

  const u = stats || userState?.user || {};
  const totalUsed = useMemo(() => series.reduce((s, p) => s + p.value, 0), [series]);

  return (
    <PageShell
      title='仪表盘'
      actions={
        <>
          <Button size='sm' variant='toggle' onClick={() => navigate('/console/topup')}>充值</Button>
          <Button size='sm' onClick={() => navigate('/console/token')}>新建 API Key</Button>
        </>
      }
    >
      {loading ? (
        <Loading />
      ) : (
        <div className='space-y-6'>
          <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
            <StatCard icon={Wallet} label='可用余额' value={renderQuota(u.quota || 0, 2)} />
            <StatCard icon={TrendingUp} label='已用额度' value={renderQuota(u.used_quota || 0, 2)} />
            <StatCard icon={Activity} label='请求次数' value={renderNumber(u.request_count || 0)} />
            <StatCard icon={KeyRound} label='用户分组' value={u.group || '-'} />
          </div>

          <Card>
            <div className='flex items-center justify-between mb-4'>
              <div>
                <h3 className='text-base font-semibold text-ui-text-1'>使用趋势</h3>
                <p className='text-xs text-ui-text-3 mt-1'>
                  区间合计 {renderQuota(totalUsed, 2)} · {series.length} 个数据点
                </p>
              </div>
              <div className='flex items-center gap-1'>
                {RANGE_OPTIONS.map((opt) => (
                  <Button
                    key={opt.value}
                    size='sm'
                    variant='toggle'
                    selected={range === opt.value}
                    onClick={() => setRange(opt.value)}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
            </div>
            {chartLoading ? <Loading /> : <Sparkline points={series} />}
          </Card>

          <Card>
            <h3 className='text-base font-semibold text-ui-text-1 mb-1'>模型用量分布</h3>
            <p className='text-xs text-ui-text-3 mb-4'>同时间区间，按 quota 占比 Top 10</p>
            {chartLoading ? <Loading /> : <Donut slices={modelSlices} />}
          </Card>
        </div>
      )}
    </PageShell>
  );
};

export default Dashboard;
