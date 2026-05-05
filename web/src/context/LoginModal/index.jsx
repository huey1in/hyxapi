/*
Copyright (C) 2025 QuantumNous

Login modal global state.
*/

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

const LoginModalContext = createContext(null);

export const LoginModalProvider = ({ children }) => {
  const [open, setOpen] = useState(false);

  const openLoginModal = useCallback(() => setOpen(true), []);
  const closeLoginModal = useCallback(() => setOpen(false), []);

  const value = useMemo(
    () => ({ open, openLoginModal, closeLoginModal }),
    [open, openLoginModal, closeLoginModal],
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
      openLoginModal: () => {},
      closeLoginModal: () => {},
    };
  }
  return ctx;
};

export default LoginModalContext;
