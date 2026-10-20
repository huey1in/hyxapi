import { useTranslation } from 'react-i18next';
import { configuredContentKind } from '../../../lib/configured-content';
import MarkdownRenderer from './MarkdownRenderer';

export default function ConfiguredContent({ content, title }: { content: string; title: string }) {
  const { t } = useTranslation();
  const kind = configuredContentKind(content);
  if (kind === 'url') return <div className='space-y-4'>
    <p className='text-sm text-ui-text-2'>{t('The administrator configured an external link for this document.')}</p>
    <a className='text-sm underline break-all' href={content.trim()} target='_blank' rel='noopener noreferrer'>{t('View document')}</a>
  </div>;
  if (kind === 'html') return <iframe title={title} srcDoc={content} sandbox='' referrerPolicy='no-referrer' className='w-full h-[55vh] min-h-64 border-0 rounded-lg bg-white' />;
  return <MarkdownRenderer content={content} />;
}
