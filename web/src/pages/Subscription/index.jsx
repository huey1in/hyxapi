import React, { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Copy, KeyRound } from 'lucide-react';
import { API, showError, showSuccess, copy, timestamp2string } from '../../helpers';
import {
  PageShell, Card, Button, IconButton, Input, NumberInput, MultiSelect, Table,
  Tag, Modal, ConfirmDialog, Loading,
} from '../../components/ui';

const SubscriptionPage = () => {
  const [plans, setPlans] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [codesPlan, setCodesPlan] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [plansRes, groupsRes] = await Promise.all([
        API.get('/api/subscription/admin/plans'),
        API.get('/api/group').catch(() => ({ data: { success: false } })),
      ]);
      if (plansRes.data?.success) setPlans(plansRes.data.data || []);
      else showError(plansRes.data?.message);
      if (groupsRes.data?.success && Array.isArray(groupsRes.data.data)) {
        setGroups(groupsRes.data.data.map((g) => ({ value: g, label: g })));
      }
    } catch (e) { showError(e); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const remove = async (planId) => {
    try {
      const res = await API.delete(`/api/subscription/admin/plans/${planId}`);
      const { success, message } = res.data || {};
      if (success) { showSuccess('已删除'); setConfirm(null); load(); }
      else showError(message);
    } catch (e) { showError(e); }
  };

  const columns = [
    { key: 'id', title: 'ID', width: 70, render: (r) => r.plan?.id },
    { key: 'name', title: '套餐名', render: (r) => r.plan?.name },
    { key: 'desc', title: '描述', render: (r) => r.plan?.description || '-' },
    { key: 'price', title: '价格', render: (r) => `¥${((r.plan?.price ?? 0) / 100).toFixed(2)}` },
    { key: 'duration', title: '时长(天)', render: (r) => r.plan?.duration_days },
    { key: 'groups', title: '可用分组', render: (r) =>
        <div className='flex flex-wrap gap-1'>
          {(r.plan?.allowed_groups || []).map((g) => <Tag key={g} color='blue'>{g}</Tag>)}
        </div> },
    { key: 'status', title: '状态', render: (r) =>
        r.plan?.enabled ? <Tag color='green'>启用</Tag> : <Tag color='grey'>停用</Tag> },
    { key: 'ops', title: '操作', align: 'right', render: (r) => (
        <div className='flex justify-end gap-1'>
          <IconButton icon={KeyRound} title='激活码' onClick={() => setCodesPlan(r.plan)} />
          <IconButton icon={Pencil} title='编辑' onClick={() => setEditing(r.plan)} />
          <IconButton icon={Trash2} variant='danger' title='删除'
            onClick={() => setConfirm({ title: `删除套餐 ${r.plan?.name}?`, onOk: () => remove(r.plan.id) })} />
        </div>
      ) },
  ];

  return (
    <PageShell
      title='订阅套餐'
      actions={<Button icon={Plus} onClick={() => setEditing({ name: '', description: '', price: 0, duration_days: 30, allowed_groups: [], enabled: true })}>新建套餐</Button>}
    >
      {loading ? <Loading /> : <Table columns={columns} rows={plans} rowKey={(r) => r.plan?.id} />}

      {editing && (
        <PlanEditModal plan={editing} groups={groups} onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }} />
      )}
      {codesPlan && (
        <CodesModal plan={codesPlan} onClose={() => setCodesPlan(null)} />
      )}
      {confirm && (
        <ConfirmDialog open title={confirm.title} onConfirm={confirm.onOk}
          onClose={() => setConfirm(null)} />
      )}
    </PageShell>
  );
};

