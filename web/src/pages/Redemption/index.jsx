import React, { useEffect, useState } from 'react';
import { Trash2, Copy, Power, PowerOff } from 'lucide-react';
import { API, showError, showSuccess, copy, renderQuota, timestamp2string } from '../../helpers';
import { quotaToDisplayAmount, displayAmountToQuota } from '../../helpers/quota';
import {
  PageShell, Button, IconButton, Input, NumberInput, Select, Table, Pagination,
  Tag, Modal, ConfirmDialog, Loading,
} from '../../components/ui';

const PAGE_SIZE = 20;

const QUOTA_STATUS_TAG = {
  1: { color: 'green', text: '未使用' },
  2: { color: 'grey',  text: '禁用' },
  3: { color: 'blue',  text: '已使用' },
  4: { color: 'red',   text: '失效' },
};

const RedemptionPage = () => {
  const [tab, setTab] = useState('quota');

  return (
    <PageShell title='兑换码'>
      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        {[{ key: 'quota', label: '额度兑换码' }, { key: 'subscription', label: '订阅激活码' }].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              cursor: 'pointer', height: 30, paddingInline: 14, borderRadius: 15,
              fontSize: 13, border: 'none',
              color: tab === t.key ? 'var(--ui-text)' : 'var(--ui-text-2)',
              background: tab === t.key ? 'var(--ui-bg-subtle)' : 'transparent',
              fontWeight: tab === t.key ? 500 : 400,
              transition: 'background 0.15s',
            }}
          >{t.label}</button>
        ))}
      </div>
      {tab === 'quota' ? <QuotaCodesTab /> : <SubscriptionCodesTab />}
    </PageShell>
  );
};

