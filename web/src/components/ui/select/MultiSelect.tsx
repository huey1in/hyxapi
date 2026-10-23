/*
 * MultiSelect — 多选下拉
 *
 * options:    [{ value, label }]
 * value:      已选值数组
 * onChange:   完整新数组
 * placeholder: 未选时显示
 * searchable: 是否带搜索（默认 true）
 * width:      最大宽度；控件按内容收缩，默认上限 320px
 */

import { useEffect, useId, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Check, Search, X } from 'lucide-react';
import { cn, FOCUS_RING } from '../tokens';
import { inputStyle } from '../input/Input';
import useDropdownState from './useDropdownState';
import useDropdownLayout from './useDropdownLayout';
import { selectorStyle } from './selectorSizing';

type OptionValue = string | number;
type MultiSelectOption<T extends OptionValue = string> = T | { value: T; label: ReactNode };
interface MultiSelectProps<T extends OptionValue = string> {
  options?: MultiSelectOption<T>[];
  value?: T[];
  onChange?: (value: T[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  searchable?: boolean;
  disabled?: boolean;
  size?: number;
  width?: CSSProperties['width'] | 'full';
  id?: string;
  'aria-label'?: string;
  popover?: boolean;
}

function normalizeOption<T extends OptionValue>(option: MultiSelectOption<T>): { value: T; label: ReactNode } {
  if (typeof option === 'object') return option;
  return { value: option, label: String(option) };
}

function MultiSelect<T extends OptionValue = string>({
  options = [],
  value = [],
  onChange,
  placeholder,
  searchPlaceholder,
  emptyText,
  searchable = true,
  disabled = false,
  size = 36,
  width,
  id,
  'aria-label': ariaLabel,
  popover = true,
}: MultiSelectProps<T>) {
  const { t } = useTranslation();
  const [keyword, setKeyword] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useDropdownState(ref, trigger);
  const menu = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const menuId = useId();

  useDropdownLayout({ open, popover, trigger, menu, content, placement: 'bottom-end', minMenuWidth: searchable ? 180 : 0, search });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
    };
  }, [setOpen]);

  const list = options.map(normalizeOption<T>);
  const filtered = list.filter((o) => String(o.label || o.value).toLowerCase().includes(keyword.toLowerCase()));
  const selectedSet = new Set(value);

  const toggle = (v: T) => {
    const next = selectedSet.has(v) ? value.filter((x) => x !== v) : [...value, v];
    onChange?.(next);
  };

  const labelOfVal = (v: T) => list.find((o) => o.value === v)?.label || String(v);
  const s = inputStyle({ variant: 'admin', size });
  /* MultiSelect 高度可随 tag 增长，height 改为 min-height */
  const { height, ...flatStyle } = s.style;

  return (
    <div className='relative inline-flex' style={selectorStyle(width)} ref={ref}
      onKeyDownCapture={(event) => {
        if (event.key !== 'Escape' || !open) return;
        event.preventDefault(); event.stopPropagation();
        setOpen(false); trigger.current?.focus({ preventScroll: true });
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
        style={{ ...flatStyle, minHeight: height, paddingTop: 4, paddingBottom: 4 }}
        className={cn(
          s.className,
          'w-full min-w-0 inline-flex items-center justify-between gap-2 cursor-pointer text-left',
          open && 'border-ui-text-3',
          FOCUS_RING,
        )}
      >
        <span className='flex flex-wrap items-center gap-1 min-w-0'>
          {value.length === 0 && <span className='min-w-0 truncate text-ui-text-3 text-sm'>{placeholder ?? t('Please select')}</span>}
          {value.slice(0, 4).map((v) => (
            <span key={String(v)} className='inline-flex min-w-0 max-w-full items-center gap-1 px-1.5 py-0.5 text-[11px] rounded-md bg-ui-bg-subtle border border-ui-border text-ui-text-2'>
              <span className='min-w-0 truncate'>{labelOfVal(v)}</span>
              <span
                role='button'
                onClick={(e) => { e.stopPropagation(); toggle(v); }}
                className='shrink-0 cursor-pointer hover:text-ui-text'
              >
                <X size={10} />
              </span>
            </span>
          ))}
          {value.length > 4 && <span className='text-[11px] text-ui-text-3'>+{value.length - 4}</span>}
        </span>
        <ChevronDown size={14} className={cn('text-ui-text-3 shrink-0 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div
          ref={menu} id={menuId} popover={popover ? 'manual' : undefined}
          className={cn('border border-ui-border rounded-xl shadow-lg overflow-hidden animate-dropdown', !popover && 'absolute z-30 top-full mt-1.5 right-0 w-max min-w-full max-w-[min(320px,calc(100vw_-_16px))]')}
          style={{ backgroundColor: 'var(--page-bg)', ...(popover ? { position: 'fixed', inset: 'auto', margin: 0, padding: 0 } : {}) }}
        >
          {searchable && (
            <div className='p-2 border-b border-ui-divider'>
              <div className='flex items-center gap-2 px-1'>
                <Search size={14} className='shrink-0 text-ui-text-3' />
                <input
                  ref={search}
                  size={1}
                  autoFocus
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder={searchPlaceholder ?? t('Search…')}
                  className='min-w-0 flex-1 bg-transparent outline-hidden text-sm py-1 placeholder:text-ui-text-3'
                />
              </div>
            </div>
          )}
          <div ref={content} className='p-1 flex flex-col gap-0.5 max-h-72 overflow-y-auto'>
            {filtered.length === 0 ? (
              <div className='py-3 text-center text-xs text-ui-text-3'>{emptyText ?? t('No matches')}</div>
            ) : (
              filtered.map((o) => {
                const sel = selectedSet.has(o.value);
                return (
                  <button
                    key={String(o.value)}
                    type='button'
                    onClick={() => toggle(o.value)}
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

export default MultiSelect;
