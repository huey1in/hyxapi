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
 * 步骤导航组件
 * 负责渲染上一步、下一步和完成按钮
 */
const StepNavigation = ({
  currentStep,
  steps,
  prev,
  next,
  onSubmit,
  loading,
  t,
}) => {
  return (
    <div className='flex justify-end items-center pt-12 gap-4'>
      {currentStep > 0 && (
        <button
          onClick={prev}
          className='px-6 py-3 text-sm border border-gray-300 rounded-lg text-ui-text-2 bg-ui-bg-elevated hover:bg-ui-bg-subtle transition-colors font-medium'
        >
          {t('上一步')}
        </button>
      )}

      {currentStep < steps.length - 1 && (
        <button
          onClick={next}
          className='px-8 py-3 text-sm rounded-lg transition-colors font-medium bg-black text-white hover:bg-[#333333]'
        >
          {t('下一步')}
        </button>
      )}

      {currentStep === steps.length - 1 && (
        <button
          onClick={onSubmit}
          disabled={loading}
          className='px-8 py-3 text-sm rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed bg-black text-white hover:bg-[#333333]'
        >
          {loading ? t('初始化中...') : t('初始化系统')}
        </button>
      )}
    </div>
  );
};

export default StepNavigation;
