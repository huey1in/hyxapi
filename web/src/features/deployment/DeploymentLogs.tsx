import { useCallback, useEffect, useRef, useState } from 'react';
import { errorText, request } from './api';
import type { Container } from './api';
import { integer } from './core';
import { Button, Checkbox, ErrorMessage, Field, Input, Select } from './ui';

export default function DeploymentLogs({ id, containers }: { id: string; containers: Container[] }) {
  const [container, setContainer] = useState(containers[0]?.container_id || '');
  const [level, setLevel] = useState('');
  const [stream, setStream] = useState('');
  const [limit, setLimit] = useState('100');
  const [cursor, setCursor] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [automatic, setAutomatic] = useState(false);
  const [logs, setLogs] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const active = useRef<AbortController>(undefined);
  const load = useCallback(async () => {
    active.current?.abort(); const abort = new AbortController(); active.current = abort;
    if (!container) return;
    setLoading(true); setError('');
    try {
      const query = new URLSearchParams({ container_id: container, level, stream, limit: String(integer(limit, '日志条数', 1, 1000)), cursor });
      if (start) query.set('start_time', new Date(start).toISOString());
      if (end) query.set('end_time', new Date(end).toISOString());
      if (start && end && new Date(start) > new Date(end)) throw new Error('开始时间不能晚于结束时间');
      const result = await request<string>('get', `/api/deployments/${encodeURIComponent(id)}/logs?${query}`, undefined, abort.signal);
      if (!abort.signal.aborted) setLogs(typeof result === 'string' ? result : JSON.stringify(result, null, 2));
    } catch (cause) { if (!abort.signal.aborted) setError(errorText(cause)); }
    finally { if (!abort.signal.aborted) setLoading(false); }
  }, [container, level, stream, limit, cursor, start, end, id]);
  useEffect(() => { load(); return () => active.current?.abort(); }, [load]);
  useEffect(() => { if (!automatic) return; const timer = setInterval(load, 5000); return () => clearInterval(timer); }, [automatic, load]);
  return <div className='space-y-4'>
    <div className='grid gap-3 sm:grid-cols-2'>
      <Field label='日志容器'><Select width='full' value={container} onChange={setContainer} options={[{ value: '', label: '选择容器' }, ...containers.map((item) => ({ value: item.container_id, label: item.container_id }))]} /></Field>
      <Field label='日志条数'><Input aria-label='日志条数' type='number' min='1' max='1000' step='1' value={limit} onChange={setLimit} /></Field>
      <Field label='日志级别'><Select width='full' value={level} onChange={setLevel} options={[{ value: '', label: '全部级别' }, ...['debug', 'info', 'warning', 'error', 'critical'].map((value) => ({ value, label: value }))]} /></Field>
      <Field label='输出流'><Select width='full' value={stream} onChange={setStream} options={[{ value: '', label: '全部输出' }, { value: 'stdout', label: 'stdout' }, { value: 'stderr', label: 'stderr' }]} /></Field>
      <Field label='日志开始时间'><Input aria-label='日志开始时间' type='datetime-local' value={start} onChange={setStart} /></Field>
      <Field label='日志结束时间'><Input aria-label='日志结束时间' type='datetime-local' value={end} onChange={setEnd} /></Field>
    </div>
    <Field label='日志游标（可选）'><Input aria-label='日志游标' value={cursor} onChange={setCursor} /></Field>
    <div className='flex flex-wrap items-center gap-3'><Button size='sm' loading={loading} onClick={load} disabled={!container}>刷新部署日志</Button><Checkbox checked={automatic} onChange={setAutomatic} label='每 5 秒刷新日志' /></div>
    <ErrorMessage message={error} />
    <pre aria-label='部署日志内容' className='max-h-96 overflow-auto whitespace-pre-wrap break-all rounded-xl border border-ui-border p-4 font-mono text-xs text-ui-text-2'>{logs || (loading ? '正在加载日志…' : '暂无日志')}</pre>
  </div>;
}
