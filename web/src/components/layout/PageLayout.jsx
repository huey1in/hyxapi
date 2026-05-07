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

import HeaderBar from './headerbar';
import { Layout } from '@douyinfe/semi-ui';
import SiderBar from './SiderBar';
import App from '../../App';
import FooterBar from './Footer';
import { ToastContainer } from 'react-toastify';
import ErrorBoundary from '../common/ErrorBoundary';
import React, { useContext, useEffect, useState } from 'react';
import { useIsMobile } from '../../hooks/common/useIsMobile';
import { useSidebarCollapsed } from '../../hooks/common/useSidebarCollapsed';
import { useTranslation } from 'react-i18next';
import {
  API,
  getSystemName,
  showError,
  setStatusData,
} from '../../helpers';
import { UserContext } from '../../context/User';
import { StatusContext } from '../../context/Status';
import { useLocation } from 'react-router-dom';
import { normalizeLanguage } from '../../i18n/language';
const { Sider, Content, Header } = Layout;

const PAGE_TITLES = [
  { match: (p) => p === '/', name: '首页' },
  { match: (p) => p === '/pricing', name: '模型广场' },
  { match: (p) => p === '/login', name: '登录' },
  { match: (p) => p === '/register', name: '注册' },
  { match: (p) => p === '/reset' || p === '/user/reset', name: '重置密码' },
  { match: (p) => p === '/setup', name: '初始化' },
  { match: (p) => p === '/forbidden', name: '无权限' },
  { match: (p) => p === '/user-agreement', name: '用户协议' },
  { match: (p) => p === '/privacy-policy', name: '隐私政策' },
  { match: (p) => p.startsWith('/oauth/'), name: 'OAuth 授权' },
  { match: (p) => p === '/console', name: '控制台' },
  { match: (p) => p === '/console/channel', name: '渠道管理' },
  { match: (p) => p === '/console/token', name: '令牌' },
  { match: (p) => p === '/console/redemption', name: '兑换码' },
  { match: (p) => p === '/console/topup', name: '钱包管理' },
  { match: (p) => p === '/console/log', name: '日志' },
  { match: (p) => p === '/console/midjourney', name: 'Midjourney' },
  { match: (p) => p === '/console/task', name: '任务' },
  { match: (p) => p === '/console/playground', name: '对话' },
  { match: (p) => p === '/console/personal', name: '个人设置' },
  { match: (p) => p === '/console/setting', name: '系统设置' },
  { match: (p) => p === '/console/user', name: '用户管理' },
  { match: (p) => p === '/console/subscription', name: '订阅' },
];

const getPageName = (pathname) => {
  const hit = PAGE_TITLES.find((entry) => entry.match(pathname));
  return hit ? hit.name : '';
};

