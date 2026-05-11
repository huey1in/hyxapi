/*
Copyright (C) 2025 QuantumNous

Mobile slide-in drawer with public navigation links.
*/

import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { useLoginModal } from '../../../context/LoginModal';
import { Button, IconButton } from '../../ui';

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

  return createPortal(
    <div
      className={`fixed inset-0 z-[100] flex flex-col transition-transform duration-300 ease-in-out ${
        open ? 'translate-x-0' : 'translate-x-full'
      }`}
      style={{ backgroundColor: '#F5F3EC' }}
      role='dialog'
      aria-label='navigation'
    >
      <div className='flex items-center justify-between px-[20px] pt-[18px] pb-[10px]'>
        <Button
          variant='bare'
          onClick={() => {
            onClose();
            navigate('/');
          }}
          aria-label='Home'
          className='text-[22px] font-bold text-ui-text'
          style={{ letterSpacing: '-0.03em' }}
        >
          {systemName === 'Routify' ? (
            <>
              Rout<span style={{ color: 'var(--ui-brand)' }}>ify</span>
            </>
          ) : (
            systemName || 'Routify'
          )}
        </Button>
        <IconButton
          icon={X}
          size='xl'
          shape='circle'
          tone='black'
          onClick={onClose}
          aria-label='Close menu'
        />
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
              <Button
                variant='bare'
                onClick={() => navigateLink(link)}
                className='w-full flex items-center justify-between py-[18px] text-[15px] font-medium text-ui-text'
              >
                <span>{link.text}</span>
              </Button>
            </div>
          );
        })}
      </nav>

      <div className='p-[20px] flex gap-3'>
        <Button
          variant='hero'
          tone='outline'
          block
          onClick={() => {
            onClose();
            if (userState?.user) navigate('/console');
            else openLoginModal();
          }}
        >
          {userState?.user ? '控制台' : '登录'}
        </Button>
        <Button
          variant='hero'
          tone='black'
          block
          onClick={() => {
            onClose();
            if (userState?.user) navigate('/console/playground');
            else openLoginModal('register');
          }}
        >
          {userState?.user ? '进入' : '注册'}
        </Button>
      </div>
    </div>,
    document.body,
  );
};

export default MobileNavDrawer;
