/*
 * Card — 通用卡片
 *
 * variant:
 *   plain    page-bg + 边框（默认，与 page-bg 同色）
 *   filled   bg-ui-bg-subtle 实心
 *
 * noPadding: 取消默认 p-4（用于自带 padding 的子内容，如 Table）
 * interactive: 'hover' | 'lift' （hover 反馈；lift 还有 shadow-md）
 * header / footer: 可选 slot，自带内边距
 */

import React from 'react';
import { cn } from '../tokens';

const VARIANT = {
  plain:  'border border-ui-border bg-[var(--page-bg)]',
  filled: 'bg-ui-bg-subtle',
};

const INTERACTIVE = {
  hover: 'cursor-pointer hover:border-ui-text-3 hover:bg-ui-bg-subtle/40 transition-colors',
  lift:  'cursor-pointer hover:border-ui-text-3 hover:bg-ui-bg-subtle/40 hover:shadow-md transition-all',
};

const Card = React.forwardRef(function Card(
  {
    children,
    variant = 'plain',
    interactive,
    onClick,
    header,
    footer,
    noPadding = false,
    ...rest
  },
  ref,
) {
  const hasSections = header || footer;
  const Component = onClick ? 'button' : 'div';

  return (
    <Component
      ref={ref}
      onClick={onClick}
      type={Component === 'button' ? 'button' : undefined}
      className={cn(
        VARIANT[variant],
        'rounded-2xl',
        hasSections || noPadding ? '' : 'p-4',
        'overflow-hidden',
        INTERACTIVE[interactive],
        Component === 'button' && 'text-left w-full',
      )}
      {...rest}
    >
      {header && <div className='px-4 pt-4'>{header}</div>}
      {hasSections ? <div className={noPadding ? '' : 'p-4'}>{children}</div> : children}
      {footer && <div className='px-4 pb-4'>{footer}</div>}
    </Component>
  );
});

export default Card;

