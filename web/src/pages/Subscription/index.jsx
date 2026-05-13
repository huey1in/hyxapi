import React, { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Copy, KeyRound } from 'lucide-react';
import { API, showError, showSuccess, copy } from '../../helpers';
import {
  PageShell, Button, IconButton, Input, NumberInput, MultiSelect, Select, Table,
  Tag, Modal, SlideOver, Switch, ConfirmDialog, Loading,
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
    { key: 'title', title: '套餐名', render: (r) => r.plan?.title },
    { key: 'subtitle', title: '描述', render: (r) => r.plan?.subtitle || '-' },
    { key: 'duration', title: '时长', render: (r) => {
        const p = r.plan;
        const unitMap = { month: '月', year: '年', day: '天', hour: '小时' };
        if (p?.duration_unit === 'custom') return `${p.custom_seconds}秒`;
        return `${p?.duration_value || 1}${unitMap[p?.duration_unit] || '月'}`;
      } },
    { key: 'quota', title: '额度', render: (r) => r.plan?.total_amount ? `${r.plan.total_amount}` : '不限' },
    { key: 'rpm', title: 'RPM', render: (r) => r.plan?.rpm_limit || '不限' },
    { key: 'groups', title: '可用分组', render: (r) =>
        <div className='flex flex-wrap gap-1'>
          {(() => { try { const g = typeof r.plan?.allowed_groups === 'string' ? JSON.parse(r.plan.allowed_groups) : (r.plan?.allowed_groups || []); return g.map((x) => <Tag key={x} color='blue'>{x}</Tag>); } catch { return null; } })()}
        </div> },
    { key: 'status', title: '状态', render: (r) =>
        r.plan?.enabled ? <Tag color='green'>启用</Tag> : <Tag color='grey'>停用</Tag> },
    { key: 'ops', title: '操作', align: 'right', render: (r) => (
        <div className='flex justify-end gap-1'>
          <IconButton icon={KeyRound} title='激活码' onClick={() => setCodesPlan(r.plan)} />
          <IconButton icon={Pencil} title='编辑' onClick={() => setEditing(r.plan)} />
          <IconButton icon={Trash2} variant='danger' title='删除'
            onClick={() => setConfirm({ title: `删除套餐 ${r.plan?.title}?`, onOk: () => remove(r.plan.id) })} />
        </div>
      ) },
  ];

  return (
    <PageShell
      title='订阅套餐'
      actions={<Button icon={Plus} onClick={() => setEditing({ title: '', subtitle: '', duration_unit: 'month', duration_value: 1, total_amount: 0, quota_reset_period: 'never', rpm_limit: 0, concurrent_limit: 0, allowed_groups: [], allowed_models: [], enabled: true, sort_order: 0 })}>新建套餐</Button>}
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

const DURATION_UNIT_OPTIONS = [
  { value: 'month', label: '月' },
  { value: 'year', label: '年' },
  { value: 'day', label: '天' },
  { value: 'hour', label: '小时' },
  { value: 'custom', label: '自定义（秒）' },
];

const QUOTA_RESET_OPTIONS = [
  { value: 'never', label: '不重置' },
  { value: 'daily', label: '每天' },
  { value: 'weekly', label: '每周' },
  { value: 'monthly', label: '每月' },
  { value: 'custom', label: '自定义（秒）' },
];

const PlanEditModal = ({ plan, groups, onClose, onSaved }) => {
  const isEdit = !!plan.id;
  const parseArr = (v) => {
    if (Array.isArray(v)) return v;
    if (typeof v === 'string' && v) try { const r = JSON.parse(v); if (Array.isArray(r)) return r; } catch {}
    return [];
  };
  const [form, setForm] = useState(() => ({
    ...plan,
    title: plan.title || plan.name || '',
    subtitle: plan.subtitle || plan.description || '',
    allowed_groups: parseArr(plan.allowed_groups),
    allowed_models: parseArr(plan.allowed_models),
  }));
  const [saving, setSaving] = useState(false);
  const [models, setModels] = useState([]);
  const u = (k) => (v) => setForm((p) => ({ ...p, [k]: v?.target ? v.target.value : v }));

  useEffect(() => {
    const group = (form.allowed_groups || []).length === 1 ? form.allowed_groups[0] : '';
    const url = group ? `/api/user/models?group=${encodeURIComponent(group)}` : '/api/user/models';
    API.get(url).then((res) => {
      if (res.data?.success && Array.isArray(res.data.data)) {
        setModels(res.data.data.map((m) => ({ value: m, label: m })));
      }
    }).catch(() => setModels([]));
  }, [form.allowed_groups]);

  const save = async () => {
    if (!form.title?.trim()) return showError('请输入套餐名');
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        subtitle: form.subtitle || '',
        price_amount: 0,
        currency: 'CNY',
        duration_unit: form.duration_unit || 'month',
        duration_value: Number(form.duration_value) || 1,
        custom_seconds: Number(form.custom_seconds) || 0,
        enabled: !!form.enabled,
        sort_order: Number(form.sort_order) || 0,
        total_amount: Number(form.total_amount) || 0,
        quota_reset_period: form.quota_reset_period || 'never',
        quota_reset_custom_seconds: Number(form.quota_reset_custom_seconds) || 0,
        allowed_groups: JSON.stringify(form.allowed_groups || []),
        allowed_models: JSON.stringify(form.allowed_models || []),
        concurrent_limit: Number(form.concurrent_limit) || 0,
        rpm_limit: Number(form.rpm_limit) || 0,
      };
      const res = isEdit
        ? await API.put(`/api/subscription/admin/plans/${plan.id}`, { plan: payload })
        : await API.post('/api/subscription/admin/plans', { plan: payload });
      const { success, message } = res.data || {};
      if (success) { showSuccess(isEdit ? '已更新' : '已创建'); onSaved(); }
      else showError(message);
    } catch (e) { showError(e); } finally { setSaving(false); }
  };

  return (
    <SlideOver open title={<span className='text-lg font-semibold'>{isEdit ? `编辑套餐 #${plan.id}` : '新建套餐'}</span>} onClose={onClose} width={520}
      footer={<><Button variant='toggle' onClick={onClose}>取消</Button><Button loading={saving} onClick={save}>{isEdit ? '保存' : '创建'}</Button></>}>
      <div className='px-6 pb-6 space-y-5'>
        {/* 基本信息 */}
        <div className='space-y-4'>
          <div>
            <label className='block text-sm text-ui-text-2 mb-1.5'>套餐名称</label>
            <Input value={form.title || ''} onChange={u('title')} width='full' placeholder='如：月度专业版' />
          </div>
          <div>
            <label className='block text-sm text-ui-text-2 mb-1.5'>描述</label>
            <Input value={form.subtitle || ''} onChange={u('subtitle')} width='full' placeholder='套餐简介' />
          </div>
          <div className='grid grid-cols-2 gap-4'>
            <div>
              <label className='block text-sm text-ui-text-2 mb-1.5'>排序权重</label>
              <NumberInput value={form.sort_order ?? 0} onChange={(v) => u('sort_order')(Number(v))} width='full' />
            </div>
            <div>
              <label className='flex items-center gap-2 text-sm text-ui-text-2 h-full pt-5'>
                <Switch size='sm' checked={!!form.enabled} onChange={(v) => u('enabled')(v)} />
                启用此套餐
              </label>
            </div>
          </div>
        </div>

        <div className='h-px bg-[#eeeeee]' />

        {/* 时长配置 */}
        <div className='space-y-4'>
          <span className='text-sm font-medium text-ui-text'>订阅时长</span>
          <div className='grid grid-cols-2 gap-4'>
            <div>
              <label className='block text-sm text-ui-text-2 mb-1.5'>时长单位</label>
              <Select value={form.duration_unit || 'month'} onChange={u('duration_unit')} options={DURATION_UNIT_OPTIONS} width='full' />
            </div>
            {(form.duration_unit || 'month') !== 'custom' ? (
              <div>
                <label className='block text-sm text-ui-text-2 mb-1.5'>数量</label>
                <NumberInput value={form.duration_value ?? 1} onChange={(v) => u('duration_value')(Number(v))} min={1} width='full' />
              </div>
            ) : (
              <div>
                <label className='block text-sm text-ui-text-2 mb-1.5'>自定义秒数</label>
                <NumberInput value={form.custom_seconds ?? 0} onChange={(v) => u('custom_seconds')(Number(v))} min={1} width='full' />
              </div>
            )}
          </div>
        </div>

        <div className='h-px bg-[#eeeeee]' />

        {/* 额度配置 */}
        <div className='space-y-4'>
          <span className='text-sm font-medium text-ui-text'>额度与限流</span>
          <div>
            <label className='block text-sm text-ui-text-2 mb-1.5'>总可用额度 <span className='text-xs text-ui-text-3'>(0 = 不限)</span></label>
            <NumberInput value={form.total_amount ?? 0} onChange={(v) => u('total_amount')(Number(v))} min={0} width='full' />
          </div>
          <div className='grid grid-cols-2 gap-4'>
            <div>
              <label className='block text-sm text-ui-text-2 mb-1.5'>额度重置周期</label>
              <Select value={form.quota_reset_period || 'never'} onChange={u('quota_reset_period')} options={QUOTA_RESET_OPTIONS} width='full' />
            </div>
            {form.quota_reset_period === 'custom' && (
              <div>
                <label className='block text-sm text-ui-text-2 mb-1.5'>重置间隔（秒）</label>
                <NumberInput value={form.quota_reset_custom_seconds ?? 0} onChange={(v) => u('quota_reset_custom_seconds')(Number(v))} min={1} width='full' />
              </div>
            )}
          </div>
          <div className='grid grid-cols-2 gap-4'>
            <div>
              <label className='block text-sm text-ui-text-2 mb-1.5'>RPM 限制 <span className='text-xs text-ui-text-3'>(0 = 不限)</span></label>
              <NumberInput value={form.rpm_limit ?? 0} onChange={(v) => u('rpm_limit')(Number(v))} min={0} width='full' />
            </div>
            <div>
              <label className='block text-sm text-ui-text-2 mb-1.5'>并发限制 <span className='text-xs text-ui-text-3'>(0 = 不限)</span></label>
              <NumberInput value={form.concurrent_limit ?? 0} onChange={(v) => u('concurrent_limit')(Number(v))} min={0} width='full' />
            </div>
          </div>
        </div>

        <div className='h-px bg-[#eeeeee]' />

        {/* 权限控制 */}
        <div className='space-y-4'>
          <span className='text-sm font-medium text-ui-text'>权限控制</span>
          <div>
            <label className='block text-sm text-ui-text-2 mb-1.5'>可用分组 <span className='text-xs text-ui-text-3'>(空 = 不限制)</span></label>
            <MultiSelect
              value={form.allowed_groups || []}
              onChange={u('allowed_groups')}
              options={groups}
              placeholder='选择分组'
              width='full'
            />
          </div>
          <div>
            <label className='block text-sm text-ui-text-2 mb-1.5'>可用模型 <span className='text-xs text-ui-text-3'>(空 = 不限制)</span></label>
            <MultiSelect
              value={form.allowed_models || []}
              onChange={u('allowed_models')}
              options={models}
              placeholder='选择允许的模型'
              width='full'
              searchable
            />
          </div>
        </div>
      </div>
    </SlideOver>
  );
};

