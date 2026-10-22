/*
 * Select — 单选下拉
 *
 * options:    [{ value, label, disabled? }]
 * value:      当前值
 * onChange:   选中回调
 * placeholder: 未选中显示文字
 * prefix:     触发器内部左侧提示
 * width:      最大宽度；控件按内容收缩，默认上限 320px
 * size:       sm | md (默认) | lg
 * variant:    default（描边）| text（无边框文本）
 * placement:  bottom-start | bottom-end | top-start | top-end
 * popover:    使用顶层浮层，避免被弹窗或滚动容器裁剪
 * disabled
 * emptyText:  options 为空时显示
 */

import { useId, useRef } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { cn, FOCUS_RING } from '../tokens';
import { inputStyle } from '../input/Input';
import useDropdownState from './useDropdownState';
import useDropdownLayout from './useDropdownLayout';
import { selectorStyle } from './selectorSizing';

type SelectValue = string | number;
export interface SelectOption<V extends SelectValue> { value: V; label: ReactNode; disabled?: boolean }
interface SelectProps<V extends SelectValue> {
  options?: (SelectOption<V> | V)[];
  value?: V | null;
  onChange?: (value: V) => void;
  placeholder?: ReactNode;
  prefix?: ReactNode;
  emptyText?: ReactNode;
  placement?: 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end';
  popover?: boolean;
  disabled?: boolean;
  variant?: 'default' | 'text';
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
  popover = true,
  disabled = false,
  variant = 'default',
  size = 36,
  width,
  id,
  'aria-label': ariaLabel,
}: SelectProps<V>) {
  const ref = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useDropdownState(ref, trigger);
  const menu = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useDropdownLayout({ open, popover, trigger, menu, content, placement });

  const list = options.map((o) => (typeof o === 'object' ? o : { value: o, label: o }));
  const current = list.find((o) => o.value === value);
  const isTop = placement.startsWith('top');
  const isEnd = placement.endsWith('end');
  const s = inputStyle({ variant: 'admin', size });

  return (
    <div className='relative inline-flex' style={selectorStyle(width)} ref={ref} onKeyDown={(event) => {
      if (open && event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setOpen(false); trigger.current?.focus(); }
    }}>
      <button
        ref={trigger}
        type='button'
        id={id}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-haspopup='true'
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        style={variant === 'text' ? { ...s.style, paddingLeft: 0, paddingRight: 0 } : s.style}
        className={cn(
          variant === 'text' ? 'rounded-sm border-0 bg-transparent text-ui-text-2 transition-colors hover:text-ui-text disabled:opacity-50' : s.className,
          'w-full min-w-0 inline-flex items-center justify-between cursor-pointer text-left',
          prefix ? 'gap-1.5' : 'gap-2',
          open && (variant === 'text' ? 'text-ui-text' : 'border-ui-text-3'),
          FOCUS_RING,
          disabled && 'cursor-not-allowed',
        )}
      >
        {prefix && <span className='shrink-0 text-xs text-ui-text-3' aria-hidden='true'>{prefix}</span>}
        <span title={typeof current?.label === 'string' ? current.label : undefined} className={cn('min-w-0 flex-1 truncate', !current && 'text-ui-text-3')}>
          {current?.label ?? placeholder}
        </span>
        <ChevronDown size={14} className={cn('text-ui-text-3 shrink-0 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div
          ref={menu}
          id={menuId}
          popover={popover ? 'manual' : undefined}
          className={cn(
            'border border-ui-border rounded-xl shadow-lg overflow-hidden animate-dropdown',
            !popover && ['absolute z-30 w-max min-w-full max-w-[min(320px,calc(100vw_-_16px))]', isEnd ? 'right-0' : 'left-0', isTop ? 'bottom-full mb-1.5' : 'top-full mt-1.5'],
          )}
          style={{ backgroundColor: 'var(--page-bg)', ...(popover ? { position: 'fixed', inset: 'auto', margin: 0, padding: 0 } : {}) }}
        >
          <div ref={content} className='p-1 flex flex-col gap-0.5 max-h-72 overflow-y-auto ui-scrollbar'>
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
                    onClick={() => { onChange?.(o.value); setOpen(false); trigger.current?.focus({ preventScroll: true }); }}
                    className={cn(
                      'flex items-center justify-between w-full px-2.5 py-1.5 rounded-lg text-left text-sm transition-colors',
                      sel
                        ? 'bg-ui-bg-subtle text-ui-text'
                        : 'text-ui-text hover:bg-ui-bg-subtle',
                      o.disabled && 'opacity-50 cursor-not-allowed',
                    )}
                  >
                    <span title={typeof o.label === 'string' ? o.label : undefined} className='min-w-0 flex-1 truncate'>{o.label}</span>
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
