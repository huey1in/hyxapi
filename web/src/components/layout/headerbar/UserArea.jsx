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
import ChevronDownIcon from './icons/ChevronDownIcon';
import SlidersIcon from './icons/SlidersIcon';
import KeyIcon from './icons/KeyIcon';
import WalletIcon from './icons/WalletIcon';
import LogOutIcon from './icons/LogOutIcon';
import SkeletonWrapper from '../components/SkeletonWrapper';
import { useLoginModal } from '../../../context/LoginModal';

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
  const { openLoginModal } = useLoginModal();

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
      { icon: <SlidersIcon size={15} />, label: t('个人设置'), path: '/console/personal' },
      { icon: <KeyIcon size={15} />, label: t('令牌管理'), path: '/console/token' },
      { icon: <WalletIcon size={15} />, label: t('钱包管理'), path: '/console/topup' },
    ];

    return (
      <div className='relative' ref={ref}>
        <button
          onClick={() => setOpen((o) => !o)}
          className='inline-flex items-center gap-1.5 h-11 px-3 rounded-xl text-ui-text-2 hover:text-ui-text hover:bg-ui-bg-subtle active:scale-95 transition-all duration-150'
        >
          <span className='text-sm font-medium text-ui-text max-w-[140px] truncate'>
            {userState.user.username}
          </span>
          <ChevronDownIcon size={16} className='text-ui-text-3' />
        </button>

        {open && (
          <div className='absolute right-0 mt-2 w-44 bg-ui-bg-elevated border border-ui-border rounded-xl shadow-lg py-1 z-50 animate-dropdown'>
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
              <LogOutIcon size={15} className='flex-shrink-0' />
              {t('退出')}
            </button>
          </div>
        )}
      </div>
    );
  }

  const showRegisterButton = !isSelfUseMode;

  return (
    <div className='flex items-center gap-2'>
      <button
        type='button'
        onClick={openLoginModal}
        className='px-4 py-2 text-sm font-medium text-ui-text-2 hover:text-ui-text transition-colors cursor-pointer bg-transparent'
      >
        {t('登录')}
      </button>
      {showRegisterButton && (
        <button
          type='button'
          onClick={() => openLoginModal('register')}
          className='hidden md:inline-flex items-center px-5 py-2 text-sm font-semibold bg-ui-accent text-ui-accent-fg rounded-lg transition-all duration-200 hover:bg-ui-accent-hover hover:shadow-md active:scale-95 cursor-pointer border-0'
        >
          {t('注册')}
        </button>
      )}
    </div>
  );
};

export default UserArea;
