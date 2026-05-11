/*
 * Card — 全站唯一卡片组件
 *
 * variant:
 *   plain     页面背景 + 边框（默认）
 *   elevated  浅色背景 + 边框 + 轻阴影
 *   outlined  透明 + 边框
 *   filled    bg-ui-bg-subtle 实心
 *
 * padding: none | sm | md | lg
 * radius:  md (rounded-xl) | lg (rounded-2xl 默认) | xl (rounded-3xl) | xxl (rounded-[20px]) | full
 * interactive: false | true (hover 边框/底色) | 'lift' (再加 hover:shadow-md)
 * tone: default (中性 hover) | accent (hover:border-ui-brand) — 仅当 interactive 时生效
 * onClick: 提供则自动作为 button
 * header / footer: 可选 slot
 *
 * 业务方禁止传 className 重写 border/bg/radius/shadow，只允许布局类。
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
  none: '',
  md: 'rounded-xl',
  lg: 'rounded-2xl',
  xl: 'rounded-3xl',
  xxl: 'rounded-[20px]',
  full: 'rounded-full',
};

const INTERACTIVE_BASE = 'cursor-pointer transition-all';
const INTERACTIVE_TONE = {
  default: 'hover:border-ui-text-3 hover:bg-ui-bg-subtle/40',
  accent: 'hover:border-ui-brand',
};
const INTERACTIVE_LIFT = 'hover:shadow-md';

const Card = React.forwardRef(function Card(
  {
    children,
    variant = 'plain',
    padding = 'md',
    radius = 'lg',
    interactive = false,
    tone = 'default',
    onClick,
    header,
    footer,
    headerClassName,
    footerClassName,
    bodyClassName,
    className,
    as,
    ...rest
  },
  ref,
) {
  const hasSections = header || footer;
  const Component = as || (onClick ? 'button' : 'div');
  const isInteractive = interactive || !!onClick;

  return (
    <Component
      ref={ref}
      onClick={onClick}
      type={Component === 'button' ? 'button' : undefined}
      className={cn(
        VARIANT[variant],
        RADIUS[radius],
        hasSections ? '' : PADDING[padding],
        'overflow-hidden',
        isInteractive && INTERACTIVE_BASE,
        isInteractive && INTERACTIVE_TONE[tone],
        interactive === 'lift' && INTERACTIVE_LIFT,
        Component === 'button' && 'text-left w-full',
        className,
      )}
      {...rest}
    >
      {header && (
        <div className={cn('px-4 py-3 border-b border-ui-border', headerClassName)}>{header}</div>
      )}
      {hasSections ? (
        <div className={cn(PADDING[padding], bodyClassName)}>{children}</div>
      ) : (
        children
      )}
      {footer && (
        <div className={cn('px-4 py-3 border-t border-ui-border', footerClassName)}>{footer}</div>
      )}
    </Component>
  );
});

export default Card;
