/*
Copyright (C) 2025 QuantumNous

Login entry — 控制台不再内嵌登录模态框；所有登录入口统一跳转 home-site 登录页。
*/

import React, { createContext, useCallback, useContext, useEffect, useMemo } from 'react';

const LoginModalContext = createContext(null);

export const LoginModalProvider = ({ children }) => {
  const openLoginModal = useCallback((m = 'login') => {
    const next = `${window.location.pathname}${window.location.search}`;
    window.location.assign(`/auth?mode=${m === 'register' ? 'register' : 'login'}&next=${encodeURIComponent(next)}`);
  }, []);

  const closeLoginModal = useCallback(() => {}, []);
  const switchMode = useCallback(() => {}, []);

  // API 401/403 触发的全局事件 → 跳转 home-site 登录页（替代原弹出登录模态框）
  useEffect(() => {
    const handler = () => openLoginModal('login');
    window.addEventListener('routify:auth-required', handler);
    return () => window.removeEventListener('routify:auth-required', handler);
  }, [openLoginModal]);

  const value = useMemo(
    () => ({ open: false, mode: 'login', openLoginModal, closeLoginModal, switchMode }),
    [openLoginModal, closeLoginModal, switchMode],
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

