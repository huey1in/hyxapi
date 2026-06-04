import React from 'react';

// Kuma 式服务状态色条：每个格子代表一个时间桶（约 1 分钟）。
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
  // history 为最新在前，转成时间正序（旧 → 新），不足左侧补空。
  const chrono = history.slice(0, slots).reverse();
  const pad = Math.max(0, slots - chrono.length);
  const cells = [...Array(pad).fill(null), ...chrono];

  return (
    <div className='flex items-stretch gap-[1.5px] h-7'>
      {cells.map((rec, i) => {
        if (!rec) {
          return <div key={i} className='flex-1 rounded-sm bg-ui-bg-subtle' />;
        }
        const color = STATUS_COLOR[rec.status] || STATUS_COLOR.idle;
        const title = rec.status === 'idle'
          ? `${fmtTime(rec.checked_at)} · 无调用`
          : `${fmtTime(rec.checked_at)} · 调用 ${rec.total} · 错误 ${rec.errors} · 延迟 ${rec.latency}ms`;
        return <div key={i} title={title} className={`flex-1 rounded-sm ${color}`} />;
      })}
    </div>
  );
};

export default StatusBar;
