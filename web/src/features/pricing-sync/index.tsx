import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuthStore } from '../../stores/auth-store';
import type { PricingSnapshot } from '../../pages/Setting/billing/pricing-config';
import type { Preview, Source } from './core';
import { defaultEndpoint, selectSource, syncChanges } from './core';
import { errorText, request } from './api';
import { Button, Checkbox, ConfirmDialog, Input, Pagination, SlideOver } from './ui';
import PriceDetails from './PriceDetails';

function SyncDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [sources, setSources] = useState<Source[]>([]);
  const [sourceKeyword, setSourceKeyword] = useState('');
  const [sourcePage, setSourcePage] = useState(1);
  const [checked, setChecked] = useState<number[]>([]);
  const [timeout, setTimeoutValue] = useState('10');
  const [preview, setPreview] = useState<Preview>();
  const [baseline, setBaseline] = useState<PricingSnapshot>();
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [confirmation, setConfirmation] = useState(false);
  const [resetConfirmation, setResetConfirmation] = useState(false);
  const [exportEnabled, setExportEnabled] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const lifetime = useRef<AbortController>(undefined);
  const active = useRef<AbortController>(undefined);
  const locked = useRef(false);
  const customId = useRef(-2000);
  useEffect(() => {
    const abort = new AbortController(); lifetime.current = abort; setBusy(true);
    Promise.all([request<Omit<Source, 'endpoint'>[]>('get', '/api/ratio_sync/channels', undefined, abort.signal), request<{ key: string; value: string }[]>('get', '/api/option/', undefined, abort.signal)])
      .then(([items, options]) => { if (!abort.signal.aborted) { setSources(items.map((item) => ({ ...item, endpoint: defaultEndpoint(item) })).sort((a, b) => Number(a.id > 0) - Number(b.id > 0))); setExportEnabled(options.find((item) => item.key === 'ExposeRatioEnabled')?.value === 'true'); } })
      .catch((cause) => { if (!abort.signal.aborted) setError(errorText(cause)); })
      .finally(() => { if (!abort.signal.aborted) setBusy(false); });
    return () => { abort.abort(); active.current?.abort(); };
  }, []);
  const invalidate = () => { active.current?.abort(); setPreview(undefined); setBaseline(undefined); setSelected({}); setConfirmation(false); setMessage(''); };
  const compare = async () => {
    if (locked.current) return;
    const chosen = sources.filter((item) => checked.includes(item.id));
    if (!chosen.length || chosen.length > 32 || !Number.isInteger(Number(timeout)) || Number(timeout) < 1 || Number(timeout) > 60) { setError('请选择 1–32 个来源，超时须为 1–60 秒。'); return; }
    active.current?.abort(); const abort = new AbortController(); active.current = abort; locked.current = true;
    setBusy(true); setComparing(true); setError(''); setMessage(''); setSelected({}); setPreview(undefined); setBaseline(undefined);
    try {
      const snapshot = await request<PricingSnapshot>('get', '/api/option/model_pricing', undefined, abort.signal);
      const result = await request<Preview>('post', '/api/ratio_sync/fetch', { upstreams: chosen, timeout: Number(timeout) }, abort.signal);
      if (!abort.signal.aborted) { setBaseline(snapshot); setPreview(result); setPage(1); if (!Object.keys(result.prices).length) setMessage('没有可同步的价格差异。'); }
    } catch (cause) { if (!abort.signal.aborted) setError(errorText(cause)); }
    finally { if (active.current === abort) { locked.current = false; if (!abort.signal.aborted) { setBusy(false); setComparing(false); } } }
  };
  const save = async () => {
    const signal = lifetime.current?.signal;
    if (!signal || signal.aborted || !preview || !baseline || locked.current) return;
    locked.current = true; setBusy(true); setError('');
    try {
      const changes = syncChanges(preview, selected, baseline);
      if (!changes.length) throw new Error('请先选择需要同步的模型及来源。');
      await request('patch', '/api/option/model_pricing', { changes }, signal);
      if (!signal.aborted) { setConfirmation(false); setSelected({}); setBaseline(undefined); setMessage(`已同步 ${changes.length} 个模型。再次同步前请重新比较。`); onSaved(); }
    } catch (cause) { if (!signal.aborted) { setConfirmation(false); setError(errorText(cause)); } }
    finally { locked.current = false; if (!signal.aborted) setBusy(false); }
  };
  const setExport = async () => {
    const signal = lifetime.current?.signal; if (!signal || locked.current) return;
    locked.current = true; setBusy(true); setError('');
    try { await request('put', '/api/option/', { key: 'ExposeRatioEnabled', value: String(!exportEnabled) }, signal); if (!signal.aborted) setExportEnabled(!exportEnabled); }
    catch (cause) { if (!signal.aborted) setError(errorText(cause)); }
    finally { locked.current = false; if (!signal.aborted) setBusy(false); }
  };
  const resetRatios = async () => {
    const signal = lifetime.current?.signal; if (!signal || locked.current) return;
    locked.current = true; setBusy(true); setError('');
    try {
      await request('post', '/api/option/rest_model_ratio', undefined, signal);
      if (!signal.aborted) { invalidate(); setResetConfirmation(false); setMessage('输入倍率已恢复默认，请重新比较价格。'); onSaved(); }
    } catch (cause) { if (!signal.aborted) { setResetConfirmation(false); setError(errorText(cause)); } }
    finally { locked.current = false; if (!signal.aborted) setBusy(false); }
  };
  const names = useMemo(() => Object.keys(preview?.prices || {}).sort().filter((name) => name.toLowerCase().includes(keyword.trim().toLowerCase())), [preview, keyword]);
  const visible = names.slice((page - 1) * 10, page * 10);
  const sourceNames = useMemo(() => [...new Set(Object.values(preview?.prices || {}).flatMap((row) => Object.keys(row.upstreams)))].sort(), [preview]);
  const matchingSources = sources.filter((item) => `${item.name} ${item.base_url}`.toLowerCase().includes(sourceKeyword.trim().toLowerCase()));
  const updateSource = (id: number, field: 'name' | 'base_url' | 'endpoint', value: string) => { invalidate(); setSources((items) => items.map((item) => item.id === id ? { ...item, [field]: value } : item)); };
  return <SlideOver open onClose={() => !busy && onClose()} title='上游价格同步' footer={<><Button disabled={busy} onClick={onClose}>关闭</Button><Button disabled={busy || !baseline || !Object.keys(selected).length} loading={busy} onClick={() => setConfirmation(true)}>同步所选价格（{Object.keys(selected).length}）</Button></>}>
    <div className='min-w-0 space-y-5 p-4 md:p-6'>
      {error && <p role='alert' className='break-words text-sm text-ui-danger'>{error}</p>}{message && <p role='status' className='text-sm text-ui-text'>{message}</p>}
      <p className='text-xs leading-5 text-ui-text-3'>选择渠道、预设或自定义 HTTP 来源，先比较再按模型选择完整价格。未提供的倍率使用本机默认值；显式配置优先于原有 USD 直接价格，插件独立价格保留。保存遇到版本冲突时保留选择，请重新比较。</p>
      <div className='flex flex-wrap items-center gap-3 rounded-xl border border-ui-border p-3'><Checkbox checked={exportEnabled} disabled={busy} onChange={setExport} label='开放本站价格导出 API' /><code className='break-all text-xs text-ui-text-3'>/api/ratio_config</code><Button size='sm' disabled={busy} onClick={() => setResetConfirmation(true)}>恢复默认输入倍率</Button></div>
      <div className='flex flex-wrap items-center gap-2'><Input aria-label='筛选同步来源' placeholder='搜索来源名称或地址' value={sourceKeyword} onChange={(value) => { setSourceKeyword(value); setSourcePage(1); }} /><span className='text-xs text-ui-text-3'>已选择 {checked.length} 个来源</span></div>
      <div className='space-y-2'>{matchingSources.slice((sourcePage - 1) * 10, sourcePage * 10).map((item) => <div key={item.id} className='grid min-w-0 grid-cols-[repeat(auto-fit,minmax(min(180px,100%),1fr))] gap-2 rounded-xl border border-ui-border p-3'>
        <div className='flex min-w-0 flex-wrap items-center gap-2 break-all'><Checkbox disabled={busy} checked={checked.includes(item.id)} onChange={(value) => { invalidate(); setChecked((items) => value ? [...items, item.id] : items.filter((id) => id !== item.id)); }} label={item.name} />{item.status !== undefined && item.status !== 1 && <span className='text-xs text-ui-text-3'>已停用</span>}</div>
        {item.id < -1000 ? <Input aria-label={`来源名称 ${item.id}`} value={item.name} disabled={busy} onChange={(value) => updateSource(item.id, 'name', value)} /> : <p className='self-center break-all text-xs text-ui-text-3'>{item.base_url}</p>}
        <Input aria-label={`${item.name} 接口`} value={item.endpoint} disabled={busy} onChange={(value) => updateSource(item.id, 'endpoint', value)} />
        {item.id < -1000 && <Input aria-label={`${item.name} 地址`} value={item.base_url} disabled={busy} onChange={(value) => updateSource(item.id, 'base_url', value)} />}
        {item.id < -1000 && <Button size='sm' disabled={busy} onClick={() => { invalidate(); setSources((items) => items.filter((source) => source.id !== item.id)); setChecked((items) => items.filter((id) => id !== item.id)); }}>移除来源</Button>}
      </div>)}</div>
      <Pagination page={sourcePage} pageSize={10} total={matchingSources.length} onChange={setSourcePage} />
      <div className='flex flex-wrap items-end gap-2'><Button disabled={busy} onClick={() => { invalidate(); const id = customId.current--; setSources((items) => [...items, { id, name: '自定义来源', base_url: '', endpoint: '/api/pricing' }]); setChecked((items) => [...items, id]); setSourceKeyword('自定义来源'); setSourcePage(1); }}>添加自定义来源</Button><label className='grid w-24 min-w-0 grid-cols-1 gap-1 text-xs text-ui-text-3'>超时秒数<Input aria-label='同步超时秒数' type='number' value={timeout} disabled={busy} onChange={(value) => { invalidate(); setTimeoutValue(value); }} /></label><Button disabled={busy} loading={busy} onClick={compare}>比较上游价格</Button>{comparing && <Button onClick={() => { active.current?.abort(); active.current = undefined; locked.current = false; setBusy(false); setComparing(false); }}>取消比较</Button>}</div>
      {preview && <>
        <div className='space-y-1 text-xs'>{preview.test_results.map((result) => <p key={result.name} className={result.status === 'success' ? 'text-ui-text-3' : 'text-ui-danger'}>{result.name}：{result.status === 'success' ? '获取成功' : result.error || '获取失败'}</p>)}{Object.entries(preview.export_errors || {}).map(([name, reason]) => <p key={name} className='text-ui-danger'>{name} 当前直接价格未参与比较：{reason}</p>)}</div>
        <div className='flex flex-wrap gap-2'><Input aria-label='筛选同步模型' placeholder='筛选模型' value={keyword} onChange={(value) => { setKeyword(value); setPage(1); }} />{sourceNames.map((source) => <Button key={source} size='sm' disabled={busy || !baseline} onClick={() => setSelected((old) => selectSource(preview, names, source, old))}>筛选结果选用 <span className='max-w-40 truncate' title={source}>{source}</span></Button>)}<Button size='sm' disabled={busy} onClick={() => setSelected({})}>清空选择</Button></div>
        {visible.map((name) => <section key={name} aria-label={`同步模型 ${name}`} className='min-w-0 space-y-3 rounded-2xl border border-ui-border p-4'><h3 className='break-all text-sm font-semibold text-ui-text'>{name}</h3><div className='grid min-w-0 grid-cols-[repeat(auto-fit,minmax(min(220px,100%),1fr))] gap-3'>
          <div className='min-w-0 rounded-xl bg-ui-hover/40 p-3'><p className='mb-3 text-xs text-ui-text-3'>当前价格</p><PriceDetails name={name} price={preview.prices[name].current} /></div>
          {Object.entries(preview.prices[name].upstreams).map(([source, price]) => <div key={source} className='min-w-0 space-y-3 rounded-xl border border-ui-border p-3'><label className='flex gap-2 text-xs text-ui-text'><input type='radio' name={`sync-${name}`} aria-label={`${name} 选用 ${source}`} checked={selected[name] === source} disabled={busy || !baseline} onChange={() => setSelected((old) => ({ ...old, [name]: source }))} /><span className='break-all'>{source}</span></label>{Object.values(preview.differences[name] || {}).some((field) => field.confidence[source] === false) && <p className='text-xs text-ui-danger'>来源可能返回占位价格，请核对。</p>}<PriceDetails name={name} price={price} /></div>)}
        </div></section>)}
        <Pagination page={page} pageSize={10} total={names.length} onChange={setPage} />
      </>}
    </div>
    <ConfirmDialog open={confirmation} onClose={() => !busy && setConfirmation(false)} title='确认同步模型价格' description={`将为 ${Object.keys(selected).length} 个模型启用所选完整价格。保存后用于后续请求结算，进行中的请求保留原计费快照。`} confirmText='确认同步价格' onConfirm={save} closeOnConfirm={false} loading={busy} />
    <ConfirmDialog open={resetConfirmation} onClose={() => !busy && setResetConfirmation(false)} title='恢复全部默认输入倍率' description='将全部模型的输入倍率恢复为官方默认值。表达式、固定单价及 USD 直接价格继续按现有优先级生效。' confirmText='确认恢复输入倍率' onConfirm={resetRatios} closeOnConfirm={false} loading={busy} />
  </SlideOver>;
}

export default function PricingSync(props: { onClose: () => void; onSaved: () => void }) {
  const user = useAuthStore((state) => state.auth.user);
  return user?.role === 100 ? <SyncDialog key={user.id} {...props} /> : null;
}
