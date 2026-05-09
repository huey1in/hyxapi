/*
Copyright (C) 2025 QuantumNous

Mobile slide-in drawer with public navigation links.
*/

import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useLoginModal } from '../../../context/LoginModal';

const MobileNavDrawer = ({
  open,
  onClose,
  mainNavLinks,
  userState,
  pricingRequireAuth,
  systemName,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { openLoginModal } = useLoginModal();

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose();
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = original;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (typeof document === 'undefined') return null;

  const navigateLink = (link) => {
    if (link.isExternal) {
      window.open(link.externalLink, '_blank', 'noopener,noreferrer');
      onClose();
      return;
    }
    if (link.itemKey === 'console' && !userState.user) {
      onClose();
      openLoginModal();
      return;
    }
    if (link.itemKey === 'pricing' && pricingRequireAuth && !userState.user) {
      onClose();
      openLoginModal();
      return;
    }
    navigate(link.to);
    onClose();
  };

  const itemFontStyle = {
    fontFamily:
      "Season-Sans, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
  };

  return createPortal(
    <div
      className={`fixed inset-0 z-[100] flex flex-col transition-transform duration-300 ease-in-out ${
        open ? 'translate-x-0' : 'translate-x-full'
      }`}
      style={{ backgroundColor: '#F5F3EC', ...itemFontStyle }}
      role='dialog'
      aria-label='navigation'
    >
      <div className='flex items-center justify-between px-[20px] pt-[18px] pb-[10px]'>
        <button
          type='button'
          onClick={() => {
            onClose();
            navigate('/');
          }}
          className='p-0 border-0 bg-transparent cursor-pointer'
          aria-label='Home'
        >
          <span
            className='text-[22px] font-bold text-ui-text'
            style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '-0.03em' }}
          >
            {systemName === 'Routify' ? (
              <>
                Rout<span style={{ color: 'var(--ui-brand)' }}>ify</span>
              </>
            ) : (
              systemName || 'Routify'
            )}
          </span>
        </button>
        <button
          onClick={onClose}
          aria-label='Close menu'
          className='w-[40px] h-[40px] rounded-full bg-black flex items-center justify-center cursor-pointer flex-shrink-0'
        >
          <svg width='14' height='14' viewBox='0 0 14 14' fill='none'>
            <path
              d='M1 1L13 13M13 1L1 13'
              stroke='white'
              strokeWidth='1.8'
              strokeLinecap='round'
            />
          </svg>
        </button>
      </div>

      <nav className='flex-1 overflow-y-auto px-[20px] mt-2'>
        {mainNavLinks.map((link) => {
          const isActive =
            !link.isExternal &&
            (link.to === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(link.to));
          return (
            <div key={link.itemKey} style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
              <button
                onClick={() => navigateLink(link)}
                className={`w-full flex items-center justify-between py-[18px] text-[15px] font-medium bg-transparent cursor-pointer ${
                  isActive ? 'text-ui-text' : 'text-ui-text'
                }`}
              >
                <span>{link.text}</span>
              </button>
            </div>
          );
        })}
      </nav>

      <div className='p-[20px] flex gap-3'>
        <button
          onClick={() => {
            onClose();
            if (userState?.user) navigate('/console');
            else openLoginModal();
          }}
          className='flex-1 h-[52px] rounded-full border text-[15px] font-semibold text-ui-text bg-transparent cursor-pointer'
          style={{ borderColor: 'rgb(192, 190, 181)' }}
        >
          {userState?.user ? '控制台' : '登录'}
        </button>
        <button
          onClick={() => {
            onClose();
            if (userState?.user) navigate('/console/playground');
            else openLoginModal('register');
          }}
          className='flex-1 h-[52px] rounded-full bg-black text-[15px] font-semibold text-white cursor-pointer'
        >
          {userState?.user ? '进入' : '注册'}
        </button>
      </div>
    </div>,
    document.body,
  );
};

export default MobileNavDrawer;
