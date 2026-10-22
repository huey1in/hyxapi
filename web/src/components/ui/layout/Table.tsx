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
 * emptyIcon: 与表格内容对应的空状态图标
 * onRowClick: (row, idx) => void
 * expandedKey: 当前展开行的 rowKey（与 renderExpanded 搭配，在该行下方插入详情）
 * renderExpanded: (row, idx) => node   展开行内容
 * tableLayout: 'auto'(默认) | 'fixed'  fixed 时配合列 width 严格约束列宽，防止内容撑宽
 * 小于 768px 时显示卡片；mobileRole 支持 selection（勾选）、actions（操作）及 wide（整行字段）
 */

import React from 'react';
import type { CSSProperties, HTMLAttributes, Key, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../tokens';
import { useTranslation } from 'react-i18next';
import Skeleton from '../feedback/Skeleton';
import EmptyState from '../display/EmptyState';
import useIsMobile from '../../../hooks/useIsMobile';

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
  mobileRole?: 'selection' | 'actions' | 'wide';
}

interface TableProps<T extends object> {
  className?: string;
  columns?: TableColumn<T>[];
  rows?: T[];
  rowKey?: keyof T | ((row: T) => Key);
  size?: keyof typeof SIZE_PAD;
  striped?: boolean;
  hoverable?: boolean;
  emptyText?: ReactNode;
  emptyIcon?: LucideIcon | null;
  onRowClick?: (row: T, index: number) => void;
  rowProps?: (row: T, index: number) => HTMLAttributes<HTMLElement>;
  expandedKey?: Key | null;
  renderExpanded?: (row: T, index: number) => ReactNode;
  tableLayout?: 'auto' | 'fixed';
  minWidth?: CSSProperties['minWidth'];
  loading?: boolean;
  skeletonRows?: number;
  showMobileSelectionHeader?: boolean;
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
  emptyIcon,
  onRowClick,
  rowProps,
  expandedKey,
  renderExpanded,
  tableLayout = 'auto',
  minWidth,
  loading = false,
  skeletonRows = 6,
  showMobileSelectionHeader = true,
}: TableProps<T>) {
  const { t } = useTranslation();
  const mobile = useIsMobile();
  const textEmptyState = typeof emptyText === 'string' || typeof emptyText === 'number';
  const emptyContent = textEmptyState ? <EmptyState icon={emptyIcon} title={emptyText} padding='sm' /> : emptyText;
  const keyOf = (row: T, i: number): Key => {
    if (typeof rowKey === 'function') return rowKey(row);
    const value: unknown = rowKey === undefined ? Reflect.get(row, 'id') : row[rowKey];
    return typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint' ? value : i;
  };

  if (mobile) {
    const selection = columns.filter((column) => column.mobileRole === 'selection');
    const selectionHeadings = selection.filter((column) => column.title != null && column.title !== '' && column.title !== false);
    const actions = columns.filter((column) => column.mobileRole === 'actions');
    const fields = columns.filter((column) => column.mobileRole !== 'selection' && column.mobileRole !== 'actions');
    const cell = (column: TableColumn<T>, row: T, index: number) => column.render ? column.render(row, index) : Reflect.get(row, column.key) as ReactNode;
    return <div className={cn('mobile-table min-w-0 w-full space-y-3', className)} data-table-view='cards'
      role={loading ? 'status' : undefined} aria-label={loading ? t('Loading...') : undefined} aria-busy={loading || undefined} data-loading-skeleton={loading ? 'cards' : undefined}>
      {showMobileSelectionHeader && selectionHeadings.length > 0 && (loading || rows.length > 0) && <div className='flex flex-wrap items-center gap-2 text-sm text-ui-text-2' inert={loading || undefined}>
        {selectionHeadings.map((column) => <label key={column.key} className='inline-flex min-h-10 max-w-full cursor-pointer items-center gap-2 rounded-lg pr-3'>{column.title}<span>{t('Select current page')}</span></label>)}
      </div>}
      {loading ? Array.from({ length: skeletonRows }, (_, index) => <div key={index} aria-hidden='true' className='mobile-table-card space-y-3'>
        {fields.map((column) => <div key={column.key} className={cn('mobile-table-field', column.mobileRole === 'wide' && 'mobile-table-field-wide')}><Skeleton height={14} width={column.mobileRole === 'wide' ? '40%' : '75%'} /><Skeleton height={18} width='85%' className={column.mobileRole === 'wide' ? undefined : 'ml-auto'} /></div>)}
        {(selection.length > 0 || actions.length > 0) && <div className='flex items-end gap-3 border-t border-ui-divider pt-3'>
          {selection.length > 0 && <Skeleton height={18} width={18} className='shrink-0' />}
          {actions.length > 0 && <div className='flex flex-1 justify-end gap-2'><Skeleton height={30} width={60} /><Skeleton height={30} width={60} /></div>}
        </div>}
      </div>) : rows.length === 0 ? <div className={cn('mobile-table-card text-center text-sm text-ui-text-3', !textEmptyState && 'py-8')}>{emptyContent}</div> : rows.map((row, index) => {
        const key = keyOf(row, index);
        const expanded = expandedKey != null && key === expandedKey;
        const { className: rowClass, onClick, onKeyDown, ...attributes } = rowProps?.(row, index) ?? {};
        return <article key={key} {...attributes} data-mobile-card={String(key)} tabIndex={attributes.tabIndex ?? (onRowClick ? 0 : undefined)}
          className={cn('mobile-table-card', expanded && 'bg-ui-bg-subtle', onRowClick && 'cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui-text', rowClass)}
          onClick={(event) => {
            if (event.target instanceof Element && event.target.closest('button,a,input,select,textarea,[role="checkbox"],[role="switch"]')) return;
            if (onRowClick) onRowClick(row, index); else onClick?.(event);
          }}
          onKeyDown={(event) => {
            if (event.target !== event.currentTarget) return;
            onKeyDown?.(event);
            if (!event.defaultPrevented && onRowClick && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onRowClick(row, index); }
          }}>
          <dl className='space-y-3'>{fields.map((column, columnIndex) => <div key={column.key} className={cn('mobile-table-field', column.mobileRole === 'wide' && 'mobile-table-field-wide')}>
            <dt className='min-w-0 text-xs leading-5 text-ui-text-3'>{column.title}</dt>
            <dd className={cn('mobile-table-value m-0 text-sm leading-5 text-ui-text', column.mobileRole === 'wide' ? 'text-left' : 'text-right', columnIndex === 0 && 'font-medium')}>{cell(column, row, index)}</dd>
          </div>)}</dl>
          {(selection.length > 0 || actions.length > 0) && <div className='mt-3 flex items-end gap-3 border-t border-ui-divider pt-3'>
            {selection.length > 0 && <div className='flex shrink-0 items-center gap-2'>{selection.map((column) => <React.Fragment key={column.key}>{cell(column, row, index)}</React.Fragment>)}</div>}
            {actions.length > 0 && <div className='flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2'>{actions.map((column) => <div key={column.key} className='mobile-table-value' aria-label={typeof column.title === 'string' ? column.title : undefined}>{cell(column, row, index)}</div>)}</div>}
          </div>}
          {expanded && renderExpanded && <div className='mt-3 border-t border-ui-divider pt-3'>{renderExpanded(row, index)}</div>}
        </article>;
      })}
    </div>;
  }

  return (
    <div role={loading ? 'status' : undefined} aria-label={loading ? t('Loading...') : undefined} aria-busy={loading || undefined}
      data-loading-skeleton={loading ? 'table' : undefined} data-table-view='table'
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
              <td colSpan={columns.length} className={cn('text-center text-ui-text-3', textEmptyState ? 'px-4' : SIZE_PAD[size])}>
                {emptyContent}
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
