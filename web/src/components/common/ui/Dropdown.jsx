/*
Copyright (C) 2025 QuantumNous

Shared Dropdown primitive — unifies the LanguageSelector / PrefDropdown /
SearchModal / Token / SelectChip implementations into one component.

Usage:
  <Dropdown
    options={[{ value, label }]}
    value={value}
    onChange={fn}
    placeholder='Select…'
    emptyText='No options'
    placement='bottom-start'   // 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end'
    portal={false}             // render the popup via a portal — needed when the
                                // trigger sits inside an `overflow-hidden` parent
    popupClassName='w-52'
    triggerClassName=''
    renderTrigger={fn?}        // ({ open, current, ref, onClick }) => ReactNode
    showCheck={true}
  />
*/

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';

const Dropdown = ({
  options = [],
  value,
  onChange,
  placeholder = '',
  emptyText = '',
  placement = 'bottom-start',
  portal = false,
  popupClassName = 'w-52',
  triggerClassName = '',
  renderTrigger,
  showCheck = true,
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

  const handleToggle = () => setOpen((o) => !o);
  const handleSelect = (v) => {
    onChange?.(v);
    setOpen(false);
  };

  const trigger = renderTrigger ? (
    renderTrigger({ open, current, ref: btnRef, onClick: handleToggle })
  ) : (
    // Dropdown 默认触发器：组件内部实现，业务方通常通过 renderTrigger 覆盖
    <button
      ref={btnRef}
      type='button'
      onClick={handleToggle}
      className={`inline-flex items-center justify-between gap-2 px-3 py-2 text-sm bg-transparent border border-ui-border rounded-xl text-ui-text hover:border-ui-text-3 transition-colors ${triggerClassName}`}
    >
      <span className={`truncate ${current ? '' : 'text-ui-text-3'}`}>
        {current?.label ?? placeholder}
      </span>
      <ChevronDown
        size={14}
        className={`text-ui-text-3 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
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
            // Dropdown 选项项：Dropdown 视觉系内部实现，业务方使用 <Dropdown> 即可
            <button
              key={String(o.value)}
              type='button'
              onClick={() => handleSelect(o.value)}
              className={`flex items-center justify-between w-full px-3 py-2 rounded-xl text-sm transition-colors ${
                sel
                  ? 'bg-ui-bg-subtle text-ui-text font-medium'
                  : 'text-ui-text hover:bg-ui-bg-subtle'
              }`}
            >
              <span className='truncate'>{o.label}</span>
              {showCheck && sel && (
                <svg
                  width='14'
                  height='14'
                  viewBox='0 0 14 14'
                  fill='none'
                  stroke='currentColor'
                  strokeWidth='2'
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  className='flex-shrink-0'
                >
                  <path d='M2 7l3.5 3.5 6.5-7' />
                </svg>
              )}
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
        // Dropdown popover 浮层（portal），不是卡片，Dropdown 视觉系内部实现
        <div
          ref={popupRef}
          className={`fixed border border-ui-border rounded-2xl shadow-xl overflow-hidden z-[200] animate-dropdown ${popupClassName}`}
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
        // Dropdown popover 浮层（absolute），不是卡片，Dropdown 视觉系内部实现
        <div
          ref={popupRef}
          className={`absolute ${isEnd ? 'right-0' : 'left-0'} ${
            isTop ? 'bottom-full mb-2' : 'top-full mt-2'
          } border border-ui-border rounded-2xl shadow-xl overflow-hidden z-50 animate-dropdown ${popupClassName}`}
          style={{ backgroundColor: 'var(--page-bg)' }}
        >
          {panelInner}
        </div>
      );
    }
  }

  return (
    <div className='relative' ref={ref}>
      {trigger}
      {panel}
    </div>
  );
};

export default Dropdown;
