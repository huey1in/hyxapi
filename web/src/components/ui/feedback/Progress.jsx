/*
 * Progress — 线性 / 环形进度条
 *
 * variant: linear (默认) | circular
 *
 * 通用：
 *   value:        0~max (默认 max=100)
 *   max:          默认 100
 *   indeterminate: 不定进度（无 value 时启用）
 *   tone:         default | success | warning | danger
 *
 * linear:
 *   showLabel: 末端显示百分比
 *
 * circular:
 *   size:      px，默认 48
 *   thickness: px，默认 4
 *   showLabel: 中心显示百分比
 */

import React from 'react';
import { cn } from '../tokens';

const TONE = {
  default: 'bg-ui-accent',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger:  'bg-ui-danger',
};
const STROKE = {
  default: 'stroke-ui-accent',
  success: 'stroke-emerald-500',
  warning: 'stroke-amber-500',
  danger:  'stroke-ui-danger',
};

const Linear = ({ value, max, indeterminate, tone, showLabel }) => {
  const pct = indeterminate ? 50 : Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className='flex items-center gap-2 w-full'>
      <div className='relative flex-1 h-1.5 rounded-full bg-ui-bg-subtle overflow-hidden'>
        <div
          className={cn('absolute inset-y-0 left-0 rounded-full transition-all', TONE[tone], indeterminate && 'animate-progress-indet')}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel && !indeterminate && (
        <span className='text-xs text-ui-text-2 tabular-nums w-9 text-right'>{Math.round(pct)}%</span>
      )}
    </div>
  );
};

const Circular = ({ value, max, indeterminate, tone, size, thickness, showLabel }) => {
  const pct = indeterminate ? 25 : Math.max(0, Math.min(100, (value / max) * 100));
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const off = c - (pct / 100) * c;
  return (
    <div className={cn('relative inline-flex items-center justify-center', indeterminate && 'animate-spin-slow')} style={{ width: size, height: size }}>
      <svg width={size} height={size} className='-rotate-90'>
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={thickness} className='stroke-ui-bg-subtle' fill='none' />
        <circle
          cx={size / 2} cy={size / 2} r={r} strokeWidth={thickness}
          className={cn(STROKE[tone], 'transition-[stroke-dashoffset]')}
          fill='none'
          strokeLinecap='round'
          strokeDasharray={c}
          strokeDashoffset={off}
        />
      </svg>
      {showLabel && !indeterminate && (
        <span className='absolute text-xs text-ui-text tabular-nums'>{Math.round(pct)}%</span>
      )}
    </div>
  );
};

const Progress = ({
  variant = 'linear',
  value = 0,
  max = 100,
  indeterminate = false,
  tone = 'default',
  showLabel = false,
  size = 48,
  thickness = 4,
}) => {
  if (variant === 'circular') {
    return <Circular value={value} max={max} indeterminate={indeterminate} tone={tone} size={size} thickness={thickness} showLabel={showLabel} />;
  }
  return <Linear value={value} max={max} indeterminate={indeterminate} tone={tone} showLabel={showLabel} />;
};

export default Progress;