const PlanEditModal = ({ plan, groups, onClose, onSaved }) => {
  const isEdit = !!plan.id;
  const [form, setForm] = useState(plan);
  const [saving, setSaving] = useState(false);
  const u = (k) => (v) => setForm((p) => ({ ...p, [k]: v?.target ? v.target.value : v }));

  const save = async () => {
    if (!form.name?.trim()) return showError('请输入套餐名');
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description || '',
        price: Number(form.price) || 0,
        duration_days: Number(form.duration_days) || 30,
        allowed_groups: form.allowed_groups || [],
        enabled: !!form.enabled,
      };
      const res = isEdit
        ? await API.put(`/api/subscription/admin/plans/${plan.id}`, payload)
        : await API.post('/api/subscription/admin/plans', payload);
      const { success, message } = res.data || {};
      if (success) { showSuccess(isEdit ? '已更新' : '已创建'); onSaved(); }
      else showError(message);
    } catch (e) { showError(e); } finally { setSaving(false); }
  };

  return (
    <Modal open title={isEdit ? `编辑套餐 #${plan.id}` : '新建套餐'} onClose={onClose} onConfirm={save} loading={saving} width={560}>
      <div className='space-y-4'>
        <div>
          <label className='block text-sm text-ui-text-2 mb-1.5'>套餐名</label>
          <Input value={form.name || ''} onChange={u('name')} />
        </div>
        <div>
          <label className='block text-sm text-ui-text-2 mb-1.5'>描述</label>
          <Input value={form.description || ''} onChange={u('description')} />
        </div>
        <div className='grid grid-cols-2 gap-4'>
          <div>
            <label className='block text-sm text-ui-text-2 mb-1.5'>价格（分）</label>
            <NumberInput value={form.price ?? 0} onChange={(v) => u('price')(Number(v))} min={0} />
          </div>
          <div>
            <label className='block text-sm text-ui-text-2 mb-1.5'>时长（天）</label>
            <NumberInput value={form.duration_days ?? 30} onChange={(v) => u('duration_days')(Number(v))} min={1} />
          </div>
        </div>
        <div>
          <label className='block text-sm text-ui-text-2 mb-1.5'>可用分组</label>
          <MultiSelect
            value={form.allowed_groups || []}
            onChange={u('allowed_groups')}
            options={groups}
            placeholder='选择分组（订阅期间这些分组将按订阅计费）'
          />
        </div>
        <label className='flex items-center gap-2 text-sm'>
          <input type='checkbox' checked={!!form.enabled} onChange={(e) => u('enabled')(e.target.checked)} />
          <span className='text-ui-text-1'>启用此套餐</span>
        </label>
      </div>
    </Modal>
  );
};

const CodesModal = ({ plan, onClose }) => {
  const [codes, setCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [count, setCount] = useState(1);
  const [generating, setGenerating] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await API.get(`/api/subscription/admin/plans/${plan.id}/codes`);
      if (res.data?.success) setCodes(res.data.data || []);
    } catch (e) { showError(e); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const generate = async () => {
    setGenerating(true);
    try {
      const res = await API.post(`/api/subscription/admin/plans/${plan.id}/codes`, { count });
      const { success, message } = res.data || {};
      if (success) { showSuccess(`已生成 ${count} 个激活码`); load(); }
      else showError(message);
    } catch (e) { showError(e); } finally { setGenerating(false); }
  };

  const remove = async (id) => {
    try {
      await API.delete(`/api/subscription/admin/codes/${id}`);
      showSuccess('已删除'); load();
    } catch (e) { showError(e); }
  };

  return (
    <Modal open title={`${plan.name} - 激活码管理`} onClose={onClose} hideFooter width={640}>
      <div className='flex items-center gap-2 mb-4'>
        <NumberInput value={count} onChange={(v) => setCount(Math.max(1, Number(v) || 1))} min={1} max={100} className='w-24' />
        <Button onClick={generate} loading={generating}>批量生成</Button>
      </div>
      {loading ? <Loading /> : (
        <div className='space-y-2 max-h-96 overflow-auto'>
          {codes.length === 0 && <p className='text-sm text-ui-text-3'>暂无激活码</p>}
          {codes.map((c) => (
            <div key={c.id} className='flex items-center justify-between gap-2 p-2 rounded-lg border border-ui-border'>
              <div className='flex-1 font-mono text-xs text-ui-text-1 truncate'>{c.code}</div>
              <Tag color={c.used_by ? 'grey' : 'green'}>{c.used_by ? `已用 #${c.used_by}` : '未使用'}</Tag>
              <IconButton icon={Copy} onClick={() => { copy(c.code); showSuccess('已复制'); }} />
              <IconButton icon={Trash2} variant='danger' onClick={() => remove(c.id)} />
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
};

export default SubscriptionPage;
