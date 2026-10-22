/*
 * Tabs — 标签切换
 *
 * items:    [{ value, label, disabled? }]
 * value
 * onChange
 * variant:  underline (默认) | pill
 * size:     sm | md (默认)
 */

import { cn, FOCUS_RING } from '../tokens';
import type { ReactNode } from 'react';

type TabValue = string | number;
interface TabItem<V extends TabValue> { value: V; label: ReactNode; disabled?: boolean }
interface TabsProps<V extends TabValue> {
  items?: readonly TabItem<V>[];
  value?: V;
  onChange?: (value: V) => void;
  variant?: 'underline' | 'pill';
  size?: 'sm' | 'md';
}

const SIZE_PAD = {
  sm: { underline: 'px-1 py-2 text-xs',   pill: 'px-2.5 py-1 text-xs'   },
  md: { underline: 'px-1 py-2.5 text-sm', pill: 'px-3 py-1.5 text-sm' },
};

function Tabs<V extends TabValue>({ items = [], value, onChange, variant = 'underline', size = 'md' }: TabsProps<V>) {
  if (variant === 'pill') {
    return (
      <div className='inline-flex items-center min-w-max gap-1 bg-ui-bg-subtle p-1 rounded-xl'>
        {items.map((it) => {
          const sel = it.value === value;
          return (
            <button
              key={String(it.value)}
              type='button'
              disabled={it.disabled}
              onClick={() => !it.disabled && onChange?.(it.value)}
              className={cn(
                'rounded-lg transition-colors',
                SIZE_PAD[size].pill,
                sel
                  ? 'bg-[var(--page-bg)] text-ui-text shadow-xs'
                  : 'text-ui-text-2 hover:text-ui-text',
                it.disabled && 'opacity-50 cursor-not-allowed',
                FOCUS_RING,
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
    <div className='relative flex items-end gap-4 border-b border-ui-border'>
      {items.map((it) => {
        const sel = it.value === value;
        return (
          <button
            key={String(it.value)}
            type='button'
            disabled={it.disabled}
            onClick={() => !it.disabled && onChange?.(it.value)}
            className={cn(
              'relative -mb-px transition-colors',
              SIZE_PAD[size].underline,
              sel ? 'text-ui-text' : 'text-ui-text-3 hover:text-ui-text-2',
              it.disabled && 'opacity-50 cursor-not-allowed',
              FOCUS_RING,
            )}
          >
            {it.label}
            <span
              className={cn(
                'absolute left-0 right-0 -bottom-px h-[2px] rounded-full transition-opacity',
                sel ? 'bg-ui-accent opacity-100' : 'opacity-0',
              )}
            />
          </button>
        );
      })}
    </div>
  );
};

export default Tabs;
