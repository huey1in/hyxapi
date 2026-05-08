/*
 * CrudSection — reusable CRUD table wrapper with token styling.
 *
 * Props:
 *  - title, hint, icon, iconColor: header
 *  - columns, dataSource, rowKey, loading
 *  - page, pageSize, total, onPageChange
 *  - selectedRowKeys, onSelectionChange, selectable
 *  - onAdd, addLabel
 *  - onBatchDelete, batchDeleteLabel
 *  - onSave, saveLabel, saveDisabled, saveLoading
 *  - enabled, onToggleEnabled, enableLabel
 *  - emptyLabel
 *  - children (additional content above the table)
 */
import React from 'react';
import {
  Plus,
  Trash2,
  Save,
  Loader2,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import Pagination from './Pagination';

const CrudSection = ({
  title,
  hint,
  icon: Icon,
  iconColor = 'blue',
  columns = [],
  dataSource = [],
  rowKey = 'id',
  loading = false,
  page = 1,
  pageSize = 10,
  total = 0,
  onPageChange,
  selectedRowKeys = [],
  onSelectionChange,
  selectable = true,
  onAdd,
  addLabel = '添加',
  onBatchDelete,
  batchDeleteLabel = '批量删除',
  onSave,
  saveLabel = '保存设置',
  saveDisabled = false,
  saveLoading = false,
  enabled,
  onToggleEnabled,
  enableLabel = '启用',
  emptyLabel = '暂无数据',
  children,
}) => {
  const ICON_COLOR_MAP = {
    blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    purple: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
    cyan: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
    emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    orange: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
    rose: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
    amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    indigo: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
    green: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20',
    red: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
    sky: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20',
    teal: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20',
  };
  const iconCls = ICON_COLOR_MAP[iconColor] || ICON_COLOR_MAP.blue;

  const allSelected =
    selectable &&
    dataSource.length > 0 &&
    dataSource.every((r) => selectedRowKeys.includes(r[rowKey]));

  const toggleAll = () => {
    if (allSelected) {
      onSelectionChange?.([]);
    } else {
      onSelectionChange?.(dataSource.map((r) => r[rowKey]));
    }
  };

  const toggleRow = (key) => {
    const next = selectedRowKeys.includes(key)
      ? selectedRowKeys.filter((k) => k !== key)
      : [...selectedRowKeys, key];
    onSelectionChange?.(next);
  };

  return (
    <div className='space-y-4'>
      {/* Header */}
      <div className='flex flex-col sm:flex-row sm:items-center gap-3'>
        <div className='flex items-center gap-2 flex-1 min-w-0'>
          {Icon && (
            <div
              className={`w-8 h-8 rounded-md inline-flex items-center justify-center border ${iconCls}`}
            >
              <Icon size={15} />
            </div>
          )}
          <div className='flex-1 min-w-0'>
            {title && (
              <div className='text-sm font-semibold text-ui-text'>{title}</div>
            )}
            {hint && (
              <div className='text-[11px] text-ui-text-3 mt-0.5 line-clamp-2'>
                {hint}
              </div>
            )}
          </div>
        </div>
        <div className='flex items-center gap-2 flex-wrap'>
          {onToggleEnabled !== undefined && (
            <button
              type='button'
              onClick={() => onToggleEnabled(!enabled)}
              className='inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md border border-ui-border text-ui-text-2 hover:bg-ui-bg-hover'
            >
              {enabled ? (
                <ToggleRight size={14} className='text-emerald-500' />
              ) : (
                <ToggleLeft size={14} className='text-ui-text-3' />
              )}
              {enableLabel}
            </button>
          )}
          {onAdd && (
            <button
              type='button'
              onClick={onAdd}
              className='inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md bg-ui-accent text-ui-accent-fg hover:opacity-90'
            >
              <Plus size={12} />
              {addLabel}
            </button>
          )}
          {onBatchDelete && (
            <button
              type='button'
              onClick={onBatchDelete}
              disabled={!selectedRowKeys.length}
              className='inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-md border border-ui-danger/30 text-ui-danger hover:bg-ui-danger-bg disabled:opacity-40'
            >
              <Trash2 size={12} />
              {batchDeleteLabel}
              {selectedRowKeys.length > 0 && ` (${selectedRowKeys.length})`}
            </button>
          )}
          {onSave && (
            <button
              type='button'
              onClick={onSave}
              disabled={saveLoading || saveDisabled}
              className='inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-ui-accent text-ui-accent-fg hover:opacity-90 disabled:opacity-50'
            >
              {saveLoading ? (
                <Loader2 size={11} className='animate-spin' />
              ) : (
                <Save size={11} />
              )}
              {saveLabel}
            </button>
          )}
        </div>
      </div>

      {children}

      {/* Table */}
      <div className='rounded-md border border-ui-border overflow-hidden'>
        <div className='overflow-x-auto nice-scroll'>
          <table className='w-full text-xs'>
            <thead>
              <tr className='bg-ui-bg-subtle'>
                {selectable && (
                  <th className='w-9 px-3 py-2 text-left'>
                    <input
                      type='checkbox'
                      checked={allSelected}
                      onChange={toggleAll}
                      className='rounded border-ui-border text-ui-accent focus:ring-ui-accent/40'
                    />
                  </th>
                )}
                {columns.map((col) => (
                  <th
                    key={col.key || col.dataIndex}
                    className={`px-3 py-2 text-left font-semibold text-ui-text-2 whitespace-nowrap ${
                      col.width ? '' : ''
                    }`}
                    style={
                      col.width
                        ? { minWidth: typeof col.width === 'number' ? `${col.width}px` : col.width }
                        : undefined
                    }
                  >
                    {col.title}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className='divide-y divide-ui-divider'>
              {dataSource.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length + (selectable ? 1 : 0)}
                    className='px-3 py-8 text-center text-ui-text-3'
                  >
                    {emptyLabel}
                  </td>
                </tr>
              ) : (
                dataSource.map((row) => (
                  <tr
                    key={row[rowKey]}
                    className='hover:bg-ui-bg-hover/50 transition-colors'
                  >
                    {selectable && (
                      <td className='w-9 px-3 py-2'>
                        <input
                          type='checkbox'
                          checked={selectedRowKeys.includes(row[rowKey])}
                          onChange={() => toggleRow(row[rowKey])}
                          className='rounded border-ui-border text-ui-accent focus:ring-ui-accent/40'
                        />
                      </td>
                    )}
                    {columns.map((col) => (
                      <td
                        key={col.key || col.dataIndex}
                        className='px-3 py-2 text-ui-text'
                        style={
                          col.width
                            ? { minWidth: typeof col.width === 'number' ? `${col.width}px` : col.width }
                            : undefined
                        }
                      >
                        {col.render
                          ? col.render(row[col.dataIndex], row)
                          : row[col.dataIndex]}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {total > 0 && (
          <Pagination page={page} pageSize={pageSize} total={total} onChange={onPageChange} />
        )}
      </div>
    </div>
  );
};

export default CrudSection;
