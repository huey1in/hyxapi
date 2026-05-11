/*
 * Table — 数据表格
 *
 * columns: [{ key, title, width?, align?: 'left'|'center'|'right', render?(row, idx) }]
 * rows:    Array<object>
 * rowKey:  string | (row) => key   行唯一键（默认 row.id || index）
 * size:    sm | md (默认)
 * striped: 隔行变色
 * hoverable: 行 hover 高亮（默认 true）
 * emptyText: 空数据文案
 * onRowClick: (row, idx) => void
 */

import React from 'react';
import { cn } from '../tokens';

const SIZE_PAD = {
  sm: 'px-3 py-2 text-xs',
  md: 'px-4 py-2.5 text-sm',
};

const ALIGN = {
  left:   'text-left',
  center: 'text-center',
  right:  'text-right',
};

const Table = ({
  columns = [],
  rows = [],
  rowKey,
  size = 'md',
  striped = false,
  hoverable = true,
  emptyText = '暂无数据',
  onRowClick,
}) => {
  const keyOf = (row, i) => {
    if (typeof rowKey === 'function') return rowKey(row);
    if (typeof rowKey === 'string')   return row[rowKey];
    return row?.id ?? i;
  };

  return (
    <div className='w-full overflow-x-auto rounded-2xl border border-ui-border bg-[var(--page-bg)] ui-scrollbar'>
      <table className='w-full border-collapse'>
        <thead>
          <tr className='border-b border-ui-border'>
            {columns.map((c) => (
              <th
                key={c.key}
                style={c.width ? { width: c.width } : undefined}
                className={cn(
                  'font-medium text-ui-text-2 whitespace-nowrap',
                  SIZE_PAD[size],
                  ALIGN[c.align] || ALIGN.left,
                )}
              >
                {c.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className={cn('text-center text-ui-text-3', SIZE_PAD[size])}>
                {emptyText}
              </td>
            </tr>
          ) : (
            rows.map((row, idx) => (
              <tr
                key={keyOf(row, idx)}
                onClick={onRowClick ? () => onRowClick(row, idx) : undefined}
                className={cn(
                  idx !== rows.length - 1 && 'border-b border-ui-divider',
                  striped && idx % 2 === 1 && 'bg-ui-border',
                  hoverable && 'hover:bg-ui-bg-subtle transition-colors',
                  onRowClick && 'cursor-pointer',
                )}
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={cn('text-ui-text', SIZE_PAD[size], ALIGN[c.align] || ALIGN.left)}
                  >
                    {c.render ? c.render(row, idx) : row[c.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default Table;
