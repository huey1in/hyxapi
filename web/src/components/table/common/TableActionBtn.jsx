/*
 * TableActionBtn — 表格行内操作按钮的统一封装。
 *
 * Props:
 *   onClick   — 点击回调（自动 stopPropagation）
 *   disabled  — 禁用
 *   danger    — 危险态（红色文字/边框）
 *   bordered  — 是否带边框，默认 true。UsersTable 这类无边框场景传 false
 *   title     — title / aria-label
 *   children  — 通常为 <Icon /> + 文本
 *
 * 该组件仅是 <button> 的薄包装，保持与既有局部 ActionBtn 完全一致的视觉，
 * 用于消除 RedemptionsTable / SubscriptionsTable / UsersTable 中的三份重复定义。
 */

import React from 'react';

const TableActionBtn = ({
  children,
  onClick,
  disabled,
  danger,
  bordered = true,
  title,
}) => {
  const dangerCls = bordered
    ? 'border-ui-danger/30 text-ui-danger hover:bg-ui-danger-bg disabled:hover:bg-transparent'
    : 'text-ui-danger hover:bg-ui-danger-bg disabled:hover:bg-transparent';
  const normalCls = bordered
    ? 'border-ui-border text-ui-text-2 hover:text-ui-text hover:bg-ui-bg-subtle disabled:hover:bg-transparent'
    : 'text-ui-text-2 hover:text-ui-text hover:bg-ui-bg-subtle disabled:hover:bg-transparent';
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(e);
      }}
      disabled={disabled}
      title={title}
      className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] rounded ${
        bordered ? 'border' : ''
      } transition-colors whitespace-nowrap disabled:opacity-40 ${
        danger ? dangerCls : normalCls
      }`}
    >
      {children}
    </button>
  );
};

export default TableActionBtn;
