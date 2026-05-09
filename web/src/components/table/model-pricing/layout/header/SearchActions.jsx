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

import React, { memo, useCallback } from 'react';
import { Search, Copy, Filter } from 'lucide-react';
import Select from '../../../../common/form/Select';

const SearchActions = memo(
  ({
    selectedRowKeys = [],
    copyText,
    handleChange,
    handleCompositionStart,
    handleCompositionEnd,
    isMobile = false,
    searchValue = '',
    setShowFilterModal,
    showWithRecharge,
    setShowWithRecharge,
    currency,
    setCurrency,
    siteDisplayType,
    showRatio,
    setShowRatio,
    viewMode,
    setViewMode,
    tokenUnit,
    setTokenUnit,
    t,
  }) => {
    const supportsCurrencyDisplay = siteDisplayType !== 'TOKENS';

    const handleCopyClick = useCallback(() => {
      if (copyText && selectedRowKeys.length > 0) {
        copyText(selectedRowKeys);
      }
    }, [copyText, selectedRowKeys]);

    const handleFilterClick = useCallback(() => {
      setShowFilterModal?.(true);
    }, [setShowFilterModal]);

    const handleViewModeToggle = useCallback(() => {
      setViewMode?.(viewMode === 'table' ? 'card' : 'table');
    }, [viewMode, setViewMode]);

    const handleTokenUnitToggle = useCallback(() => {
      setTokenUnit?.(tokenUnit === 'K' ? 'M' : 'K');
    }, [tokenUnit, setTokenUnit]);

    return (
      <div className='flex items-center gap-2 w-full'>
        <div className='flex-1 relative'>
          <Search size={16} className='absolute left-3 top-1/2 -translate-y-1/2 text-ui-text-3' />
          <input
            className='w-full pl-9 pr-3.5 py-2 text-sm bg-transparent border border-ui-border rounded-xl text-ui-text placeholder:text-ui-text-3 outline-none focus:border-ui-text-3 transition-colors'
            placeholder={t('模糊搜索模型名称')}
            value={searchValue}
            onCompositionStart={handleCompositionStart}
            onCompositionEnd={handleCompositionEnd}
            onChange={(e) => handleChange(e.target.value)}
          />
        </div>

        <button
          className='inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl bg-ui-accent text-ui-accent-fg hover:bg-ui-accent-hover transition-colors disabled:opacity-50'
          onClick={handleCopyClick}
          disabled={selectedRowKeys.length === 0}
        >
          <Copy size={14} />
          {t('复制')}
        </button>

        {!isMobile && (
          <>
            <div className='border-l border-ui-border h-6 mx-1' />

            {/* 充值价格显示开关 */}
            {supportsCurrencyDisplay && (
              <div className='flex items-center gap-2'>
                <span className='text-sm text-ui-text-2'>{t('充值价格显示')}</span>
                <label className='relative inline-flex items-center cursor-pointer'>
                  <input
                    type='checkbox'
                    className='sr-only peer'
                    checked={showWithRecharge}
                    onChange={(e) => setShowWithRecharge(e.target.checked)}
                  />
                  <div className="w-9 h-5 bg-ui-bg-subtle border border-ui-border rounded-full peer peer-checked:bg-ui-accent peer-checked:border-ui-accent transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full" />
                </label>
              </div>
            )}

            {/* 货币单位选择 */}
            {supportsCurrencyDisplay && showWithRecharge && (
              <Select
                value={currency}
                onChange={setCurrency}
                options={[
                  { value: 'USD', label: 'USD' },
                  { value: 'CNY', label: 'CNY' },
                  { value: 'CUSTOM', label: t('自定义货币') },
                ]}
              />
            )}

            {/* 显示倍率开关 */}
            <div className='flex items-center gap-2'>
              <span className='text-sm text-ui-text-2'>{t('倍率')}</span>
              <label className='relative inline-flex items-center cursor-pointer'>
                <input
                  type='checkbox'
                  className='sr-only peer'
                  checked={showRatio}
                  onChange={(e) => setShowRatio(e.target.checked)}
                />
                <div className="w-9 h-5 bg-ui-bg-subtle border border-ui-border rounded-full peer peer-checked:bg-ui-accent peer-checked:border-ui-accent transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full" />
              </label>
            </div>

            {/* 视图模式切换按钮 */}
            <button
              className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-xl border transition-colors ${viewMode === 'table' ? 'bg-ui-accent text-ui-accent-fg border-ui-accent' : 'border-ui-border text-ui-text hover:bg-ui-bg-subtle'}`}
              onClick={handleViewModeToggle}
            >
              {t('表格视图')}
            </button>

            {/* Token单位切换按钮 */}
            <button
              className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-xl border transition-colors ${tokenUnit === 'K' ? 'bg-ui-accent text-ui-accent-fg border-ui-accent' : 'border-ui-border text-ui-text hover:bg-ui-bg-subtle'}`}
              onClick={handleTokenUnitToggle}
            >
              {tokenUnit}
            </button>
          </>
        )}

        {isMobile && (
          <button
            className='inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-xl border border-ui-border text-ui-text hover:bg-ui-bg-subtle transition-colors'
            onClick={handleFilterClick}
          >
            <Filter size={14} />
            {t('筛选')}
          </button>
        )}
      </div>
    );
  },
);

SearchActions.displayName = 'SearchActions';

export default SearchActions;
