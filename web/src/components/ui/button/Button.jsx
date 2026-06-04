/*
 * Button — 全站唯一按钮组件
 *
 * 业务端禁止传 className —— 视觉与布局通过 props 表达。
 *
 * variant:
 *   primary | secondary | oauth | link | toggle (+selected) | chip (+selected)
 *
 * size:     sm | md (默认) | lg
 * pill:     true 时强制全圆角（rounded-full）
 * icon / iconRight: lucide 组件 或 React 节点
 * loading:  true 时替代 icon 显示 spinner，按钮禁用
 * disabled: 禁用
 * block:    w-full（占满父容器）
 * flex1:    flex-1（在 flex 行里平分）
 * shrink:   false 时 flex-shrink-0
 * justify:  start | center (默认) | between | end
 * selected: 仅 toggle / chip 用
 */

import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn, SIZE_PADDING, SIZE_TEXT, SIZE_GAP, SIZE_ICON, FOCUS_RING } from '../tokens';

const VARIANT_STYLES = {
  primary:   'bg-ui-accent text-ui-accent-fg hover:bg-ui-accent-hover',
  secondary: 'bg-ui-bg-subtle text-ui-text hover:bg-ui-divider font-medium',
  oauth:     'border border-ui-border bg-[var(--page-bg)] hover:bg-ui-bg-subtle text-ui-text font-medium !rounded-lg',
  link:      'text-ui-accent hover:underline !px-0 !py-0',
};

const TOGGLE_STYLES = {
  unselected: 'border border-ui-border text-ui-text hover:bg-ui-bg-subtle',
  selected:   'bg-ui-accent text-ui-accent-fg border border-ui-accent',
};
const CHIP_STYLES = {
  unselected: '!rounded-lg border border-ui-border text-ui-text-2 hover:bg-ui-bg-subtle hover:text-ui-text',
  selected:   '!rounded-lg bg-ui-accent text-ui-accent-fg border border-ui-accent',
};
const STATEFUL = { toggle: TOGGLE_STYLES, chip: CHIP_STYLES };

const RADIUS_BY_SIZE = {
  sm: 'rounded-md',
  md: 'rounded-xl',
  lg: 'rounded-xl',
};

const JUSTIFY_CLS = {
  start:   'justify-start',
  center:  'justify-center',
  between: 'justify-between',
  end:     'justify-end',
};

const Button = React.forwardRef(function Button(
  {
    children,
    variant = 'primary',
    size = 'md',
    pill = false,
    icon: Icon,
    iconRight: IconRight,
    loading = false,
    disabled = false,
    block = false,
    flex1 = false,
    shrink,
    justify = 'center',
    selected = false,
    type = 'button',
    onClick,
    ...rest
  },
  ref,
) {
  const isDisabled = disabled || loading;
  const iconSize = SIZE_ICON[size];
  const renderIcon = (node) =>
    React.isValidElement(node) ? node : React.createElement(node, { size: iconSize });

  let variantStyle;
  if (STATEFUL[variant]) {
    variantStyle = STATEFUL[variant][selected ? 'selected' : 'unselected'];
  } else {
    variantStyle = VARIANT_STYLES[variant];
  }

  return (
    <button
      ref={ref}
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      aria-pressed={STATEFUL[variant] ? selected : undefined}
      aria-busy={loading || undefined}
      className={cn(
        'relative inline-flex items-center whitespace-nowrap transition-colors active:scale-[0.98]',
        pill ? 'rounded-full' : RADIUS_BY_SIZE[size],
        JUSTIFY_CLS[justify] || JUSTIFY_CLS.center,
        block && 'w-full',
        flex1 && 'flex-1',
        shrink === false && 'flex-shrink-0',
        block ? 'gap-3' : SIZE_GAP[size],
        SIZE_TEXT[size],
        SIZE_PADDING[size],
        // 默认 variant 样式
        variantStyle,
        // disabled：保留 variant 颜色，仅降透明度
        disabled && !loading && 'opacity-40 cursor-not-allowed active:scale-100 hover:bg-ui-accent',
        // loading 保留原 variant 颜色但锁定不可点
        loading && 'cursor-progress active:scale-100',
        FOCUS_RING,
      )}
      {...rest}
    >
      {/* loading 模式：保留按钮宽度，文字隐形，spinner 居中绝对定位 */}
      {loading && (
        <span className='absolute inset-0 flex items-center justify-center'>
          <Loader2 size={iconSize} className='animate-spin' />
        </span>
      )}
      <span className={cn('inline-flex items-center', block ? 'gap-3' : SIZE_GAP[size], loading && 'invisible')}>
        {!loading && Icon && renderIcon(Icon)}
        {children}
        {!loading && IconRight && renderIcon(IconRight)}
      </span>
    </button>
  );
});

export default Button;
