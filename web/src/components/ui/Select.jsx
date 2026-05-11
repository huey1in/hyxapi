/*
 * Select — 统一下拉选择器
 *
 * 基于自定义实现，portal-aware（适合在 overflow-hidden 容器中使用）
 * 不再使用原生 <select>，所有选择器都走这一个组件
 *
 * 使用：
 *   <Select options={[{value, label}]} value={v} onChange={setV} />
 *   <Select options={[{value, label}]} value={v} onChange={setV} portal placement='bottom-end' />
 */

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from './tokens';

const Select = ({
  options = [],
  value,
  onChange,
  placeholder = '请选择',
  emptyText = '无可用选项',
  placement = 'bottom-start',
  portal = false,
  popupClassName = 'w-52',
  triggerClassName,
  className,
  disabled = false,
  size = 'md',
  renderTrigger,
}) => {
  const [open, setOpen] = useState(false);
  const [popupPos, setPopupPos] = useState({});
  const ref = useRef(null);
  const btnRef = useRef(null);
  const popupRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && ref.current.contains(e.target)) return;
      if (portal && popupRef.current && popupRef.current.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', onKey);
    };
  }, [portal]);

  useLayoutEffect(() => {
    if (!portal || !open || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const POPUP_W = 224;
    const margin = 8;
    let left = placement.endsWith('end') ? r.right - POPUP_W : r.left;
    if (left + POPUP_W + margin > window.innerWidth) left = window.innerWidth - POPUP_W - margin;
    if (left < margin) left = margin;
    setPopupPos(
      placement.startsWith('top')
        ? { left, bottom: window.innerHeight - r.top + 8 }
        : { left, top: r.bottom + 8 },
    );
  }, [open, portal, placement]);

  const list = (options || []).map((o) =>
    typeof o === 'string' ? { value: o, label: o } : o,
  );
  const current = list.find((o) => o.value === value);

  const handleToggle = () => !disabled && setOpen((o) => !o);
  const handleSelect = (v) => {
    onChange?.(v);
    setOpen(false);
  };

  const sizeClass =
    size === 'sm' ? 'px-2.5 py-1 text-xs' : size === 'lg' ? 'px-4 py-2.5 text-base' : 'px-3 py-2 text-sm';

  const trigger = renderTrigger ? (
    renderTrigger({ open, current, ref: btnRef, onClick: handleToggle, disabled })
  ) : (
    <button
      ref={btnRef}
      type='button'
      onClick={handleToggle}
      disabled={disabled}
      className={cn(
        'inline-flex items-center justify-between gap-2 w-full bg-transparent border border-ui-border rounded-xl text-ui-text hover:border-ui-text-3 transition-colors',
        sizeClass,
        disabled && 'opacity-50 cursor-not-allowed',
        triggerClassName,
      )}
    >
      <span className={cn('truncate', !current && 'text-ui-text-3')}>
        {current?.label ?? placeholder}
      </span>
      <ChevronDown
        size={14}
        className={cn('text-ui-text-3 flex-shrink-0 transition-transform', open && 'rotate-180')}
      />
    </button>
  );

  const panelInner = (
    <div className='px-2 py-2 flex flex-col gap-0.5 max-h-72 overflow-y-auto'>
      {list.length === 0 ? (
        <div className='px-3 py-3 text-center text-xs text-ui-text-3'>{emptyText}</div>
      ) : (
        list.map((o) => {
          const sel = o.value === value;
          return (
            <button
              key={String(o.value)}
              type='button'
              onClick={() => handleSelect(o.value)}
              className={cn(
                'flex items-center justify-between w-full px-3 py-2 rounded-xl text-sm transition-colors',
                sel
                  ? 'bg-ui-bg-subtle text-ui-text font-medium'
                  : 'text-ui-text hover:bg-ui-bg-subtle',
              )}
            >
              <span className='truncate'>{o.label}</span>
              {sel && <Check size={14} className='flex-shrink-0' />}
            </button>
          );
        })
      )}
    </div>
  );

  let panel = null;
  if (open) {
    if (portal) {
      panel = createPortal(
        <div
          ref={popupRef}
          className={cn(
            'fixed border border-ui-border rounded-2xl shadow-xl overflow-hidden z-[200] animate-dropdown',
            popupClassName,
          )}
          style={{ ...popupPos, backgroundColor: 'var(--page-bg)' }}
        >
          {panelInner}
        </div>,
        document.body,
      );
    } else {
      const isTop = placement.startsWith('top');
      const isEnd = placement.endsWith('end');
      panel = (
        <div
          ref={popupRef}
          className={cn(
            'absolute',
            isEnd ? 'right-0' : 'left-0',
            isTop ? 'bottom-full mb-2' : 'top-full mt-2',
            'border border-ui-border rounded-2xl shadow-xl overflow-hidden z-50 animate-dropdown',
            popupClassName,
          )}
          style={{ backgroundColor: 'var(--page-bg)' }}
        >
          {panelInner}
        </div>
      );
    }
  }

  return (
    <div className={cn('relative', className)} ref={ref}>
      {trigger}
      {panel}
    </div>
  );
};

export default Select;
