import { useTranslation } from 'react-i18next';
import { Textarea } from '../../components/ui';

export default function SiteNoticeEditor({ value, onChange, disabled = false }: {
  value: string; onChange: (value: string) => void; disabled?: boolean;
}) {
  const { t } = useTranslation();
  return <div className='min-w-0 space-y-3'>
    <label className='block space-y-2 text-sm text-ui-text'>
      <span className='font-medium'>{t('Site notice')}</span>
      <Textarea aria-label={t('Site notice content')} value={value} onChange={onChange} disabled={disabled} rows={6} />
    </label>
    <p className='text-xs text-ui-text-3'>{t('Shown in a dismissible banner above console pages. Supports Markdown, sandboxed HTML, or a web address.')}</p>
  </div>;
}
