/*
 * IconButton — 仅图标的方形按钮（菜单触发、工具栏图标按钮）
 *
 * size: sm (28x28) | md (32x32) | lg (36x36)
 * variant: ghost (默认) | solid
 *
 * 使用：
 *   <IconButton icon={MoreHorizontal} onClick={...} aria-label='菜单' />
 */

import React from 'react';
import { cn, FOCUS_RING } from './tokens';

const SIZE_BOX = {
  sm: 'w-7 h-7',
  md: 'w-9 h-9',
  lg: 'w-10 h-10',
};

const SIZE_ICON = {
  sm: 14,
  md: 16,
  lg: 18,
};

const VARIANT_STYLES = {
  ghost:
    'text-ui-text-3 hover:text-ui-text hover:bg-ui-bg-subtle',
  solid:
    'bg-ui-accent text-ui-accent-fg hover:bg-ui-accent-hover',
  danger:
    'text-ui-danger hover:bg-ui-danger-bg',
};

const IconButton = React.forwardRef(function IconButton(
  {
    icon: Icon,
    size = 'md',
    variant = 'ghost',
    disabled = false,
    className,
    title,
    'aria-label': ariaLabel,
    onClick,
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type='button'
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel || title}
      className={cn(
        'inline-flex items-center justify-center rounded-xl transition-colors active:scale-95',
        SIZE_BOX[size],
        VARIANT_STYLES[variant],
        FOCUS_RING,
        disabled && 'opacity-50 cursor-not-allowed active:scale-100',
        className,
      )}
      {...rest}
    >
      {Icon && <Icon size={SIZE_ICON[size]} />}
    </button>
  );
});

export default IconButton;
