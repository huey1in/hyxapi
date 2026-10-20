import { useEffect, useRef, useState } from 'react';
import { request, errorText, ruleOptions } from './catalog';
import type { Model, Vendor } from './catalog';
import { Button, Checkbox, ErrorMessage, Field, Input, Select, SlideOver, Textarea } from './ui';

export default function MetadataEditor({ model, vendor, vendors, onClose, onSaved }: { model?: Model; vendor?: Vendor; vendors: Vendor[]; onClose: () => void; onSaved: () => void }) {
  const isModel = Boolean(model);
  const [draft, setDraft] = useState(() => ({
    id: model?.id || vendor?.id || 0, model_name: model?.model_name || '', name: vendor?.name || '',
    description: model?.description || vendor?.description || '', icon: model?.icon || vendor?.icon || '',
    tags: model?.tags || '', vendor_id: model?.vendor_id || 0, endpoints: model?.endpoints || '',
    status: model?.status ?? 1, sync_official: model?.sync_official ?? 1, name_rule: model?.name_rule || 0,
    version: vendor?.version,
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const controller = useRef<AbortController>(undefined);
  const busyRef = useRef(false);
  useEffect(() => { const abort = new AbortController(); controller.current = abort; return () => abort.abort(); }, []);
  const update = <K extends keyof typeof draft>(key: K, value: typeof draft[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const save = async () => {
    if (busyRef.current) return;
    if (!(isModel ? draft.model_name : draft.name).trim()) { setError('请输入名称'); return; }
    if (isModel && draft.endpoints.trim()) {
      try { const value = JSON.parse(draft.endpoints); if (!value || typeof value !== 'object') throw new Error(); }
      catch { setError('端点配置必须为 JSON 对象或数组'); return; }
    }
    busyRef.current = true; setBusy(true); setError('');
    try {
      const payload = isModel ? { id: draft.id, model_name: draft.model_name.trim(), description: draft.description, icon: draft.icon, tags: draft.tags, vendor_id: draft.vendor_id, endpoints: draft.endpoints, status: draft.status, sync_official: draft.sync_official, name_rule: draft.name_rule } : { id: draft.id, name: draft.name.trim(), description: draft.description, icon: draft.icon, version: draft.version };
      await request(draft.id ? 'put' : 'post', `/api/${isModel ? 'models' : 'vendors'}/`, payload, controller.current?.signal);
      if (!controller.current?.signal.aborted) onSaved();
    } catch (cause) { if (!controller.current?.signal.aborted) setError(errorText(cause)); }
    finally { busyRef.current = false; if (!controller.current?.signal.aborted) setBusy(false); }
  };
  return <SlideOver open title={`${draft.id ? '编辑' : '新建'}${isModel ? '模型' : '供应商'}`} onClose={onClose} footer={<Button variant='primary' loading={busy} onClick={save}>保存</Button>}>
    <div className='space-y-5 p-5'>
      <ErrorMessage message={error} />
      <Field label={isModel ? '模型名称' : '供应商名称'}><Input width='full' maxLength={128} value={isModel ? draft.model_name : draft.name} aria-label={isModel ? '模型名称' : '供应商名称'} onChange={(value) => isModel ? update('model_name', value) : update('name', value)} /></Field>
      <Field label='描述'><Textarea width='full' value={draft.description} aria-label='描述' onChange={(value) => update('description', value)} /></Field>
      <Field label='图标名称'><Input width='full' value={draft.icon} maxLength={128} aria-label='图标名称' onChange={(value) => update('icon', value)} /></Field>
      {isModel && <>
        <Field label='标签'><Input width='full' value={draft.tags} maxLength={255} aria-label='标签' onChange={(value) => update('tags', value)} /></Field>
        <Field label='供应商'><Select width='full' value={String(draft.vendor_id)} options={[{ value: '0', label: '未分配' }, ...vendors.map((item) => ({ value: String(item.id), label: item.name }))]} onChange={(value) => update('vendor_id', Number(value))} /></Field>
        <Field label='匹配规则'><Select width='full' value={String(draft.name_rule)} options={ruleOptions} onChange={(value) => update('name_rule', Number(value))} /></Field>
        <Field label='端点配置'><Textarea width='full' rows={5} aria-label='端点配置' value={draft.endpoints} placeholder='["openai", "anthropic"]' onChange={(value) => update('endpoints', value)} /></Field>
        <p className='text-xs text-ui-text-3'>留空时根据已接入的渠道推导协议；支持协议名称数组或自定义路径对象。</p>
        <Checkbox label='在模型广场显示' checked={draft.status === 1} onChange={(value) => update('status', value ? 1 : 0)} />
        <Checkbox label='允许同步上游元数据' checked={draft.sync_official === 1} onChange={(value) => update('sync_official', value ? 1 : 0)} />
        {!!model?.bound_channels?.length && <p className='text-xs text-ui-text-3'>已接入渠道：{model.bound_channels.map((item) => item.name).join('、')}</p>}
        {!!model?.supported_endpoints?.length && <p className='text-xs text-ui-text-3'>支持协议：{model.supported_endpoints.join('、')}</p>}
        {!!model?.enable_groups?.length && <p className='text-xs text-ui-text-3'>可用分组：{model.enable_groups.join('、')}</p>}
        {!!model?.matched_models?.length && <details><summary className='cursor-pointer text-sm'>匹配的模型（{model.matched_models.length}）</summary><p className='mt-2 break-words text-xs text-ui-text-3'>{model.matched_models.join('、')}</p></details>}
      </>}
    </div>
  </SlideOver>;
}
