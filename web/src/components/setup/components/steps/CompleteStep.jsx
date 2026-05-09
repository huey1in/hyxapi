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
 * 完成步骤组件
 * 显示配置总结和初始化确认界面
 */
const CompleteStep = ({
  setupStatus,
  formData,
  renderNavigationButtons,
  t,
}) => {
  return (
    <div className='py-4'>
      <h2 className='text-2xl font-semibold text-ui-text mb-3'>
        {t('准备完成初始化')}
      </h2>
      <p className='text-ui-text-2 text-base mb-8'>
        {t('请确认以下设置信息，点击"初始化系统"开始配置')}
      </p>

      <div className='p-6 rounded-2xl bg-[#fafafa] mb-8'>
        <div className='space-y-4'>
          <div className='flex justify-between items-center pb-4 border-b border-gray-200'>
            <span className='text-sm text-ui-text-2'>{t('数据库类型')}</span>
            <span className='text-base font-medium text-ui-text'>
              {setupStatus.database_type === 'sqlite'
                ? 'SQLite'
                : setupStatus.database_type === 'mysql'
                  ? 'MySQL'
                  : 'PostgreSQL'}
            </span>
          </div>
          <div className='flex justify-between items-center pb-4 border-b border-gray-200'>
            <span className='text-sm text-ui-text-2'>{t('管理员账号')}</span>
            <span className='text-base font-medium text-ui-text'>
              {setupStatus.root_init
                ? t('已初始化')
                : formData.username || t('未设置')}
            </span>
          </div>
          <div className='flex justify-between items-center'>
            <span className='text-sm text-ui-text-2'>{t('使用模式')}</span>
            <span className='text-base font-medium text-ui-text'>
              {formData.usageMode === 'external'
                ? t('对外运营模式')
                : formData.usageMode === 'self'
                  ? t('自用模式')
                  : t('演示站点模式')}
            </span>
          </div>
        </div>
      </div>

      {renderNavigationButtons && renderNavigationButtons()}
    </div>
  );
};

export default CompleteStep;
