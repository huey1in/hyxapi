import { useEffect, useRef, useState } from 'react';
import { errorText, request } from './api';
import type { Hardware, Location, Quote, Replica } from './api';
import { initialDraft, payload, priceInput } from './core';
import type { Draft } from './core';
import { Button, Checkbox, ConfirmDialog, ErrorMessage, Field, Input, Select, SlideOver, Textarea } from './ui';

export default function DeploymentForm({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [draft, setDraft] = useState<Draft>({ ...initialDraft, locations: [] });
  const [hardware, setHardware] = useState<Hardware[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [availability, setAvailability] = useState<Replica[]>();
  const [resourceRevision, setResourceRevision] = useState(0);
  const [quote, setQuote] = useState<{ key: string; value: Quote }>();
  const [phase, setPhase] = useState<'idle' | 'quote' | 'create'>('idle');
  const [confirmation, setConfirmation] = useState(false);
  const [error, setError] = useState('');
  const lifetime = useRef<AbortController>(undefined);
  const quoting = useRef<AbortController>(undefined);
  const current = useRef(draft);
  const creating = useRef(false);
  useEffect(() => {
    const abort = new AbortController(); lifetime.current = abort;
    Promise.all([
      request<{ hardware_types: Hardware[] }>('get', '/api/deployments/hardware-types', undefined, abort.signal),
      request<{ locations: Location[] }>('get', '/api/deployments/locations', undefined, abort.signal),
    ]).then(([h, l]) => { if (!abort.signal.aborted) { setHardware(h.hardware_types || []); setLocations(l.locations || []); } })
      .catch((cause) => { if (!abort.signal.aborted) setError(errorText(cause)); });
    return () => { abort.abort(); quoting.current?.abort(); };
  }, [resourceRevision]);
  useEffect(() => {
    const abort = new AbortController(); setAvailability(undefined);
    if (Number(draft.hardware) > 0 && Number(draft.gpus) > 0) {
      const query = new URLSearchParams({ hardware_id: draft.hardware, gpu_count: draft.gpus });
      request<{ replicas: Replica[] }>('get', `/api/deployments/available-replicas?${query}`, undefined, abort.signal)
        .then((result) => { if (!abort.signal.aborted) setAvailability(result.replicas || []); })
        .catch((cause) => { if (!abort.signal.aborted) setError(errorText(cause)); });
    }
    return () => abort.abort();
  }, [draft.hardware, draft.gpus, resourceRevision]);
  const update = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    quoting.current?.abort(); setQuote(undefined); setConfirmation(false); setPhase('idle');
    const next = { ...current.current, [key]: value }; current.current = next; setDraft(next);
  };
  const estimate = async () => {
    quoting.current?.abort(); const abort = new AbortController(); quoting.current = abort;
    setPhase('quote'); setError(''); setQuote(undefined);
    const snapshot = current.current; const key = JSON.stringify(snapshot);
    try {
      const body = payload(snapshot);
      const selected = hardware.find((item) => item.id === body.hardware_id);
      if (!selected?.available || body.gpus_per_container > selected.max_gpus) throw new Error('所选硬件或 GPU 数量不可用');
      if (!availability || body.location_ids.some((id) => !availability.some((item) => item.location_id === id && item.available_count > 0))) throw new Error('请等待资源查询完成，并选择有可用副本的地区');
      if (availability.filter((item) => body.location_ids.includes(item.location_id)).reduce((sum, item) => sum + item.available_count, 0) < body.container_config.replica_count) throw new Error('所选地区的可用副本不足');
      const name = await request<{ available: boolean }>('get', `/api/deployments/check-name?${new URLSearchParams({ name: body.resource_private_name })}`, undefined, abort.signal);
      if (!name.available) throw new Error('部署名称已被使用');
      const result = await request<Quote>('post', '/api/deployments/price-estimation', priceInput(body), abort.signal);
      if (!result.estimation_valid || !Number.isFinite(result.estimated_cost) || result.estimated_cost < 0) throw new Error('供应商没有返回有效报价');
      if (!abort.signal.aborted && key === JSON.stringify(current.current)) setQuote({ key, value: result });
    } catch (cause) { if (!abort.signal.aborted) setError(errorText(cause)); }
    finally { if (!abort.signal.aborted) setPhase('idle'); }
  };
  const create = async () => {
    const signal = lifetime.current?.signal;
    if (!signal || signal.aborted || creating.current) return;
    creating.current = true; setPhase('create'); setError('');
    try {
      if (!quote || quote.key !== JSON.stringify(current.current)) throw new Error('配置已变化，请重新获取报价');
      await request('post', '/api/deployments/', payload(current.current), signal);
      if (!signal.aborted) onCreated();
    } catch (cause) { if (!signal.aborted) { setError(errorText(cause)); setConfirmation(false); } }
    finally { creating.current = false; if (!signal.aborted) setPhase('idle'); }
  };
  const disabled = phase === 'create';
  const text = (key: Exclude<keyof Draft, 'locations'>, label: string, type = 'text') => <Field label={label}><Input aria-label={label} value={draft[key]} disabled={disabled} type={type} autoComplete='off' onChange={(value) => update(key, value)} /></Field>;
  return <SlideOver open onClose={() => !disabled && onClose()} title='新建模型部署' width={720} footer={<><Button disabled={disabled} onClick={onClose}>取消</Button><Button loading={phase === 'quote'} disabled={disabled} onClick={estimate}>获取部署报价</Button><Button disabled={disabled || !quote} loading={disabled} onClick={() => setConfirmation(true)}>创建部署</Button></>}>
    <div className='space-y-5 p-6'>
      <ErrorMessage message={error} />
      <p className='text-xs text-ui-text-3'>资源在 io.net 运行。选择硬件与地区，填写镜像配置，获取报价后确认创建。</p>
      {text('name', '部署名称')}
      <Field label='GPU 硬件'><Select width='full' value={draft.hardware} disabled={disabled} onChange={(value) => update('hardware', value)} options={[{ value: '', label: '选择硬件' }, ...hardware.map((item) => ({ value: String(item.id), label: `${item.name} · ${item.available_count || 0} 可用 · 每容器最多 ${item.max_gpus} GPU` }))]} /></Field>
      <div className='grid gap-4 sm:grid-cols-3'>{text('gpus', '每容器 GPU 数量', 'number')}{text('replicas', '副本数量', 'number')}{text('hours', '运行小时数', 'number')}</div>
      <div className='space-y-2'><p className='text-sm text-ui-text-2'>部署地区</p><div className='grid gap-2 sm:grid-cols-2'>{locations.map((item) => {
        const available = availability?.find((entry) => entry.location_id === item.id)?.available_count;
        const selected = draft.locations.includes(item.id);
        return <Checkbox key={item.id} checked={selected} disabled={disabled || (!selected && (available == null || available <= 0))} onChange={(checked) => update('locations', checked ? [...draft.locations, item.id] : draft.locations.filter((id) => id !== item.id))} label={`${item.name} · ${available == null ? '待查询' : `${available} 副本可用`}`} />;
      })}</div><Button size='sm' disabled={disabled} onClick={() => { quoting.current?.abort(); setQuote(undefined); setPhase('idle'); setResourceRevision((value) => value + 1); }}>刷新可用资源</Button></div>
      {text('image', '镜像地址')}
      {text('port', '流量端口', 'number')}
      <div className='grid gap-4 sm:grid-cols-2'>{text('username', '镜像仓库用户名（可选）')}{text('registrySecret', '镜像仓库密钥（可选）', 'password')}</div>
      {([['environment', '环境变量 JSON'], ['secrets', '机密环境变量 JSON'], ['entrypoint', '启动入口 JSON 数组'], ['args', '启动参数 JSON 数组']] as const).map(([key, label]) => <Field key={key} label={label}><Textarea aria-label={label} value={draft[key]} onChange={(value) => update(key, value)} disabled={disabled} rows={3} spellCheck={false} autoComplete='off' /></Field>)}
      {quote && <div role='status' className='rounded-2xl border border-ui-border p-4 text-sm text-ui-text'><p className='font-semibold'>预计费用 {quote.value.estimated_cost.toFixed(4)} {quote.value.currency}</p><p className='mt-1 text-xs text-ui-text-3'>总时长 {draft.hours} 小时，{draft.replicas} 个副本，每副本 {draft.gpus} GPU。修改配置后需重新报价。</p></div>}
    </div>
    <ConfirmDialog open={confirmation} onClose={() => !disabled && setConfirmation(false)} title='确认创建付费部署' description={`将在 io.net 账户创建 ${draft.name}。预计费用 ${quote?.value.estimated_cost.toFixed(4) || '—'} ${quote?.value.currency || ''}，最终以供应商实际账单为准。`} onConfirm={create} confirmText='确认创建部署' loading={disabled} closeOnConfirm={false} />
  </SlideOver>;
}
