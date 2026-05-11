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
import { Button } from '../../ui';

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
        <Button size='lg' variant='secondary' onClick={prev}>
          {t('上一步')}
        </Button>
      )}

      {currentStep < steps.length - 1 && (
        <Button size='lg' onClick={next}>
          {t('下一步')}
        </Button>
      )}

      {currentStep === steps.length - 1 && (
        <Button size='lg' onClick={onSubmit} disabled={loading} loading={loading}>
          {loading ? t('初始化中...') : t('初始化系统')}
        </Button>
      )}
    </div>
  );
};

export default StepNavigation;
