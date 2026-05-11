/*
 * TableActionBtn — 表格行内操作按钮（与 backup 同名同风）
 *
 * 用法：<TableActionBtn icon onClick danger bordered={false}>编辑</TableActionBtn>
 */

import React from 'react';
import { cn } from '../../ui/tokens';

const TableActionBtn = ({ children, onClick, danger = false, bordered = true, disabled = false }) => (
  <button
    type='button'
    disabled={disabled}
    onClick={onClick}
    className={cn(
      'inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] transition-colors whitespace-nowrap',
      bordered && 'border border-ui-border',
      danger
        ? 'text-ui-danger hover:bg-ui-danger-bg'
        : 'text-ui-text-2 hover:text-ui-text hover:bg-ui-bg-subtle',
      disabled && 'opacity-50 cursor-not-allowed',
    )}
  >
    {children}
  </button>
);

export default TableActionBtn;
