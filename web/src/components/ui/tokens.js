/**
 * Design tokens — 集中管理尺寸 / 圆角 / 间距 / 色板片段
 *
 * 业务方不直接读这些常量；它们只供 ui/* 原子组件内部使用。
 */
import clsx from 'clsx';

export const cn = clsx;

export const SIZE_PADDING = {
  sm: 'px-2.5 py-1',
  md: 'px-3.5 py-2',
  lg: 'px-4 py-2.5',
};

export const SIZE_TEXT = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
};

export const SIZE_GAP = {
  sm: 'gap-1',
  md: 'gap-1.5',
  lg: 'gap-2',
};

export const SIZE_ICON = {
  sm: 12,
  md: 14,
  lg: 16,
};

export const RADIUS = {
  none: 'rounded-none',
  sm:   'rounded-md',
  md:   'rounded-xl',
  lg:   'rounded-2xl',
  xl:   'rounded-3xl',
  xxl:  'rounded-[20px]',
  full: 'rounded-full',
};

export const FOCUS_RING =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-ui-text focus-visible:ring-offset-1';

/** 状态色板（用于 Tag 等多色场景） */
export const COLOR_TONES = {
  default: 'bg-ui-bg-subtle text-ui-text-2',
  blue:    'bg-blue-500/10    text-blue-600    dark:text-blue-400',
  emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  violet:  'bg-violet-500/10  text-violet-600  dark:text-violet-400',
  amber:   'bg-amber-500/10   text-amber-600   dark:text-amber-400',
  rose:    'bg-rose-500/10    text-rose-600    dark:text-rose-400',
  cyan:    'bg-cyan-500/10    text-cyan-600    dark:text-cyan-400',
  danger:  'bg-ui-danger-bg   text-ui-danger',
  success: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  warning: 'bg-amber-500/10   text-amber-600   dark:text-amber-400',
};
