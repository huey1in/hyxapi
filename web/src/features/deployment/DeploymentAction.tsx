import { useEffect, useRef, useState } from 'react';
import { errorText, request } from './api';
import type { Deployment, Quote } from './api';
import { integer, updateConfiguration } from './core';
import { Button, ConfirmDialog, ErrorMessage, Field, Input, SlideOver, Textarea } from './ui';

export type Action = 'rename' | 'extend' | 'edit' | 'terminate';
const titles: Record<Action, string> = { rename: '修改部署名称', extend: '延长部署时长', edit: '更新部署配置', terminate: '终止部署' };
export default function DeploymentAction({ action, deployment, name, onClose, onSaved }: { action: Action; deployment: Deployment; name: string; onClose: () => void; onSaved: () => void }) {
  const [value, setValue] = useState(action === 'rename' ? name : action === 'extend' ? '1' : JSON.stringify({ image_url: deployment.container_config?.image_url || '', env_variables: deployment.container_config?.env_variables || {}, entrypoint: deployment.container_config?.entrypoint || [], traffic_port: deployment.container_config?.traffic_port || 0 }, null, 2));
  const [quote, setQuote] = useState<{ key: string; value: Quote }>();
  const [confirmation, setConfirmation] = useState(false);
  const [busy, setBusy] = useState(false);
  const [quoting, setQuoting] = useState(false);
  const [error, setError] = useState('');
  const controller = useRef<AbortController>(undefined);
  const quoteController = useRef<AbortController>(undefined);
  const current = useRef(value);
  const mutating = useRef(false);
  useEffect(() => { const abort = new AbortController(); controller.current = abort; return () => { abort.abort(); quoteController.current?.abort(); }; }, []);
  const estimate = async () => {
    quoteController.current?.abort(); const abort = new AbortController(); quoteController.current = abort;
    const snapshot = current.current; setQuoting(true); setError(''); setQuote(undefined);
    try {
      const hours = integer(snapshot, '续期小时数');
      if (!deployment.hardware_id || !deployment.locations?.length || !deployment.instance_count || !deployment.gpus_per_container) throw new Error('缺少部署硬件、地区或副本信息，无法计算续期报价');
      const result = await request<Quote>('post', '/api/deployments/price-estimation', { location_ids: deployment.locations.map((item) => item.id), hardware_id: deployment.hardware_id, gpus_per_container: deployment.gpus_per_container, replica_count: deployment.instance_count, duration_hours: hours, currency: 'usdc' }, abort.signal);
      if (!result.estimation_valid || !Number.isFinite(result.estimated_cost) || result.estimated_cost < 0) throw new Error('供应商没有返回有效报价');
      if (!abort.signal.aborted && snapshot === current.current) setQuote({ key: snapshot, value: result });
    } catch (cause) { if (!abort.signal.aborted) setError(errorText(cause)); }
    finally { if (!abort.signal.aborted) setQuoting(false); }
  };
  const execute = async () => {
    const signal = controller.current?.signal;
    if (!signal || signal.aborted || mutating.current) return;
    mutating.current = true; setBusy(true); setError('');
    try {
      const path = `/api/deployments/${encodeURIComponent(deployment.id)}`;
      if (action === 'rename') {
        if (!current.current.trim()) throw new Error('部署名称不能为空');
        await request('put', path + '/name', { name: current.current.trim() }, signal);
      } else if (action === 'edit') await request('put', path, updateConfiguration(current.current), signal);
      else if (action === 'extend') {
        if (!quote || quote.key !== current.current) throw new Error('请先获取当前时长的续期报价');
        await request('post', path + '/extend', { duration_hours: integer(current.current, '续期小时数') }, signal);
      } else await request('delete', path, undefined, signal);
      if (!signal.aborted) onSaved();
    } catch (cause) { if (!signal.aborted) { setError(errorText(cause)); setConfirmation(false); } }
    finally { mutating.current = false; if (!signal.aborted) setBusy(false); }
  };
  const update = (next: string) => { quoteController.current?.abort(); setQuoting(false); setQuote(undefined); current.current = next; setValue(next); };
  return <SlideOver open onClose={() => !busy && onClose()} title={titles[action]} footer={<><Button disabled={busy} onClick={onClose}>取消</Button>{action === 'extend' && <Button loading={quoting} disabled={busy} onClick={estimate}>获取续期报价</Button>}<Button loading={busy} disabled={busy || (action === 'extend' && !quote)} onClick={() => setConfirmation(true)}>提交操作</Button></>}>
    <div className='space-y-4 p-6'><ErrorMessage message={error} /><p className='break-all text-sm text-ui-text-2'>{name} · {deployment.id}</p>
      {action === 'rename' && <Field label='新的部署名称'><Input aria-label='新的部署名称' value={value} onChange={update} disabled={busy} /></Field>}
      {action === 'extend' && <><Field label='续期小时数'><Input aria-label='续期小时数' value={value} type='number' min='1' step='1' onChange={update} disabled={busy} /></Field>{quote && <p role='status' className='text-sm font-semibold text-ui-text'>预计续期费用 {quote.value.estimated_cost.toFixed(4)} {quote.value.currency}</p>}</>}
      {action === 'edit' && <><p className='text-xs text-ui-text-3'>支持 image_url、traffic_port、env_variables、secret_env_variables、entrypoint、args、command、registry_username 和 registry_secret。省略的字段保留原值。</p><Field label='部署更新 JSON'><Textarea aria-label='部署更新 JSON' rows={16} value={value} onChange={update} disabled={busy} spellCheck={false} /></Field></>}
      {action === 'terminate' && <p className='text-sm text-ui-text-2'>请求 io.net 终止此部署，容器将停止服务。已产生的费用按供应商结算。</p>}
    </div>
    <ConfirmDialog open={confirmation} onClose={() => !busy && setConfirmation(false)} title={`确认${titles[action]}`} description={action === 'extend' ? `续期 ${value} 小时，预计 ${quote?.value.estimated_cost.toFixed(4)} ${quote?.value.currency}，由 io.net 账户结算。` : action === 'terminate' ? '终止后部署中的服务将不可用，请确认相关调用已经迁移。' : '将向 io.net 提交以上修改，运行中的服务可能重新部署。'} onConfirm={execute} loading={busy} closeOnConfirm={false} confirmText='确认提交' />
  </SlideOver>;
}
