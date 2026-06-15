import React, { useEffect, useState, useCallback, useRef } from 'react';
import { RefreshCw } from 'lucide-react';
import { API, renderQuota, renderNumber } from '../../helpers';
import { Loading, IconButton } from '../../components/ui';
import useIsMobile from '../../hooks/useIsMobile';

/* ─── helpers ─── */

const fmtUptime = (s) => {
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

const fmtBytes = (b) => {
  if (!b || b <= 0) return '0 B';
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0, v = b;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(i === 0 ? 0 : 2)} ${u[i]}`;
};

const fmtTokens = (n) => {
  if (!n) return '0';
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k';
  return String(n);
};

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
    <div style={{ width: '100%', height: 4, borderRadius: 2, background: 'var(--ui-bg-subtle)', marginTop: 6 }}>
      <div style={{ width: `${Math.max(pct, pct > 0 ? 1 : 0)}%`, height: '100%', borderRadius: 2, background: c, transition: 'width 0.3s' }} />
    </div>
  );
};

const ResourceCard = ({ label, value, detail }) => {
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

const Section = ({ title, right, children }) => (
  <div>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
      <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--ui-text)' }}>{title}</span>
      {right && <span style={{ fontSize: 13, color: 'var(--ui-text-3)' }}>{right}</span>}
    </div>
    {children}
  </div>
);

const PoolCard = ({ title, data }) => {
  if (!data || !data.max_open) return null;
  const usePct = data.max_open > 0 ? (data.in_use / data.max_open) * 100 : 0;
  return (
    <div style={{ padding: 16, border: '1px solid var(--ui-border)', borderRadius: 16, flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ui-text)', marginBottom: 10 }}>{title}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
        <KV label='活跃' value={data.in_use} />
        <KV label='空闲' value={data.idle} />
        <KV label='已打开' value={data.open} />
        <KV label='最大连接' value={data.max_open} />
        <KV label='等待次数' value={data.wait_count} />
        <KV label='等待耗时' value={data.wait_duration_ms != null ? `${data.wait_duration_ms}ms` : '-'} />
      </div>
      <MiniBar value={usePct} />
    </div>
  );
};

const KV = ({ label, value }) => (
  <div>
    <div style={{ fontSize: 11, color: 'var(--ui-text-3)' }}>{label}</div>
    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ui-text)', fontVariantNumeric: 'tabular-nums' }}>{value ?? '-'}</div>
  </div>
);

/* ─── page ─── */

const REFRESH_INTERVAL = 5;

const SystemStatus = () => {
  const isMobile = useIsMobile();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL);
  const timerRef = useRef(null);

  const loadData = useCallback(async () => {
    try {
      const res = await API.get('/api/system-status');
      if (res.data?.success) setData(res.data.data);
    } catch {}
    finally { setLoading(false); setCountdown(REFRESH_INTERVAL); }
  }, []);

  useEffect(() => {
    loadData();
    const dataTimer = setInterval(loadData, REFRESH_INTERVAL * 1000);
    timerRef.current = setInterval(() => setCountdown((c) => Math.max(c - 1, 0)), 1000);
    return () => { clearInterval(dataTimer); clearInterval(timerRef.current); };
  }, [loadData]);

  if (loading && !data) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}><Loading /></div>;
  }
  if (!data) return null;

  const { system, resources, runtime: rt, database, log_database, redis,
    request_stats: rs, semantic_cache: sc, disk_cache: dc, channel_affinity: ca } = data;

  const grid = (cols) => ({ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : `repeat(${cols}, 1fr)`, gap: isMobile ? 8 : 12 });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 20 : 28, width: '100%', maxWidth: 960, marginInline: 'auto', padding: isMobile ? '16px' : '24px 16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--ui-text)' }}>系统状态</span>
          <span style={{ fontSize: 12, color: 'var(--ui-text-3)', fontVariantNumeric: 'tabular-nums' }}>{countdown}s 后刷新</span>
        </div>
        <IconButton icon={RefreshCw} onClick={() => { setLoading(true); loadData(); }} disabled={loading} title='刷新' />
      </div>

      {/* S1: System overview */}
      <div style={grid(4)}>
        <StatMini label='运行时间' value={fmtUptime(system?.uptime_seconds)} />
        <StatMini label='版本' value={system?.version || '-'} sub={system?.go_version} />
        <StatMini label='Goroutines' value={(system?.goroutines || 0).toLocaleString()} />
        <StatMini label='活跃连接' value={(system?.active_connections || 0).toLocaleString()} />
      </div>

      {/* S2: Resources */}
      <Section title='资源监控'>
        <div style={grid(3)}>
          <ResourceCard label='CPU' value={resources?.cpu_usage} />
          <ResourceCard label='内存' value={resources?.memory_usage} />
          <ResourceCard label='磁盘' value={resources?.disk_usage}
            detail={resources?.disk_total ? `${fmtBytes(resources.disk_used)} / ${fmtBytes(resources.disk_total)}` : null} />
        </div>
      </Section>

      {/* S3: Go Runtime */}
      {rt && (
        <Section title='Go 运行时'>
          <div style={grid(isMobile ? 2 : 6)}>
            <StatMini label='Heap Alloc' value={fmtBytes(rt.heap_alloc)} />
            <StatMini label='Heap Sys' value={fmtBytes(rt.heap_sys)} />
            <StatMini label='Heap Idle' value={fmtBytes(rt.heap_idle)} />
            <StatMini label='Heap InUse' value={fmtBytes(rt.heap_inuse)} />
            <StatMini label='Stack InUse' value={fmtBytes(rt.stack_inuse)} />
            <StatMini label='GC 次数' value={(rt.num_gc || 0).toLocaleString()} sub={rt.gc_pause_avg_us ? `平均暂停 ${rt.gc_pause_avg_us}µs` : null} />
          </div>
        </Section>
      )}

      {/* S4: Connection Pools */}
      <Section title='连接池'>
        <div style={{ display: 'flex', gap: isMobile ? 8 : 12, flexDirection: isMobile ? 'column' : 'row' }}>
          <PoolCard title='主数据库' data={database} />
          <PoolCard title='日志数据库' data={log_database} />
          {/* Redis */}
          <div style={{ padding: 16, border: '1px solid var(--ui-border)', borderRadius: 16, flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ui-text)', marginBottom: 10 }}>
              Redis
              {redis && !redis.enabled && <span style={{ fontSize: 11, color: 'var(--ui-text-3)', marginLeft: 6 }}>未启用</span>}
            </div>
            {redis?.enabled ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                <KV label='总连接' value={redis.total_conns} />
                <KV label='空闲' value={redis.idle_conns} />
                <KV label='命中' value={(redis.hits || 0).toLocaleString()} />
                <KV label='未命中' value={(redis.misses || 0).toLocaleString()} />
                <KV label='超时' value={redis.timeouts || 0} />
                <KV label='Key 数量' value={redis.db_size != null ? redis.db_size.toLocaleString() : '-'} />
              </div>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--ui-text-3)' }}>内存模式运行中</div>
            )}
          </div>
        </div>
      </Section>

      {/* S5: Request Stats */}
      <Section title='请求统计'>
        <div style={grid(isMobile ? 2 : 6)}>
          <StatMini label='今日请求' value={renderNumber(rs?.today_requests || 0)} />
          <StatMini label='今日 Token' value={fmtTokens(rs?.today_tokens)} />
          <StatMini label='今日消费' value={renderQuota(rs?.today_quota || 0)} />
          <StatMini label='累计请求' value={renderNumber(rs?.total_requests || 0)} />
          <StatMini label='累计 Token' value={fmtTokens(rs?.total_tokens)} />
          <StatMini label='累计消费' value={renderQuota(rs?.total_quota || 0)} />
        </div>
      </Section>

      {/* S6: Cache System */}
      <Section title='缓存系统'>
        <div style={{ display: 'flex', gap: isMobile ? 8 : 12, flexDirection: isMobile ? 'column' : 'row' }}>
          {/* Semantic Cache */}
          <div style={{ padding: 16, border: '1px solid var(--ui-border)', borderRadius: 16, flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ui-text)', marginBottom: 10 }}>语义缓存</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
              <KV label='状态' value={sc?.enabled ? '已启用' : '未启用'} />
              <KV label='条目数' value={(sc?.entries || 0).toLocaleString()} />
              <KV label='命中次数' value={(sc?.total_hits || 0).toLocaleString()} />
            </div>
          </div>
          {/* Disk Cache */}
          <div style={{ padding: 16, border: '1px solid var(--ui-border)', borderRadius: 16, flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ui-text)', marginBottom: 10 }}>磁盘缓存</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
              <KV label='磁盘文件' value={(dc?.active_disk_files || 0).toLocaleString()} />
              <KV label='内存缓存' value={(dc?.active_memory_bufs || 0).toLocaleString()} />
              <KV label='磁盘用量' value={fmtBytes(dc?.disk_usage_bytes)} />
              <KV label='内存用量' value={fmtBytes(dc?.memory_usage_bytes)} />
              <KV label='磁盘命中' value={(dc?.disk_hits || 0).toLocaleString()} />
              <KV label='内存命中' value={(dc?.memory_hits || 0).toLocaleString()} />
            </div>
            {dc?.disk_max_bytes > 0 && (
              <MiniBar value={dc.disk_usage_bytes || 0} max={dc.disk_max_bytes} />
            )}
          </div>
          {/* Channel Affinity */}
          <div style={{ padding: 16, border: '1px solid var(--ui-border)', borderRadius: 16, flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ui-text)', marginBottom: 10 }}>渠道亲和缓存</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
              <KV label='状态' value={ca?.enabled ? '已启用' : '未启用'} />
              <KV label='算法' value={ca?.cache_algo || '-'} />
              <KV label='条目数' value={(ca?.total || 0).toLocaleString()} />
              <KV label='容量' value={(ca?.cache_capacity || 0).toLocaleString()} />
            </div>
            {ca?.cache_capacity > 0 && (
              <MiniBar value={ca?.total || 0} max={ca.cache_capacity} />
            )}
          </div>
        </div>
      </Section>

      {/* Footer */}
      <div style={{ fontSize: 12, color: 'var(--ui-text-3)', textAlign: 'right', paddingBottom: 8 }}>
        {system?.go_version} · {system?.version}
      </div>
    </div>
  );
};

export default SystemStatus;
