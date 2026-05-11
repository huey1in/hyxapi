/*
 * Accordion — 手风琴 / 可折叠面板
 *
 * items: [{ key, title, content, disabled? }]
 * defaultActiveKey: 初始展开的 key（数组 = 多选模式）
 * multiple: 默认 false，单选模式
 * onChange: (activeKeys[]) => void
 */

import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../tokens';

const Accordion = ({
  items = [],
  defaultActiveKey,
  multiple = false,
  onChange,
}) => {
  const initial = Array.isArray(defaultActiveKey)
    ? defaultActiveKey
    : defaultActiveKey != null
      ? [defaultActiveKey]
      : [];
  const [active, setActive] = useState(initial);

  const toggle = (key) => {
    const isOpen = active.includes(key);
    let next;
    if (multiple) {
      next = isOpen ? active.filter((k) => k !== key) : [...active, key];
    } else {
      next = isOpen ? [] : [key];
    }
    setActive(next);
    onChange?.(next);
  };

  return (
    <div className='flex flex-col divide-y divide-ui-divider border border-ui-border rounded-2xl overflow-hidden bg-[var(--page-bg)]'>
      {items.map((it) => {
        const open = active.includes(it.key);
        return (
          <div key={it.key}>
            <button
              type='button'
              disabled={it.disabled}
              onClick={() => !it.disabled && toggle(it.key)}
              className={cn(
                'w-full flex items-center justify-between gap-3 px-4 py-3 text-left text-sm transition-colors',
                it.disabled ? 'text-ui-text-3 cursor-not-allowed' : 'text-ui-text hover:bg-ui-bg-subtle/60',
              )}
            >
              <span className='font-medium'>{it.title}</span>
              <ChevronDown size={16} className={cn('flex-shrink-0 text-ui-text-2 transition-transform', open && 'rotate-180')} />
            </button>
            <div
              className={cn('grid transition-[grid-template-rows] duration-200', open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}
            >
              <div className='overflow-hidden'>
                <div className='px-4 pb-3 text-sm text-ui-text-2 leading-relaxed'>{it.content}</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default Accordion;
