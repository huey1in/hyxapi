/*
 * PageLayout — 应用主壳
 *
 * - `/setup` / `/forbidden`：完全裸壳
 * - `/console/*` 等私有页：左侧 Sider + 顶部 Header + 主区
 * - 其它公共页（Home / Pricing / 协议）：顶部 TopNavBar + 主区
 */

import React, { useContext, useEffect } from 'react';
import { useLocation, Outlet } from 'react-router-dom';
import SiderBar from './SiderBar';
import HeaderBar from './HeaderBar';
import TopNavBar from './TopNavBar';
import { UserContext } from '../context/User';
import { StatusContext } from '../context/Status';
import { API, showError, setStatusData } from '../helpers';

const BARE_ROUTES = ['/setup', '/forbidden'];

const PageLayout = ({ children }) => {
  const loc = useLocation();
  const [, userDispatch] = useContext(UserContext);
  const [, statusDispatch] = useContext(StatusContext);
  const content = children ?? <Outlet />;

  /* 启动时拉取用户态 + 系统配置 */
  useEffect(() => {
    try {
      const stored = localStorage.getItem('user');
      if (stored) userDispatch({ type: 'login', payload: JSON.parse(stored) });
    } catch {}
    API.get('/api/status').then((res) => {
      const { success, data } = res.data || {};
      if (success) { statusDispatch({ type: 'set', payload: data }); setStatusData(data); }
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (BARE_ROUTES.includes(loc.pathname)) {
    return <div className='min-h-screen' style={{ backgroundColor: 'var(--page-bg)' }}>{content}</div>;
  }

  const isConsole = loc.pathname.startsWith('/console');

  if (isConsole) {
    return (
      <div className='flex h-screen' style={{ backgroundColor: 'var(--page-bg)' }}>
        <SiderBar />
        <div className='flex-1 flex flex-col min-w-0'>
          <HeaderBar />
          <main className='flex-1 overflow-y-auto'>{content}</main>
        </div>
      </div>
    );
  }

  /* 公共页面：顶栏 + 主区 */
  return (
    <div className='min-h-screen flex flex-col' style={{ backgroundColor: 'var(--page-bg)' }}>
      <TopNavBar />
      <main className='flex-1'>{content}</main>
    </div>
  );
};

export default PageLayout;
