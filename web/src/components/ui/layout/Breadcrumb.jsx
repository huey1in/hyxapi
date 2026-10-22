/*
 * Breadcrumb — 面包屑
 *
 * items: [{ label?, href?, onClick?, content? }]
 * content: 自定义内容，可用于带下拉菜单的面包屑。
 * separator: 节点，默认右箭头。
 *
 * 最后一项渲染为当前页（无链接、加深色）。
 */

import React from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '../tokens';

/** @param {{ items?: { label?: React.ReactNode, content?: React.ReactNode, href?: string, onClick?: React.MouseEventHandler<HTMLButtonElement> }[], separator?: React.ReactNode, className?: string, 'aria-label'?: string }} props */
const Breadcrumb = ({ items = [], separator, className, 'aria-label': ariaLabel }) => {
  const sep = separator ?? <ChevronRight size={12} className='text-ui-text-3' />;
  return (
    <nav aria-label={ariaLabel} className={cn('flex items-center gap-1.5 text-xs text-ui-text-2 min-w-0', className)}>
      {items.map((it, i) => {
        const last = i === items.length - 1;
        const content = it.content !== undefined ? it.content : last ? (
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
          <div key={i} className='inline-flex min-w-0 max-w-full items-center gap-1.5'>
            {i > 0 && <span aria-hidden='true' className='flex shrink-0 items-center'>{sep}</span>}
            {content}
          </div>
        );
      })}
    </nav>
  );
};

export default Breadcrumb;
