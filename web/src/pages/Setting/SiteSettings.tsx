import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, ShieldCheck } from 'lucide-react';
import { Button, EmptyState, Switch, Textarea } from '../../components/ui';
import ConfiguredContent from '../../components/common/markdown/ConfiguredContent';
import { parseHeaderNavModules } from '../../lib/nav-modules';

type RecordValue = Record<string, unknown>;
const record = (value: unknown): value is RecordValue => value !== null && typeof value === 'object' && !Array.isArray(value);
function navigationRecord(value: string): RecordValue | null {
  if (!value.trim()) return {};
  try { const parsed: unknown = JSON.parse(value); return record(parsed) ? parsed : null; } catch { return null; }
}

export default function SiteSettings({ value, onChange, disabled = false }: { value: (key: string) => string; onChange: (key: string, value: string) => void; disabled?: boolean }) {
  const { t } = useTranslation();
  const [preview, setPreview] = useState('');
  const raw = value('HeaderNavModules');
  const parsed = navigationRecord(raw);
  const config = parseHeaderNavModules(raw);
  const setModule = (key: keyof typeof config, enabled: boolean, auth = false) => {
    if (!parsed) return;
    const before = parsed[key];
    const next = auth || key === 'pricing' ? { ...(record(before) ? before : {}), ...(key === 'pricing' ? config[key] : {}), [auth ? 'requireAuth' : 'enabled']: enabled } : enabled;
    onChange('HeaderNavModules', JSON.stringify({ ...parsed, [key]: next }));
  };
  // TODO: 首页暂未完成设计，公开站点暂时只提供控制台和模型配置。
  const modules: { key: 'console' | 'pricing'; label: string }[] = [{ key: 'console', label: 'Console' }, { key: 'pricing', label: 'Models' }];
  const documents = [{ key: 'legal.user_agreement', title: 'Terms of Service' }, { key: 'legal.privacy_policy', title: 'Privacy Policy' }];
  return <section className='min-w-0 space-y-6'>
    <div><h2 className='text-[15px] font-semibold text-ui-text'>{t('Public site')}</h2><p className='mt-2 text-xs text-ui-text-3'>{t('Configure public navigation and documents. Save changes with the page Save button.')}</p></div>
    <fieldset disabled={disabled} className='space-y-6'>
      <div className='grid gap-5 sm:grid-cols-2'>{modules.map(({ key, label }) => <div key={key} className='min-w-0 space-y-3'>
        <label className='flex items-center justify-between gap-3 text-sm'><span>{t(label)}</span><Switch aria-label={t('{{module}} navigation', { module: t(label) })} checked={typeof config[key] === 'boolean' ? config[key] as boolean : config[key].enabled} disabled={!parsed} onChange={(enabled) => setModule(key, enabled)} /></label>
        {key === 'pricing' && <label className='flex items-center justify-between gap-3 text-xs text-ui-text-3'><span>{t('Require sign-in')}</span><Switch aria-label={t('Require sign-in for {{module}}', { module: t(label) })} checked={config[key].requireAuth} disabled={!parsed || !config[key].enabled} onChange={(enabled) => setModule(key, enabled, true)} /></label>}
      </div>)}</div>
      {documents.map((document) => <div key={document.key} className='space-y-3'><div className='flex items-center justify-between gap-3'><label htmlFor={`site-${document.key}`} className='text-sm font-medium'>{t(document.title)}</label><Button variant='link' onClick={() => setPreview((current) => current === document.key ? '' : document.key)}>{t(preview === document.key ? 'Edit' : 'Preview')}</Button></div>{preview === document.key ? <div className='rounded-xl border border-ui-border p-4'>{value(document.key).trim() ? <ConfiguredContent content={value(document.key)} title={t(document.title)} /> : <EmptyState icon={document.key === 'legal.privacy_policy' ? ShieldCheck : FileText} padding='sm' title={t('No content configured')} />}</div> : <Textarea id={`site-${document.key}`} aria-label={t(document.title)} width='full' rows={6} value={value(document.key)} onChange={(next) => onChange(document.key, next)} />}<p className='text-xs text-ui-text-3'>{t('Supports Markdown, HTML, or an HTTP/HTTPS URL. Leave empty to disable this document.')}</p></div>)}
    </fieldset>
  </section>;
}
