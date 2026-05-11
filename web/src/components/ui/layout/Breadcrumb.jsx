/*
 * Breadcrumb — 面包屑
 *
 * items: [{ label, href?, onClick? }]
 * separator: 节点，默认 '/'
 *
 * 最后一项渲染为当前页（无链接、加深色）。
 */

import React from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '../tokens';

const Breadcrumb = ({ items = [], separator }) => {
  const sep = separator ?? <ChevronRight size={12} className='text-ui-text-3' />;
  return (
    <nav className='flex items-center gap-1.5 text-xs text-ui-text-2 min-w-0'>
      {items.map((it, i) => {
        const last = i === items.length - 1;
        const content = last ? (
          <span className='text-ui-text font-semibold truncate max-w-[200px]'>{it.label}</span>
        ) : it.href ? (
          <a href={it.href} className='hover:text-ui-text truncate max-w-[160px]'>{it.label}</a>
        ) : (
          <button
            type='button'
            onClick={it.onClick}
            className={cn('hover:text-ui-text truncate max-w-[160px]', it.onClick ? 'cursor-pointer' : 'cursor-default')}
          >
            {it.label}
          </button>
        );
        return (
          <React.Fragment key={i}>
            {content}
            {!last && <span className='flex items-center'>{sep}</span>}
          </React.Fragment>
        );
      })}
    </nav>
  );
};

export default Breadcrumb;
