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
import { Button } from '../../ui';

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
      { label: t('个人设置'), path: '/console/personal' },
      { label: t('令牌'), path: '/console/token' },
      { label: t('钱包管理'), path: '/console/topup' },
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
          <div className='absolute right-0 mt-3 w-52 bg-ui-bg-elevated border border-ui-border rounded-2xl shadow-xl overflow-hidden z-50 animate-dropdown'>
            <div className='px-3 pt-3 pb-1.5'>
              <p className='text-[11px] font-semibold text-ui-text-3 uppercase tracking-widest'>
                {t('账户')}
              </p>
            </div>
            <div className='px-2 pb-2 flex flex-col gap-0.5'>
              {menuItems.map((item) => (
                <button
                  key={item.label}
                  onClick={() => { navigate(item.path); setOpen(false); }}
                  className='flex items-center w-full px-3 py-2.5 rounded-xl text-sm text-ui-text hover:bg-ui-bg-subtle transition-colors'
                >
                  <span>{item.label}</span>
                </button>
              ))}
              <div className='my-1 mx-1 border-t border-ui-divider' />
              <button
                onClick={() => { logout(); setOpen(false); }}
                className='flex items-center w-full px-3 py-2.5 rounded-xl text-sm text-ui-danger hover:bg-ui-danger-bg transition-colors'
              >
                <span>{t('退出')}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  const showRegisterButton = !isSelfUseMode;

  return (
    <div className='flex items-center gap-2'>
      <Button variant='ghost' onClick={openLoginModal}>
        {t('登录')}
      </Button>
      {showRegisterButton && (
        <Button
          className='hidden md:inline-flex'
          onClick={() => openLoginModal('register')}
        >
          {t('注册')}
        </Button>
      )}
    </div>
  );
};

export default UserArea;
