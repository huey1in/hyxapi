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

import React, { useContext, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { UserContext } from '../context/User';

export const redirectToAuth = (mode = 'login') => {
  const next = `${window.location.pathname}${window.location.search}`;
  const authMode = mode === 'register' ? 'register' : 'login';
  window.location.assign(`/auth?mode=${authMode}&next=${encodeURIComponent(next)}`);
};

export function authHeader() {
  let user = JSON.parse(localStorage.getItem('user'));
  if (user && user.token) {
    return { Authorization: 'Bearer ' + user.token };
  }
  return {};
}

export const AuthRedirect = ({ children }) => {
  const user = localStorage.getItem('user');
  if (user) return <Navigate to='/console' replace />;
  return children;
};

// 校验登录状态：未登录时跳转认证页，并通过 next 参数保留当前地址。
function PrivateRoute({ children }) {
  const [userState] = useContext(UserContext);
  const hasUser = !!userState?.user || !!localStorage.getItem('user');

  useEffect(() => {
    if (!hasUser) redirectToAuth('login');
  }, [hasUser]);

  if (!hasUser) {
    return <div className='min-h-[40vh]' />;
  }
  return children;
}

export function AdminRoute({ children }) {
  const [userState] = useContext(UserContext);
  const raw = localStorage.getItem('user');
  const hasUser = !!userState?.user || !!raw;

  useEffect(() => {
    if (!hasUser) redirectToAuth('login');
  }, [hasUser]);

  if (!hasUser) return <div className='min-h-[40vh]' />;

  try {
    const user = userState?.user || (raw ? JSON.parse(raw) : null);
    if (user && typeof user.role === 'number' && user.role >= 10) {
      return children;
    }
  } catch (e) {
    // ignore
  }
  return <Navigate to='/forbidden' replace />;
}

export { PrivateRoute };
