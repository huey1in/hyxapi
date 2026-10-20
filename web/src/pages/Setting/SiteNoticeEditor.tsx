import { useTranslation } from 'react-i18next';
import { Textarea } from '../../components/ui';
import ConfiguredContent from '../../components/common/markdown/ConfiguredContent';

export default function SiteNoticeEditor({ value, onChange, disabled = false }: {
  value: string; onChange: (value: string) => void; disabled?: boolean;
}) {
  const { t } = useTranslation();
  return <div className='min-w-0 space-y-3'>
    <label className='block space-y-2 text-sm text-ui-text'>
      <span className='font-medium'>{t('Site notice')}</span>
      <Textarea aria-label={t('Site notice content')} value={value} onChange={onChange} disabled={disabled} rows={6} />
    </label>
    <p className='text-xs text-ui-text-3'>{t('Shown on the notifications page. Supports Markdown, sandboxed HTML, or a web address.')}</p>
    {value.trim() && <details className='min-w-0 rounded-xl border border-ui-border p-3'>
      <summary className='cursor-pointer text-sm text-ui-text-2'>{t('Preview')}</summary>
      <div className='mt-3 min-w-0'><ConfiguredContent content={value} title={t('Site notice')} /></div>
    </details>}
  </div>;
}
