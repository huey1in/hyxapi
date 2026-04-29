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

import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, LogOut, Settings, Key, CreditCard } from 'lucide-react';
import { stringToColor } from '../../../helpers';
import SkeletonWrapper from '../components/SkeletonWrapper';

const UserArea = ({
  userState,
  isLoading,
  isMobile,
  isSelfUseMode,
  logout,
  navigate,
  t,
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (isLoading) {
    return (
      <SkeletonWrapper loading={true} type='userArea' width={50} isMobile={isMobile} />
    );
  }

  if (userState.user) {
    const menuItems = [
      { icon: <Settings size={15} />, label: t('个人设置'), path: '/console/personal' },
      { icon: <Key size={15} />, label: t('令牌管理'), path: '/console/token' },
      { icon: <CreditCard size={15} />, label: t('钱包管理'), path: '/console/topup' },
    ];

    return (
      <div className='relative' ref={ref}>
        <button
          onClick={() => setOpen((o) => !o)}
          className='flex items-center gap-1.5 px-2 py-1.5 rounded-full hover:bg-ui-bg-subtle transition-colors'
        >
          <span
            className='flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold flex-shrink-0'
            style={{ backgroundColor: stringToColor(userState.user.username), color: '#fff' }}
          >
            {userState.user.username[0].toUpperCase()}
          </span>
          <span className='hidden md:block text-xs font-medium text-ui-text'>
            {userState.user.username}
          </span>
          <ChevronDown size={14} className='text-ui-text-3' />
        </button>

        {open && (
          <div className='absolute right-0 mt-2 w-44 bg-ui-bg-elevated border border-ui-border rounded-xl shadow-lg py-1 z-50'>
            {menuItems.map((item) => (
              <button
                key={item.label}
                onClick={() => { navigate(item.path); setOpen(false); }}
                className='flex items-center gap-2.5 w-full px-3 py-2 text-sm text-ui-text hover:bg-ui-bg-subtle transition-colors'
              >
                <span className='text-ui-text-3 flex-shrink-0'>{item.icon}</span>
                {item.label}
              </button>
            ))}
            <div className='my-1 border-t border-ui-divider' />
            <button
              onClick={() => { logout(); setOpen(false); }}
              className='flex items-center gap-2.5 w-full px-3 py-2 text-sm text-ui-danger hover:bg-ui-danger-bg transition-colors'
            >
              <LogOut size={15} className='flex-shrink-0' />
              {t('退出')}
            </button>
          </div>
        )}
      </div>
    );
  }

  const showRegisterButton = !isSelfUseMode;

  return (
    <div className='flex items-center gap-1'>
      <Link
        to='/login'
        className={`px-3 py-1.5 text-xs font-medium text-ui-text hover:bg-ui-bg-subtle transition-colors ${
          showRegisterButton && !isMobile ? 'rounded-l-full' : 'rounded-full'
        }`}
      >
        {t('登录')}
      </Link>
      {showRegisterButton && (
        <div className='hidden md:block'>
          <Link
            to='/register'
            className='px-3 py-1.5 text-xs font-medium bg-ui-accent text-ui-accent-fg hover:bg-ui-accent-hover transition-colors rounded-r-full'
          >
            {t('注册')}
          </Link>
        </div>
      )}
    </div>
  );
};

export default UserArea;
