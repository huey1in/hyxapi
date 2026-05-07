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
import { useLoginModal } from '../context/LoginModal';
import { UserContext } from '../context/User';

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

// 校验登录状态：未登录时停留在当前路由 + 打开登录模态框，登录成功后 UserContext 变更会自动刷新此组件
function PrivateRoute({ children }) {
  const [userState] = useContext(UserContext);
  const { openLoginModal } = useLoginModal();
  const hasUser = !!userState?.user || !!localStorage.getItem('user');

  useEffect(() => {
    if (!hasUser) openLoginModal('login');
  }, [hasUser, openLoginModal]);

  if (!hasUser) {
    // 未登录时返回空白占位，让 LoginModal 在当前路由上方覆盖显示
    return <div className='min-h-[40vh]' />;
  }
  return children;
}

export function AdminRoute({ children }) {
  const [userState] = useContext(UserContext);
  const { openLoginModal } = useLoginModal();
  const raw = localStorage.getItem('user');
  const hasUser = !!userState?.user || !!raw;

  useEffect(() => {
    if (!hasUser) openLoginModal('login');
  }, [hasUser, openLoginModal]);

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
