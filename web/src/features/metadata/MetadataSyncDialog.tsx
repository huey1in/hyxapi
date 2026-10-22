import { useEffect, useMemo, useRef, useState } from 'react';
import { request, errorText, fieldLabels } from './catalog';
import type { SyncCandidate, SyncPreview } from './catalog';
import { Button, Checkbox, ErrorMessage, Field, Input, Select, SlideOver } from './ui';

export default function MetadataSyncDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [locale, setLocale] = useState('zh');
  const [scope, setScope] = useState('site');
  const [keyword, setKeyword] = useState('');
  const [preview, setPreview] = useState<SyncPreview>();
  const [selection, setSelection] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const controller = useRef<AbortController>(undefined);
  const busyRef = useRef(false);
  useEffect(() => () => controller.current?.abort(), []);
  const candidates = useMemo(() => (preview?.candidates || []).filter((item) => (scope === 'all' || item.scope === scope) && item.model_name.toLowerCase().includes(keyword.toLowerCase())), [preview, scope, keyword]);
  const actionable = (item: SyncCandidate) => item.kind === 'create' || item.kind === 'update';
  const load = async () => {
    if (busyRef.current) return;
    controller.current?.abort(); const abort = new AbortController(); controller.current = abort;
    busyRef.current = true; setBusy(true); setError(''); setPreview(undefined); setSelection({});
    try { const result = await request<SyncPreview>('get', `/api/models/sync_upstream/preview?locale=${locale}`, undefined, abort.signal); if (!abort.signal.aborted) setPreview(result); }
    catch (cause) { if (!abort.signal.aborted) setError(errorText(cause)); }
    finally { busyRef.current = false; if (!abort.signal.aborted) setBusy(false); }
  };
  const toggle = (item: SyncCandidate, checked: boolean) => setSelection((current) => {
    const next = { ...current };
    if (checked) next[item.model_name] = item.fields.map((field) => field.field); else delete next[item.model_name];
    return next;
  });
  const apply = async () => {
    if (!preview || busyRef.current) return;
    busyRef.current = true; setBusy(true); setError('');
    const abort = new AbortController(); controller.current = abort;
    try {
      const selections = preview.candidates.filter((item) => Object.hasOwn(selection, item.model_name)).map((item) => ({ model_name: item.model_name, record_version: item.record_version, create: item.kind === 'create', fields: selection[item.model_name] }));
      await request('post', '/api/models/sync_upstream', { locale: preview.source.locale, source_version: preview.source.version, selections }, abort.signal);
      if (!abort.signal.aborted) onSaved();
    } catch (cause) { if (!abort.signal.aborted) setError(errorText(cause)); }
    finally { busyRef.current = false; if (!abort.signal.aborted) setBusy(false); }
  };
  const count = Object.keys(selection).length;
  return <SlideOver open title='同步上游元数据' onClose={onClose} footer={<div className='flex flex-wrap items-center justify-end gap-3'><span className='text-xs text-ui-text-3'>已选择 {count} 个模型</span><Button variant='primary' loading={busy} disabled={!preview || !count} onClick={apply}>应用所选变更</Button></div>}>
    <div className='space-y-5 p-5'>
      <p className='text-sm text-ui-text-2'>先获取差异，再选择要新增的模型或覆盖的字段。上游或本地数据变化后，需要重新预览。</p>
      <div className='flex flex-wrap items-end gap-3'><Field label='元数据语言'><Select value={locale} disabled={busy} options={[{ value: 'zh', label: '中文' }, { value: 'en', label: 'English' }, { value: 'ja', label: '日本語' }]} onChange={(value) => { setLocale(value); setPreview(undefined); setSelection({}); }} /></Field><Button loading={busy} onClick={load}>获取差异</Button></div>
      <ErrorMessage message={error} />
      {preview && <>
        <div className='flex flex-wrap gap-3'><Select value={scope} onChange={setScope} options={[{ value: 'site', label: '站内模型' }, { value: 'catalog', label: '上游其他模型' }, { value: 'all', label: '全部模型' }]} /><Input value={keyword} onChange={setKeyword} placeholder='搜索模型' aria-label='搜索同步模型' /></div>
        <div className='flex flex-wrap gap-2'><Button disabled={busy} onClick={() => setSelection((current) => ({ ...current, ...Object.fromEntries(candidates.filter(actionable).map((item) => [item.model_name, item.fields.map((field) => field.field)])) }))}>选择当前筛选结果</Button><Button disabled={busy} onClick={() => setSelection({})}>清空选择</Button></div>
        <p className='text-xs text-ui-text-3'>筛选仅影响展示；已选模型跨筛选保留。当前显示 {candidates.length} 项。</p>
        <div className='space-y-3'>{candidates.map((item) => <section key={item.model_name} className='min-w-0 rounded-2xl border border-ui-border p-4'>
          <div className='flex items-start gap-3'><Checkbox checked={Object.hasOwn(selection, item.model_name)} disabled={busy || !actionable(item)} aria-label={`选择 ${item.model_name}`} onChange={(checked) => toggle(item, checked)} /><div className='min-w-0 flex-1'><p className='break-all text-sm font-medium'>{item.model_name}</p><p className='mt-1 text-xs text-ui-text-3'>{{ create: '新增', update: '更新', unchanged: '无变化', blocked: '已关闭同步', missing_upstream: '上游未收录', missing_vendor: '上游缺少供应商' }[item.kind] || item.kind}{item.vendor_to_create && ` · 将新增供应商 ${item.vendor_to_create}`}</p></div></div>
          {actionable(item) && <div className='mt-3 space-y-3'>{item.fields.map((field) => <div key={field.field} className='min-w-0 space-y-1'>
            <Checkbox label={fieldLabels[field.field] || field.field} checked={Boolean(selection[item.model_name]?.includes(field.field))} disabled={busy || item.kind === 'create'} onChange={(checked) => setSelection((current) => { const fields = current[item.model_name] || []; const nextFields = checked ? [...fields, field.field] : fields.filter((key) => key !== field.field); const next = { ...current }; if (nextFields.length) next[item.model_name] = nextFields; else delete next[item.model_name]; return next; })} />
            <p className='break-words text-xs text-ui-text-3'>当前：{String(field.local ?? '') || '空'}</p><p className='break-words text-xs text-ui-text-2'>上游：{String(field.upstream ?? '') || '空'}</p>
          </div>)}</div>}
        </section>)}</div>
      </>}
    </div>
  </SlideOver>;
}
