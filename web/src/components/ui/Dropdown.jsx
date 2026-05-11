/*
 * Dropdown — 通用下拉菜单（按钮触发，菜单项执行操作而非选择值）
 *
 * 与 Select 区别：
 *   Select  — 选择 value（菜单项是 options）
 *   Dropdown — 触发 action（菜单项是带 onClick 的项）
 *
 * 使用：
 *   <Dropdown
 *     trigger={<IconButton icon={MoreHorizontal} />}
 *     items={[
 *       { label: '编辑', onClick: ... },
 *       { label: '删除', danger: true, onClick: ... },
 *     ]}
 *   />
 */

import React, { useEffect, useRef, useState } from 'react';
import { cn } from './tokens';

const Dropdown = ({ trigger, items = [], placement = 'bottom-end', className }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const isEnd = placement.endsWith('end');
  const isTop = placement.startsWith('top');

  return (
    <div className={cn('relative inline-block', className)} ref={ref}>
      <span onClick={() => setOpen((o) => !o)}>{trigger}</span>
      {open && (
        <div
          className={cn(
            'absolute z-30 min-w-[160px] border border-ui-border rounded-xl shadow-lg overflow-hidden animate-dropdown',
            isEnd ? 'right-0' : 'left-0',
            isTop ? 'bottom-full mb-1' : 'top-full mt-1',
          )}
          style={{ backgroundColor: 'var(--page-bg)' }}
        >
          {items.map((it, i) => (
            <button
              key={i}
              type='button'
              onClick={() => {
                if (!it.disabled) {
                  it.onClick?.();
                  setOpen(false);
                }
              }}
              disabled={it.disabled || it.loading}
              className={cn(
                'w-full text-left px-3 py-2.5 text-sm transition-colors disabled:opacity-50',
                it.danger
                  ? 'text-ui-danger hover:bg-ui-danger-bg'
                  : it.primary
                    ? 'text-ui-brand font-medium hover:bg-ui-bg-subtle'
                    : 'text-ui-text-2 hover:text-ui-text hover:bg-ui-bg-subtle',
              )}
            >
              {it.label}
              {it.loading && '...'}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default Dropdown;