/* ─── 额度兑换码 Tab ─── */
const QuotaCodesTab = () => {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState(null);
  const [genForm, setGenForm] = useState({ name: '', quota: 500000, count: 1, expired_time: 0 });
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(null);
  const [searchKeyword, setSearchKeyword] = useState('');

  const toLocalInput = (ts) => {
    if (!ts) return '';
    const d = new Date(ts * 1000);
    if (isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  const toUnix = (v) => (v ? Math.floor(new Date(v).getTime() / 1000) : 0);

  const load = async (p = 1) => {
    setLoading(true);
    try {
      const url = searchKeyword.trim()
        ? `/api/redemption/search?keyword=${encodeURIComponent(searchKeyword.trim())}&p=${p}&page_size=${PAGE_SIZE}`
        : `/api/redemption/?p=${p}&page_size=${PAGE_SIZE}`;
      const res = await API.get(url);
      const { success, data, message } = res.data || {};
      if (success) {
        setRows(data?.items || data || []);
        setTotal(data?.total ?? 0);
        setPage(p);
      } else showError(message);
    } catch (e) { showError(e); } finally { setLoading(false); }
  };
  useEffect(() => { load(1); }, []);
  useEffect(() => { if (!searchKeyword) load(1); }, [searchKeyword]);

  const setStatus = async (row, status) => {
    try {
      const res = await API.put('/api/redemption/?status_only=true', { id: row.id, status });
      const { success, message } = res.data || {};
      if (success) { showSuccess('已更新'); load(page); }
      else showError(message);
    } catch (e) { showError(e); }
  };

  const remove = async (row) => {
    try {
      const res = await API.delete(`/api/redemption/${row.id}/`);
      const { success, message } = res.data || {};
      if (success) { showSuccess('已删除'); setConfirm(null); load(page); }
      else showError(message);
    } catch (e) { showError(e); }
  };

  const removeInvalid = async () => {
    try {
      const res = await API.delete('/api/redemption/invalid');
      const { success, message } = res.data || {};
      if (success) { showSuccess('已清理失效兑换码'); setConfirm(null); load(1); }
      else showError(message);
    } catch (e) { showError(e); }
  };

  const generate = async () => {
    if (!genForm.name?.trim()) return showError('请输入名称');
    setGenerating(true);
    try {
      const res = await API.post('/api/redemption/', {
        name: genForm.name.trim(),
        quota: Number(genForm.quota) || 0,
        count: Number(genForm.count) || 1,
        expired_time: Number(genForm.expired_time) || 0,
      });
      const { success, data, message } = res.data || {};
      if (success) {
        showSuccess(`已生成 ${data?.length || genForm.count} 个兑换码`);
        setGenerated(data || []);
        load(1);
      } else showError(message);
    } catch (e) { showError(e); } finally { setGenerating(false); }
  };

  const columns = [
    { key: 'id', title: 'ID', width: 70 },
    { key: 'name', title: '名称' },
    { key: 'key', title: '兑换码', render: (r) => (
        <div className='flex items-center gap-2 font-mono text-xs'>
          <span>{r.key?.slice(0, 12)}…</span>
          <IconButton icon={Copy} title='复制' onClick={() => { copy(r.key); showSuccess('已复制'); }} />
        </div>
      ) },
    { key: 'quota', title: '面额', render: (r) => renderQuota(r.quota || 0, 2) },
    { key: 'status', title: '状态', render: (r) => {
        const s = QUOTA_STATUS_TAG[r.status] || QUOTA_STATUS_TAG[1];
        return <Tag color={s.color}>{s.text}</Tag>;
      } },
    { key: 'used_user_id', title: '使用者', render: (r) => r.used_user_id || '-' },
    { key: 'expired_time', title: '过期时间', render: (r) => r.expired_time ? timestamp2string(r.expired_time) : '永不' },
    { key: 'created_time', title: '创建时间', render: (r) => timestamp2string(r.created_time) },
    { key: 'ops', title: '操作', align: 'right', render: (r) => (
        <div className='flex justify-end gap-1'>
          {r.status === 1
            ? <IconButton icon={PowerOff} title='禁用' onClick={() => setStatus(r, 2)} />
            : r.status === 2 ? <IconButton icon={Power} title='启用' onClick={() => setStatus(r, 1)} /> : null}
          <IconButton icon={Trash2} variant='danger' title='删除'
            onClick={() => setConfirm({ title: `删除兑换码 ${r.name}?`, onOk: () => remove(r) })} />
        </div>
      ) },
  ];

  return (
    <>
      <div style={{ padding: 16, border: '1px solid var(--ui-border)', borderRadius: 16, marginBottom: 16 }}>
        <div className='grid grid-cols-2 md:grid-cols-4 gap-3 items-end'>
          <div>
            <label className='block text-xs text-[#999] mb-1'>名称</label>
            <Input value={genForm.name} onChange={(v) => setGenForm((p) => ({ ...p, name: v }))} width='full' placeholder='如"5月活动"' />
          </div>
          <div>
            <label className='block text-xs text-[#999] mb-1'>金额</label>
            <NumberInput value={quotaToDisplayAmount(genForm.quota)} onChange={(v) => setGenForm((p) => ({ ...p, quota: displayAmountToQuota(v) }))} min={0} step='any' width='full' />
          </div>
          <div>
            <label className='block text-xs text-[#999] mb-1'>数量</label>
            <NumberInput value={genForm.count} onChange={(v) => setGenForm((p) => ({ ...p, count: Math.max(1, Number(v) || 1) }))} min={1} max={100} width='full' />
          </div>
          <Button onClick={generate} loading={generating}>生成兑换码</Button>
        </div>
        <div className='mt-3'>
          <label className='block text-xs text-[#999] mb-1'>过期时间 <span className='text-[#bbb]'>(留空 = 永不)</span></label>
          <div className='flex gap-2'>
            <input
              type='datetime-local'
              value={toLocalInput(genForm.expired_time)}
              onChange={(e) => setGenForm((p) => ({ ...p, expired_time: toUnix(e.target.value) }))}
              className='flex-1 rounded-lg border border-ui-border bg-transparent px-3 py-2 text-sm text-ui-text'
              style={{ maxWidth: 260 }}
            />
            {genForm.expired_time > 0 && (
              <Button variant='toggle' onClick={() => setGenForm((p) => ({ ...p, expired_time: 0 }))}>清除</Button>
            )}
          </div>
        </div>
      </div>

      <div className='flex justify-between items-center mb-3'>
        <div className='flex gap-2 items-center'>
          <Input value={searchKeyword} onChange={setSearchKeyword} placeholder='搜索名称或兑换码' width={200}
            onKeyDown={(e) => { if (e.key === 'Enter') load(1); }} />
          <Button variant='toggle' onClick={() => load(1)}>搜索</Button>
          {searchKeyword && <Button variant='toggle' onClick={() => { setSearchKeyword(''); }}>清除</Button>}
        </div>
        <Button variant='toggle' onClick={() => setConfirm({ title: '清理所有失效兑换码?', onOk: removeInvalid })}>清理失效</Button>
      </div>

      {loading ? <Loading /> : (
        <>
          <Table columns={columns} rows={rows} />
          <div className='mt-4 flex justify-end'>
            <Pagination total={total} pageSize={PAGE_SIZE} page={page} onChange={load} />
          </div>
        </>
      )}

      {generated && (
        <Modal open title='生成成功' onClose={() => setGenerated(null)} hideFooter width={520}>
          <div className='space-y-3'>
            <p className='text-sm text-[#666]'>请妥善保存以下兑换码：</p>
            <pre className='p-3 rounded-lg text-xs font-mono max-h-64 overflow-auto whitespace-pre-wrap break-all' style={{ background: 'var(--ui-bg-subtle)' }}>{generated.join('\n')}</pre>
            <div className='flex justify-end gap-2'>
              <Button variant='toggle' onClick={() => { copy(generated.join('\n')); showSuccess('已复制全部'); }}>复制全部</Button>
              <Button onClick={() => setGenerated(null)}>完成</Button>
            </div>
          </div>
        </Modal>
      )}

      {confirm && <ConfirmDialog open title={confirm.title} onConfirm={confirm.onOk} onClose={() => setConfirm(null)} />}
    </>
  );
};

/* ─── 订阅激活码 Tab ─── */
const SubscriptionCodesTab = () => {
  const [plans, setPlans] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState('');
  const [codes, setCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [genForm, setGenForm] = useState({ count: 1, name: '', expired_time: 0 });
  const [searchKeyword, setSearchKeyword] = useState('');
  const [confirm, setConfirm] = useState(null);

  useEffect(() => {
    API.get('/api/subscription/admin/plans').then((res) => {
      if (res.data?.success) {
        const list = (res.data.data || []).map((p) => p.plan || p);
        setPlans(list);
        if (list.length > 0) setSelectedPlan(String(list[0].id));
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const loadCodes = async (planId, keyword) => {
    if (!planId) return;
    setLoading(true);
    try {
      const params = keyword ? `?keyword=${encodeURIComponent(keyword)}` : '';
      const res = await API.get(`/api/subscription/admin/plans/${planId}/codes${params}`);
      if (res.data?.success) setCodes(res.data.data || []);
    } catch (e) { showError(e); } finally { setLoading(false); }
  };

  useEffect(() => { if (selectedPlan) loadCodes(selectedPlan, searchKeyword); }, [selectedPlan]);

  const [generated, setGenerated] = useState(null);

  const generate = async () => {
    if (!selectedPlan) return showError('请先选择套餐');
    setGenerating(true);
    try {
      const res = await API.post(`/api/subscription/admin/plans/${selectedPlan}/codes`, {
        count: genForm.count,
        name: genForm.name.trim() || undefined,
        expired_time: genForm.expired_time || 0,
      });
      const { success, data, message } = res.data || {};
      if (success) { showSuccess(`已生成 ${genForm.count} 个激活码`); setGenerated(data || []); loadCodes(selectedPlan, searchKeyword); }
      else showError(message);
    } catch (e) { showError(e); } finally { setGenerating(false); }
  };

  const remove = async (id) => {
    try {
      await API.delete(`/api/subscription/admin/codes/${id}`);
      showSuccess('已删除'); loadCodes(selectedPlan, searchKeyword);
    } catch (e) { showError(e); }
  };

  const removeInvalid = async () => {
    try {
      const res = await API.delete(`/api/subscription/admin/codes/invalid?plan_id=${selectedPlan}`);
      if (res.data?.success) { showSuccess('已清理失效激活码'); setConfirm(null); loadCodes(selectedPlan, searchKeyword); }
      else showError(res.data?.message);
    } catch (e) { showError(e); }
  };

  const toLocalInput = (ts) => {
    if (!ts) return '';
    const d = new Date(ts * 1000);
    if (isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  const toUnix = (v) => (v ? Math.floor(new Date(v).getTime() / 1000) : 0);

  const planOptions = plans.map((p) => ({ value: String(p.id), label: p.title || p.name || `套餐#${p.id}` }));

  const columns = [
    { key: 'key', title: '激活码', render: (r) => (
        <div className='flex items-center gap-2 font-mono text-xs'>
          <span className='truncate max-w-[180px]'>{r.key}</span>
          <IconButton icon={Copy} title='复制' onClick={() => { copy(r.key); showSuccess('已复制'); }} />
        </div>
      ) },
    { key: 'name', title: '批次', render: (r) => r.name || '-' },
    { key: 'status', title: '状态', render: (r) =>
        r.status === 2 || r.used_user_id
          ? <Tag color='grey'>已用 #{r.used_user_id}</Tag>
          : <Tag color='green'>未使用</Tag> },
    { key: 'expired_time', title: '过期时间', render: (r) => r.expired_time ? timestamp2string(r.expired_time) : '永不' },
    { key: 'created_time', title: '创建时间', render: (r) => timestamp2string(r.created_time) },
    { key: 'ops', title: '操作', align: 'right', render: (r) => (
        <IconButton icon={Trash2} variant='danger' title='删除' onClick={() => remove(r.id)} />
      ) },
  ];

  return (
    <>
      <div style={{ padding: 16, border: '1px solid var(--ui-border)', borderRadius: 16, marginBottom: 16 }}>
        <div className='grid grid-cols-2 md:grid-cols-4 gap-3 items-end'>
          <div>
            <label className='block text-xs text-[#999] mb-1'>选择套餐</label>
            <Select value={selectedPlan} onChange={setSelectedPlan} options={planOptions} placeholder='选择套餐' width='full' />
          </div>
          <div>
            <label className='block text-xs text-[#999] mb-1'>批次名称</label>
            <Input value={genForm.name} onChange={(v) => setGenForm((p) => ({ ...p, name: v }))} width='full' placeholder='可选' />
          </div>
          <div>
            <label className='block text-xs text-[#999] mb-1'>数量</label>
            <NumberInput value={genForm.count} onChange={(v) => setGenForm((p) => ({ ...p, count: Math.max(1, Number(v) || 1) }))} min={1} max={200} width='full' />
          </div>
          <Button onClick={generate} loading={generating}>生成激活码</Button>
        </div>
        <div className='mt-3'>
          <label className='block text-xs text-[#999] mb-1'>过期时间 <span className='text-[#bbb]'>(留空 = 永不)</span></label>
          <div className='flex gap-2'>
            <input
              type='datetime-local'
              value={toLocalInput(genForm.expired_time)}
              onChange={(e) => setGenForm((p) => ({ ...p, expired_time: toUnix(e.target.value) }))}
              className='flex-1 rounded-lg border border-ui-border bg-transparent px-3 py-2 text-sm text-ui-text'
              style={{ maxWidth: 260 }}
            />
            {genForm.expired_time > 0 && (
              <Button variant='toggle' onClick={() => setGenForm((p) => ({ ...p, expired_time: 0 }))}>清除</Button>
            )}
          </div>
        </div>
      </div>

      <div className='flex justify-between items-center mb-3'>
        <div className='flex gap-2 items-center'>
          <Input value={searchKeyword} onChange={setSearchKeyword} placeholder='搜索批次名或激活码' width={200}
            onKeyDown={(e) => { if (e.key === 'Enter') loadCodes(selectedPlan, searchKeyword); }} />
          <Button variant='toggle' onClick={() => loadCodes(selectedPlan, searchKeyword)}>搜索</Button>
          {searchKeyword && <Button variant='toggle' onClick={() => { setSearchKeyword(''); loadCodes(selectedPlan, ''); }}>清除</Button>}
        </div>
        <Button variant='toggle' onClick={() => setConfirm({ title: '清理当前套餐所有失效激活码?', onOk: removeInvalid })}>清理失效</Button>
      </div>

      {loading ? <Loading /> : (
        <Table columns={columns} rows={codes} rowKey={(r) => r.id} />
      )}

      {generated && (
        <Modal open title='生成成功' onClose={() => setGenerated(null)} hideFooter width={520}>
          <div className='space-y-3'>
            <p className='text-sm text-[#666]'>请妥善保存以下激活码：</p>
            <pre className='p-3 rounded-lg text-xs font-mono max-h-64 overflow-auto whitespace-pre-wrap break-all' style={{ background: 'var(--ui-bg-subtle)' }}>{(Array.isArray(generated) ? generated.map((c) => typeof c === 'string' ? c : c.key).join('\n') : '')}</pre>
            <div className='flex justify-end gap-2'>
              <Button variant='toggle' onClick={() => { copy((Array.isArray(generated) ? generated.map((c) => typeof c === 'string' ? c : c.key).join('\n') : '')); showSuccess('已复制全部'); }}>复制全部</Button>
              <Button onClick={() => setGenerated(null)}>完成</Button>
            </div>
          </div>
        </Modal>
      )}

      {confirm && <ConfirmDialog open title={confirm.title} onConfirm={confirm.onOk} onClose={() => setConfirm(null)} />}
    </>
  );
};

/* ─── 额度兑换码生成 ─── */
export default RedemptionPage;
