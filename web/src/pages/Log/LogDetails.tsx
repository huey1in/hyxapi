import { useTranslation } from 'react-i18next';
import { Modal } from '../../components/ui';
import type { FeedRow } from './feed-data';
import RequestLogDetail from './RequestLogDetail';
import TaskDetails from './TaskDetails';
import MidjourneyDetails from './MidjourneyDetails';

export default function LogDetails({ row, identity, isAdmin, isRoot, onClose }: { row: FeedRow; identity: string; isAdmin: boolean; isRoot: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const title = row.source === 'usage' ? 'Request details' : row.source === 'tasks' ? 'Task details' : 'Midjourney task details';
  return <Modal open width={row.source === 'usage' ? 760 : 800} title={t(title)} hideFooter onClose={onClose}>
    {row.source === 'usage' && <RequestLogDetail row={row.log} isAdmin={isAdmin} isRoot={isRoot} />}
    {row.source === 'tasks' && <TaskDetails row={row.task} identity={identity} />}
    {row.source === 'midjourney' && <MidjourneyDetails row={row.midjourney} />}
  </Modal>;
}
