import { useContext, useEffect, useRef, useState } from 'react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { bootstrapAuthentication, resolveAuthentication } from '../../lib/auth-session';
import { useAuthStore } from '../../stores/auth-store';
import { canOpenConsolePage, isConsolePath } from '../../lib/console-routes';
import SecurityVerification from '../auth/SecurityVerification';
import HeaderBar from './HeaderBar';
import SiderBar from './SiderBar';
import FooterBar from './FooterBar';
import Forbidden from '../../pages/Forbidden';
import { Button } from '../ui';
import { MobileSidebarProvider } from '../../context/MobileSidebar';
import { StatusContext } from '../../context/Status';
import { API, getSystemName, setStatusData } from '../../helpers';
import type { ApiEnvelope, SiteStatus } from '../../types/api';
import { apiErrorMessage } from '../../lib/api-error';
import { parseHeaderNavModules, publicModuleAccess, publicRouteModule } from '../../lib/nav-modules';

export default function PageLayout() {
  const { t } = useTranslation();
  const [statusState, statusDispatch] = useContext(StatusContext);
  const user = useAuthStore((state) => state.auth.user);
  const location = useLocation();
  const currentLocation = useRef(location); currentLocation.current = location;
  const mainRef = useRef<HTMLElement>(null);
  const navigate = useNavigate();
  const [authReady, setAuthReady] = useState(false);
  const [resolvedAuthMode, setResolvedAuthMode] = useState<boolean | null>(null);
  const [authError, setAuthError] = useState('');
  const [authAttempt, setAuthAttempt] = useState(0);
  const [statusError, setStatusError] = useState('');
  const [statusAttempt, setStatusAttempt] = useState(0);
  const isConsoleRoute = isConsolePath(location.pathname);
  const module = publicRouteModule(location.pathname);
  const modules = parseHeaderNavModules(statusState.status?.HeaderNavModules);
  const moduleAccess = module ? publicModuleAccess(modules, module, Boolean(user)) : 'allowed';
  const needsAuthentication = isConsoleRoute || Boolean(module && modules[module].enabled && modules[module].requireAuth);
  const ready = authReady && resolvedAuthMode === needsAuthentication;
  const isStandaloneRoute = ['/', '/auth', '/setup', '/user/reset'].includes(location.pathname) || location.pathname.startsWith('/oauth/');
  const hideFooter = isConsoleRoute || isStandaloneRoute;

  useEffect(() => { if (mainRef.current) mainRef.current.scrollTop = 0; }, [location.pathname]);
  useEffect(() => {
    const owner = new AbortController();
    setStatusError('');
    void (async () => {
      try {
        const response = await API.get<ApiEnvelope<SiteStatus>>('/api/status', { signal: owner.signal, disableDuplicate: true, skipErrorHandler: true });
        owner.signal.throwIfAborted();
        if (!response.data.success || !response.data.data) throw new Error(response.data.message || 'Unable to load site status');
        statusDispatch({ type: 'set', payload: response.data.data }); setStatusData(response.data.data);
      } catch (error) { if (!owner.signal.aborted) setStatusError(apiErrorMessage(error, 'Unable to load site status')); }
    })();
    return () => owner.abort();
  }, [statusDispatch, statusAttempt]);
  useEffect(() => {
    let active = true;
    setAuthReady(false); setAuthError('');
    void (async () => {
      try {
        const outcome = await (needsAuthentication ? resolveAuthentication() : bootstrapAuthentication());
        if (!active) return;
        if (needsAuthentication && (outcome.kind === 'anonymous' || outcome.kind === 'out_of_sync')) {
          const current = currentLocation.current;
          navigate(`/auth?next=${encodeURIComponent(current.pathname + current.search + current.hash)}`, { replace: true });
        } else if (needsAuthentication && outcome.kind === 'transient_error') setAuthError('Unable to verify sign-in status. Try again.');
        else { setResolvedAuthMode(needsAuthentication); setAuthReady(true); }
      } catch { if (active && needsAuthentication) setAuthError('Unable to verify sign-in status. Try again.'); }
    })();
    const unsubscribe = useAuthStore.subscribe((next, previous) => {
      if (needsAuthentication && previous.auth.user && !next.auth.user && next.auth.bootstrapState === 'complete') navigate('/auth', { replace: true });
    });
    return () => { active = false; unsubscribe(); };
  }, [needsAuthentication, navigate, authAttempt]);
  useEffect(() => { document.title = getSystemName() || 'Hyxware'; }, [location.pathname]);

  const needsSetup = statusState.status?.setup === false && location.pathname !== '/setup';
  const allowed = !isConsoleRoute || canOpenConsolePage(location.pathname, user);
  return <MobileSidebarProvider>
    <SecurityVerification />
    <div className='flex flex-col h-screen' style={{ backgroundColor: 'var(--page-bg)' }}>
      {!isStandaloneRoute && <HeaderBar showMenu={isConsoleRoute && ready} />}
      <div className={`flex-1 flex min-h-0${!isStandaloneRoute ? ' console-layout-body' : ''}`}>
        {isConsoleRoute && ready && user && <SiderBar />}
        <main ref={mainRef} className='flex-1 min-w-0 overflow-y-auto overflow-x-hidden flex flex-col'>
          {statusError && <div role='alert' className='flex items-center justify-center gap-3 px-4 py-3 text-sm text-ui-text-2'>{t(statusError)}<Button variant='link' onClick={() => setStatusAttempt((value) => value + 1)}>{t('Retry')}</Button></div>}
          <div className='flex-1'>
            {needsSetup ? <Navigate to='/setup' replace /> : module && (!statusState.status || statusError) ? <p role='status' className='p-8 text-ui-text-2'>{t('Loading site status…')}</p> : moduleAccess === 'disabled' ? <Navigate to='/' replace /> : needsAuthentication && !ready ? <div role={authError ? 'alert' : 'status'} className='p-8 space-y-3'>
              <p>{t(authError || 'Verifying sign-in status…')}</p>{authError && <Button onClick={() => setAuthAttempt((value) => value + 1)}>{t('Retry')}</Button>}
            </div> : !allowed ? <Forbidden /> : <Outlet />}
          </div>
          {!hideFooter && <FooterBar />}
        </main>
      </div>
    </div>
  </MobileSidebarProvider>;
}
