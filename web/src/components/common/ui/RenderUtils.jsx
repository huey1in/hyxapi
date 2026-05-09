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

// 通用渲染函数：限制项目数量显示，支持popover展开
export function renderLimitedItems({ items, renderItem, maxDisplay = 3 }) {
  if (!items || items.length === 0) return '-';
  const displayItems = items.slice(0, maxDisplay);
  const remainingItems = items.slice(maxDisplay);
  return (
    <span className='inline-flex flex-wrap gap-1'>
      {displayItems.map((item, idx) => renderItem(item, idx))}
      {remainingItems.length > 0 && (
        <span
          className='inline-flex items-center px-1.5 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600 cursor-default'
          title={remainingItems.map((item) => (typeof item === 'string' ? item : '')).join(', ')}
        >
          +{remainingItems.length}
        </span>
      )}
    </span>
  );
}

// 渲染描述字段，长文本支持tooltip
export const renderDescription = (text, maxWidth = 200) => {
  return (
    <span
      className='block truncate'
      style={{ maxWidth }}
      title={text || '-'}
    >
      {text || '-'}
    </span>
  );
};
