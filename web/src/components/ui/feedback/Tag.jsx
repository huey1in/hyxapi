/*
 * Tag — 状态标签 / 徽章
 *
 * tone:  default (中性) | success | warning | danger | info
 * size:  sm (默认) | md | lg
 * dot:   true 时只展示 圆点 + 文字（无底色边框）
 * closable: 显示 × 关闭按钮，触发 onClose
 */

import React from 'react';
import { X } from 'lucide-react';
import { cn } from '../tokens';

const SIZE = {
  sm: 'px-1.5 py-0.5 text-[11px]',
  md: 'px-2 py-0.5 text-xs',
  lg: 'px-2.5 py-1 text-xs',
};

/* 全部走中性灰 + 边框；语义只靠 dot 颜色暗示 */
const TONE_DOT = {
  default: 'bg-ui-text-3',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger:  'bg-ui-danger',
  info:    'bg-blue-500',
};

const Tag = ({
  children,
  tone = 'default',
  /* 旧 API 兼容 */
  color,
  size = 'sm',
  dot = false,
  closable = false,
  onClose,
}) => {
  const t = TONE_DOT[tone] ? tone : (TONE_DOT[color] ? color : 'default');
  const dotCls = TONE_DOT[t];

  if (dot) {
    return (
      <span className='inline-flex items-center gap-1.5 text-[11px] text-ui-text-2'>
        <span className={cn('w-1.5 h-1.5 rounded-full', dotCls)} />
        {children}
      </span>
    );
  }

  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 rounded-md border border-ui-border bg-[var(--page-bg)] text-ui-text-2 whitespace-nowrap',
      SIZE[size],
    )}>
      {t !== 'default' && <span className={cn('w-1.5 h-1.5 rounded-full', dotCls)} />}
      {children}
      {closable && (
        <button
          type='button'
          onClick={(e) => { e.stopPropagation(); onClose?.(e); }}
          className='inline-flex items-center justify-center -mr-0.5 ml-0.5 p-0.5 rounded text-ui-text-3 hover:text-ui-text hover:bg-ui-bg-subtle'
          aria-label='close'
        >
          <X size={10} />
        </button>
      )}
    </span>
  );
};

export default Tag;
