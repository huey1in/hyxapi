import { useState } from 'react';
import { FileDown } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { renderQuota } from '../../helpers';
import { Button, EmptyState } from '../../components/ui';
import { apiErrorMessage } from '../../lib/api-error';
import { taskArtifactsSchema, taskDate, taskStatusLabels } from './task-data';
import type { TaskRow } from './task-data';
import { readTaskData } from './task-query';
import { DetailCode, DetailContent, DetailField, DetailFields, DetailSection, DetailText } from './LogDetailLayout';

export default function TaskDetails({ row, identity }: { row: TaskRow; identity: string }) {
  const { t, i18n } = useTranslation();
  const [requested, setRequested] = useState(false);
  const query = useQuery({
    queryKey: ['task-artifacts', identity, row.id, row.platform, row.task_id],
    gcTime: 0, retry: false, enabled: requested,
    queryFn: async ({ signal }) => {
      const data = await readTaskData(`/api/task/${encodeURIComponent(row.task_id)}/artifacts`, taskArtifactsSchema, signal);
      if (data.task_id !== row.task_id) throw new Error('Invalid task data; reload and try again.');
      return data;
    },
  });
  const artifacts = query.isError || query.isFetching ? undefined : query.data;
  const load = () => { if (requested) void query.refetch(); else setRequested(true); };
  return <DetailContent>
    <DetailSection title={t('Basic information')}>
      <DetailFields>
        <DetailField label={t('Task ID')} value={row.task_id} mono />
        <DetailField label={t('Status')} value={t(taskStatusLabels[row.status] || row.status)} />
        <DetailField label={t('Model')} value={row.properties?.origin_model_name || '—'} />
        <DetailField label={t('Plugin / platform')} value={row.admin_info?.task_plugin?.name || row.platform} />
        <DetailField label={t('Action')} value={row.action || '—'} />
        <DetailField label={t('Progress')} value={row.progress || '0%'} />
        <DetailField label={t('Cost')} value={renderQuota(row.quota)} />
        <DetailField label={t('Submitted at')} value={taskDate(row.submit_time, i18n.language)} />
        <DetailField label={t('Started at')} value={taskDate(row.start_time, i18n.language)} />
        <DetailField label={t('Finished at')} value={taskDate(row.finish_time, i18n.language)} />
      </DetailFields>
    </DetailSection>
    {row.fail_reason && <DetailSection title={t('Failure reason')}><DetailText error>{row.fail_reason}</DetailText></DetailSection>}
    <DetailSection title={t('Task results')}>
      {row.result_discarded ? <p className='text-[15px] text-ui-text-3'>{t('This task returned its result inline and has no saved download.')}</p> : row.status === 'SUCCESS' && <Button size='sm' variant='toggle' loading={query.isFetching} onClick={load}>{t(query.isError ? 'Retry task results' : 'Load task results')}</Button>}
      {query.isError && <p role='alert' className='text-[15px] text-ui-danger'>{t(apiErrorMessage(query.error))}</p>}
      {artifacts && <div className='space-y-4'>
        {artifacts.artifacts.map((item) => <div key={item.key} className='space-y-2'>
          <a className='break-all text-[15px] underline' href={item.content_url} target='_blank' rel='noreferrer'>{t('Open / download {{name}}', { name: item.key })}</a>
          {item.type === 'video' && <video controls preload='none' src={item.content_url} style={{ display: 'block', width: '100%', aspectRatio: '16 / 9', objectFit: 'contain' }} className='max-h-96 rounded-xl' />}
          {item.type === 'audio' && <audio controls preload='none' src={item.content_url} className='w-full' />}
          {item.type === 'image' && <img loading='lazy' alt={item.key} src={item.content_url} className='max-h-96 max-w-full rounded-xl' />}
        </div>)}
        {!artifacts.artifacts.length && <EmptyState icon={FileDown} padding='sm' title={t('This task has no downloadable files.')} />}
      </div>}
    </DetailSection>
    {(row.admin_info || row.root_info) && <DetailCode title={t('Runtime information')} value={JSON.stringify({ admin_info: row.admin_info, root_info: row.root_info })} />}
  </DetailContent>;
}