const CodesModal = ({ plan, onClose }) => {
  const [codes, setCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [count, setCount] = useState(1);
  const [name, setName] = useState('');
  const [expiredTime, setExpiredTime] = useState(0);
  const [generating, setGenerating] = useState(false);

  const toLocalInput = (ts) => {
    if (!ts) return '';
    const d = new Date(ts * 1000);
    if (isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  const toUnix = (v) => (v ? Math.floor(new Date(v).getTime() / 1000) : 0);

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
      const res = await API.post(`/api/subscription/admin/plans/${plan.id}/codes`, {
        count,
        name: name.trim() || undefined,
        expired_time: expiredTime || 0,
      });
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
    <Modal open title={`${plan.title} - 激活码管理`} onClose={onClose} hideFooter width={680}>
      <div className='space-y-4 mb-4'>
        <div className='grid grid-cols-2 gap-3'>
          <div>
            <label className='block text-xs text-[#999] mb-1'>批次名称</label>
            <Input value={name} onChange={setName} width='full' placeholder='可选，如"5月活动"' />
          </div>
          <div>
            <label className='block text-xs text-[#999] mb-1'>生成数量</label>
            <NumberInput value={count} onChange={(v) => setCount(Math.max(1, Number(v) || 1))} min={1} max={200} width='full' />
          </div>
        </div>
        <div>
          <label className='block text-xs text-[#999] mb-1'>过期时间 <span className='text-[#bbb]'>(留空 = 永不过期)</span></label>
          <div className='flex gap-2'>
            <input
              type='datetime-local'
              value={toLocalInput(expiredTime)}
              onChange={(e) => setExpiredTime(toUnix(e.target.value))}
              className='flex-1 rounded-lg border border-[#e3e3e3] bg-transparent px-3 py-2 text-sm text-[#000]'
            />
            {expiredTime > 0 && (
              <Button variant='toggle' onClick={() => setExpiredTime(0)}>清除</Button>
            )}
          </div>
        </div>
        <Button onClick={generate} loading={generating}>批量生成</Button>
      </div>

      <div className='h-px bg-[#eeeeee] mb-4' />

      {loading ? <Loading /> : (
        <div className='space-y-2 max-h-80 overflow-auto'>
          {codes.length === 0 && <p className='text-sm text-[#999]'>暂无激活码</p>}
          {codes.map((c) => (
            <div key={c.id} className='flex items-center justify-between gap-2 p-2 rounded-lg border border-[#e9e9e9]'>
              <div className='flex-1 min-w-0'>
                <div className='font-mono text-xs text-[#000] truncate'>{c.key}</div>
                {c.name && <div className='text-xs text-[#999] mt-0.5'>{c.name}</div>}
              </div>
              <Tag color={c.status === 2 || c.used_user_id ? 'grey' : 'green'}>
                {c.status === 2 || c.used_user_id ? `已用 #${c.used_user_id}` : '未使用'}
              </Tag>
              {c.expired_time > 0 && (
                <span className='text-xs text-[#999] whitespace-nowrap'>
                  {new Date(c.expired_time * 1000).toLocaleDateString()}
                </span>
              )}
              <IconButton icon={Copy} onClick={() => { copy(c.key); showSuccess('已复制'); }} />
              <IconButton icon={Trash2} variant='danger' onClick={() => remove(c.id)} />
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
};

export default SubscriptionPage;
