import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { SiteStatus } from '../../types/api';
import { parseHeaderNavModules } from '../../lib/nav-modules';

export default function PublicNavLinks({ status, includeHome = true, includePricing = true, onNavigate }: { status?: SiteStatus; includeHome?: boolean; includePricing?: boolean; onNavigate?: () => void }) {
  const { t } = useTranslation();
  const modules = parseHeaderNavModules(status?.HeaderNavModules);
  return <>
    {includeHome && modules.home && <Link to='/' onClick={onNavigate}>{t('Home')}</Link>}
    {modules.console && <Link to='/console' onClick={onNavigate}>{t('Console')}</Link>}
    {includePricing && modules.pricing.enabled && <Link to='/pricing' onClick={onNavigate}>{t('Models')}</Link>}
  </>;
}
