/*
 * Combobox — 可搜索单选下拉
 *
 * 与 Select 接口一致，多一个搜索输入框过滤 options。
 */

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Check, Search } from 'lucide-react';
import { cn, FOCUS_RING } from '../tokens';
import { inputStyle, resolveWidth } from '../input/Input';
import useDropdownState from './useDropdownState';

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
}) => {
  const [keyword, setKeyword] = useState('');
  const ref = useRef(null);
  const [open, setOpen] = useDropdownState(ref);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
    };
  }, [setOpen]);

  const list = options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o));
  const current = list.find((o) => o.value === value);
  const filtered = list.filter((o) => String(o.label || o.value).toLowerCase().includes(keyword.toLowerCase()));
  const w = resolveWidth(width);
  const s = inputStyle({ variant: 'admin', size });

  return (
    <div className={cn('relative inline-flex', w.className)} style={w.style} ref={ref}>
      <button
        type='button'
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        style={s.style}
        className={cn(
          s.className,
          'w-full inline-flex items-center justify-between gap-2 cursor-pointer text-left',
          open && 'border-ui-text-3',
          FOCUS_RING,
        )}
      >
        <span className={cn('truncate', !current && 'text-ui-text-3')}>
          {current?.label ?? placeholder}
        </span>
        <ChevronDown size={14} className={cn('text-ui-text-3 shrink-0 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div
          className='absolute z-30 top-full mt-1.5 left-0 right-0 min-w-full border border-ui-border rounded-xl shadow-lg overflow-hidden animate-dropdown'
          style={{ backgroundColor: 'var(--page-bg)' }}
        >
          <div className='p-2 border-b border-ui-divider'>
            <div className='flex items-center gap-2 px-1'>
              <Search size={14} className='text-ui-text-3' />
              <input
                autoFocus
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder={searchPlaceholder}
                className='flex-1 bg-transparent outline-hidden text-sm py-1 placeholder:text-ui-text-3'
              />
            </div>
          </div>
          <div className='p-1 flex flex-col gap-0.5 max-h-72 overflow-y-auto ui-scrollbar'>
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
};

export default Combobox;
