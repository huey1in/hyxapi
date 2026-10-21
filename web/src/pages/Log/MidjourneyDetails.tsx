import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { renderQuota } from '../../helpers';
import { Button } from '../../components/ui';
import { midjourneyVideos, parseTaskMetadata, safeTaskMediaURL, taskDate, taskStatusLabels } from './task-data';
import type { MidjourneyRow } from './task-data';
import { DetailCode, DetailContent, DetailField, DetailFields, DetailSection, DetailText } from './LogDetailLayout';

export default function MidjourneyDetails({ row }: { row: MidjourneyRow }) {
  const { t, i18n } = useTranslation();
  const [preview, setPreview] = useState(false);
  const image = safeTaskMediaURL(row.image_url, window.location.origin);
  const videos = midjourneyVideos(row, window.location.origin);
  const date = (value: number) => taskDate(value, i18n.language, true);
  return <DetailContent>
    <DetailSection title={t('Basic information')}>
      <DetailFields>
        <DetailField label={t('Task ID')} value={row.mj_id} mono />
        <DetailField label={t('Status')} value={t(taskStatusLabels[row.status] || row.status || 'Queued')} />
        <DetailField label={t('Action')} value={row.action || '—'} />
        <DetailField label={t('Progress')} value={row.progress || '0%'} />
        <DetailField label={t('Cost')} value={renderQuota(row.quota)} />
        <DetailField label={t('Submitted at')} value={date(row.submit_time)} />
        <DetailField label={t('Started at')} value={date(row.start_time)} />
        <DetailField label={t('Finished at')} value={date(row.finish_time)} />
      </DetailFields>
    </DetailSection>
    {row.fail_reason && <DetailSection title={t('Failure reason')}><DetailText error>{row.fail_reason}</DetailText></DetailSection>}
    {[[t('Prompt'), row.prompt], [t('English prompt'), row.prompt_en], [t('Description'), row.description]].map(([label, value]) => value && <DetailSection key={label} title={label}><DetailText>{value}</DetailText></DetailSection>)}
    {(image || videos.length > 0) && <DetailSection title={t('Task results')}>
      <Button size='sm' variant='toggle' onClick={() => setPreview((value) => !value)}>{t(preview ? 'Hide results' : 'View generated results')}</Button>
      {preview && <div className='space-y-3'>
        {image && <a className='block' href={image} target='_blank' rel='noreferrer'><img src={image} alt={t('Midjourney generated result')} className='max-h-96 max-w-full rounded-xl' /></a>}
        {videos.map((url, index) => <div key={url}><video src={url} controls preload='none' className='max-h-96 w-full rounded-xl' /><a href={url} target='_blank' rel='noreferrer' className='text-xs underline'>{t('Open / download video {{index}}', { index: index + 1 })}</a></div>)}
      </div>}
    </DetailSection>}
    {(row.buttons || row.properties) && <DetailCode title={t('Task parameters and actions')} value={JSON.stringify({ buttons: parseTaskMetadata(row.buttons), properties: parseTaskMetadata(row.properties) })} />}
  </DetailContent>;
}
