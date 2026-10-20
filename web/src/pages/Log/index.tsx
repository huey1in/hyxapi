import { lazy, Suspense, useContext, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ConsolePageHeader from '../../components/layout/ConsolePageHeader';
import Skeleton from '../../components/ui/feedback/Skeleton';
import { useAuthStore } from '../../stores/auth-store';
import { StatusContext } from '../../context/Status';
import { parseSidebarModules } from '../../lib/sidebar-modules';
import { logTabFromSearch, logTabLocation, visibleLogTabs } from './log-navigation';

const UsageLogs = lazy(() => import('./UsageLogs'));
const AsyncTasks = lazy(() => import('./AsyncTasks'));
const MidjourneyTasks = lazy(() => import('./MidjourneyTasks'));

function LoadingPanel() {
  const { t } = useTranslation();
  return <div role='status' aria-label={t('Loading...')}><Skeleton height={3} rounded='rounded-full' /><span className='sr-only'>{t('Loading...')}</span></div>;
}

export default function LogsPage() {
  const { t } = useTranslation();
  const [status] = useContext(StatusContext);
  const user = useAuthStore((state) => state.auth.user);
  const sid = useAuthStore((state) => state.auth.session?.sid);
  const identity = `${user?.id}:${sid}:${user?.role}`;
  const location = useLocation();
  const navigate = useNavigate();
  const adminModules = parseSidebarModules(status.status?.SidebarModulesAdmin);
  const userModules = user?.permissions?.sidebar_settings === false ? {} : parseSidebarModules(user?.sidebar_modules);
  const tabs = status.status ? visibleLogTabs(adminModules, userModules) : [];
  const requested = logTabFromSearch(location.search);
  const active = tabs.find((tab) => tab.value === requested) ?? tabs[0];
  const canonical = active ? logTabLocation(active.value, location.search, location.hash) : '';
  useEffect(() => {
    if (canonical && canonical !== location.pathname + location.search + location.hash) void navigate(canonical, { replace: true });
  }, [canonical, location.pathname, location.search, location.hash, navigate]);

  return <div className='console-content-page'>
    <ConsolePageHeader title={t('日志')} />
    {!status.status ? <LoadingPanel /> : !active ? <p className='text-sm text-ui-text-3'>{t('No log views are enabled.')}</p> : <>
      <nav aria-label={t('日志')} className='flex gap-4 overflow-x-auto border-b border-ui-border'>
        {tabs.map((tab) => <Link key={tab.value} to={logTabLocation(tab.value, location.search, location.hash)} aria-current={tab.value === active.value ? 'page' : undefined}
          className={`shrink-0 whitespace-nowrap border-b-2 px-1 py-2.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ${tab.value === active.value ? 'border-ui-text text-ui-text' : 'border-transparent text-ui-text-3 hover:text-ui-text'}`}>
          {t(tab.label)}
        </Link>)}
      </nav>
      <Suspense key={`${identity}:${active.value}`} fallback={<LoadingPanel />}>
        {active.value === 'usage' ? <UsageLogs /> : active.value === 'tasks' ? <AsyncTasks /> : <MidjourneyTasks />}
      </Suspense>
    </>}
  </div>;
}
