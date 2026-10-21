import { useTranslation } from 'react-i18next';
import Skeleton from '../../components/ui/feedback/Skeleton';
import Pagination from '../../components/ui/layout/Pagination';
import { useAuthStore } from '../../stores/auth-store';
import LogsTable from './LogsTable';

const PAGE_SIZE = 20;

export default function LogsLoading() {
  const { t } = useTranslation();
  const admin = useAuthStore((state) => (state.auth.user?.role ?? 1) >= 10);
  return <div className='min-w-0 space-y-5' role='status' aria-label={t('Loading...')}>
    <div className='flex flex-wrap items-center justify-between gap-3'>
      <Skeleton width={92} height={38} rounded='rounded-xl' />
      <div className='flex flex-wrap items-center gap-3'>
        {admin && <Skeleton width={130} height={36} rounded='rounded-xl' />}
        <div className='flex items-center gap-2'><Skeleton width={84} height={20} /><Skeleton width={44} height={24} rounded='rounded-full' /></div>
        <Skeleton width={100} height={38} rounded='rounded-xl' /><Skeleton width={28} height={28} />
      </div>
    </div>
    <LogsTable loading all={admin} /><Pagination page={1} pageSize={PAGE_SIZE} total={0} onChange={() => {}} />
  </div>;
}
