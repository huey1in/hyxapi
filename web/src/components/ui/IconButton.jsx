/*
 * IconButton — 仅图标的方形/圆形按钮
 *
 * size:     xs (20) | sm (28) | md (32) | lg (36) | xl (44)
 * variant:  ghost (默认) | solid | danger | outline | circleSolid | landing
 * shape:    square (rounded-xl) | circle (rounded-full)
 * tone:     default | blue | green | yellow | purple | red | black
 *           - 默认/blue/green/yellow/purple/red 控制 ghost 的 hover 配色
 *           - black: 强制黑底（落地页风格）
 * selected: 选中态高对比
 *
 * icon 可接受 lucide 组件类型 或 React 节点（emoji、自定义 SVG 等）
 *
 * 业务方禁止传 className 重写视觉，只允许传布局类（absolute/inset-X 等）。
 */

import React from 'react';
import { cn, FOCUS_RING } from './tokens';

const SIZE_BOX = {
  xs: 'w-5 h-5',
  sm: 'w-7 h-7',
  md: 'w-9 h-9',
  lg: 'w-10 h-10',
  xl: 'w-11 h-11',
};

const SIZE_ICON = {
  xs: 10,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
};

const VARIANT_STYLES = {
  ghost:
    'text-ui-text-3 hover:text-ui-text hover:bg-ui-bg-subtle',
  solid:
    'bg-ui-accent text-ui-accent-fg hover:bg-ui-accent-hover',
  danger:
    'text-ui-danger hover:bg-ui-danger-bg',
  outline:
    'border border-ui-border text-ui-text-3 bg-ui-bg-elevated hover:bg-ui-bg-subtle',
  circleSolid:
    'bg-ui-accent text-ui-accent-fg hover:bg-ui-accent-hover shadow-sm',
  landing:
    'bg-black text-white hover:bg-zinc-800',
};

const TONE_HOVER = {
  default: '',
  blue: 'hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-500/10',
  green: 'hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-500/10',
  yellow: 'hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-500/10',
  purple: 'hover:text-violet-600 dark:hover:text-violet-400 hover:bg-violet-500/10',
  red: 'hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10',
  black: '',
};

const SELECTED_STYLE = 'bg-ui-accent text-ui-accent-fg hover:bg-ui-accent-hover border-transparent';

const IconButton = React.forwardRef(function IconButton(
  {
    icon: Icon,
    size = 'md',
    variant = 'ghost',
    shape = 'square',
    tone = 'default',
    selected = false,
    disabled = false,
    className,
    title,
    'aria-label': ariaLabel,
    onClick,
    ...rest
  },
  ref,
) {
  const effectiveVariant = tone === 'black' ? 'landing' : variant;
  const variantStyle = selected ? SELECTED_STYLE : VARIANT_STYLES[effectiveVariant];
  const toneStyle = effectiveVariant === 'ghost' && !selected ? TONE_HOVER[tone] : '';
  const iconSize = SIZE_ICON[size];

  // icon 可以是组件（lucide forwardRef / function component）或 React 节点
  const renderIcon = () => {
    if (!Icon) return null;
    if (React.isValidElement(Icon)) return Icon;
    return <Icon size={iconSize} />;
  };

  return (
    <button
      ref={ref}
      type='button'
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel || title}
      aria-pressed={selected || undefined}
      className={cn(
        'inline-flex items-center justify-center flex-shrink-0 transition-colors active:scale-95',
        shape === 'circle' ? 'rounded-full' : 'rounded-xl',
        SIZE_BOX[size],
        variantStyle,
        toneStyle,
        FOCUS_RING,
        disabled && 'opacity-50 cursor-not-allowed active:scale-100',
        className,
      )}
      {...rest}
    >
      {renderIcon()}
    </button>
  );
});

export default IconButton;
