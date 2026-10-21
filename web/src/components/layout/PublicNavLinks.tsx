import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { SiteStatus } from '../../types/api';
import { parseHeaderNavModules } from '../../lib/nav-modules';

export default function PublicNavLinks({ status, includeHome = true, includePricing = true, onNavigate }: { status?: SiteStatus; includeHome?: boolean; includePricing?: boolean; onNavigate?: () => void }) {
  const { t } = useTranslation();
  const modules = parseHeaderNavModules(status?.HeaderNavModules);
  return <>
    {includeHome && modules.home && <NavLink to='/' onClick={onNavigate}>{t('Home')}</NavLink>}
    {modules.console && <NavLink to='/console' onClick={onNavigate}>{t('Console')}</NavLink>}
    {includePricing && modules.pricing.enabled && <NavLink to='/pricing' onClick={onNavigate}>{t('Models')}</NavLink>}
  </>;
}
