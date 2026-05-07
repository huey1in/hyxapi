/*
Copyright (C) 2025 QuantumNous

Login modal global state — supports login / register mode switching.
*/

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const LoginModalContext = createContext(null);

export const LoginModalProvider = ({ children }) => {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState('login');

  const openLoginModal = useCallback((m = 'login') => {
    setMode(m);
    setOpen(true);
  }, []);

  const closeLoginModal = useCallback(() => setOpen(false), []);

  const switchMode = useCallback((m) => setMode(m), []);

  // 监听 API 401/403 触发的全局事件，自动打开登录模态框
  useEffect(() => {
    const handler = () => {
      setMode('login');
      setOpen(true);
    };
    window.addEventListener('routify:auth-required', handler);
    return () => window.removeEventListener('routify:auth-required', handler);
  }, []);

  const value = useMemo(
    () => ({ open, mode, openLoginModal, closeLoginModal, switchMode }),
    [open, mode, openLoginModal, closeLoginModal, switchMode],
  );

  return (
    <LoginModalContext.Provider value={value}>
      {children}
    </LoginModalContext.Provider>
  );
};

export const useLoginModal = () => {
  const ctx = useContext(LoginModalContext);
  if (!ctx) {
    return {
      open: false,
      mode: 'login',
      openLoginModal: () => {},
      closeLoginModal: () => {},
      switchMode: () => {},
    };
  }
  return ctx;
};

export default LoginModalContext;