const PageLayout = () => {
  const [userState, userDispatch] = useContext(UserContext);
  const [, statusDispatch] = useContext(StatusContext);
  const isMobile = useIsMobile();
  const [collapsed, , setCollapsed] = useSidebarCollapsed();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { i18n } = useTranslation();
  const location = useLocation();

  const cardProPages = [
    '/console/channel',
    '/console/log',
    '/console/redemption',
    '/console/user',
    '/console/token',
    '/console/midjourney',
    '/console/task',
    '/console/playground',
    '/pricing',
  ];

  const shouldHideFooter = cardProPages.includes(location.pathname);

  const shouldInnerPadding =
    location.pathname.includes('/console') &&
    location.pathname !== '/console/playground';

  const isConsoleRoute = location.pathname.startsWith('/console');
  const showSider = isConsoleRoute;
  const headerOffset = isConsoleRoute ? '64px' : 'var(--header-height)';
  // align sidebar + main with the centred 1420px header container
  const consoleGutter = 'max(0px, calc((100vw - 1420px) / 2))';

  useEffect(() => {
    if (isMobile && drawerOpen && collapsed) {
      setCollapsed(false);
    }
  }, [isMobile, drawerOpen, collapsed, setCollapsed]);

  const loadUser = () => {
    let user = localStorage.getItem('user');
    if (user) {
      let data = JSON.parse(user);
      userDispatch({ type: 'login', payload: data });
    }
  };

  const loadStatus = async () => {
    try {
      const res = await API.get('/api/status');
      const { success, data } = res.data;
      if (success) {
        statusDispatch({ type: 'set', payload: data });
        setStatusData(data);
      } else {
        showError('Unable to connect to server');
      }
    } catch (error) {
      showError('Failed to load status');
    }
  };

  useEffect(() => {
    loadUser();
    loadStatus().catch(console.error);
  }, []);

  useEffect(() => {
    const systemName = getSystemName() || 'Routify';
    const pageName = getPageName(location.pathname);
    document.title = pageName ? `${systemName} - ${pageName}` : systemName;
  }, [location.pathname]);

  useEffect(() => {
    let preferredLang;

    if (userState?.user?.setting) {
      try {
        const settings = JSON.parse(userState.user.setting);
        preferredLang = normalizeLanguage(settings.language);
      } catch (e) {
        // Ignore parse errors
      }
    }

    if (!preferredLang) {
      const savedLang = localStorage.getItem('i18nextLng');
      if (savedLang) {
        preferredLang = normalizeLanguage(savedLang);
      }
    }

    if (preferredLang) {
      localStorage.setItem('i18nextLng', preferredLang);
      if (preferredLang !== i18n.language) {
        i18n.changeLanguage(preferredLang);
      }
    }
  }, [i18n, userState?.user?.setting]);

  return (
    <Layout
      className='app-layout'
      style={{
        display: 'flex',
        flexDirection: 'column',
        overflow: isMobile ? 'visible' : 'hidden',
        backgroundColor: 'var(--page-bg)',
      }}
    >
      <Header
        style={{
          padding: 0,
          height: 'auto',
          lineHeight: 'normal',
          position: 'fixed',
          width: '100%',
          top: 0,
          zIndex: 100,
        }}
      >
        <HeaderBar
          onMobileMenuToggle={() => setDrawerOpen((prev) => !prev)}
          drawerOpen={drawerOpen}
        />
      </Header>
      <Layout
        style={{
          overflow: isMobile ? 'visible' : 'auto',
          display: 'flex',
          flexDirection: 'column',
          paddingTop: headerOffset,
        }}
      >
        {showSider && (
          <>
            {/* 移动端遮罩 */}
            {isMobile && (
              <div
                onClick={() => setDrawerOpen(false)}
                style={{
                  position: 'fixed',
                  inset: 0,
                  top: headerOffset,
                  zIndex: 98,
                  backgroundColor: 'rgba(0,0,0,0.45)',
                  backdropFilter: 'blur(3px)',
                  WebkitBackdropFilter: 'blur(3px)',
                  opacity: drawerOpen ? 1 : 0,
                  pointerEvents: drawerOpen ? 'auto' : 'none',
                  transition: 'opacity 0.3s ease',
                }}
              />
            )}
            <Sider
              className='app-sider'
              style={{
                position: 'fixed',
                left: isMobile ? 0 : consoleGutter,
                top: headerOffset,
                bottom: 0,
                height: 'auto',
                zIndex: 99,
                border: 'none',
                paddingRight: '0',
                width: isMobile ? 'var(--sidebar-width)' : 'var(--sidebar-current-width)',
                transform: isMobile && !drawerOpen ? 'translateX(-100%)' : 'translateX(0)',
                transition: 'transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            >
              <SiderBar
                onNavigate={() => {
                  if (isMobile) setDrawerOpen(false);
                }}
              />
            </Sider>
          </>
        )}
        <Layout
          style={{
            marginLeft: isMobile
              ? '0'
              : isConsoleRoute
                ? `calc(${consoleGutter} + var(--sidebar-current-width))`
                : '0',
            marginRight: isMobile || !isConsoleRoute ? '0' : consoleGutter,
            flex: '1 1 auto',
            display: 'flex',
            flexDirection: 'column',
            transition: 'margin-left 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <Content
            style={{
              flex: '1 0 auto',
              overflowY: isMobile ? 'visible' : 'hidden',
              WebkitOverflowScrolling: 'touch',
              padding: shouldInnerPadding ? (isMobile ? '5px' : '0 24px 24px') : '0',
              position: 'relative',
              backgroundColor: 'var(--page-bg)',
            }}
          >
            <ErrorBoundary>
              <App />
            </ErrorBoundary>
          </Content>
          {!shouldHideFooter && (
            <Layout.Footer
              style={{
                flex: '0 0 auto',
                width: '100%',
              }}
            >
              <FooterBar />
            </Layout.Footer>
          )}
        </Layout>
      </Layout>
      <ToastContainer />
    </Layout>
  );
};

export default PageLayout;
