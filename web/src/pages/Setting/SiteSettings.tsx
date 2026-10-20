import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Input, Switch, Textarea } from '../../components/ui';
import ConfiguredContent from '../../components/common/markdown/ConfiguredContent';
import { parseHeaderNavModules } from '../../lib/nav-modules';

type RecordValue = Record<string, unknown>;
const record = (value: unknown): value is RecordValue => value !== null && typeof value === 'object' && !Array.isArray(value);
function navigationRecord(value: string): RecordValue | null {
  if (!value.trim()) return {};
  try { const parsed: unknown = JSON.parse(value); return record(parsed) ? parsed : null; } catch { return null; }
}
export function validDocsUrl(value: string): boolean {
  if (!value.trim()) return true;
  try { const url = new URL(value.trim()); return !/[\u0000-\u0020\u007f]/.test(value.trim()) && /^https?:\/\//i.test(value.trim()) && !!url.hostname && !url.username && !url.password; } catch { return false; }
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
    const next = auth || key === 'pricing' || key === 'rankings' ? { ...(record(before) ? before : {}), ...(key === 'pricing' || key === 'rankings' ? config[key] : {}), [auth ? 'requireAuth' : 'enabled']: enabled } : enabled;
    onChange('HeaderNavModules', JSON.stringify({ ...parsed, [key]: next }));
  };
  const modules: { key: keyof typeof config; label: string }[] = [{ key: 'home', label: 'Home' }, { key: 'console', label: 'Console' }, { key: 'pricing', label: 'Models' }, { key: 'rankings', label: 'Rankings' }, { key: 'docs', label: 'Docs' }, { key: 'about', label: 'About' }];
  const documents = [{ key: 'About', title: 'About content' }, { key: 'legal.user_agreement', title: 'Terms of Service' }, { key: 'legal.privacy_policy', title: 'Privacy Policy' }];
  const docs = value('general_setting.docs_link');
  const invalidDocs = !validDocsUrl(docs);
  return <section className='rounded-[26px] border border-ui-border px-[22px] py-5 space-y-6'>
    <div><h3 className='text-[15px] font-semibold text-ui-text'>{t('Public site')}</h3><p className='mt-2 text-xs text-ui-text-3'>{t('Configure public navigation and documents. Save changes with the page Save button.')}</p></div>
    <fieldset disabled={disabled} className='space-y-6'>
      <div className='grid gap-3 sm:grid-cols-2'>{modules.map(({ key, label }) => <div key={key} className='rounded-xl border border-ui-border p-3 space-y-3'>
        <label className='flex items-center justify-between gap-3 text-sm'><span>{t(label)}</span><Switch aria-label={t('{{module}} navigation', { module: t(label) })} checked={typeof config[key] === 'boolean' ? config[key] as boolean : config[key].enabled} disabled={!parsed} onChange={(enabled) => setModule(key, enabled)} /></label>
        {(key === 'pricing' || key === 'rankings') && <label className='flex items-center justify-between gap-3 text-xs text-ui-text-3'><span>{t('Require sign-in')}</span><Switch aria-label={t('Require sign-in for {{module}}', { module: t(label) })} checked={config[key].requireAuth} disabled={!parsed || !config[key].enabled} onChange={(enabled) => setModule(key, enabled, true)} /></label>}
      </div>)}</div>
      <label className='block text-xs text-ui-text-3'><span className='mb-2 block'>{t('Documentation URL')}</span><Input aria-label={t('Documentation URL')} width='full' value={docs} onChange={(next) => onChange('general_setting.docs_link', next)} placeholder='https://docs.example.com/' invalid={invalidDocs} data-setting-invalid={invalidDocs ? 'true' : undefined} /><span className='mt-2 block'>{t('Leave empty to use the New API documentation.')}</span>{invalidDocs && <span role='alert' className='mt-2 block'>{t('Documentation URL must be an HTTP or HTTPS URL without credentials')}</span>}</label>
      <details className='rounded-xl border border-ui-border p-3'><summary className='text-xs text-ui-text-2'>{t('Navigation JSON')}</summary><div className='mt-3 space-y-3'><Textarea aria-label={t('Navigation JSON')} width='full' rows={6} value={raw} onChange={(next) => onChange('HeaderNavModules', next)} invalid={!parsed} data-setting-invalid={!parsed ? 'true' : undefined} />{!parsed && <p role='alert' className='text-xs text-ui-text-2'>{t('Navigation configuration must be a JSON object')}</p>}<Button variant='link' onClick={() => onChange('HeaderNavModules', JSON.stringify(parseHeaderNavModules(null)))}>{t('Reset navigation defaults')}</Button></div></details>
      {documents.map((document) => <div key={document.key} className='space-y-3'><div className='flex items-center justify-between gap-3'><label htmlFor={`site-${document.key}`} className='text-sm font-medium'>{t(document.title)}</label><Button variant='link' onClick={() => setPreview((current) => current === document.key ? '' : document.key)}>{t(preview === document.key ? 'Edit' : 'Preview')}</Button></div>{preview === document.key ? <div className='rounded-xl border border-ui-border p-4'>{value(document.key).trim() ? <ConfiguredContent content={value(document.key)} title={t(document.title)} /> : <p className='text-sm text-ui-text-3'>{t('No content configured')}</p>}</div> : <Textarea id={`site-${document.key}`} aria-label={t(document.title)} width='full' rows={6} value={value(document.key)} onChange={(next) => onChange(document.key, next)} />}<p className='text-xs text-ui-text-3'>{t('Supports Markdown, HTML, or an HTTP/HTTPS URL. Leave empty to disable this document.')}</p></div>)}
    </fieldset>
  </section>;
}
