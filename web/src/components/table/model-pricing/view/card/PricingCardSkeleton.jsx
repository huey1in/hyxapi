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

const PricingCardSkeleton = ({
  skeletonCount = 100,
  rowSelection = false,
  showRatio = false,
}) => {
  return (
    <div className='px-2 pt-2'>
      <div className='grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-4'>
        {Array.from({ length: skeletonCount }).map((_, index) => (
          <div
            key={index}
            className='rounded-2xl border border-ui-border p-6'
            style={{ backgroundColor: 'var(--page-bg)' }}
          >
            {/* 头部：图标 + 模型名称 + 操作按钮 */}
            <div className='flex items-start justify-between mb-3'>
              <div className='flex items-start space-x-3 flex-1 min-w-0'>
                {/* 模型图标骨架 */}
                <div className='w-12 h-12 rounded-2xl animate-pulse bg-ui-bg-subtle' />
                {/* 模型名称和价格区域 */}
                <div className='flex-1 min-w-0'>
                  {/* 模型名称骨架 */}
                  <div
                    className='animate-pulse bg-ui-bg-subtle rounded-md mb-2'
                    style={{ width: `${120 + (index % 3) * 30}px`, height: 20 }}
                  />
                  {/* 价格信息骨架 */}
                  <div
                    className='animate-pulse bg-ui-bg-subtle rounded-md'
                    style={{ width: `${160 + (index % 4) * 20}px`, height: 20 }}
                  />
                </div>
              </div>

              <div className='flex items-center space-x-2 ml-3'>
                {/* 复制按钮骨架 */}
                <div className='w-4 h-4 animate-pulse bg-ui-bg-subtle rounded' />
                {/* 勾选框骨架 */}
                {rowSelection && (
                  <div className='w-4 h-4 animate-pulse bg-ui-bg-subtle rounded-sm' />
                )}
              </div>
            </div>

            {/* 模型描述骨架 */}
            <div className='mb-4 space-y-2'>
              <div className='animate-pulse bg-ui-bg-subtle rounded h-3 w-full' />
              <div className='animate-pulse bg-ui-bg-subtle rounded h-3 w-3/4' />
            </div>

            {/* 标签区域骨架 */}
            <div className='flex flex-wrap gap-2'>
              {Array.from({ length: 2 + (index % 3) }).map((_, tagIndex) => (
                <div
                  key={tagIndex}
                  className='animate-pulse bg-ui-bg-subtle rounded-full'
                  style={{ width: 64, height: 18 }}
                />
              ))}
            </div>

            {/* 倍率信息骨架（可选） */}
            {showRatio && (
              <div className='mt-4 pt-3 border-t border-ui-border'>
                <div className='flex items-center space-x-1 mb-2'>
                  <div className='animate-pulse bg-ui-bg-subtle rounded h-3 w-15' />
                  <div className='animate-pulse bg-ui-bg-subtle rounded-full w-3.5 h-3.5' />
                </div>
                <div className='grid grid-cols-3 gap-2'>
                  {Array.from({ length: 3 }).map((_, ratioIndex) => (
                    <div
                      key={ratioIndex}
                      className='animate-pulse bg-ui-bg-subtle rounded h-3 w-full'
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 分页骨架 */}
      <div className='flex justify-center mt-6 py-4 border-t pricing-pagination-divider'>
        <div className='animate-pulse bg-ui-bg-subtle rounded-lg' style={{ width: 300, height: 32 }} />
      </div>
    </div>
  );
};

export default PricingCardSkeleton;
