/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import React, { useMemo, useState } from 'react';
import { getPricingTableColumns } from './PricingTableColumns';

const PricingTable = ({
  filteredModels,
  loading,
  rowSelection,
  pageSize,
  setPageSize,
  selectedGroup,
  groupRatio,
  copyText,
  setModalImageUrl,
  setIsModalOpenurl,
  currency,
  siteDisplayType,
  tokenUnit,
  displayPrice,
  searchValue,
  showRatio,
  compactMode = false,
  openModelDetail,
  t,
}) => {
  const [currentPage, setCurrentPage] = useState(1);

  const columns = useMemo(() => {
    return getPricingTableColumns({
      t,
      selectedGroup,
      groupRatio,
      copyText,
      setModalImageUrl,
      setIsModalOpenurl,
      currency,
      siteDisplayType,
      tokenUnit,
      displayPrice,
      showRatio,
    });
  }, [
    t,
    selectedGroup,
    groupRatio,
    copyText,
    setModalImageUrl,
    setIsModalOpenurl,
    currency,
    siteDisplayType,
    tokenUnit,
    displayPrice,
    showRatio,
  ]);

  // Filter models by search
  const filteredBySearch = useMemo(() => {
    if (!searchValue) return filteredModels;
    return filteredModels.filter((m) =>
      m.model_name?.toLowerCase().includes(searchValue.toLowerCase()),
    );
  }, [filteredModels, searchValue]);

  const totalPages = Math.ceil(filteredBySearch.length / pageSize);
  const paginatedData = filteredBySearch.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  if (!filteredModels || filteredModels.length === 0) {
    return (
      <div className='border border-ui-border rounded-xl overflow-hidden' style={{ backgroundColor: 'var(--page-bg)' }}>
        <div className='flex flex-col justify-center items-center py-20 text-ui-text-3'>
          <svg width='150' height='150' viewBox='0 0 150 150' fill='none' className='mb-4 opacity-50'>
            <circle cx='75' cy='75' r='60' stroke='currentColor' strokeWidth='2' strokeDasharray='4 4' />
            <path d='M55 65h40M55 75h30M55 85h20' stroke='currentColor' strokeWidth='2' strokeLinecap='round' />
          </svg>
          <span className='text-sm'>{t('搜索无结果')}</span>
        </div>
      </div>
    );
  }

  return (
    <div className='border border-ui-border rounded-xl overflow-hidden' style={{ backgroundColor: 'var(--page-bg)' }}>
      <div className={compactMode ? 'overflow-x-auto' : 'overflow-x-auto'}>
        <table className='w-full text-sm'>
          <thead>
            <tr className='border-b border-ui-border bg-ui-bg-subtle/50'>
              {rowSelection && (
                <th className='py-3 px-3 text-left w-10'>
                  <input type='checkbox' className='w-4 h-4 rounded border-ui-border' />
                </th>
              )}
              {columns.map((col, idx) => (
                <th key={idx} className='py-3 px-3 text-left text-ui-text-2 font-medium whitespace-nowrap'>
                  {typeof col.title === 'function' ? col.title() : col.title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length + (rowSelection ? 1 : 0)} className='py-10 text-center text-ui-text-3'>
                  <div className='flex justify-center'>
                    <div className='w-5 h-5 border-2 border-ui-text-3 border-t-transparent rounded-full animate-spin' />
                  </div>
                </td>
              </tr>
            ) : (
              paginatedData.map((record, rowIdx) => (
                <tr
                  key={record.key || record.model_name || rowIdx}
                  className='border-b border-ui-border last:border-0 hover:bg-ui-bg-subtle/30 cursor-pointer transition-colors'
                  onClick={() => openModelDetail && openModelDetail(record)}
                >
                  {rowSelection && (
                    <td className='py-3 px-3' onClick={(e) => e.stopPropagation()}>
                      <input
                        type='checkbox'
                        className='w-4 h-4 rounded border-ui-border'
                        checked={rowSelection.selectedRowKeys?.includes(record.key || record.model_name)}
                        onChange={() => {
                          const key = record.key || record.model_name;
                          const keys = rowSelection.selectedRowKeys || [];
                          const newKeys = keys.includes(key)
                            ? keys.filter((k) => k !== key)
                            : [...keys, key];
                          rowSelection.onChange?.(newKeys, null);
                        }}
                      />
                    </td>
                  )}
                  {columns.map((col, colIdx) => (
                    <td key={colIdx} className='py-3 px-3'>
                      {col.render
                        ? col.render(record[col.dataIndex], record, rowIdx)
                        : record[col.dataIndex] ?? '-'}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {/* Pagination */}
      <div className='flex justify-between items-center px-4 py-3 border-t border-ui-border'>
        <span className='text-xs text-ui-text-3'>
          {filteredBySearch.length} {t('条记录')}
        </span>
        <div className='flex items-center gap-2'>
          <button
            className='px-2 py-1 text-xs rounded border border-ui-border text-ui-text hover:bg-ui-bg-subtle disabled:opacity-50'
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage(currentPage - 1)}
          >
            ←
          </button>
          <span className='text-xs text-ui-text-2'>{currentPage}/{totalPages || 1}</span>
          <button
            className='px-2 py-1 text-xs rounded border border-ui-border text-ui-text hover:bg-ui-bg-subtle disabled:opacity-50'
            disabled={currentPage >= totalPages}
            onClick={() => setCurrentPage(currentPage + 1)}
          >
            →
          </button>
          <select
            className='px-2 py-1 text-xs border border-ui-border rounded bg-transparent text-ui-text outline-none'
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
          >
            {[10, 20, 50, 100].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};

export default PricingTable;
