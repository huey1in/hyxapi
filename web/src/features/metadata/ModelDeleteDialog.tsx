import { useEffect, useRef, useState } from 'react';
import { request, errorText } from './catalog';
import type { Model } from './catalog';
import { Button, Checkbox, ErrorMessage, SlideOver } from './ui';

export default function ModelDeleteDialog({ models, root, onClose, onSaved }: { models: Model[]; root: boolean; onClose: () => void; onSaved: () => void }) {
  const [channels, setChannels] = useState(false);
  const [prices, setPrices] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const controller = useRef<AbortController>(undefined);
  const busyRef = useRef(false);
  useEffect(() => { const abort = new AbortController(); controller.current = abort; return () => abort.abort(); }, []);
  const remove = async () => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError('');
    try {
      await request('post', '/api/models/delete', { model_ids: models.map((model) => model.id), remove_from_channels: channels, remove_pricing: root && prices }, controller.current?.signal);
      if (!controller.current?.signal.aborted) onSaved();
    } catch (cause) { if (!controller.current?.signal.aborted) setError(errorText(cause)); }
    finally { busyRef.current = false; if (!controller.current?.signal.aborted) setBusy(false); }
  };
  return <SlideOver open title='删除模型元数据' onClose={onClose} footer={<Button variant='primary' loading={busy} onClick={remove}>确认删除</Button>}>
    <div className='space-y-5 p-5'>
      <p className='text-sm text-ui-text-2'>将删除以下 {models.length} 条元数据。按需选择同时移除的渠道配置与价格。</p>
      <p className='break-all text-sm'>{models.map((model) => model.model_name).join('、')}</p>
      <Checkbox label='同时从渠道移除这些模型' checked={channels} disabled={busy || models.some((model) => model.name_rule !== 0)} onChange={setChannels} />
      {models.some((model) => model.name_rule !== 0) && <p className='text-xs text-ui-text-3'>匹配规则不能批量展开并删除渠道模型；渠道移除仅支持精确匹配记录。</p>}
      {root && <Checkbox label='同时删除这些名称的价格配置' checked={prices} disabled={busy} onChange={setPrices} />}
      <ErrorMessage message={error} />
    </div>
  </SlideOver>;
}
