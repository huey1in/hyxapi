import { useTranslation } from 'react-i18next';
import { Headset } from 'lucide-react';
import ConsolePageHeader from '../../components/layout/ConsolePageHeader';
import { Pagination, Skeleton, Table } from '../../components/ui';

export default function TicketsLoading({ management = false }: { management?: boolean }) {
  const { t } = useTranslation();
  return <div className='console-content-page'>
    <ConsolePageHeader title={t(management ? 'Ticket management' : 'Support tickets')} />
    <div className='mb-5 flex gap-2'><Skeleton width={200} height={36} /><Skeleton width={80} height={36} />{!management && <div className='ml-auto'><Skeleton width={100} height={36} /></div>}</div>
    <div className='min-h-[320px]'><Table loading skeletonRows={5} emptyIcon={Headset} columns={['Subject', 'Category', 'Status', ...(management ? ['Requester', 'Priority', 'Assigned support'] : []), 'Updated time'].map((title) => ({ key: title, title: t(title) }))} /></div>
    <div className='mt-4 flex justify-end'><Pagination page={1} pageSize={10} total={0} onChange={() => {}} /></div>
  </div>;
}
