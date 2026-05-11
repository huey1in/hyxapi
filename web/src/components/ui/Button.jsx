/*
 * Button — 全站唯一按钮组件
 *
 * variant:
 *   primary      主操作
 *   secondary    次操作
 *   ghost        无背景
 *   danger       危险（文字）
 *   dangerSolid  危险（实心）
 *   link         链接（无 padding/无背景）
 *   oauth        OAuth 登录按钮（带边框/页面色背景）
 *   toggle       二态切换（搭配 selected：边框 → 实心强对比）
 *   tab          下划线 tab（搭配 selected）
 *   chip         胶囊（搭配 selected）
 *   hero         52px round-full 落地页 CTA（搭配 tone='black'|'outline'）
 *   bare         零视觉，仅 inline-flex 容器（用于 nav pill 等共用 className 场景）
 *
 * size:     sm | md | lg
 * tone:     仅 hero/landing 系列使用：black | outline
 * icon/iconRight:  lucide 组件 或 React 节点（emoji/自定义 JSX）
 * loading:  显示 Spinner
 * disabled: 禁用
 * block:    占满宽度
 * selected: 仅 toggle/tab/chip 用
 *
 * 业务方禁止传 className 重写视觉，仅允许布局类（justify-start, ml-2, absolute 等）。
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
  oauth:
    'border border-ui-border bg-[var(--page-bg)] hover:bg-ui-bg-subtle text-ui-text font-medium !rounded-lg',
  bare:
    '',
};

const TOGGLE_STYLES = {
  unselected: 'border border-ui-border text-ui-text hover:bg-ui-bg-subtle font-medium',
  selected: 'bg-ui-accent text-ui-accent-fg border border-ui-accent font-medium',
};

const TAB_STYLES = {
  unselected: '!rounded-none border-b-2 border-transparent text-ui-text-2 hover:text-ui-text font-medium',
  selected: '!rounded-none border-b-2 border-ui-accent text-ui-text font-semibold',
};

const CHIP_STYLES = {
  unselected: '!rounded-full border border-ui-border text-ui-text-2 hover:bg-ui-bg-subtle hover:text-ui-text',
  selected: '!rounded-full bg-ui-accent text-ui-accent-fg border border-ui-accent',
};

const STATEFUL_VARIANTS = {
  toggle: TOGGLE_STYLES,
  tab: TAB_STYLES,
  chip: CHIP_STYLES,
};

// hero: 52px round-full 落地页 CTA, 通过 tone 区分
const HERO_TONES = {
  black: '!h-[52px] !rounded-full bg-black text-white hover:bg-zinc-800 font-semibold',
  outline: '!h-[52px] !rounded-full border border-ui-border text-ui-text hover:bg-ui-bg-subtle font-medium',
};

const Button = React.forwardRef(function Button(
  {
    children,
    variant = 'primary',
    size = 'md',
    tone = 'black',
    icon: Icon,
    iconRight: IconRight,
    loading = false,
    disabled = false,
    block = false,
    selected = false,
    type = 'button',
    className,
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
  if (variant === 'hero') {
    variantStyle = HERO_TONES[tone] || HERO_TONES.black;
  } else if (STATEFUL_VARIANTS[variant]) {
    variantStyle = STATEFUL_VARIANTS[variant][selected ? 'selected' : 'unselected'];
  } else {
    variantStyle = VARIANT_STYLES[variant];
  }

  // bare 不强加 padding/text-size，由调用方布局类控制
  const padding = (variant === 'link' || variant === 'bare') ? '' : SIZE_PADDING[size];
  const textSize = variant === 'bare' ? '' : SIZE_TEXT[size];

  return (
    <button
      ref={ref}
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      aria-pressed={STATEFUL_VARIANTS[variant] ? selected : undefined}
      className={cn(
        'inline-flex items-center justify-center rounded-xl whitespace-nowrap transition-colors active:scale-[0.98]',
        block ? 'w-full gap-3' : SIZE_GAP[size],
        textSize,
        padding,
        variantStyle,
        variant !== 'bare' && FOCUS_RING,
        isDisabled && 'opacity-50 cursor-not-allowed active:scale-100 hover:bg-transparent',
        className,
      )}
      {...rest}
    >
      {loading ? (
        <Loader2 size={iconSize} className='animate-spin' />
      ) : (
        Icon && renderIcon(Icon)
      )}
      {children}
      {!loading && IconRight && renderIcon(IconRight)}
    </button>
  );
});

export default Button;
