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
import { renderQuota } from '../../../helpers';
import CompactModeToggle from '../../common/ui/CompactModeToggle';
import { useMinimumLoadingTime } from '../../../hooks/common/useMinimumLoadingTime';

const LogsActions = ({
  stat,
  loadingStat,
  showStat,
  compactMode,
  setCompactMode,
  t,
}) => {
  const showSkeleton = useMinimumLoadingTime(loadingStat);
  const needSkeleton = !showStat || showSkeleton;

  return (
    <div className='flex flex-col md:flex-row justify-between items-start md:items-center gap-2 w-full'>
      {needSkeleton ? (
        <div className='flex gap-2'>
          <span className='inline-block w-[108px] h-[21px] rounded-md bg-ui-bg-subtle animate-pulse' />
          <span className='inline-block w-[65px] h-[21px] rounded-md bg-ui-bg-subtle animate-pulse' />
          <span className='inline-block w-[64px] h-[21px] rounded-md bg-ui-bg-subtle animate-pulse' />
        </div>
      ) : (
        <div className='flex flex-wrap gap-2'>
          <span
            className='inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400'
            style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)' }}
          >
            {t('消耗额度')}: {renderQuota(stat.quota)}
          </span>
          <span
            className='inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg bg-pink-500/10 text-pink-600 dark:text-pink-400 border border-pink-500/20'
            style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)' }}
          >
            RPM: {stat.rpm}
          </span>
          <span
            className='inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-500/10 text-gray-600 dark:text-gray-400 border border-gray-500/20'
            style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)' }}
          >
            TPM: {stat.tpm}
          </span>
        </div>
      )}

      <CompactModeToggle
        compactMode={compactMode}
        setCompactMode={setCompactMode}
        t={t}
      />
    </div>
  );
};

export default LogsActions;
