/*
 * Select — 单选下拉
 *
 * options:    [{ value, label, disabled? }]
 * value:      当前值
 * onChange:   选中回调
 * placeholder: 未选中显示文字
 * prefix:     触发器内部左侧提示
 * size:       sm | md (默认) | lg
 * placement:  bottom-start | bottom-end | top-start | top-end
 * disabled
 * emptyText:  options 为空时显示
 */

import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { cn, FOCUS_RING } from '../tokens';
import { inputStyle, resolveWidth } from '../input/Input';

type SelectValue = string | number;
export interface SelectOption<V extends SelectValue> { value: V; label: ReactNode; disabled?: boolean }
export interface SelectProps<V extends SelectValue> {
  options?: (SelectOption<V> | V)[];
  value?: V | null;
  onChange?: (value: V) => void;
  placeholder?: ReactNode;
  prefix?: ReactNode;
  emptyText?: ReactNode;
  placement?: 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end';
  disabled?: boolean;
  size?: number;
  width?: CSSProperties['width'] | 'full';
  id?: string;
  'aria-label'?: string;
}

function Select<V extends SelectValue>({
  options = [],
  value,
  onChange,
  placeholder = '请选择',
  prefix,
  emptyText = '无可用选项',
  placement = 'bottom-start',
  disabled = false,
  size = 36,
  width,
  id,
  'aria-label': ariaLabel,
}: SelectProps<V>) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && e.target instanceof Node && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
    };
  }, []);

  const list = options.map((o) => (typeof o === 'object' ? o : { value: o, label: o }));
  const current = list.find((o) => o.value === value);
  const isTop = placement.startsWith('top');
  const isEnd = placement.endsWith('end');
  const w = resolveWidth(width);
  const s = inputStyle({ variant: 'admin', size });

  return (
    <div className={cn('relative inline-flex', w.className)} style={w.style} ref={ref} onKeyDown={(event) => {
      if (open && event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setOpen(false); trigger.current?.focus(); }
    }}>
      <button
        ref={trigger}
        type='button'
        id={id}
        aria-label={ariaLabel}
        aria-expanded={open}
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        style={s.style}
        className={cn(
          s.className,
          'w-full inline-flex items-center justify-between cursor-pointer text-left',
          prefix ? 'gap-1.5' : 'gap-2',
          open && 'border-ui-text-3',
          FOCUS_RING,
          disabled && 'cursor-not-allowed',
        )}
      >
        {prefix && <span className='shrink-0 text-xs text-ui-text-3' aria-hidden='true'>{prefix}</span>}
        <span className={cn('truncate', prefix && 'min-w-0 flex-1', !current && 'text-ui-text-3')}>
          {current?.label ?? placeholder}
        </span>
        <ChevronDown size={14} className={cn('text-ui-text-3 shrink-0 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div
          className={cn(
            'absolute z-30 min-w-full border border-ui-border rounded-xl shadow-lg overflow-hidden animate-dropdown',
            isEnd ? 'right-0' : 'left-0',
            isTop ? 'bottom-full mb-1.5' : 'top-full mt-1.5',
          )}
          style={{ backgroundColor: 'var(--page-bg)' }}
        >
          <div className='p-1 flex flex-col gap-0.5 max-h-72 overflow-y-auto ui-scrollbar'>
            {list.length === 0 ? (
              <div className='px-3 py-3 text-center text-xs text-ui-text-3'>{emptyText}</div>
            ) : (
              list.map((o) => {
                const sel = o.value === value;
                return (
                  <button
                    key={String(o.value)}
                    type='button'
                    disabled={o.disabled}
                    onClick={() => { onChange?.(o.value); setOpen(false); }}
                    className={cn(
                      'flex items-center justify-between w-full px-2.5 py-1.5 rounded-lg text-sm transition-colors',
                      sel
                        ? 'bg-ui-bg-subtle text-ui-text'
                        : 'text-ui-text hover:bg-ui-bg-subtle',
                      o.disabled && 'opacity-50 cursor-not-allowed',
                    )}
                  >
                    <span className='truncate'>{o.label}</span>
                    {sel && <Check size={14} className='shrink-0 text-ui-text-2' />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default Select;
