import React, { useEffect, useContext, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import HeaderBar from './HeaderBar';
import SiderBar from './SiderBar';
import FooterBar from './FooterBar';
import LoginModal from './LoginModal';
import { MobileSidebarProvider } from '../../context/MobileSidebar';
import { UserContext } from '../../context/User';
import { StatusContext } from '../../context/Status';
import { API, getSystemName, showError, setStatusData, setUserData, updateAPI } from '../../helpers';

const PageLayout = () => {
  const [, userDispatch] = useContext(UserContext);
  const [, statusDispatch] = useContext(StatusContext);
  const location = useLocation();
  const mainRef = useRef(null);
  const isConsoleRoute = location.pathname.startsWith('/console');
  const hideFooter = isConsoleRoute || location.pathname.startsWith('/pricing');

  // 路由切换时滚动回顶部
  useEffect(() => {
    if (mainRef.current) {
      mainRef.current.scrollTop = 0;
    }
  }, [location.pathname]);

  useEffect(() => {
    const raw = localStorage.getItem('user');
    if (raw) {
      try {
        const u = JSON.parse(raw);
        setUserData?.(u);
        updateAPI();
        userDispatch({ type: 'login', payload: u });
      } catch {}
    }
    (async () => {
      try {
        const res = await API.get('/api/status');
        if (res?.data?.success) {
          statusDispatch({ type: 'set', payload: res.data.data });
          setStatusData(res.data.data);
        }
      } catch (e) { showError('Failed to load status'); }
    })();
  }, []);  // eslint-disable-line

  useEffect(() => {
    document.title = getSystemName() || 'Routify';
  }, [location.pathname]);

  return (
    <MobileSidebarProvider>
      <div
        className='flex flex-col h-screen'
        style={{ backgroundColor: 'var(--page-bg)' }}
      >
        <HeaderBar />
        <div className='flex-1 flex min-h-0'>
          {isConsoleRoute && <SiderBar />}
          <main ref={mainRef} className='flex-1 min-w-0 overflow-y-auto overflow-x-hidden flex flex-col'>
            <div className='flex-1'>
              <Outlet />
            </div>
            {!hideFooter && <FooterBar />}
          </main>
        </div>
        <LoginModal />
      </div>
    </MobileSidebarProvider>
  );
};

export default PageLayout;
