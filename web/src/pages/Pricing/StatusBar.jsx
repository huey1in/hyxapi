import React from 'react';

// Kuma 式服务状态色条：每个格子代表一次有调用的聚合桶（无请求的空闲时段被跳过）。
const STATUS_COLOR = {
  up: 'bg-emerald-500',
  degraded: 'bg-amber-500',
  down: 'bg-rose-500',
  idle: 'bg-gray-200 dark:bg-gray-700',
};

const fmtTime = (ts) => {
  if (!ts) return '';
  return new Date(ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

const StatusBar = ({ history = [], slots = 60 }) => {
  // 只保留有真实调用的桶（过滤 idle / 无请求），按时间正序（旧 → 新）。
  // 这样没有请求的那段时间不会留空，色条只反映实际有流量的时段。
  const active = history.filter((rec) => rec && rec.status !== 'idle' && (rec.total || 0) > 0);
  const chrono = active.slice(0, slots).reverse();

  if (chrono.length === 0) {
    return <div className='flex items-stretch gap-[1.5px] h-7'><div className='flex-1 rounded-sm bg-ui-bg-subtle' /></div>;
  }

  return (
    <div className='flex items-stretch gap-[1.5px] h-7'>
      {chrono.map((rec, i) => {
        const color = STATUS_COLOR[rec.status] || STATUS_COLOR.idle;
        const title = `${fmtTime(rec.checked_at)} · 调用 ${rec.total} · 错误 ${rec.errors} · 延迟 ${rec.latency}ms`;
        return <div key={i} title={title} className={`flex-1 rounded-sm ${color}`} />;
      })}
    </div>
  );
};

export default StatusBar;
