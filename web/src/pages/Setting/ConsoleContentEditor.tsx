import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Input, Select, Switch, Textarea } from '../../components/ui';
import { consoleColors, parseApiInfo, parseConsoleDraft, parseFAQ, type ConsoleListKind } from '../../features/dashboard-content/content';
import { ConsoleContentPanels } from '../../features/dashboard-content/ConsoleContent';

export default function ConsoleContentEditor({ kind, value, enabled, onChange, onEnabledChange, disabled = false }: {
  kind: ConsoleListKind; value: string; enabled: boolean; onChange: (value: string) => void;
  onEnabledChange: (value: boolean) => void; disabled?: boolean;
}) {
  const { t } = useTranslation(); const id = useId();
  const title = kind === 'api_info' ? t('API information') : t('Frequently asked questions');
  const draft = parseConsoleDraft(kind, value);
  const rows = draft.rows;
  const limit = kind === 'api_info' ? 50 : 100;
  const changeField = (index: number, key: string, next: string) => {
    if (rows) onChange(JSON.stringify(rows.map((row, rowIndex) => rowIndex === index ? { ...row, [key]: next } : row)));
  };
  return <section aria-label={title} tabIndex={-1} data-setting-invalid={draft.valid ? undefined : 'true'} className='min-w-0 space-y-4 rounded-[26px] border border-ui-border p-5'>
    <div className='flex flex-wrap items-center justify-between gap-3'><h2 className='text-sm font-semibold text-ui-text'>{title}</h2><Switch aria-label={t('Show {{section}}', { section: title })} checked={enabled} onChange={onEnabledChange} disabled={disabled} /></div>
    <p className='text-xs leading-relaxed text-ui-text-3'>{t('Shown on the overview page. Changes take effect after saving settings.')}</p>
    {!draft.valid && <p role='alert' className='text-sm text-ui-danger'>{t('Complete all required fields and check entry limits before saving.')}</p>}
    {!rows ? <label className='block space-y-2 text-sm'><span>{t('Repair JSON')}</span><Textarea aria-label={t('Repair JSON')} value={value} onChange={onChange} rows={8} disabled={disabled} /></label> : <>
      {rows.map((row, index) => <fieldset key={index} className='min-w-0 space-y-3 rounded-xl border border-ui-border p-4' disabled={disabled}>
        <legend className='px-1 text-xs text-ui-text-3'>{t('Entry {{number}}', { number: index + 1 })}</legend>
        {Object.entries(row).map(([key, field]) => {
          const label = t(({ url: 'API address', route: 'Route description', description: 'Description', color: 'Label color', question: 'Question', answer: 'Answer' } as Record<string, string>)[key] || key);
          const fieldID = `${id}-${index}-${key}`;
          return <label key={key} htmlFor={fieldID} className='block min-w-0 space-y-1.5 text-xs text-ui-text-2'><span>{label}</span>
            {key === 'color' ? <Select id={fieldID} aria-label={label} value={field} options={consoleColors.map((color) => ({ value: color, label: t(color) }))} onChange={(next: string) => changeField(index, key, next)} disabled={disabled} /> : key === 'answer' ? <Textarea id={fieldID} aria-label={label} value={field} onChange={(next: string) => changeField(index, key, next)} rows={4} disabled={disabled} /> : <Input id={fieldID} aria-label={label} value={field} onChange={(next) => changeField(index, key, next)} disabled={disabled} />}
          </label>;
        })}
        <Button size='sm' variant='toggle' disabled={disabled} onClick={() => onChange(JSON.stringify(rows.filter((_, rowIndex) => rowIndex !== index)))}>{t('Remove entry')}</Button>
      </fieldset>)}
      <Button size='sm' variant='toggle' disabled={disabled || rows.length >= limit} onClick={() => onChange(JSON.stringify([...rows, kind === 'api_info' ? { url: '', route: '', description: '', color: 'blue' } : { question: '', answer: '' }]))}>{t('Add entry')}</Button>
    </>}
    <p className='text-xs text-ui-text-3'>{kind === 'api_info' ? t('Up to 50 entries. Address: 500 characters; route: 100; description: 200.') : t('Up to 100 questions. Question: 200 characters; answer: 1,000. Answers support Markdown.')}</p>
    {draft.valid && rows && rows.length > 0 && <details className='min-w-0'><summary className='cursor-pointer text-sm text-ui-text-2'>{t('Preview')}</summary><div className='mt-3 min-w-0'><ConsoleContentPanels apiInfo={kind === 'api_info' ? parseApiInfo(rows) : []} faq={kind === 'faq' ? parseFAQ(rows) : []} /></div></details>}
  </section>;
}
