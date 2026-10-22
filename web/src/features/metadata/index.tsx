import { useEffect, useRef, useState } from 'react';
import { Boxes, Factory, Plus, Pencil, Trash2, RefreshCw } from 'lucide-react';
import { useAuthStore } from '../../stores/auth-store';
import PricingConfigDialog from '../../pages/Setting/PricingConfigDialog';
import MetadataEditor from './MetadataEditor';
import MetadataSyncDialog from './MetadataSyncDialog';
import ModelDeleteDialog from './ModelDeleteDialog';
import VendorOperationDialog from './VendorOperationDialog';
import { request, errorText, ruleOptions, stateLabels } from './catalog';
import type { Model, Vendor, Page, Operation } from './catalog';
import { Button, Checkbox, ErrorMessage, IconButton, Input, PageShell, Pagination, Select, Table, Tag } from './ui';

const newModel: Model = { id: 0, model_name: '', status: 1, sync_official: 1, name_rule: 0 };
const pageSize = 20;

function CatalogSession({ kind, root }: { kind: 'models' | 'vendors'; root: boolean }) {
  const [models, setModels] = useState<Model[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [vendorOptions, setVendorOptions] = useState<Vendor[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState('');
  const [filter, setFilter] = useState({ vendor: '', status: '', sync_official: '', square_state: '', association: '' });
  const [selected, setSelected] = useState<number[]>([]);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<Model | Vendor>();
  const [sync, setSync] = useState(false);
  const [deleting, setDeleting] = useState<Model[]>();
  const [operation, setOperation] = useState<Operation>();
  const [pricing, setPricing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const controller = useRef<AbortController>(undefined);
  const busyRef = useRef(false);
  const refresh = () => { setSelected([]); setRevision((current) => current + 1); };
  const saved = () => { setEditing(undefined); setDeleting(undefined); setOperation(undefined); setSync(false); refresh(); };
  useEffect(() => {
    const abort = new AbortController(); controller.current = abort;
    setLoading(true); setError(''); setSelected([]);
    const query = new URLSearchParams({ keyword, p: String(page), page_size: String(pageSize), ...filter, ...(kind === 'models' ? { include_channel_models: 'true' } : {}) });
    const timer = setTimeout(async () => {
      try {
        const [result, options] = await Promise.all([
          request<Page<Model> | Page<Vendor>>('get', `/api/${kind}/search?${query}`, undefined, abort.signal),
          request<Page<Vendor>>('get', '/api/vendors/?p=1&page_size=1000', undefined, abort.signal),
        ]);
        if (abort.signal.aborted) return;
        if (kind === 'models') setModels(result.items as Model[]); else setVendors(result.items as Vendor[]);
        setVendorOptions(options.items || []); setTotal(result.total);
        if (page > 1 && result.total <= (page - 1) * pageSize) setPage(Math.max(1, Math.ceil(result.total / pageSize)));
      } catch (cause) { if (!abort.signal.aborted) setError(errorText(cause)); }
      finally { if (!abort.signal.aborted) setLoading(false); }
    }, 200);
    return () => { clearTimeout(timer); abort.abort(); };
  }, [kind, page, keyword, filter, revision]);
  const change = (key: keyof typeof filter, value: string) => { setFilter((current) => ({ ...current, [key]: value })); setPage(1); };
  const toggle = (id: number, checked: boolean) => setSelected((current) => checked ? [...current, id] : current.filter((value) => value !== id));
  const selectAll = (checked: boolean) => setSelected(checked ? (kind === 'models' ? models : vendors).filter((item) => item.id > 0).map((item) => item.id) : []);
  const toggleStatus = async (model: Model) => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError('');
    const signal = controller.current?.signal;
    try { await request('put', '/api/models/?status_only=true', { id: model.id, status: model.status === 1 ? 0 : 1 }, signal); if (!signal?.aborted) refresh(); }
    catch (cause) { if (!signal?.aborted) setError(errorText(cause)); }
    finally { busyRef.current = false; setBusy(false); }
  };
  const actions = <div className='flex flex-wrap gap-2'>
    <IconButton icon={RefreshCw} title='刷新' onClick={refresh} />
    {kind === 'models' && <Button onClick={() => setSync(true)}>同步上游</Button>}
    <Button variant='primary' icon={Plus} onClick={() => setEditing(kind === 'models' ? { ...newModel } : { id: 0, name: '' })}>新建{kind === 'models' ? '模型' : '供应商'}</Button>
  </div>;
  return <PageShell title={kind === 'models' ? '模型管理' : '供应商管理'} actions={actions}>
    <div className='space-y-4'>
      <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-3'>
        <Input width='full' value={keyword} placeholder='搜索名称或描述' aria-label='搜索名称或描述' onChange={(value) => { setKeyword(value); setPage(1); }} />
        {kind === 'models' ? <>
          <Select width='full' value={filter.vendor} onChange={(value) => change('vendor', value)} options={[{ value: '', label: '全部供应商' }, { value: '0', label: '未分配' }, ...vendorOptions.map((vendor) => ({ value: String(vendor.id), label: vendor.name }))]} />
          <Select width='full' value={filter.square_state} onChange={(value) => change('square_state', value)} options={[{ value: '', label: '全部广场状态' }, ...Object.entries(stateLabels).map(([value, label]) => ({ value, label }))]} />
          <Select width='full' value={filter.status} onChange={(value) => change('status', value)} options={[{ value: '', label: '全部可见性' }, { value: '1', label: '允许显示' }, { value: '0', label: '隐藏' }]} />
          <Select width='full' value={filter.sync_official} onChange={(value) => change('sync_official', value)} options={[{ value: '', label: '全部同步状态' }, { value: '1', label: '允许同步' }, { value: '0', label: '关闭同步' }]} />
        </> : <Select width='full' value={filter.association} onChange={(value) => change('association', value)} options={[{ value: '', label: '全部关联状态' }, { value: 'linked', label: '已有模型' }, { value: 'unlinked', label: '未关联模型' }]} />}
      </div>
      <div className='flex flex-wrap items-center gap-3'>
        <Checkbox label='选择本页' checked={selected.length > 0 && selected.length === (kind === 'models' ? models : vendors).filter((item) => item.id > 0).length} disabled={loading} onChange={selectAll} />
        <span className='text-xs text-ui-text-3'>已选 {selected.length} 项</span>
        {kind === 'models' ? <><Button disabled={!selected.length || loading} onClick={() => setOperation({ action: 'assign', model_ids: selected })}>分配供应商</Button><Button disabled={!selected.length || loading} onClick={() => setDeleting(models.filter((item) => selected.includes(item.id)))}>删除所选</Button></> : <><Button disabled={!selected.length || loading} onClick={() => setOperation({ action: 'merge', vendor_ids: selected })}>合并所选</Button><Button disabled={!selected.length || loading} onClick={() => setOperation({ action: 'delete', vendor_ids: selected })}>删除所选</Button></>}
      </div>
      <ErrorMessage message={error} />
      {kind === 'models' ? <Table<Model> loading={loading} rows={models} rowKey={(item) => item.id || `channel:${item.model_name}`} minWidth={800} emptyIcon={Boxes} columns={[
        { key: 'select', mobileRole: 'selection', title: '', width: 40, render: (item) => <Checkbox checked={selected.includes(item.id)} disabled={!item.id} aria-label={`选择 ${item.model_name}`} onChange={(checked) => toggle(item.id, checked)} /> },
        { key: 'model_name', title: '模型', render: (item) => <div className='max-w-72 break-all'><p>{item.model_name}</p><p className='mt-1 text-xs text-ui-text-3'>{ruleOptions[item.name_rule]?.label}{!item.has_metadata && ' · 尚无元数据'}</p></div> },
        { key: 'vendor', title: '供应商', render: (item) => vendorOptions.find((vendor) => vendor.id === item.vendor_id)?.name || '未分配' },
        { key: 'square_state', title: '广场状态', render: (item) => <Tag>{stateLabels[item.square_state || ''] || '不可用'}</Tag> },
        { key: 'channels', title: '接入渠道', render: (item) => item.configured_channel_count || 0 },
        { key: 'visible', title: '允许显示', render: (item) => <Checkbox checked={item.status === 1} disabled={!item.id || busy} aria-label={`${item.model_name} 允许显示`} onChange={() => toggleStatus(item)} /> },
        { key: 'ops', mobileRole: 'actions' as const, title: '操作', align: 'right', render: (item) => <div className='flex justify-end gap-1'><IconButton icon={Pencil} title={item.id ? '编辑' : '补充元数据'} onClick={() => setEditing(item.id ? item : { ...item, status: 1, sync_official: 1 })} />{root && <Button size='sm' onClick={() => setPricing(item.model_name)}>价格</Button>}{item.id > 0 && <IconButton icon={Trash2} title='删除' onClick={() => setDeleting([item])} />}</div> },
      ]} /> : <Table<Vendor> loading={loading} rows={vendors} minWidth={600} emptyIcon={Factory} columns={[
        { key: 'select', mobileRole: 'selection', title: '', width: 40, render: (item) => <Checkbox checked={selected.includes(item.id)} aria-label={`选择 ${item.name}`} onChange={(checked) => toggle(item.id, checked)} /> },
        { key: 'name', title: '供应商', render: (item) => <span className='break-all'>{item.name}</span> },
        { key: 'description', title: '描述', render: (item) => <span className='inline-block max-w-80 break-words'>{item.description || '—'}</span> },
        { key: 'model_count', title: '关联模型', render: (item) => item.model_count || 0 },
        { key: 'ops', mobileRole: 'actions' as const, title: '操作', align: 'right', render: (item) => <div className='flex justify-end gap-1'><IconButton icon={Pencil} title='编辑' onClick={() => setEditing(item)} /><IconButton icon={Trash2} title='删除' onClick={() => setOperation({ action: 'delete', vendor_ids: [item.id] })} /></div> },
      ]} />}
      <Pagination page={page} pageSize={pageSize} total={total} onChange={setPage} />
    </div>
    {editing && <MetadataEditor model={kind === 'models' ? editing as Model : undefined} vendor={kind === 'vendors' ? editing as Vendor : undefined} vendors={vendorOptions} onClose={() => setEditing(undefined)} onSaved={saved} />}
    {sync && <MetadataSyncDialog onClose={() => setSync(false)} onSaved={saved} />}
    {operation && <VendorOperationDialog operation={operation} onClose={() => setOperation(undefined)} onSaved={saved} />}
    {deleting && <ModelDeleteDialog models={deleting} root={root} onClose={() => setDeleting(undefined)} onSaved={saved} />}
    {pricing && <PricingConfigDialog modelName={pricing} onClose={() => setPricing(null)} onSaved={() => { setPricing(null); refresh(); }} />}
  </PageShell>;
}

export default function MetadataPage({ kind = 'models' }: { kind?: 'models' | 'vendors' }) {
  const user = useAuthStore((state) => state.auth.user);
  if (!user || user.role < 10) return <PageShell title='无访问权限'><p className='text-sm text-ui-text-2'>此页面仅供管理员使用。</p></PageShell>;
  return <CatalogSession key={`${user.id}:${kind}`} kind={kind} root={user.role === 100} />;
}
