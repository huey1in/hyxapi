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
import type { CSSProperties, HTMLAttributes, Key, ReactNode } from 'react';
import { cn } from '../tokens';
import { useTranslation } from 'react-i18next';
import Skeleton from '../feedback/Skeleton';

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

export interface TableColumn<T> {
  key: string;
  title: ReactNode;
  width?: CSSProperties['width'];
  align?: keyof typeof ALIGN;
  render?: (row: T, index: number) => ReactNode;
}

export interface TableProps<T extends object> {
  className?: string;
  columns?: TableColumn<T>[];
  rows?: T[];
  rowKey?: keyof T | ((row: T) => Key);
  size?: keyof typeof SIZE_PAD;
  striped?: boolean;
  hoverable?: boolean;
  emptyText?: ReactNode;
  onRowClick?: (row: T, index: number) => void;
  rowProps?: (row: T, index: number) => HTMLAttributes<HTMLTableRowElement>;
  expandedKey?: Key | null;
  renderExpanded?: (row: T, index: number) => ReactNode;
  tableLayout?: 'auto' | 'fixed';
  minWidth?: CSSProperties['minWidth'];
  loading?: boolean;
  skeletonRows?: number;
}

function Table<T extends object>({
  className,
  columns = [],
  rows = [],
  rowKey,
  size = 'md',
  striped = false,
  hoverable = true,
  emptyText = '暂无数据',
  onRowClick,
  rowProps,
  expandedKey,
  renderExpanded,
  tableLayout = 'auto',
  minWidth,
  loading = false,
  skeletonRows = 6,
}: TableProps<T>) {
  const { t } = useTranslation();
  const keyOf = (row: T, i: number): Key => {
    if (typeof rowKey === 'function') return rowKey(row);
    const value: unknown = rowKey === undefined ? Reflect.get(row, 'id') : row[rowKey];
    return typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint' ? value : i;
  };

  return (
    <div role={loading ? 'status' : undefined} aria-label={loading ? t('Loading...') : undefined} aria-busy={loading || undefined}
      data-loading-skeleton={loading ? 'table' : undefined}
      className={cn('w-full overflow-x-auto rounded-2xl border border-ui-border bg-[var(--page-bg)] ui-scrollbar', className)}>
      <table
        className='w-full border-collapse'
        style={{
          ...(tableLayout === 'fixed' ? { tableLayout: 'fixed' } : {}),
          ...(minWidth ? { minWidth } : {}),
        }}
      >
        <thead inert={loading || undefined}>
          <tr className='border-b border-ui-border'>
            {columns.map((c) => (
              <th
                key={c.key}
                style={c.width ? { width: c.width } : undefined}
                className={cn(
                  'font-medium text-ui-text-2 whitespace-nowrap',
                  SIZE_PAD[size],
                  ALIGN[c.align ?? 'left'],
                )}
              >
                {c.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? Array.from({ length: skeletonRows }, (_, row) => <tr key={row} aria-hidden='true' className={cn(row < skeletonRows - 1 && 'border-b border-ui-divider', striped && row % 2 === 1 && 'bg-ui-border')}>
            {columns.map((column) => <td key={column.key} className={cn(SIZE_PAD[size], ALIGN[column.align ?? 'left'])}>
              <Skeleton height={16} width='80%' className={column.align === 'right' ? 'ml-auto' : column.align === 'center' ? 'mx-auto' : undefined} />
            </td>)}
          </tr>) : rows.length === 0 ? (
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
                    {...rowProps?.(row, idx)}
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
                        className={cn('text-ui-text overflow-hidden', SIZE_PAD[size], ALIGN[c.align ?? 'left'])}
                      >
                        {c.render ? c.render(row, idx) : (Reflect.get(row, c.key) as ReactNode)}
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
}

export default Table;
