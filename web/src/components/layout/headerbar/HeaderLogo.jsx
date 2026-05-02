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
import { Link } from 'react-router-dom';
import SkeletonWrapper from '../components/SkeletonWrapper';

const HeaderLogo = ({
  isMobile,
  isConsoleRoute,
  logo,
  logoLoaded,
  isLoading,
  systemName,
  isSelfUseMode,
  isDemoSiteMode,
  t,
}) => {
  if (isMobile && isConsoleRoute) return null;

  return (
    <Link to='/' className='group flex items-center gap-2'>
      <div className='flex items-center gap-2'>
        <SkeletonWrapper loading={isLoading} type='title' width={120} height={24}>
          <span
            className='text-2xl font-bold text-ui-text transition-opacity group-hover:opacity-80'
            style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '-0.03em' }}
          >
            {systemName === 'TokenC' ? (
              <>
                Token<span className='text-ui-brand'>C</span>
              </>
            ) : (
              systemName
            )}
          </span>
        </SkeletonWrapper>
        {(isSelfUseMode || isDemoSiteMode) && !isLoading && (
          <span
            className='text-xs px-2 py-0.5 rounded-full font-medium'
            style={isSelfUseMode
              ? { background: 'var(--ui-tag-purple-bg)', color: 'var(--ui-tag-purple)' }
              : { background: 'var(--ui-tag-blue-bg)', color: 'var(--ui-tag-blue)' }
            }
          >
            {isSelfUseMode ? t('自用模式') : t('演示站点')}
          </span>
        )}
      </div>
    </Link>
  );
};

export default HeaderLogo;
