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

import React from 'react';
import ModalDialog from '../../../common/ModalDialog';
import { getLogsColumns } from '../UsageLogsColumnDefs';

const ColumnSelectorModal = ({
  showColumnSelector,
  setShowColumnSelector,
  visibleColumns,
  handleColumnVisibilityChange,
  handleSelectAll,
  initDefaultColumns,
  billingDisplayMode,
  setBillingDisplayMode,
  COLUMN_KEYS,
  isAdminUser,
  copyText,
  showUserInfoFunc,
  t,
}) => {
  const handleBillingDisplayModeChange = (val) => {
    setBillingDisplayMode(val);
  };

  const isTokensDisplay =
    typeof localStorage !== 'undefined' &&
    localStorage.getItem('quota_display_type') === 'TOKENS';

  // Get all columns for display in selector
  const allColumns = getLogsColumns({
    t,
    COLUMN_KEYS,
    copyText,
    showUserInfoFunc,
    isAdminUser,
    billingDisplayMode,
  });

  const allChecked = Object.values(visibleColumns).every((v) => v === true);
  const someChecked = Object.values(visibleColumns).some((v) => v === true);

  return (
    <ModalDialog
      open={showColumnSelector}
      onClose={() => setShowColumnSelector(false)}
      title={t('列设置')}
      footer={
        <>
          <button
            onClick={() => initDefaultColumns()}
            className='px-4 py-2 text-sm font-medium rounded-xl border border-ui-border text-ui-text hover:bg-ui-bg-subtle transition-colors'
          >
            {t('重置')}
          </button>
          <button
            onClick={() => setShowColumnSelector(false)}
            className='px-4 py-2 text-sm font-medium rounded-xl border border-ui-border text-ui-text hover:bg-ui-bg-subtle transition-colors'
          >
            {t('取消')}
          </button>
          <button
            onClick={() => setShowColumnSelector(false)}
            className='inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl bg-ui-accent text-ui-accent-fg hover:bg-ui-accent-hover transition-colors'
          >
            {t('确定')}
          </button>
        </>
      }
    >
      <div style={{ marginBottom: 20 }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 8, fontWeight: 600 }} className='text-sm text-ui-text'>{t('计费显示模式')}</div>
          <div className='flex gap-1 p-1 bg-ui-bg-subtle rounded-xl'>
            <button
              type='button'
              onClick={() => handleBillingDisplayModeChange('price')}
              className={`flex-1 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                billingDisplayMode === 'price'
                  ? 'bg-ui-bg-elevated text-ui-text font-medium shadow-sm'
                  : 'text-ui-text-2 hover:text-ui-text'
              }`}
            >
              {isTokensDisplay ? t('价格模式') : t('价格模式（默认）')}
            </button>
            <button
              type='button'
              onClick={() => handleBillingDisplayModeChange('ratio')}
              className={`flex-1 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                billingDisplayMode === 'ratio'
                  ? 'bg-ui-bg-elevated text-ui-text font-medium shadow-sm'
                  : 'text-ui-text-2 hover:text-ui-text'
              }`}
            >
              {isTokensDisplay ? t('倍率模式（默认）') : t('倍率模式')}
            </button>
          </div>
        </div>
        <label className='flex items-center gap-2 cursor-pointer'>
          <input
            type='checkbox'
            checked={allChecked}
            ref={(el) => {
              if (el) el.indeterminate = someChecked && !allChecked;
            }}
            onChange={(e) => handleSelectAll(e.target.checked)}
            className='w-4 h-4 rounded border-ui-border text-ui-accent'
          />
          <span className='text-sm text-ui-text'>{t('全选')}</span>
        </label>
      </div>
      <div
        className='flex flex-wrap max-h-96 overflow-y-auto rounded-lg p-4 border border-ui-border'
      >
        {allColumns.map((column) => {
          // Skip admin-only columns for non-admin users
          if (
            !isAdminUser &&
            (column.key === COLUMN_KEYS.CHANNEL ||
              column.key === COLUMN_KEYS.USERNAME ||
              column.key === COLUMN_KEYS.RETRY)
          ) {
            return null;
          }

          return (
            <div key={column.key} className='w-1/2 mb-4 pr-2'>
              <label className='flex items-center gap-2 cursor-pointer'>
                <input
                  type='checkbox'
                  checked={!!visibleColumns[column.key]}
                  onChange={(e) =>
                    handleColumnVisibilityChange(column.key, e.target.checked)
                  }
                  className='w-4 h-4 rounded border-ui-border text-ui-accent'
                />
                <span className='text-sm text-ui-text'>{column.title}</span>
              </label>
            </div>
          );
        })}
      </div>
    </ModalDialog>
  );
};

export default ColumnSelectorModal;
