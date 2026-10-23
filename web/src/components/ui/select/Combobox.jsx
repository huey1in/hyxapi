/*
 * Combobox — 可搜索单选下拉
 *
 * 与 Select 接口一致，多一个搜索输入框过滤 options。
 */

import { useId, useRef, useState } from 'react';
import { ChevronDown, Check, Search } from 'lucide-react';
import { cn, FOCUS_RING } from '../tokens';
import { inputStyle } from '../input/Input';
import useDropdownState from './useDropdownState';
import useDropdownLayout from './useDropdownLayout';
import { selectorStyle } from './selectorSizing';

/**
 * @param {{ options?: (string | { value: string, label: string })[], value?: string, onChange?: (value: string) => void, placeholder?: string, searchPlaceholder?: string, emptyText?: string, disabled?: boolean, size?: number, width?: import('react').CSSProperties['width'] | 'full', id?: string, 'aria-label'?: string, popover?: boolean, placement?: 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end' }} props
 */
const Combobox = ({
  options = [],
  value,
  onChange,
  placeholder = '请选择',
  searchPlaceholder = '搜索…',
  emptyText = '无匹配项',
  disabled = false,
  size = 36,
  width,
  id,
  'aria-label': ariaLabel,
  popover = true,
  placement = 'bottom-start',
}) => {
  const [keyword, setKeyword] = useState('');
  const ref = useRef(null);
  const trigger = useRef(null);
  const [open, setOpen] = useDropdownState(ref, trigger);
  const menu = useRef(null);
  const content = useRef(null);
  const search = useRef(null);
  const menuId = useId();

  useDropdownLayout({ open, popover, trigger, menu, content, placement, minMenuWidth: 180, search });

  const list = options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o));
  const current = list.find((o) => o.value === value);
  const filtered = list.filter((o) => String(o.label || o.value).toLowerCase().includes(keyword.toLowerCase()));
  const s = inputStyle({ variant: 'admin', size });

  return (
    <div className='relative inline-flex' style={selectorStyle(width)} ref={ref} onKeyDownCapture={(event) => {
      if (event.key !== 'Escape' || !open) return;
      event.preventDefault(); event.stopPropagation(); setOpen(false); trigger.current?.focus({ preventScroll: true });
    }}>
      <button
        ref={trigger}
        id={id}
        type='button'
        aria-label={ariaLabel}
        aria-haspopup='true'
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        style={s.style}
        className={cn(
          s.className,
          'w-full min-w-0 inline-flex items-center justify-between gap-2 cursor-pointer text-left',
          open && 'border-ui-text-3',
          FOCUS_RING,
        )}
      >
        <span title={typeof current?.label === 'string' ? current.label : undefined} className={cn('min-w-0 flex-1 truncate', !current && 'text-ui-text-3')}>
          {current?.label ?? placeholder}
        </span>
        <ChevronDown size={14} className={cn('text-ui-text-3 shrink-0 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div
          ref={menu} id={menuId} popover={popover ? 'manual' : undefined}
          className={cn('border border-ui-border rounded-xl shadow-lg overflow-hidden animate-dropdown', !popover && ['absolute z-30 w-max min-w-full max-w-[min(320px,calc(100vw_-_16px))]', placement.endsWith('end') ? 'right-0' : 'left-0', placement.startsWith('top') ? 'bottom-full mb-1.5' : 'top-full mt-1.5'])}
          style={{ backgroundColor: 'var(--page-bg)', ...(popover ? { position: 'fixed', inset: 'auto', margin: 0, padding: 0 } : {}) }}
        >
          <div className='p-2 border-b border-ui-divider'>
            <div className='flex items-center gap-2 px-1'>
              <Search size={14} className='shrink-0 text-ui-text-3' />
              <input
                ref={search}
                size={1}
                autoFocus
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder={searchPlaceholder}
                className='min-w-0 flex-1 bg-transparent outline-hidden text-sm py-1 placeholder:text-ui-text-3'
              />
            </div>
          </div>
          <div ref={content} className='p-1 flex flex-col gap-0.5 max-h-72 overflow-y-auto'>
            {filtered.length === 0 ? (
              <div className='py-3 text-center text-xs text-ui-text-3'>{emptyText}</div>
            ) : (
              filtered.map((o) => {
                const sel = o.value === value;
                return (
                  <button
                    key={String(o.value)}
                    type='button'
                    onClick={() => { onChange?.(o.value); setOpen(false); setKeyword(''); }}
                    className={cn(
                      'flex items-center justify-between w-full px-2.5 py-1.5 rounded-lg text-left text-sm transition-colors',
                      sel ? 'bg-ui-bg-subtle text-ui-text' : 'text-ui-text hover:bg-ui-bg-subtle',
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
};

export default Combobox;
