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
import { IconButton } from '../../../../ui';
import {
  renderModelTag,
  stringToColor,
  calculateModelPrice,
  getModelPriceItems,
  getLobeHubIcon,
} from '../../../../../helpers';
import {
  renderLimitedItems,
  renderDescription,
} from '../../../../common/ui/RenderUtils';
import { useIsMobile } from '../../../../../hooks/common/useIsMobile';

function renderQuotaType(type, t) {
  switch (type) {
    case 1:
      return (
        <span className='inline-flex items-center px-2 py-0.5 text-[11px] rounded-full font-medium bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20'>
          {t('按次计费')}
        </span>
      );
    case 0:
      return (
        <span className='inline-flex items-center px-2 py-0.5 text-[11px] rounded-full font-medium bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20'>
          {t('按量计费')}
        </span>
      );
    default:
      return t('未知');
  }
}

// Render vendor name
const renderVendor = (vendorName, vendorIcon, t) => {
  if (!vendorName) return '-';
  return (
    <span className='inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded-full font-medium bg-gray-500/10 text-ui-text border border-gray-500/20'>
      {getLobeHubIcon(vendorIcon || 'Layers', 14)}
      {vendorName}
    </span>
  );
};

// Render tags list using RenderUtils
const renderTags = (text) => {
  if (!text) return '-';
  const tagsArr = text.split(',').filter((tag) => tag.trim());
  return renderLimitedItems({
    items: tagsArr,
    renderItem: (tag, idx) => {
      const color = stringToColor(tag.trim());
      return (
        <span
          key={idx}
          className='inline-flex items-center px-2 py-0.5 text-[11px] rounded-full font-medium border'
          style={{
            backgroundColor: `${color}15`,
            color: color,
            borderColor: `${color}30`,
          }}
        >
          {tag.trim()}
        </span>
      );
    },
    maxDisplay: 3,
  });
};

function renderSupportedEndpoints(endpoints) {
  if (!endpoints || endpoints.length === 0) {
    return null;
  }
  return (
    <div className='flex flex-wrap gap-1'>
      {endpoints.map((endpoint) => {
        const color = stringToColor(endpoint);
        return (
          <span
            key={endpoint}
            className='inline-flex items-center px-2 py-0.5 text-[11px] rounded-full font-medium border'
            style={{
              backgroundColor: `${color}15`,
              color: color,
              borderColor: `${color}30`,
            }}
          >
            {endpoint}
          </span>
        );
      })}
    </div>
  );
}

export const getPricingTableColumns = ({
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
}) => {
  const isMobile = useIsMobile();
  const priceDataCache = new WeakMap();

  const getPriceData = (record) => {
    let cache = priceDataCache.get(record);
    if (!cache) {
      cache = calculateModelPrice({
        record,
        selectedGroup,
        groupRatio,
        tokenUnit,
        displayPrice,
        currency,
        quotaDisplayType: siteDisplayType,
      });
      priceDataCache.set(record, cache);
    }
    return cache;
  };

  const endpointColumn = {
    title: t('可用端点类型'),
    dataIndex: 'supported_endpoint_types',
    render: (text, record, index) => {
      return renderSupportedEndpoints(text);
    },
  };

  const modelNameColumn = {
    title: t('模型名称'),
    dataIndex: 'model_name',
    render: (text, record, index) => {
      return renderModelTag(text, {
        onClick: () => {
          copyText(text);
        },
      });
    },
    onFilter: (value, record) =>
      record.model_name.toLowerCase().includes(value.toLowerCase()),
  };

  const quotaColumn = {
    title: t('计费类型'),
    dataIndex: 'quota_type',
    render: (text, record, index) => {
      return renderQuotaType(parseInt(text), t);
    },
    sorter: (a, b) => a.quota_type - b.quota_type,
  };

  const descriptionColumn = {
    title: t('描述'),
    dataIndex: 'description',
    render: (text) => renderDescription(text, 200),
  };

  const tagsColumn = {
    title: t('标签'),
    dataIndex: 'tags',
    render: renderTags,
  };

  const vendorColumn = {
    title: t('供应商'),
    dataIndex: 'vendor_name',
    render: (text, record) => renderVendor(text, record.vendor_icon, t),
  };

  const baseColumns = [
    modelNameColumn,
    vendorColumn,
    descriptionColumn,
    tagsColumn,
    quotaColumn,
  ];

  const ratioColumn = {
    title: () => (
      <div className='flex items-center space-x-1'>
        <span>{t('倍率')}</span>
        <IconButton
          icon={HelpCircle}
          size='xs'
          title={t('倍率是为了方便换算不同价格的模型')}
          onClick={() => {
            setModalImageUrl('/ratio.png');
            setIsModalOpenurl(true);
          }}
        />
      </div>
    ),
    dataIndex: 'model_ratio',
    render: (text, record, index) => {
      const completionRatio = parseFloat(record.completion_ratio.toFixed(3));
      const priceData = getPriceData(record);

      return (
        <div className='space-y-1'>
          <div className='text-ui-text'>
            {t('模型倍率')}：{record.quota_type === 0 ? text : t('无')}
          </div>
          <div className='text-ui-text'>
            {t('补全倍率')}：
            {record.quota_type === 0 ? completionRatio : t('无')}
          </div>
          <div className='text-ui-text'>
            {t('分组倍率')}：{priceData?.usedGroupRatio ?? '-'}
          </div>
        </div>
      );
    },
  };

  const priceColumn = {
    title: siteDisplayType === 'TOKENS' ? t('计费摘要') : t('模型价格'),
    dataIndex: 'model_price',
    ...(isMobile ? {} : { fixed: 'right' }),
    render: (text, record, index) => {
      const priceData = getPriceData(record);
      const priceItems = getModelPriceItems(priceData, t, siteDisplayType);

      return (
        <div className='space-y-1'>
          {priceItems.map((item) => (
            <div key={item.key} className='text-ui-text'>
              {item.label} {item.value}
              {item.suffix}
            </div>
          ))}
        </div>
      );
    },
  };

  const columns = [...baseColumns];
  columns.push(endpointColumn);
  if (showRatio) {
    columns.push(ratioColumn);
  }
  columns.push(priceColumn);
  return columns;
};
