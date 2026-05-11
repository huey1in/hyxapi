/*
 * Tag — 统一标签/徽章
 *
 * color: default | neutral | blue | emerald | violet | amber | rose | cyan | danger | success | warning
 * size:  sm | md
 *
 * 使用：
 *   <Tag>标签</Tag>
 *   <Tag color='blue'>新建</Tag>
 *   <Tag color='emerald' size='sm'>已启用</Tag>
 *   <Tag color='danger' closable onClose={...}>已禁用</Tag>
 *   <Tag dot color='emerald'>未使用</Tag>   // 圆点指示
 */

import React from 'react';
import { X } from 'lucide-react';
import { cn, COLOR_TONES } from './tokens';

const SIZE = {
  sm: 'px-1.5 py-0.5 text-[11px]',
  md: 'px-2 py-0.5 text-[11px]',
  lg: 'px-2.5 py-1 text-xs',
};

const Tag = ({
  children,
  color = 'default',
  size = 'md',
  dot = false,
  closable = false,
  onClose,
  className,
}) => {
  const tone = COLOR_TONES[color] || COLOR_TONES.default;

  if (dot) {
    // 仅圆点 + 文字（无背景），适合表格状态列
    const dotColor = {
      default: 'bg-ui-text-3',
      neutral: 'bg-ui-text-3',
      blue: 'bg-blue-500',
      emerald: 'bg-emerald-500',
      violet: 'bg-violet-500',
      amber: 'bg-amber-500',
      rose: 'bg-rose-500',
      cyan: 'bg-cyan-500',
      danger: 'bg-ui-danger',
      success: 'bg-emerald-500',
      warning: 'bg-amber-500',
    }[color] || 'bg-ui-text-3';

    const textColor = tone.split(' ').filter((c) => c.includes('text-')).join(' ');
    return (
      <span className={cn('inline-flex items-center gap-1.5 text-[11px] font-medium', textColor, className)}>
        <span className={cn('w-1.5 h-1.5 rounded-full', dotColor)} />
        {children}
      </span>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 font-medium rounded-xl whitespace-nowrap',
        SIZE[size],
        tone,
        className,
      )}
    >
      {children}
      {closable && (
        <button
          type='button'
          onClick={(e) => {
            e.stopPropagation();
            onClose?.(e);
          }}
          className='inline-flex items-center justify-center -mr-0.5 ml-0.5 p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10'
        >
          <X size={10} />
        </button>
      )}
    </span>
  );
};

export default Tag;
