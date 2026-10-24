import { useTranslation } from 'react-i18next';
import ConsolePageHeader from '../../components/layout/ConsolePageHeader';
import Skeleton from '../../components/ui/feedback/Skeleton';

export function LeaderboardSkeleton() {
  return <div aria-busy='true' className='leaderboard-data'>
    <div className='leaderboard-stats'>{[0, 1, 2, 3].map((index) => <div className='leaderboard-stat' key={index}><Skeleton width={80} height={14} /><Skeleton width={105} height={28} className='mt-3' /></div>)}</div>
    <div className='leaderboard-columns'>
      <section className='leaderboard-panel'><Skeleton width={130} height={20} className='mb-6' />{Array.from({ length: 7 }, (_, index) => <div key={index} className='leaderboard-loading-row'><Skeleton shape='circle' width={32} height={32} /><Skeleton width='28%' height={16} /><Skeleton width='38%' height={16} className='ml-auto' /></div>)}</section>
      <section className='leaderboard-panel'><Skeleton width={110} height={20} className='mb-6' />{[0, 1, 2, 3, 4].map((index) => <div key={index} className='mb-6'><Skeleton width='65%' height={15} /><Skeleton width='100%' height={5} className='mt-3' /></div>)}</section>
    </div>
  </div>;
}

export default function LeaderboardLoading() {
  const { t } = useTranslation();
  return <div className='console-content-page console-wide-page leaderboard-page'>
    <ConsolePageHeader title={t('Usage leaderboard')} />
    <div className='leaderboard-toolbar'><Skeleton width={234} height={36} rounded='rounded-full' /><Skeleton width={140} height={32} /></div>
    <LeaderboardSkeleton />
  </div>;
}
