/*
 * IconButton — 仅图标的方形 / 圆形按钮
 *
 * 业务端禁止传 className —— 视觉与布局通过 props 表达。
 *
 * size:     xs (20) | sm (28) | md (32) | lg (36) | xl (44)
 * variant:  ghost (默认) | solid | danger | outline | circleSolid
 * shape:    square (rounded-xl) | circle (rounded-full)
 * tone:     default | blue | green | yellow | purple | red （仅 ghost 时叠加 hover 配色）
 * selected: 选中态
 * absolute: 绝对定位（搭配 position 或 inset）
 * position: tl | tr | bl | br （仅 absolute 时四角偏移 top-2 / left-2 等）
 */

import React from 'react';
import type { ButtonHTMLAttributes, ComponentType, ReactElement } from 'react';
import { cn, FOCUS_RING } from '../tokens';

const SIZE_BOX = {
  xs: 'w-5 h-5',
  sm: 'w-7 h-7',
  md: 'w-9 h-9',
  lg: 'w-10 h-10',
  xl: 'w-11 h-11',
};
const SIZE_ICON = { xs: 10, sm: 14, md: 16, lg: 18, xl: 20 };

const VARIANT_STYLES = {
  ghost:       'text-ui-text hover:bg-ui-bg-subtle',
  solid:       'bg-ui-accent text-ui-accent-fg hover:bg-ui-accent-hover',
  danger:      'text-ui-danger hover:bg-ui-danger-bg',
  outline:     'border border-ui-border text-ui-text bg-transparent hover:bg-ui-bg-subtle',
  circleSolid: 'bg-ui-accent text-ui-accent-fg hover:bg-ui-accent-hover shadow-xs',
};

const TONE_HOVER = {
  default: '',
  blue:    'hover:text-blue-600    dark:hover:text-blue-400    hover:bg-blue-500/10',
  green:   'hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-500/10',
  yellow:  'hover:text-amber-600   dark:hover:text-amber-400   hover:bg-amber-500/10',
  purple:  'hover:text-violet-600  dark:hover:text-violet-400  hover:bg-violet-500/10',
  red:     'hover:text-rose-600    dark:hover:text-rose-400    hover:bg-rose-500/10',
};

const SELECTED_STYLE = 'bg-ui-accent text-ui-accent-fg hover:bg-ui-accent-hover border-transparent';

const POSITION_CLS = {
  tl: 'top-2 left-2',
  tr: 'top-2 right-2',
  bl: 'bottom-2 left-2',
  br: 'bottom-2 right-2',
};

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> {
  icon?: ComponentType<{ size?: number }> | ReactElement;
  size?: keyof typeof SIZE_BOX;
  variant?: keyof typeof VARIANT_STYLES;
  shape?: 'square' | 'circle';
  tone?: keyof typeof TONE_HOVER;
  selected?: boolean;
  absolute?: boolean;
  position?: keyof typeof POSITION_CLS;
}

const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  {
    icon: Icon,
    size = 'md',
    variant = 'ghost',
    shape = 'square',
    tone = 'default',
    selected = false,
    disabled = false,
    absolute = false,
    position,
    title,
    'aria-label': ariaLabel,
    onClick,
    ...rest
  },
  ref,
) {
  const variantStyle = selected ? SELECTED_STYLE : VARIANT_STYLES[variant];
  const toneStyle = variant === 'ghost' && !selected ? TONE_HOVER[tone] : '';
  const iconSize = SIZE_ICON[size];

  const renderIcon = () => {
    if (!Icon) return null;
    if (React.isValidElement(Icon)) return Icon;
    const Component = Icon as ComponentType<{ size?: number }>;
    return <Component size={iconSize} />;
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
        'inline-flex items-center justify-center shrink-0 transition-colors active:scale-95',
        shape === 'circle' ? 'rounded-full' : 'rounded-xl',
        SIZE_BOX[size],
        variantStyle,
        toneStyle,
        FOCUS_RING,
        absolute && 'absolute',
        absolute && position && POSITION_CLS[position],
        disabled && 'opacity-50 cursor-not-allowed active:scale-100',
      )}
      {...rest}
    >
      {renderIcon()}
    </button>
  );
});

export default IconButton;
