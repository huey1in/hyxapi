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
import { Coins } from 'lucide-react';
import { calculateModelPrice, getModelPriceItems } from '../../../../../helpers';

const ModelPricingTable = ({
  modelData,
  groupRatio,
  currency,
  siteDisplayType,
  tokenUnit,
  displayPrice,
  showRatio,
  usableGroup,
  autoGroups = [],
  t,
}) => {
  const modelEnableGroups = Array.isArray(modelData?.enable_groups)
    ? modelData.enable_groups
    : [];
  const autoChain = autoGroups.filter((g) => modelEnableGroups.includes(g));
  const renderGroupPriceTable = () => {
    // 仅展示模型可用的分组：模型 enable_groups 与用户可用分组的交集

    const availableGroups = Object.keys(usableGroup || {})
      .filter((g) => g !== '')
      .filter((g) => g !== 'auto')
      .filter((g) => modelEnableGroups.includes(g));

    // 准备表格数据
    const tableData = availableGroups.map((group) => {
      const priceData = modelData
        ? calculateModelPrice({
            record: modelData,
            selectedGroup: group,
            groupRatio,
            tokenUnit,
            displayPrice,
            currency,
            quotaDisplayType: siteDisplayType,
          })
        : { inputPrice: '-', outputPrice: '-', price: '-' };

      // 获取分组倍率
      const groupRatioValue =
        groupRatio && groupRatio[group] ? groupRatio[group] : 1;

      return {
        key: group,
        group: group,
        ratio: groupRatioValue,
        billingType:
          modelData?.quota_type === 0
            ? t('按量计费')
            : modelData?.quota_type === 1
              ? t('按次计费')
              : '-',
        priceItems: getModelPriceItems(priceData, t, siteDisplayType),
      };
    });

    return (
      <div className='overflow-x-auto rounded-lg'>
        <table className='w-full text-sm'>
          <thead>
            <tr className='border-b border-ui-border'>
              <th className='text-left py-2 px-3 text-ui-text-2 font-medium'>{t('分组')}</th>
              {showRatio && (
                <th className='text-left py-2 px-3 text-ui-text-2 font-medium'>{t('倍率')}</th>
              )}
              <th className='text-left py-2 px-3 text-ui-text-2 font-medium'>{t('计费类型')}</th>
              <th className='text-left py-2 px-3 text-ui-text-2 font-medium'>
                {siteDisplayType === 'TOKENS' ? t('计费摘要') : t('价格摘要')}
              </th>
            </tr>
          </thead>
          <tbody>
            {tableData.map((row) => {
              let billingColor = 'bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20';
              if (row.billingType === t('按量计费')) billingColor = 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20';
              else if (row.billingType === t('按次计费')) billingColor = 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20';

              return (
                <tr key={row.key} className='border-b border-ui-border last:border-0'>
                  <td className='py-2 px-3'>
                    <span className='inline-flex items-center px-2 py-0.5 text-[11px] rounded-full font-medium bg-gray-500/10 text-ui-text border border-gray-500/20'>
                      {row.group}{t('分组')}
                    </span>
                  </td>
                  {showRatio && (
                    <td className='py-2 px-3'>
                      <span className='inline-flex items-center px-2 py-0.5 text-[11px] rounded-full font-medium bg-gray-500/10 text-ui-text border border-gray-500/20'>
                        {row.ratio}x
                      </span>
                    </td>
                  )}
                  <td className='py-2 px-3'>
                    <span className={`inline-flex items-center px-2 py-0.5 text-[11px] rounded-full font-medium border ${billingColor}`}>
                      {row.billingType || '-'}
                    </span>
                  </td>
                  <td className='py-2 px-3'>
                    <div className='space-y-1'>
                      {row.priceItems.map((item) => (
                        <div key={item.key}>
                          <div className='font-semibold text-orange-600'>
                            {item.label} {item.value}
                          </div>
                          <div className='text-xs text-ui-text-2'>{item.suffix}</div>
                        </div>
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className='border border-ui-border rounded-2xl p-4' style={{ backgroundColor: 'var(--page-bg)' }}>
      <div className='flex items-center mb-4'>
        <div className='w-7 h-7 rounded-lg bg-orange-500/10 flex items-center justify-center mr-2 shadow-md'>
          <Coins size={16} className='text-orange-500' />
        </div>
        <div>
          <span className='text-lg font-medium text-ui-text'>{t('分组价格')}</span>
          <div className='text-xs text-ui-text-2'>
            {t('不同用户分组的价格信息')}
          </div>
        </div>
      </div>
      {autoChain.length > 0 && (
        <div className='flex flex-wrap items-center gap-1 mb-4'>
          <span className='text-sm text-ui-text-2'>{t('auto分组调用链路')}</span>
          <span className='text-sm'>→</span>
          {autoChain.map((g, idx) => (
            <React.Fragment key={g}>
              <span className='inline-flex items-center px-2 py-0.5 text-[11px] rounded-full font-medium bg-gray-500/10 text-ui-text border border-gray-500/20'>
                {g}{t('分组')}
              </span>
              {idx < autoChain.length - 1 && <span className='text-sm'>→</span>}
            </React.Fragment>
          ))}
        </div>
      )}
      {renderGroupPriceTable()}
    </div>
  );
};

export default ModelPricingTable;
