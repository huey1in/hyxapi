import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Copy, Power, PowerOff } from 'lucide-react';
import { API, showError, showSuccess, copy, renderQuota, timestamp2string } from '../../helpers';
import {
  PageShell, Card, Button, IconButton, Input, NumberInput, Table, Pagination,
  Tag, Modal, ConfirmDialog, Loading,
} from '../../components/ui';

const PAGE_SIZE = 20;

const STATUS_TAG = {
  1: { color: 'green', text: '未使用' },
  2: { color: 'grey',  text: '禁用' },
  3: { color: 'blue',  text: '已使用' },
  4: { color: 'red',   text: '失效' },
};

const RedemptionPage = () => {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [confirm, setConfirm] = useState(null);

  const load = async (p = 1) => {
    setLoading(true);
    try {
      const res = await API.get(`/api/redemption/?p=${p}&page_size=${PAGE_SIZE}`);
      const { success, data, message } = res.data || {};
      if (success) {
        setRows(data?.items || data || []);
        setTotal(data?.total ?? rows.length);
        setPage(p);
      } else showError(message);
    } catch (e) { showError(e); } finally { setLoading(false); }
  };
  useEffect(() => { load(1); }, []);

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
        const s = STATUS_TAG[r.status] || STATUS_TAG[1];
        return <Tag color={s.color}>{s.text}</Tag>;
      } },
    { key: 'used_user_id', title: '使用者', render: (r) => r.used_user_id || '-' },
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
    <PageShell
      title='兑换码'
      actions={
        <>
          <Button variant='toggle' onClick={() => setConfirm({ title: '清理所有失效兑换码?', onOk: removeInvalid })}>清理失效</Button>
          <Button icon={Plus} onClick={() => setCreating(true)}>生成兑换码</Button>
        </>
      }
    >
      {loading ? <Loading /> : (
        <>
          <Table columns={columns} rows={rows} />
          <div className='mt-4 flex justify-end'>
            <Pagination total={total} pageSize={PAGE_SIZE} page={page} onChange={load} />
          </div>
        </>
      )}

      {creating && <CreateModal onClose={() => setCreating(false)} onSaved={() => { setCreating(false); load(1); }} />}
      {confirm && <ConfirmDialog open title={confirm.title} onConfirm={confirm.onOk} onClose={() => setConfirm(null)} />}
    </PageShell>
  );
};

const CreateModal = ({ onClose, onSaved }) => {
  const [form, setForm] = useState({ name: '', quota: 500000, count: 1 });
  const [saving, setSaving] = useState(false);
  const [generated, setGenerated] = useState(null);
  const u = (k) => (v) => setForm((p) => ({ ...p, [k]: v?.target ? v.target.value : v }));

  const save = async () => {
    if (!form.name?.trim()) return showError('请输入名称');
    setSaving(true);
    try {
      const res = await API.post('/api/redemption/', {
        name: form.name.trim(),
        quota: Number(form.quota) || 0,
        count: Number(form.count) || 1,
      });
      const { success, data, message } = res.data || {};
      if (success) {
        showSuccess(`已生成 ${data?.length || form.count} 个兑换码`);
        setGenerated(data || []);
      } else showError(message);
    } catch (e) { showError(e); } finally { setSaving(false); }
  };

  if (generated) {
    const allKeys = generated.join('\n');
    return (
      <Modal open title='生成成功' onClose={() => { onClose(); onSaved(); }} hideFooter width={520}>
        <div className='space-y-3'>
          <p className='text-sm text-ui-text-2'>请妥善保存以下兑换码：</p>
          <pre className='bg-ui-bg-subtle p-3 rounded-lg text-xs font-mono max-h-64 overflow-auto whitespace-pre-wrap break-all'>{allKeys}</pre>
          <div className='flex justify-end gap-2'>
            <Button variant='toggle' onClick={() => { copy(allKeys); showSuccess('已复制全部'); }}>复制全部</Button>
            <Button onClick={() => { onClose(); onSaved(); }}>完成</Button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open title='生成兑换码' onClose={onClose} onConfirm={save} loading={saving}>
      <div className='space-y-4'>
        <div>
          <label className='block text-sm text-ui-text-2 mb-1.5'>名称</label>
          <Input value={form.name} onChange={u('name')} />
        </div>
        <div>
          <label className='block text-sm text-ui-text-2 mb-1.5'>面额（quota 单位）</label>
          <NumberInput value={form.quota} onChange={(v) => u('quota')(Number(v))} min={0} />
        </div>
        <div>
          <label className='block text-sm text-ui-text-2 mb-1.5'>生成数量</label>
          <NumberInput value={form.count} onChange={(v) => u('count')(Number(v))} min={1} max={100} />
        </div>
      </div>
    </Modal>
  );
};

export default RedemptionPage;
