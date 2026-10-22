import { useEffect, useRef, useState } from 'react';
import { Boxes } from 'lucide-react';
import { request, errorText } from './catalog';
import type { Operation, OperationPreview, Page, Vendor } from './catalog';
import { Button, ErrorMessage, Field, Select, SlideOver, Table } from './ui';

export default function VendorOperationDialog({ operation, onClose, onSaved }: { operation: Operation; onClose: () => void; onSaved: () => void }) {
  const [target, setTarget] = useState(String(operation.target_vendor_id || 0));
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [preview, setPreview] = useState<OperationPreview>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const controller = useRef(new AbortController());
  const busyRef = useRef(false);
  const title = operation.action === 'assign' ? '分配模型供应商' : operation.action === 'merge' ? '合并供应商' : '删除供应商';
  useEffect(() => {
    const abort = new AbortController(); controller.current = abort;
    if (operation.action !== 'delete') request<Page<Vendor>>('get', '/api/vendors/?p=1&page_size=1000', undefined, abort.signal)
      .then((data) => { if (!abort.signal.aborted) setVendors(data.items || []); })
      .catch((cause) => { if (!abort.signal.aborted) setError(errorText(cause)); });
    return () => abort.abort();
  }, [operation.action]);
  const execute = async (apply: boolean) => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError('');
    try {
      const body = { ...operation, target_vendor_id: Number(target), ...(apply ? { expected_version: preview?.version } : {}) };
      const result = await request<OperationPreview>('post', `/api/vendors/operations${apply ? '' : '/preview'}`, body, controller.current.signal);
      if (controller.current.signal.aborted) return;
      if (apply) onSaved(); else setPreview(result);
    } catch (cause) { if (!controller.current.signal.aborted) { setPreview(undefined); setError(errorText(cause)); } }
    finally { busyRef.current = false; if (!controller.current.signal.aborted) setBusy(false); }
  };
  return <SlideOver open title={title} onClose={onClose} footer={<div className='flex justify-end gap-2'><Button disabled={busy} onClick={() => execute(false)}>预览操作</Button><Button variant='primary' loading={busy} disabled={!preview} onClick={() => execute(true)}>确认应用</Button></div>}>
    <div className='space-y-5 p-5'>
      <p className='text-sm text-ui-text-2'>{operation.action === 'merge' ? '将所选供应商的模型移至目标供应商，再删除来源供应商。' : operation.action === 'delete' ? '仅删除没有模型引用的供应商。存在引用时，先转移或清除模型关联。' : '将所选模型分配至目标供应商；选择未分配可清除关联。'}</p>
      {operation.action !== 'delete' && <Field label='目标供应商'><Select width='full' value={target} disabled={busy} onChange={(value) => { setTarget(value); setPreview(undefined); setError(''); }} options={[...(operation.action === 'assign' ? [{ value: '0', label: '未分配' }] : []), ...vendors.filter((vendor) => !operation.vendor_ids?.includes(vendor.id)).map((vendor) => ({ value: String(vendor.id), label: vendor.name }))]} /></Field>}
      <ErrorMessage message={error} />
      {preview && <><p className='text-sm text-ui-text-2'>影响 {preview.models.length} 个模型；来源：{preview.sources.map((vendor) => vendor.name).join('、') || '未分配'}；目标：{preview.target?.name || '未分配'}</p><Table rows={preview.models} emptyIcon={Boxes} columns={[{ key: 'model_name', title: '模型' }, { key: 'vendor_name', title: '原供应商' }]} /></>}
    </div>
  </SlideOver>;
}
