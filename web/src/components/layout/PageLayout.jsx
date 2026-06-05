import React, { useEffect, useContext, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import HeaderBar from './HeaderBar';
import SiderBar from './SiderBar';
import FooterBar from './FooterBar';
import { MobileSidebarProvider, useMobileSidebar } from '../../context/MobileSidebar';
import { UserContext } from '../../context/User';
import { StatusContext } from '../../context/Status';
import { API, getSystemName, showError, setStatusData, setUserData, updateAPI } from '../../helpers';

// 移动端控制台顶栏（含汉堡按钮），必须在 MobileSidebarProvider 内
const ConsoleMobileTopBar = () => {
  const [, setMobileOpen] = useMobileSidebar();
  return (
    <div className='md:hidden shrink-0 sticky top-0 z-30 flex items-center gap-3 h-16 px-4 border-b border-ui-divider bg-[var(--page-bg)]'>
      <button onClick={() => setMobileOpen(true)} className='flex items-center justify-center w-10 h-10 -ml-2 rounded-lg hover:bg-ui-bg-subtle transition-colors cursor-pointer' aria-label='打开菜单'>
        <Menu size={24} className='text-ui-text' />
      </button>
      <span className='text-[17px] font-semibold text-ui-text tracking-tight'>{getSystemName() || '控制台'}</span>
    </div>
  );
};

const PageLayout = () => {
  const [, userDispatch] = useContext(UserContext);
  const [, statusDispatch] = useContext(StatusContext);
  const location = useLocation();
  const mainRef = useRef(null);
  const isConsoleRoute = location.pathname.startsWith('/console');
  const hideFooter = isConsoleRoute;

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
        {!isConsoleRoute && <HeaderBar />}
        <div className='flex-1 flex min-h-0'>
          {isConsoleRoute && <SiderBar />}
          <main
            ref={mainRef}
            className='flex-1 min-w-0 overflow-y-auto overflow-x-hidden flex flex-col'
          >
            {isConsoleRoute && <ConsoleMobileTopBar />}
            <div className={`flex-1${isConsoleRoute ? ' md:pt-10' : ''}`}>
              <Outlet />
            </div>
            {!hideFooter && <FooterBar />}
          </main>
        </div>
      </div>
    </MobileSidebarProvider>
  );
};

export default PageLayout;
