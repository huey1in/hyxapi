/*
 * Tabs — 统一标签页（segmented control）
 *
 * variant: pill (默认胶囊式) | underline (下划线式)
 *
 * 使用：
 *   <Tabs value={tab} onChange={setTab} items={[{value, label}]} />
 *   <Tabs value={tab} onChange={setTab} items={[...]} variant='underline' />
 */

import React from 'react';
import { cn } from './tokens';

const Tabs = ({ value, onChange, items = [], variant = 'pill', size = 'md', className }) => {
  const sizeClass =
    size === 'sm' ? 'px-2.5 py-1 text-[11px]' : size === 'lg' ? 'px-4 py-2 text-sm' : 'px-3 py-1.5 text-xs';

  if (variant === 'underline') {
    return (
      <div className={cn('inline-flex items-center gap-4 border-b border-ui-border', className)}>
        {items.map((it) => {
          const sel = it.value === value;
          return (
            <button
              key={it.value}
              type='button'
              onClick={() => onChange?.(it.value)}
              disabled={it.disabled}
              className={cn(
                'pb-2 text-sm transition-colors -mb-px border-b-2',
                sel
                  ? 'border-ui-text text-ui-text font-medium'
                  : 'border-transparent text-ui-text-2 hover:text-ui-text',
                it.disabled && 'opacity-50 cursor-not-allowed',
              )}
            >
              {it.label}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className={cn('inline-flex items-center gap-1', className)}>
      {items.map((it) => {
        const sel = it.value === value;
        return (
          <button
            key={it.value}
            type='button'
            onClick={() => onChange?.(it.value)}
            disabled={it.disabled}
            className={cn(
              'rounded-xl whitespace-nowrap transition-colors',
              sizeClass,
              sel
                ? 'bg-ui-bg-subtle text-ui-text font-semibold'
                : 'text-ui-text-2 hover:text-ui-text hover:bg-ui-bg-subtle',
              it.disabled && 'opacity-50 cursor-not-allowed',
            )}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
};

export default Tabs;
