/*
Copyright (C) 2025 QuantumNous

Fullscreen overlay modal — supports login and register modes.
*/

import React from 'react';
import { X } from 'lucide-react';
import { useLoginModal } from '../../context/LoginModal';
import LoginForm from './LoginForm';
import RegisterForm from './RegisterForm';
import PasswordResetForm from './PasswordResetForm';
import IconButton from '../ui/IconButton';
import ModalShell from '../ui/ModalShell';

const LoginModal = () => {
  const { open, mode, closeLoginModal, switchMode } = useLoginModal();

  return (
    <ModalShell
      open={open}
      onClose={closeLoginModal}
      maxWidth='28rem'
      zIndex={1000}
      className='relative overflow-y-auto p-6 sm:p-8'
    >
      <IconButton
        icon={X}
        variant='ghost'
        size='md'
        onClick={closeLoginModal}
        aria-label='Close'
        className='absolute top-3 right-3'
      />

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
    </ModalShell>
  );
};

export default LoginModal;
