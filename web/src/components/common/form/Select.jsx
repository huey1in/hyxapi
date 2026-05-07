/*
 * Token-system Select dropdown — replaces native <select> with portal-rendered popup.
 */
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import ChevronDownIcon from '../../layout/headerbar/icons/ChevronDownIcon';

const Select = ({
  value,
  onChange,
  options = [],
  placeholder,
  className = '',
  width,
}) => {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
  const btnRef = useRef(null);
  const popRef = useRef(null);

  const current = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (
        btnRef.current && !btnRef.current.contains(e.target) &&
        popRef.current && !popRef.current.contains(e.target)
      ) setOpen(false);
    };
    const onScroll = () => setOpen(false);
    document.addEventListener('mousedown', onClick);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      document.removeEventListener('mousedown', onClick);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const popW = Math.max(r.width, 160);
    const margin = 8;
    let left = r.left;
    if (left + popW + margin > window.innerWidth) {
      left = window.innerWidth - popW - margin;
    }
    setPos({ top: r.bottom + 4, left, width: popW });
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type='button'
        onClick={() => setOpen((p) => !p)}
        style={{ ...(width ? { width } : {}), backgroundColor: 'var(--page-bg)' }}
        className={`inline-flex items-center justify-between gap-2 px-3 py-2 text-sm border border-ui-border rounded-xl text-ui-text outline-none hover:border-ui-text-3 transition-colors cursor-pointer ${className}`}
      >
        <span className='truncate'>{current?.label || placeholder || ''}</span>
        <ChevronDownIcon
          size={12}
          className={`text-ui-text-3 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && createPortal(
        <div
          ref={popRef}
          className='fixed z-[300] bg-ui-bg-elevated border border-ui-border rounded-xl shadow-xl p-1 max-h-72 overflow-y-auto animate-dropdown'
          style={{ top: pos.top, left: pos.left, width: pos.width }}
        >
          {options.map((o) => {
            const selected = o.value === value;
            return (
              <button
                key={String(o.value)}
                type='button'
                onClick={() => { onChange?.(o.value); setOpen(false); }}
                className={`flex items-center justify-between w-full px-3 py-2 text-sm rounded-lg transition-colors ${
                  selected
                    ? 'bg-ui-bg-subtle text-ui-text font-medium'
                    : 'text-ui-text hover:bg-ui-bg-subtle'
                }`}
              >
                <span className='truncate'>{o.label}</span>
                {selected && (
                  <svg width='12' height='12' viewBox='0 0 14 14' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
                    <path d='M2 7l3.5 3.5 6.5-7' />
                  </svg>
                )}
              </button>
            );
          })}
        </div>,
        document.body,
      )}
    </>
  );
};

export default Select;
