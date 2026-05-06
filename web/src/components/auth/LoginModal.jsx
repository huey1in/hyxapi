/*
Copyright (C) 2025 QuantumNous

Fullscreen overlay modal — supports login and register modes.
*/

import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useLoginModal } from '../../context/LoginModal';
import LoginForm from './LoginForm';
import RegisterForm from './RegisterForm';
import PasswordResetForm from './PasswordResetForm';

const LoginModal = () => {
  const { open, mode, closeLoginModal, switchMode } = useLoginModal();

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && closeLoginModal();
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = original;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, closeLoginModal]);

  if (typeof document === 'undefined' || !open) return null;

  return createPortal(
    <div
      className='fixed inset-0 z-[1000] flex items-center justify-center p-4'
      style={{
        backgroundColor: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
      role='dialog'
      aria-modal='true'
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) closeLoginModal();
      }}
    >
      <div
        className='relative w-full max-w-md max-h-[calc(100vh-32px)] overflow-y-auto rounded-2xl border border-ui-border shadow-2xl p-6 sm:p-8'
        style={{ backgroundColor: 'var(--page-bg)' }}
      >
        <button
          type='button'
          aria-label='Close'
          onClick={closeLoginModal}
          className='absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center text-ui-text-3 hover:text-ui-text hover:bg-ui-bg-subtle transition-colors cursor-pointer'
        >
          <svg width='14' height='14' viewBox='0 0 14 14' fill='none'>
            <path
              d='M1 1L13 13M13 1L1 13'
              stroke='currentColor'
              strokeWidth='1.8'
              strokeLinecap='round'
            />
          </svg>
        </button>

        {mode === 'register' ? (
          <RegisterForm
            embedded
            onSuccess={closeLoginModal}
            onSwitchToLogin={() => switchMode('login')}
          />
        ) : mode === 'reset' ? (
          <PasswordResetForm
            embedded
            onSwitchToLogin={() => switchMode('login')}
          />
        ) : (
          <LoginForm
            embedded
            onSuccess={closeLoginModal}
            onSwitchToRegister={() => switchMode('register')}
            onSwitchToReset={() => switchMode('reset')}
          />
        )}
      </div>
    </div>,
    document.body,
  );
};

export default LoginModal;
