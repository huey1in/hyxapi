import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../components/ui';
import { validChatTemplate } from './chat-links';
import { Input, Textarea } from './ui';

export default function ChatPresetsEditor({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { t } = useTranslation();
  const [mode, setMode] = useState('visual');
  let rows: { name: string; url: string }[] = [];
  let error = '';
  try {
    const parsed = JSON.parse(value || '[]');
    if (!Array.isArray(parsed) || parsed.length > 100 || parsed.some((entry) => !entry || typeof entry !== 'object' || Array.isArray(entry) || Object.keys(entry).length !== 1 || typeof Object.values(entry)[0] !== 'string')) throw new Error();
    rows = parsed.map((entry) => { const [name, url] = Object.entries(entry)[0]; return { name, url: url as string }; });
    if (rows.some((row) => !row.name.trim() || !validChatTemplate(row.url))) error = '请填写客户端名称及有效链接';
  } catch { error = '请输入有效的客户端 JSON 数组，每项包含一个名称和链接'; }
  const sync = (next: typeof rows) => onChange(JSON.stringify(next.map((row) => ({ [row.name]: row.url })), null, 2));
  return <section className='min-w-0 space-y-4'>
    <div className='flex flex-wrap items-center justify-between gap-2'><h2 className='text-sm font-medium text-ui-text'>{t('聊天客户端预设')}</h2><div className='flex gap-2'><Button size='sm' variant='toggle' selected={mode === 'visual'} onClick={() => setMode('visual')}>{t('可视化')}</Button><Button size='sm' variant='toggle' selected={mode === 'json'} onClick={() => setMode('json')}>JSON</Button></div></div>
    {mode === 'json' ? <Textarea aria-label={t('客户端 JSON')} value={value} rows={14} onChange={onChange} spellCheck={false} data-setting-invalid={error ? 'true' : undefined} /> : <div className='space-y-3'>
      {rows.map((row, index) => <div key={index} className='grid min-w-0 gap-2 rounded-2xl border border-ui-border p-3'>
        <label className='grid gap-1 text-xs text-ui-text-3'>{t('客户端名称')}<Input value={row.name} onChange={(name) => sync(rows.map((item, i) => i === index ? { ...item, name } : item))} data-setting-invalid={!row.name.trim() ? 'true' : undefined} /></label>
        <label className='grid gap-1 text-xs text-ui-text-3'>{t('客户端链接')}<Input value={row.url} onChange={(url) => sync(rows.map((item, i) => i === index ? { ...item, url } : item))} data-setting-invalid={!validChatTemplate(row.url) ? 'true' : undefined} /></label>
        <div><Button size='sm' variant='secondary' onClick={() => sync(rows.filter((_, i) => i !== index))}>{t('删除')}</Button></div>
      </div>)}
      <Button size='sm' variant='secondary' disabled={rows.length >= 100 || Boolean(error && !rows.length && value !== '[]')} onClick={() => sync([...rows, { name: '', url: '' }])}>{t('添加客户端')}</Button>
    </div>}
    {error && <p role='alert' className='text-xs text-red-600' data-setting-invalid='true'>{t(error)}</p>}
    <p className='break-words text-xs leading-5 text-ui-text-3'>{t('网页可嵌入控制台，协议链接打开外部应用。支持 {key}、{address}、{cherryConfig}、{aionuiConfig}、{deepchatConfig}、{aqbotConfig}，以及 fluentread、ccswitch。')}</p>
  </section>;
}
