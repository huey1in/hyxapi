import { useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy } from 'lucide-react';
import { StatusContext } from '../../context/Status';
import { Button } from '../../components/ui';
import MarkdownRenderer from '../../components/common/markdown/MarkdownRenderer';
import { copy, showError, showSuccess } from '../../helpers';
import { parseApiInfo, parseFAQ, type ApiInfo, type FAQ } from './content';

const labelColors: Record<string, string> = { blue: '#647d98', green: '#71876a', cyan: '#65868d', purple: '#887494', pink: '#a47e8b', red: '#ac776f', orange: '#ac8968', amber: '#a18e63', yellow: '#a09868', lime: '#879568', 'light-green': '#849b7c', teal: '#688d83', 'light-blue': '#7e97a4', indigo: '#787e9f', violet: '#95839f', grey: '#929292', slate: '#7d8791' };

export function ConsoleContentPanels({ apiInfo, faq, showAPI = true, showFAQ = true }: {
  apiInfo: ApiInfo[]; faq: FAQ[]; showAPI?: boolean; showFAQ?: boolean;
}) {
  const { t } = useTranslation();
  const copyURL = async (value: string) => {
    try { if (await copy(value)) showSuccess(t('Copied')); else showError(t('Copy failed')); } catch { showError(t('Copy failed')); }
  };
  if ((!showAPI || !apiInfo.length) && (!showFAQ || !faq.length)) return null;
  return <div className='grid min-w-0 grid-cols-1 gap-5 lg:grid-cols-2'>
    {showAPI && apiInfo.length > 0 && <section aria-label={t('API information')} className='min-w-0 rounded-[26px] border border-ui-border p-5'>
      <h2 className='mb-4 text-sm font-semibold text-ui-text'>{t('API information')}</h2>
      <div className='space-y-4'>{apiInfo.map((item, index) => <article key={`${item.url}:${index}`} className='min-w-0 space-y-2 border-b border-ui-border pb-4 last:border-0 last:pb-0'>
        <div className='flex min-w-0 flex-wrap items-center justify-between gap-2'><h3 className='min-w-0 break-words text-sm font-medium text-ui-text'><span aria-hidden='true' className='mr-2 inline-block h-1.5 w-1.5 rounded-full align-middle' style={{ background: labelColors[item.color] }} />{item.route}</h3><Button size='sm' variant='toggle' icon={Copy} aria-label={t('Copy API address')} onClick={() => void copyURL(item.url)}>{t('Copy')}</Button></div>
        <a href={item.url} target='_blank' rel='noopener noreferrer' className='block break-all text-sm text-ui-text-2 underline decoration-ui-border underline-offset-4'>{item.url}</a>
        <p className='break-words text-xs leading-relaxed text-ui-text-3'>{item.description}</p>
      </article>)}</div>
    </section>}
    {showFAQ && faq.length > 0 && <section aria-label={t('Frequently asked questions')} className='min-w-0 rounded-[26px] border border-ui-border p-5'>
      <h2 className='mb-4 text-sm font-semibold text-ui-text'>{t('Frequently asked questions')}</h2>
      {faq.map((item, index) => <details key={`${item.question}:${index}`} className='min-w-0 border-b border-ui-border py-3 first:pt-0 last:border-0 last:pb-0'>
        <summary className='cursor-pointer break-words text-sm font-medium text-ui-text'>{item.question}</summary>
        <div className='mt-3 min-w-0 overflow-x-auto break-words text-sm leading-relaxed text-ui-text-2'><MarkdownRenderer content={item.answer} /></div>
      </details>)}
    </section>}
  </div>;
}

export default function ConsoleContent() {
  const [{ status }] = useContext(StatusContext);
  return <ConsoleContentPanels apiInfo={parseApiInfo(status?.api_info)} faq={parseFAQ(status?.faq)} showAPI={status?.api_info_enabled !== false} showFAQ={status?.faq_enabled !== false} />;
}
