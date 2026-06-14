/*
 * Table — 数据表格
 *
 * columns: [{ key, title, width?, align?: 'left'|'center'|'right', render?(row, idx) }]
 * rows:    Array<object>
 * rowKey:  string | (row) => key   行唯一键（默认 row.id || index）
 * size:    sm | md (默认) | lg
 * striped: 隔行变色
 * hoverable: 行 hover 高亮（默认 true）
 * emptyText: 空数据文案
 * onRowClick: (row, idx) => void
 * expandedKey: 当前展开行的 rowKey（与 renderExpanded 搭配，在该行下方插入详情）
 * renderExpanded: (row, idx) => node   展开行内容
 * tableLayout: 'auto'(默认) | 'fixed'  fixed 时配合列 width 严格约束列宽，防止内容撑宽
 */

import React from 'react';
import { cn } from '../tokens';

const SIZE_PAD = {
  sm: 'px-3 py-2.5 text-xs',
  md: 'px-4 py-3 text-sm',
  lg: 'px-4 py-4 text-sm',
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
  expandedKey,
  renderExpanded,
  tableLayout = 'auto',
}) => {
  const keyOf = (row, i) => {
    if (typeof rowKey === 'function') return rowKey(row);
    if (typeof rowKey === 'string')   return row[rowKey];
    return row?.id ?? i;
  };

  return (
    <div className='w-full overflow-x-auto rounded-2xl border border-ui-border bg-[var(--page-bg)] ui-scrollbar'>
      <table className='w-full border-collapse' style={tableLayout === 'fixed' ? { tableLayout: 'fixed' } : undefined}>
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
            rows.map((row, idx) => {
              const rk = keyOf(row, idx);
              const isExpanded = expandedKey != null && rk === expandedKey;
              const isLast = idx === rows.length - 1;
              return (
                <React.Fragment key={rk}>
                  <tr
                    onClick={onRowClick ? () => onRowClick(row, idx) : undefined}
                    className={cn(
                      (!isLast && !isExpanded) && 'border-b border-ui-divider',
                      striped && idx % 2 === 1 && 'bg-ui-border',
                      isExpanded && 'bg-ui-bg-subtle',
                      hoverable === true && 'hover:bg-ui-bg-subtle transition-colors',
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
                  {isExpanded && renderExpanded && (
                    <tr className={cn(!isLast && 'border-b border-ui-divider')}>
                      <td colSpan={columns.length} className='p-0'>
                        {renderExpanded(row, idx)}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
};

export default Table;
