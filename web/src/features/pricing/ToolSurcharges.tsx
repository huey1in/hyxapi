import { useTranslation } from 'react-i18next';
import { parseToolSurcharges } from './tool-surcharges';

export default function ToolSurcharges({ value }: { value: unknown }) {
  const { t, i18n } = useTranslation();
  const { items, invalid } = parseToolSurcharges(value);
  if (!items.length && !invalid) return null;
  const format = new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 10 });
  return <section aria-label={t('Tool charges')} className='min-w-0 space-y-2 rounded-xl border border-ui-border p-3'>
    <h3 className='text-xs font-medium text-ui-text'>{t('Tool charges')}</h3>
    <p className='text-xs leading-relaxed text-ui-text-3'>{t('Tool prices are per 1K calls. The group multiplier is applied during settlement.')}</p>
    {invalid && <p role='alert' className='text-xs text-ui-text-3'>{t('Some tool charges could not be read.')}</p>}
    <dl className='min-w-0 space-y-2'>{items.map((item, index) => <div key={`${item.name}:${index}`} className='flex min-w-0 flex-wrap items-start justify-between gap-x-4 gap-y-1 text-xs'>
      <dt className='min-w-0 break-all text-ui-text-2'>{item.name}</dt>
      <dd className='flex flex-wrap gap-x-3 gap-y-1 text-ui-text-2'><span>{t('Calls: {{count}}', { count: item.count })}</span><span className='tabular-nums'>{t('{{price}} / 1K calls', { price: format.format(item.price) })}</span></dd>
    </div>)}</dl>
  </section>;
}
