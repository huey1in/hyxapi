/*
 * Button — 统一的按钮组件
 *
 * variant: primary | secondary | ghost | danger | link
 * size:    sm | md | lg
 * icon:    lucide-react 组件类型（自动间距）
 * loading: 显示加载动画
 *
 * 使用：
 *   <Button onClick={...}>保存</Button>
 *   <Button variant="secondary" icon={Plus}>添加</Button>
 *   <Button variant="danger" loading={loading}>删除</Button>
 */

import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn, SIZE_PADDING, SIZE_TEXT, SIZE_GAP, SIZE_ICON, FOCUS_RING } from './tokens';

const VARIANT_STYLES = {
  primary:
    'bg-ui-accent text-ui-accent-fg hover:bg-ui-accent-hover font-semibold',
  secondary:
    'bg-ui-bg-subtle text-ui-text hover:bg-ui-divider font-medium',
  ghost:
    'text-ui-text-2 hover:text-ui-text hover:bg-ui-bg-subtle',
  danger:
    'text-ui-danger hover:bg-ui-danger-bg font-medium',
  dangerSolid:
    'bg-ui-danger text-white hover:opacity-90 font-semibold',
  link:
    'text-ui-brand hover:underline px-0 py-0',
};

const Button = React.forwardRef(function Button(
  {
    children,
    variant = 'primary',
    size = 'md',
    icon: Icon,
    iconRight: IconRight,
    loading = false,
    disabled = false,
    type = 'button',
    className,
    onClick,
    ...rest
  },
  ref,
) {
  const isDisabled = disabled || loading;
  const iconSize = SIZE_ICON[size];

  return (
    <button
      ref={ref}
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      className={cn(
        'inline-flex items-center justify-center rounded-xl whitespace-nowrap transition-colors active:scale-[0.98]',
        SIZE_GAP[size],
        SIZE_TEXT[size],
        variant !== 'link' && SIZE_PADDING[size],
        VARIANT_STYLES[variant],
        FOCUS_RING,
        isDisabled && 'opacity-50 cursor-not-allowed active:scale-100 hover:bg-transparent',
        className,
      )}
      {...rest}
    >
      {loading ? (
        <Loader2 size={iconSize} className='animate-spin' />
      ) : (
        Icon && <Icon size={iconSize} />
      )}
      {children}
      {!loading && IconRight && <IconRight size={iconSize} />}
    </button>
  );
});

export default Button;
