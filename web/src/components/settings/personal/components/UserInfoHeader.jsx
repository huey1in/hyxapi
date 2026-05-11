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
import {
  isRoot,
  isAdmin,
  renderQuota,
  stringToColor,
} from '../../../../helpers';
import { Card } from '../../../ui';

const UserInfoHeader = ({ t, userState }) => {
  const getUsername = () => {
    if (userState.user) {
      return userState.user.username;
    } else {
      return 'null';
    }
  };

  const getAvatarText = () => {
    const username = getUsername();
    if (username && username.length > 0) {
      return username.slice(0, 2).toUpperCase();
    }
    return 'NA';
  };

  return (
    <Card padding='none'>
      {/* Cover */}
      <div
        className='relative h-32'
        style={{
          '--palette-primary-darkerChannel': '0 75 80',
          backgroundImage: `linear-gradient(0deg, rgba(var(--palette-primary-darkerChannel) / 80%), rgba(var(--palette-primary-darkerChannel) / 80%)), url('/cover-4.webp')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      >
        {/* User info content */}
        <div className='relative z-10 h-full flex flex-col justify-end p-6'>
          <div className='flex items-center'>
            <div className='flex items-stretch gap-3 sm:gap-4 flex-1 min-w-0'>
              <div
                className='w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0'
                style={{ backgroundColor: stringToColor(getUsername()) }}
              >
                {getAvatarText()}
              </div>
              <div className='flex-1 min-w-0 flex flex-col justify-between'>
                <div
                  className='text-3xl font-bold truncate'
                  style={{ color: 'white' }}
                >
                  {getUsername()}
                </div>
                <div className='flex flex-wrap items-center gap-2'>
                  {isRoot() ? (
                    <span className='inline-flex items-center px-2.5 py-0.5 text-xs rounded-full font-medium text-white/90 border border-white/30'>
                      {t('超级管理员')}
                    </span>
                  ) : isAdmin() ? (
                    <span className='inline-flex items-center px-2.5 py-0.5 text-xs rounded-full font-medium text-white/90 border border-white/30'>
                      {t('管理员')}
                    </span>
                  ) : (
                    <span className='inline-flex items-center px-2.5 py-0.5 text-xs rounded-full font-medium text-white/90 border border-white/30'>
                      {t('普通用户')}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className='p-4'>
        {/* Balance and desktop stats */}
        <div className='flex items-start justify-between gap-6'>
          {/* Balance display */}
          <div className='relative'>
            <span className='absolute -top-2 -right-2 inline-flex items-center px-1.5 py-0.5 text-[10px] rounded-md font-medium bg-red-500/10 text-red-600 border border-red-500/20'>
              {t('当前余额')}
            </span>
            <div className='text-2xl sm:text-3xl md:text-4xl font-bold tracking-wide text-ui-text'>
              {renderQuota(userState?.user?.quota)}
            </div>
          </div>

          {/* Desktop stats */}
          <div className='hidden lg:block flex-shrink-0'>
            <Card padding='none' radius='md' className='px-4 py-3'>
              <div className='flex items-center gap-4'>
                <div className='flex items-center gap-2'>
                  <span className='text-sm text-ui-text-2'>
                    {t('历史消耗')}
                  </span>
                  <span className='text-sm text-ui-text-2 font-semibold'>
                    {renderQuota(userState?.user?.used_quota)}
                  </span>
                </div>
                <div className='w-px h-4 bg-ui-border' />
                <div className='flex items-center gap-2'>
                  <span className='text-sm text-ui-text-2'>
                    {t('请求次数')}
                  </span>
                  <span className='text-sm text-ui-text-2 font-semibold'>
                    {userState.user?.request_count || 0}
                  </span>
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* Mobile stats */}
        <div className='lg:hidden mt-2'>
          <Card padding='none' radius='md' className='px-4 py-3'>
            <div className='space-y-3'>
              <div className='flex items-center justify-between'>
                <span className='text-sm text-ui-text-2'>
                  {t('历史消耗')}
                </span>
                <span className='text-sm text-ui-text-2 font-semibold'>
                  {renderQuota(userState?.user?.used_quota)}
                </span>
              </div>
              <div className='border-t border-ui-border' />
              <div className='flex items-center justify-between'>
                <span className='text-sm text-ui-text-2'>
                  {t('请求次数')}
                </span>
                <span className='text-sm text-ui-text-2 font-semibold'>
                  {userState.user?.request_count || 0}
                </span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </Card>
  );
};

export default UserInfoHeader;
