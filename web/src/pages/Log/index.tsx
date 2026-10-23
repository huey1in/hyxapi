import { useContext } from 'react';
import { ScrollText } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '../../components/ui';
import ConsolePageHeader from '../../components/layout/ConsolePageHeader';
import { useAuthStore } from '../../stores/auth-store';
import { StatusContext } from '../../context/Status';
import { parseSidebarModules } from '../../lib/sidebar-modules';
import { visibleLogSources } from './log-navigation';
import UnifiedLogs from './UnifiedLogs';
import LogsLoading from './LogsLoading';

export default function LogsPage() {
  const { t } = useTranslation();
  const [status] = useContext(StatusContext);
  const identity = useAuthStore((state) => `${state.auth.user?.id}:${state.auth.session?.sid}:${state.auth.user?.role}`);
  const sources = visibleLogSources(parseSidebarModules(status.status?.SidebarModulesAdmin));

  return <div className='console-content-page logs-page'>
    <ConsolePageHeader title={t('日志')} />
    {!status.status ? <LogsLoading /> : !sources.length ? <EmptyState icon={ScrollText} padding='md' title={t('No log views are enabled.')} /> : <UnifiedLogs key={`${identity}:${sources.map((source) => source.value).join(',')}`} sources={sources} />}
  </div>;
}
