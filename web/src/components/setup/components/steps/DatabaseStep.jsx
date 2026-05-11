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
import { Card } from '../../../ui';

/**
 * 数据库检查步骤组件
 * 显示当前数据库类型和相关警告信息
 */
const DatabaseStep = ({ setupStatus, renderNavigationButtons, t }) => {
  // 检测是否在 Electron 环境中运行
  const isElectron =
    typeof window !== 'undefined' && window.electron?.isElectron;

  return (
    <>
      {setupStatus.database_type === 'sqlite' && (
        <Card variant='filled' radius='lg' padding='lg'>
          <h3 className='font-semibold text-lg text-ui-text mb-4'>
            {isElectron ? t('本地数据存储') : t('数据库警告')}
          </h3>
          {isElectron ? (
            <div className='text-ui-text-2 text-sm leading-relaxed space-y-4'>
              <p>
                {t('您的数据将安全地存储在本地计算机上。所有配置、用户信息和使用记录都会自动保存，关闭应用后不会丢失。')}
              </p>
              {window.electron?.dataDir && (
                <div>
                  <p className='font-medium text-ui-text mb-2'>{t('数据存储位置：')}</p>
                  <div className='p-4 bg-[#f4f4f5] rounded-xl font-mono text-xs text-ui-text overflow-x-auto'>
                    {window.electron.dataDir}
                  </div>
                </div>
              )}
              <p>{t('提示：如需备份数据，只需复制上述目录即可')}</p>
            </div>
          ) : (
            <div className='text-ui-text-2 text-sm leading-relaxed space-y-4'>
              <p>
                {t('您正在使用 SQLite 数据库。如果您在容器环境中运行，请确保已正确设置数据库文件的持久化映射，否则容器重启后所有数据将丢失！')}
              </p>
              <p>
                {t('建议在生产环境中使用 MySQL 或 PostgreSQL 数据库，或确保 SQLite 数据库文件已映射到宿主机的持久化存储。')}
              </p>
            </div>
          )}
        </Card>
      )}

      {setupStatus.database_type === 'mysql' && (
        <Card variant='filled' radius='lg' padding='lg'>
          <h3 className='font-semibold text-lg text-ui-text mb-4'>{t('数据库信息')}</h3>
          <p className='text-ui-text-2 text-sm leading-relaxed'>
            {t('您正在使用 MySQL 数据库。MySQL 是一个可靠的关系型数据库管理系统，适合生产环境使用。')}
          </p>
        </Card>
      )}

      {setupStatus.database_type === 'postgres' && (
        <Card variant='filled' radius='lg' padding='lg'>
          <h3 className='font-semibold text-lg text-ui-text mb-4'>{t('数据库信息')}</h3>
          <p className='text-ui-text-2 text-sm leading-relaxed'>
            {t('您正在使用 PostgreSQL 数据库。PostgreSQL 是一个功能强大的开源关系型数据库系统，提供了出色的可靠性和数据完整性，适合生产环境使用。')}
          </p>
        </Card>
      )}
      {renderNavigationButtons && renderNavigationButtons()}
    </>
  );
};

export default DatabaseStep;
