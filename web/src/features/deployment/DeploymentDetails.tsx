import { useEffect, useRef, useState } from 'react';
import { date, errorText, request, statuses } from './api';
import type { Container, Deployment } from './api';
import { safePublicURL } from './core';
import DeploymentAction from './DeploymentAction';
import type { Action } from './DeploymentAction';
import DeploymentLogs from './DeploymentLogs';
import { Button, ErrorMessage, SlideOver, Table } from './ui';

export default function DeploymentDetails({ deployment, onClose, onChanged }: { deployment: Deployment; onClose: () => void; onChanged: () => void }) {
  const [detail, setDetail] = useState<Deployment>();
  const [containers, setContainers] = useState<Container[]>([]);
  const [selected, setSelected] = useState<Container>();
  const [action, setAction] = useState<Action>();
  const [tab, setTab] = useState<'overview' | 'containers' | 'logs'>('overview');
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const currentContainer = useRef<AbortController>(undefined);
  useEffect(() => {
    const abort = new AbortController(); setLoading(true); setError('');
    const path = `/api/deployments/${encodeURIComponent(deployment.id)}`;
    Promise.allSettled([
      request<Deployment>('get', path, undefined, abort.signal),
      request<{ containers: Container[] }>('get', path + '/containers', undefined, abort.signal),
    ]).then((results) => {
      if (abort.signal.aborted) return;
      if (results[0].status === 'fulfilled') setDetail(results[0].value);
      if (results[1].status === 'fulfilled') setContainers(results[1].value.containers || []);
      setError(results.filter((result) => result.status === 'rejected').map((result) => errorText(result.reason)).join('；')); setLoading(false);
    });
    return () => { abort.abort(); currentContainer.current?.abort(); };
  }, [deployment.id, revision]);
  const inspect = async (container: Container) => {
    currentContainer.current?.abort(); const abort = new AbortController(); currentContainer.current = abort;
    setSelected(undefined); setError('');
    try {
      const result = await request<Container>('get', `/api/deployments/${encodeURIComponent(deployment.id)}/containers/${encodeURIComponent(container.container_id)}`, undefined, abort.signal);
      if (!abort.signal.aborted) setSelected(result);
    } catch (cause) { if (!abort.signal.aborted) setError(errorText(cause)); }
  };
  return <>
    <SlideOver open onClose={onClose} title='部署详情' width={800} footer={<><Button loading={loading} onClick={() => setRevision((value) => value + 1)}>刷新部署详情</Button><Button onClick={onClose}>关闭</Button></>}>
      <div className='space-y-5 p-6'>
        <div><p className='break-all text-base font-semibold text-ui-text'>{deployment.deployment_name}</p><p className='break-all text-xs text-ui-text-3'>{deployment.id}</p></div>
        <ErrorMessage message={error} />
        <div className='flex flex-wrap gap-2'>{([['overview', '概况'], ['containers', '容器'], ['logs', '日志']] as const).map(([key, label]) => <Button key={key} size='sm' variant={tab === key ? 'primary' : 'toggle'} onClick={() => setTab(key)}>{label}</Button>)}</div>
        {tab === 'overview' && detail && <>
          <div className='grid grid-cols-2 gap-4'>{[
            ['状态', statuses[detail.status] || detail.status], ['硬件', detail.hardware_name || '—'], ['容器数量', detail.instance_count], ['每容器 GPU', detail.gpus_per_container || '—'],
            ['剩余分钟', detail.compute_minutes_remaining], ['已付费用（供应商）', detail.amount_paid == null ? '—' : `${detail.amount_paid} USDC`], ['创建时间', date(detail.created_at)], ['地区', detail.locations?.map((item) => item.name).join('、') || '—'],
          ].map(([label, value]) => <div key={String(label)}><p className='text-xs text-ui-text-3'>{label}</p><p className='mt-1 break-words text-sm font-medium text-ui-text'>{value}</p></div>)}</div>
          <pre className='max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-xl border border-ui-border p-4 text-xs text-ui-text-2'>{JSON.stringify(detail.container_config || {}, null, 2)}</pre>
          <div className='flex flex-wrap gap-2'>{(['rename', 'edit', 'extend', 'terminate'] as const).map((kind) => <Button key={kind} size='sm' onClick={() => setAction(kind)}>{({ rename: '修改名称', edit: '更新配置', extend: '续期', terminate: '终止' })[kind]}</Button>)}</div>
        </>}
        {tab === 'containers' && <>
          <Table<Container> rows={containers} rowKey='container_id' minWidth={600} columns={[
            { key: 'id', title: '容器', render: (item) => <span className='inline-block max-w-48 break-all text-xs'>{item.container_id}</span> },
            { key: 'status', title: '状态', render: (item) => statuses[item.status] || item.status },
            { key: 'hardware', title: '硬件', render: (item) => item.hardware },
            { key: 'link', title: '访问地址', render: (item) => safePublicURL(item.public_url) ? <a href={safePublicURL(item.public_url)} target='_blank' rel='noopener noreferrer' className='text-xs underline'>打开服务</a> : <span className='text-xs text-ui-text-3'>{item.public_url || '—'}</span> },
            { key: 'detail', title: '详情', render: (item) => <Button size='sm' onClick={() => inspect(item)}>查看容器</Button> },
          ]} />
          {selected && <div className='space-y-3 rounded-xl border border-ui-border p-4'><p className='break-all text-sm font-semibold text-ui-text'>{selected.container_id}</p><p className='text-xs text-ui-text-3'>设备 {selected.device_id} · 在线率 {selected.uptime_percent}% · {date(selected.created_at)}</p>{selected.events?.map((event, index) => <p key={index} className='break-words text-xs text-ui-text-2'>{date(event.time)} · {event.message}</p>)}</div>}
        </>}
        {tab === 'logs' && <DeploymentLogs key={deployment.id} id={deployment.id} containers={containers} />}
      </div>
    </SlideOver>
    {action && detail && <DeploymentAction action={action} deployment={detail} name={deployment.deployment_name} onClose={() => setAction(undefined)} onSaved={onChanged} />}
  </>;
}
