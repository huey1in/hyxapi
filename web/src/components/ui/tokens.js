/*
 * 设计系统 token — 集中管理尺寸、圆角、颜色片段
 *
 * 业务代码不应直接使用 Tailwind 类拼装组件，而是通过 ui/* 组件
 * 间接使用这些 token。
 */

import clsx from 'clsx';

// ─── 尺寸 ────────────────────────────────────────
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

// ─── 圆角 ────────────────────────────────────────
export const RADIUS = {
  none: 'rounded-none',
  sm: 'rounded-md',
  md: 'rounded-xl',
  lg: 'rounded-2xl',
  full: 'rounded-full',
};

// ─── 焦点环 ──────────────────────────────────────
export const FOCUS_RING =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-ui-text focus-visible:ring-offset-1';

// ─── 颜色调色板（用于 Tag / 状态标识） ───────────
// 每个键提供 light/dark 一致的视觉，业务方只需传 color 名称
export const COLOR_TONES = {
  default: 'bg-ui-bg-subtle text-ui-text-2',
  neutral: 'bg-ui-bg-subtle text-ui-text-2',
  blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  violet: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
  amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  rose: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
  cyan: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
  green: 'bg-green-500/10 text-green-600 dark:text-green-400',
  gray: 'bg-gray-500/10 text-gray-600 dark:text-gray-400',
  red: 'bg-red-500/10 text-red-600 dark:text-red-400',
  danger: 'bg-ui-danger-bg text-ui-danger',
  success: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  warning: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
};

// ─── 工具函数 ────────────────────────────────────
export const cn = clsx;
