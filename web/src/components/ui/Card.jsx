/*
 * Card — 统一卡片容器
 *
 * variant: plain (页面背景 + 边框) | elevated (浅色背景) | outlined (透明 + 边框)
 * padding: none | sm | md | lg
 * radius:  md | lg | full
 *
 * 使用：
 *   <Card>...</Card>
 *   <Card variant='outlined' padding='lg'>...</Card>
 */

import React from 'react';
import { cn } from './tokens';

const VARIANT = {
  plain: 'border border-ui-border bg-[var(--page-bg)]',
  elevated: 'border border-ui-border bg-ui-bg-elevated shadow-sm',
  outlined: 'border border-ui-border bg-transparent',
  filled: 'bg-ui-bg-subtle',
};

const PADDING = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
};

const RADIUS = {
  md: 'rounded-xl',
  lg: 'rounded-2xl',
  full: 'rounded-3xl',
};

const Card = React.forwardRef(function Card(
  {
    children,
    variant = 'plain',
    padding = 'md',
    radius = 'lg',
    className,
    ...rest
  },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        VARIANT[variant],
        PADDING[padding],
        RADIUS[radius],
        'overflow-hidden',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
});

export default Card;
