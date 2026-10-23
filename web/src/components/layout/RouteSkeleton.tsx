import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ConsolePage, DashboardStatsSkeleton, PersonalSkeleton, StatisticsSkeleton, MySubscriptionSkeleton, PricingCardsSkeleton } from './PageSkeletons';
import ConsolePageHeader from './ConsolePageHeader';
import TokenTable from '../../pages/Token/TokenTable';
import { TOKEN_PAGE_SIZE } from '../../pages/Token/token-management';
import Pagination from '../ui/layout/Pagination';
import Skeleton from '../ui/feedback/Skeleton';
import { TopUpSkeleton } from '../../features/payments/TopUpLayout';
import { personalSettingsTab } from '../../pages/Personal/personal-navigation';
import LogsLoading from '../../pages/Log/LogsLoading';
import TicketsLoading from '../../pages/Tickets/TicketsLoading';

export default function RouteSkeleton() {
  const { pathname, search } = useLocation();
  const { t } = useTranslation();
  if (pathname === '/tickets') return <TicketsLoading />;
  if (pathname === '/personal') return <PersonalSkeleton tab={personalSettingsTab(search)} />;
  if (pathname === '/topup') return <TopUpSkeleton />;
  if (pathname === '/log') return <div className='console-content-page'>
    <ConsolePageHeader title={t('日志')} />
    <LogsLoading />
  </div>;
  if (pathname === '/console') return <div className='console-content-page dashboard-overview'><ConsolePageHeader title={t('Usage overview')} /><DashboardStatsSkeleton /></div>;
  if (pathname === '/token') return <div className='console-content-page token-management-page'>
    <ConsolePageHeader title='API keys' />
    <div className='token-page-toolbar'><Skeleton width={140} height={32} rounded='rounded-full' /></div>
    <div className='token-key-list flex flex-col gap-3'><TokenTable loading /></div>
    <div className='token-page-pagination'><Pagination page={1} pageSize={TOKEN_PAGE_SIZE} total={0} onChange={() => {}} /></div>
  </div>;
  if (pathname === '/pricing') return <div className='console-content-page'>
    <ConsolePageHeader title={t('Models')} />
    <div><div className='mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-ui-border p-4'>
      <div className='min-w-0 basis-full sm:w-[320px] sm:basis-auto'><Skeleton width='100%' height={36} rounded='rounded-full' /></div><Skeleton width={90} height={32} />
      <Skeleton width={64} height={32} className='ml-auto' />
    </div><PricingCardsSkeleton /></div>
  </div>;
  if (pathname === '/console/operations' || pathname === '/console/system-status') return <ConsolePage>
    <div className='flex h-8 items-center justify-between gap-3'><h1 className='text-lg font-semibold text-ui-text'>{t(pathname.endsWith('operations') ? 'Operations' : 'System status')}</h1><Skeleton width={130} height={28} /></div>
    <StatisticsSkeleton system={pathname.endsWith('system-status')} />
  </ConsolePage>;
  if (pathname === '/subscription') return <ConsolePage><h1 className='text-lg font-semibold text-ui-text'>{t('My subscriptions')}</h1><MySubscriptionSkeleton /></ConsolePage>;

  // Route chunks cannot know data-dependent layouts. Navigation retains the
  // current page; cold loads show progress without inventing a table or form.
  return <div role='status' aria-label={t('Loading...')} aria-busy='true' className='p-6'><Skeleton height={3} rounded='rounded-full' /><span className='sr-only'>{t('Loading...')}</span></div>;
}
