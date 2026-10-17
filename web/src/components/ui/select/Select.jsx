/*
 * Select — 单选下拉
 *
 * options:    [{ value, label, disabled? }]
 * value:      当前值
 * onChange:   选中回调
 * placeholder: 未选中显示文字
 * size:       sm | md (默认) | lg
 * placement:  bottom-start | bottom-end | top-start | top-end
 * disabled
 * emptyText:  options 为空时显示
 */

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { cn, FOCUS_RING } from '../tokens';
import { inputStyle, resolveWidth } from '../input/Input';

const Select = ({
  options = [],
  value,
  onChange,
  placeholder = '请选择',
  emptyText = '无可用选项',
  placement = 'bottom-start',
  disabled = false,
  size = 36,
  width,
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onDocClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const list = options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o));
  const current = list.find((o) => o.value === value);
  const isTop = placement.startsWith('top');
  const isEnd = placement.endsWith('end');
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
          disabled && 'cursor-not-allowed',
        )}
      >
        <span className={cn('truncate', !current && 'text-ui-text-3')}>
          {current?.label ?? placeholder}
        </span>
        <ChevronDown size={14} className={cn('text-ui-text-3 flex-shrink-0 transition-transform', open && 'rotate-180')} />
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
                    {sel && <Check size={14} className='flex-shrink-0 text-ui-text-2' />}
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

export default Select;
