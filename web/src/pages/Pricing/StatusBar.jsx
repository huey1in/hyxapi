import React from 'react';

// Kuma 式服务状态色条：每个格子代表一次有调用的聚合桶。
// 数据不足时用绿色占位补齐，真实调用从右侧进入。
const STATUS_COLOR = {
  up: 'bg-emerald-500',
  degraded: 'bg-amber-500',
  down: 'bg-rose-500',
};

const PLACEHOLDER_COLOR = STATUS_COLOR.up;

const fmtTime = (ts) => {
  if (!ts) return '';
  return new Date(ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

const StatusBar = ({ history = [], slots = 60 }) => {
  // 只保留有真实调用的桶（过滤 idle / 无请求），按时间正序（旧 -> 新）。
  // 最右侧永远是最新真实调用；历史不足 slots 时，左侧使用绿色占位。
  const active = history.filter((rec) => rec && rec.status !== 'idle' && (rec.total || 0) > 0);
  const chrono = active.slice(0, slots).reverse();
  const placeholders = Math.max(0, slots - chrono.length);

  return (
    <div className='flex items-stretch gap-[1.5px] h-7'>
      {Array.from({ length: placeholders }).map((_, i) => (
        <div key={`placeholder-${i}`} title='暂无调用数据' className={`flex-1 rounded-sm ${PLACEHOLDER_COLOR}`} />
      ))}
      {chrono.map((rec, i) => {
        const color = STATUS_COLOR[rec.status] || PLACEHOLDER_COLOR;
        const cacheRate = rec.prompt_tokens > 0 ? ` · 缓存率 ${((rec.cache_tokens || 0) / rec.prompt_tokens * 100).toFixed(1)}%` : '';
        const title = `${fmtTime(rec.checked_at)} · 调用 ${rec.total} · 错误 ${rec.errors} · 延迟 ${rec.latency}ms${cacheRate}`;
        return <div key={i} title={title} className={`flex-1 rounded-sm ${color}`} />;
      })}
    </div>
  );
};

export default StatusBar;
