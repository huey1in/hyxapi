import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { SiteStatus } from '../../types/api';
import { parseHeaderNavModules } from '../../lib/nav-modules';

export default function PublicNavLinks({ status, includeHome = true, includePricing = true, onNavigate }: { status?: SiteStatus; includeHome?: boolean; includePricing?: boolean; onNavigate?: () => void }) {
  const { t } = useTranslation();
  const modules = parseHeaderNavModules(status?.HeaderNavModules);
  const docsLink = typeof status?.docs_link === 'string' && /^https?:\/\//i.test(status.docs_link) ? status.docs_link : 'https://docs.newapi.pro/';
  return <>
    {includeHome && modules.home && <Link to='/' onClick={onNavigate}>{t('Home')}</Link>}
    {modules.console && <Link to='/console' onClick={onNavigate}>{t('Console')}</Link>}
    {includePricing && modules.pricing.enabled && <Link to='/pricing' onClick={onNavigate}>{t('Models')}</Link>}
    {modules.docs && <a href={docsLink} target='_blank' rel='noopener noreferrer' onClick={onNavigate}>{t('Docs')}</a>}
  </>;
}
