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
import { HelpCircle } from 'lucide-react';
import { Copy } from 'lucide-react';
import {
  stringToColor,
  calculateModelPrice,
  formatPriceInfo,
  getLobeHubIcon,
} from '../../../../../helpers';
import PricingCardSkeleton from './PricingCardSkeleton';
import { useMinimumLoadingTime } from '../../../../../hooks/common/useMinimumLoadingTime';
import { renderLimitedItems } from '../../../../common/ui/RenderUtils';
import { useIsMobile } from '../../../../../hooks/common/useIsMobile';

const CARD_STYLES = {
  container:
    'w-12 h-12 rounded-2xl flex items-center justify-center relative shadow-md',
  icon: 'w-8 h-8 flex items-center justify-center',
  selected: 'border-blue-500 bg-blue-50',
  default: 'border-gray-200 hover:border-gray-300',
};

const PricingCardView = ({
  filteredModels,
  loading,
  rowSelection,
  pageSize,
  setPageSize,
  currentPage,
  setCurrentPage,
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
  t,
  selectedRowKeys = [],
  setSelectedRowKeys,
  openModelDetail,
}) => {
  const showSkeleton = useMinimumLoadingTime(loading);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedModels = filteredModels.slice(
    startIndex,
    startIndex + pageSize,
  );
  const getModelKey = (model) => model.key ?? model.model_name ?? model.id;
  const isMobile = useIsMobile();

  const handleCheckboxChange = (model, checked) => {
    if (!setSelectedRowKeys) return;
    const modelKey = getModelKey(model);
    const newKeys = checked
      ? Array.from(new Set([...selectedRowKeys, modelKey]))
      : selectedRowKeys.filter((key) => key !== modelKey);
    setSelectedRowKeys(newKeys);
    rowSelection?.onChange?.(newKeys, null);
  };

  // 获取模型图标
  const getModelIcon = (model) => {
    if (!model || !model.model_name) {
      return (
        <div className={CARD_STYLES.container}>
          <div className='w-12 h-12 rounded-2xl bg-ui-bg-subtle flex items-center justify-center text-sm font-bold text-ui-text-2'>?</div>
        </div>
      );
    }
    // 1) 优先使用模型自定义图标
    if (model.icon) {
      return (
        <div className={CARD_STYLES.container}>
          <div className={CARD_STYLES.icon}>
            {getLobeHubIcon(model.icon, 32)}
          </div>
        </div>
      );
    }
    // 2) 退化为供应商图标
    if (model.vendor_icon) {
      return (
        <div className={CARD_STYLES.container}>
          <div className={CARD_STYLES.icon}>
            {getLobeHubIcon(model.vendor_icon, 32)}
          </div>
        </div>
      );
    }

    // 如果没有供应商图标，使用模型名称生成头像

    const avatarText = model.model_name.slice(0, 2).toUpperCase();
    return (
      <div className={CARD_STYLES.container}>
        <div
          className='flex items-center justify-center text-base font-bold text-ui-text'
          style={{
            width: 48,
            height: 48,
            borderRadius: 16,
            backgroundColor: 'var(--page-bg)',
          }}
        >
          {avatarText}
        </div>
      </div>
    );
  };

  // 获取模型描述
  const getModelDescription = (record) => {
    return record.description || '';
  };

  // 渲染标签
  const renderTags = (record) => {
    // 计费类型标签（左边）
    let billingTag = (
      <span key='billing' className='inline-flex items-center px-2 py-0.5 text-[11px] rounded-full font-medium bg-gray-500/10 text-ui-text border border-gray-500/20'>
        -
      </span>
    );
    if (record.quota_type === 1) {
      billingTag = (
        <span key='billing' className='inline-flex items-center px-2 py-0.5 text-[11px] rounded-full font-medium bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20'>
          {t('按次计费')}
        </span>
      );
    } else if (record.quota_type === 0) {
      billingTag = (
        <span key='billing' className='inline-flex items-center px-2 py-0.5 text-[11px] rounded-full font-medium bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20'>
          {t('按量计费')}
        </span>
      );
    }

    // 自定义标签（右边）
    const customTags = [];
    if (record.tags) {
      const tagArr = record.tags.split(',').filter(Boolean);
      tagArr.forEach((tg, idx) => {
        const color = stringToColor(tg);
        customTags.push(
          <span
            key={`custom-${idx}`}
            className='inline-flex items-center px-2 py-0.5 text-[11px] rounded-full font-medium border'
            style={{
              backgroundColor: `${color}15`,
              color: color,
              borderColor: `${color}30`,
            }}
          >
            {tg}
          </span>,
        );
      });
    }

    return (
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-2'>{billingTag}</div>
        <div className='flex items-center gap-1'>
          {customTags.length > 0 &&
            renderLimitedItems({
              items: customTags.map((tag, idx) => ({
                key: `custom-${idx}`,
                element: tag,
              })),
              renderItem: (item, idx) => item.element,
              maxDisplay: 3,
            })}
        </div>
      </div>
    );
  };

  // 显示骨架屏
  if (showSkeleton) {
    return (
      <PricingCardSkeleton
        rowSelection={!!rowSelection}
        showRatio={showRatio}
      />
    );
  }

  if (!filteredModels || filteredModels.length === 0) {
    return (
      <div className='flex flex-col justify-center items-center py-20 text-ui-text-3'>
        <svg width='150' height='150' viewBox='0 0 150 150' fill='none' className='mb-4 opacity-50'>
          <circle cx='75' cy='75' r='60' stroke='currentColor' strokeWidth='2' strokeDasharray='4 4' />
          <path d='M55 65h40M55 75h30M55 85h20' stroke='currentColor' strokeWidth='2' strokeLinecap='round' />
        </svg>
        <span className='text-sm'>{t('搜索无结果')}</span>
      </div>
    );
  }

  return (
    <div className='px-2 pt-2'>
      <div className='grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-4'>
        {paginatedModels.map((model, index) => {
          const modelKey = getModelKey(model);
          const isSelected = selectedRowKeys.includes(modelKey);

          const priceData = calculateModelPrice({
            record: model,
            selectedGroup,
            groupRatio,
            tokenUnit,
            displayPrice,
            currency,
            quotaDisplayType: siteDisplayType,
          });

          return (
            <div
              key={modelKey || index}
              className={`rounded-2xl transition-all duration-200 hover:shadow-lg border cursor-pointer p-4 ${isSelected ? CARD_STYLES.selected : CARD_STYLES.default}`}
              style={{ backgroundColor: 'var(--page-bg)' }}
              onClick={() => openModelDetail && openModelDetail(model)}
            >
              <div className='flex flex-col h-full'>
                {/* 头部：图标 + 模型名称 + 操作按钮 */}
                <div className='flex items-start justify-between mb-3'>
                  <div className='flex items-start space-x-3 flex-1 min-w-0'>
                    {getModelIcon(model)}
                    <div className='flex-1 min-w-0'>
                      <h3 className='text-lg font-bold text-ui-text truncate'>
                        {model.model_name}
                      </h3>
                      <div className='flex flex-col gap-1 text-xs mt-1'>
                        {formatPriceInfo(priceData, t, siteDisplayType)}
                      </div>
                    </div>
                  </div>

                  <div className='flex items-center space-x-2 ml-3'>
                    {/* 复制按钮 */}
                    <button
                      className='inline-flex items-center justify-center w-8 h-8 rounded-lg text-ui-text-3 hover:text-ui-text hover:bg-ui-bg-subtle transition-colors'
                      onClick={(e) => {
                        e.stopPropagation();
                        copyText(model.model_name);
                      }}
                    >
                      <Copy size={12} />
                    </button>

                    {/* 选择框 */}
                    {rowSelection && (
                      <input
                        type='checkbox'
                        checked={isSelected}
                        className='w-4 h-4 rounded border-ui-border text-ui-accent cursor-pointer'
                        onChange={(e) => {
                          e.stopPropagation();
                          handleCheckboxChange(model, e.target.checked);
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    )}
                  </div>
                </div>

                {/* 模型描述 - 占据剩余空间 */}
                <div className='flex-1 mb-4'>
                  <p className='text-xs line-clamp-2 leading-relaxed text-ui-text-2'>
                    {getModelDescription(model)}
                  </p>
                </div>

                {/* 底部区域 */}
                <div className='mt-auto'>
                  {/* 标签区域 */}
                  {renderTags(model)}

                  {/* 倍率信息（可选） */}
                  {showRatio && (
                    <div className='pt-3'>
                      <div className='flex items-center space-x-1 mb-2'>
                        <span className='text-xs font-medium text-ui-text'>
                          {t('倍率信息')}
                        </span>
                        <button
                          className='text-blue-500 cursor-pointer'
                          title={t('倍率是为了方便换算不同价格的模型')}
                          onClick={(e) => {
                            e.stopPropagation();
                            setModalImageUrl('/ratio.png');
                            setIsModalOpenurl(true);
                          }}
                        >
                          <HelpCircle size={14} />
                        </button>
                      </div>
                      <div className='grid grid-cols-3 gap-2 text-xs text-ui-text-2'>
                        <div>
                          {t('模型')}:{' '}
                          {model.quota_type === 0 ? model.model_ratio : t('无')}
                        </div>
                        <div>
                          {t('补全')}:{' '}
                          {model.quota_type === 0
                            ? parseFloat(model.completion_ratio.toFixed(3))
                            : t('无')}
                        </div>
                        <div>
                          {t('分组')}: {priceData?.usedGroupRatio ?? '-'}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 分页 */}
      {filteredModels.length > 0 && (
        <div className='flex justify-center items-center gap-4 mt-6 py-4 border-t pricing-pagination-divider'>
          <button
            className='px-3 py-1.5 text-sm rounded-lg border border-ui-border text-ui-text hover:bg-ui-bg-subtle transition-colors disabled:opacity-50'
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage(currentPage - 1)}
          >
            ←
          </button>
          <span className='text-sm text-ui-text-2'>
            {currentPage} / {Math.ceil(filteredModels.length / pageSize)}
          </span>
          <button
            className='px-3 py-1.5 text-sm rounded-lg border border-ui-border text-ui-text hover:bg-ui-bg-subtle transition-colors disabled:opacity-50'
            disabled={currentPage >= Math.ceil(filteredModels.length / pageSize)}
            onClick={() => setCurrentPage(currentPage + 1)}
          >
            →
          </button>
          <select
            className='px-2 py-1.5 text-sm border border-ui-border rounded-lg bg-transparent text-ui-text outline-none'
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
          >
            {[10, 20, 50, 100].map((size) => (
              <option key={size} value={size}>{size} / page</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
};

export default PricingCardView;
