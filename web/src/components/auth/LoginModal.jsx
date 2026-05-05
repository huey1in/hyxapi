/*
Copyright (C) 2025 QuantumNous

Fullscreen overlay login modal.
*/

import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useLoginModal } from '../../context/LoginModal';
import LoginForm from './LoginForm';

const LoginModal = () => {
  const { open, closeLoginModal } = useLoginModal();

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
      className='fixed inset-0 z-[1000] flex items-center justify-center'
      style={{
        backgroundColor: 'rgba(0,0,0,0.45)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
      }}
      role='dialog'
      aria-modal='true'
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) closeLoginModal();
      }}
    >
      <div
        className='relative w-[calc(100%-32px)] max-w-md max-h-[calc(100vh-32px)] overflow-y-auto bg-white rounded-2xl border border-black/5 shadow-xl p-6 sm:p-8'
      >
        <button
          type='button'
          aria-label='Close'
          onClick={closeLoginModal}
          className='absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center bg-transparent hover:bg-black/[0.05] transition-colors cursor-pointer'
        >
          <svg width='14' height='14' viewBox='0 0 14 14' fill='none'>
            <path
              d='M1 1L13 13M13 1L1 13'
              stroke='black'
              strokeWidth='1.8'
              strokeLinecap='round'
            />
          </svg>
        </button>

        <LoginForm embedded onSuccess={() => closeLoginModal()} />
      </div>
    </div>,
    document.body,
  );
};

export default LoginModal;
