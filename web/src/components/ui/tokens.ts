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

export const FOCUS_RING =
  'focus:outline-hidden focus-visible:ring-2 focus-visible:ring-ui-text focus-visible:ring-offset-1';
