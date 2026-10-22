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
 * popover:    使用顶层浮层，避免被弹窗或滚动容器裁剪
 * disabled
 * emptyText:  options 为空时显示
 */

import { useId, useLayoutEffect, useRef } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { cn, FOCUS_RING } from '../tokens';
import { inputStyle, resolveWidth } from '../input/Input';
import useDropdownState from './useDropdownState';

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
  popover?: boolean;
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
  popover = false,
  disabled = false,
  size = 36,
  width,
  id,
  'aria-label': ariaLabel,
}: SelectProps<V>) {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useDropdownState(ref);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useLayoutEffect(() => {
    const panel = menu.current, items = content.current, button = trigger.current;
    if (!open || !popover || !panel || !items || !button) return;
    panel.showPopover();
    const position = () => {
      const bounds = button.getBoundingClientRect();
      const viewport = window.visualViewport;
      const left = (viewport?.offsetLeft ?? 0) + 8;
      const top = (viewport?.offsetTop ?? 0) + 8;
      const right = left + (viewport?.width ?? window.innerWidth) - 16;
      const bottom = top + (viewport?.height ?? window.innerHeight) - 16;
      const width = Math.min(bounds.width, right - left);
      panel.style.width = `${width}px`;
      const height = Math.min(items.scrollHeight, 288) + 2;
      const above = Math.max(0, bounds.top - top - 6);
      const below = Math.max(0, bottom - bounds.bottom - 6);
      const upwards = placement.startsWith('top') ? above >= height || above > below : below < height && above > below;
      const maxHeight = Math.max(0, Math.min(288, (upwards ? above : below) - 2));
      items.style.maxHeight = `${maxHeight}px`;
      panel.style.left = `${Math.max(left, Math.min(placement.endsWith('end') ? bounds.right - width : bounds.left, right - width))}px`;
      panel.style.top = `${upwards ? bounds.top - 6 - Math.min(items.scrollHeight, maxHeight) - 2 : bounds.bottom + 6}px`;
    };
    position();
    const observer = new ResizeObserver(position);
    observer.observe(button);
    observer.observe(items);
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, true);
    document.addEventListener('animationend', position, true);
    window.visualViewport?.addEventListener('resize', position);
    window.visualViewport?.addEventListener('scroll', position);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', position);
      window.removeEventListener('scroll', position, true);
      document.removeEventListener('animationend', position, true);
      window.visualViewport?.removeEventListener('resize', position);
      window.visualViewport?.removeEventListener('scroll', position);
      if (panel.matches(':popover-open')) panel.hidePopover();
    };
  }, [open, popover, placement]);

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
        aria-controls={open ? menuId : undefined}
        aria-haspopup='true'
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
          ref={menu}
          id={menuId}
          popover={popover ? 'manual' : undefined}
          className={cn(
            'border border-ui-border rounded-xl shadow-lg overflow-hidden animate-dropdown',
            !popover && ['absolute z-30 min-w-full', isEnd ? 'right-0' : 'left-0', isTop ? 'bottom-full mb-1.5' : 'top-full mt-1.5'],
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
                    <span className='min-w-0 flex-1 truncate'>{o.label}</span>
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
