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
import BellIcon from './icons/BellIcon';
import IconButton from '../../ui/IconButton';

const NotificationButton = ({ unreadCount, onNoticeOpen, t }) => {
  return (
    <div className='relative inline-flex'>
      <IconButton
        icon={BellIcon}
        variant='ghost'
        size='md'
        onClick={onNoticeOpen}
        aria-label={t('系统公告')}
      />
      {unreadCount > 0 && (
        <span className='pointer-events-none absolute top-0.5 right-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center text-[10px] font-bold bg-ui-badge text-ui-badge-fg rounded-full leading-none'>
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </div>
  );
};

export default NotificationButton;
