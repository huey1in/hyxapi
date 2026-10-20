import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ConsolePage, DashboardStatsSkeleton, PersonalSkeleton, StatisticsSkeleton, TokenCardsSkeleton, MySubscriptionSkeleton } from './PageSkeletons';
import Skeleton from '../ui/feedback/Skeleton';
import ContentSkeleton from '../ui/feedback/ContentSkeleton';

export default function RouteSkeleton() {
  const { pathname } = useLocation();
  const { t } = useTranslation();
  if (pathname === '/console/personal') return <PersonalSkeleton />;
  if (pathname === '/console') return <div className='dashboard-overview'><h1 className='pb-2 text-2xl font-semibold text-ui-text'>{t('Usage overview')}</h1><DashboardStatsSkeleton /></div>;
  if (pathname === '/console/token') return <ConsolePage><div className='flex flex-col gap-3'>
    <div className='flex h-8 items-center justify-between gap-3'><span className='text-lg font-semibold text-ui-text'>API keys</span><Skeleton width={140} height={32} rounded='rounded-full' /></div>
    <ContentSkeleton variant='tokens'><div className='space-y-3'>
      <div className='flex flex-wrap gap-2'><div className='min-w-40 flex-1'><Skeleton height={36} rounded='rounded-full' /></div><div className='min-w-40 flex-1'><Skeleton height={36} rounded='rounded-full' /></div><Skeleton width={64} height={32} /><Skeleton width={64} height={32} /><Skeleton width={32} height={32} /></div>
      <Skeleton width='65%' height={18} /><div className='flex flex-wrap gap-3'><Skeleton width={190} height={28} /><Skeleton width={140} height={28} /><Skeleton width={85} height={28} /></div>
    </div></ContentSkeleton><TokenCardsSkeleton />
  </div></ConsolePage>;
  if (pathname === '/console/operations' || pathname === '/console/system-status') return <ConsolePage>
    <div className='flex h-8 items-center justify-between gap-3'><h1 className='text-lg font-semibold text-ui-text'>{t(pathname.endsWith('operations') ? 'Operations' : 'System status')}</h1><Skeleton width={130} height={28} /></div>
    <StatisticsSkeleton system={pathname.endsWith('system-status')} />
  </ConsolePage>;
  if (pathname === '/console/my-subscription') return <ConsolePage><div className='flex h-8 items-center justify-between'><h1 className='text-lg font-semibold text-ui-text'>{t('My subscriptions')}</h1><Skeleton width={28} height={28} /></div><MySubscriptionSkeleton /></ConsolePage>;

  // Route chunks cannot know data-dependent layouts. Navigation retains the
  // current page; cold loads show progress without inventing a table or form.
  return <div role='status' aria-label={t('Loading...')} aria-busy='true' className='p-6'><Skeleton height={3} rounded='rounded-full' /><span className='sr-only'>{t('Loading...')}</span></div>;
}
