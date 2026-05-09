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

/**
 * 使用模式选择步骤组件
 * 提供系统使用模式的选择界面
 */
const UsageModeStep = ({
  formData,
  handleUsageModeChange,
  renderNavigationButtons,
  t,
}) => {
  const options = [
    {
      value: 'external',
      label: t('对外运营模式'),
      description: t('适用于为多个用户提供服务的场景'),
    },
    {
      value: 'self',
      label: t('自用模式'),
      description: t('适用于个人使用的场景，不需要设置模型价格'),
    },
    {
      value: 'demo',
      label: t('演示站点模式'),
      description: t('适用于展示系统功能的场景，提供基础功能演示'),
    },
  ];

  return (
    <>
      <div className='space-y-3'>
        {options.map((option) => (
          <label
            key={option.value}
            className={`block border rounded-2xl p-5 cursor-pointer transition-colors bg-ui-bg-elevated hover:bg-[#fafafa] ${
              formData.usageMode === option.value
                ? 'border-blue-500 ring-1 ring-blue-500'
                : 'border-black'
            }`}
            onClick={() => handleUsageModeChange(option.value)}
          >
            <div className='flex items-center gap-3'>
              <input
                type='radio'
                name='usage-mode-selection'
                value={option.value}
                checked={formData.usageMode === option.value}
                onChange={() => handleUsageModeChange(option.value)}
                className='w-4 h-4 text-blue-600'
              />
              <div>
                <span className='text-base font-semibold text-ui-text'>
                  {option.label}
                </span>
                <p className='text-sm text-ui-text-2 mt-0.5'>
                  {option.description}
                </p>
              </div>
            </div>
          </label>
        ))}
      </div>
      {renderNavigationButtons && renderNavigationButtons()}
    </>
  );
};

export default UsageModeStep;
