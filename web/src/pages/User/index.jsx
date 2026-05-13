import React, { useEffect, useState } from 'react';
import { Plus, Search, Pencil, Trash2, ShieldCheck, ShieldOff, ArrowUp, ArrowDown } from 'lucide-react';
import { API, showError, showSuccess, renderQuota } from '../../helpers';
import {
  PageShell, Card, Button, IconButton, Input, Table, Pagination,
  Tag, Modal, SlideOver, ConfirmDialog, Loading,
} from '../../components/ui';

const PAGE_SIZE = 20;
const ROLE_TAG = {
  1:   { color: 'grey',  text: '普通用户' },
  10:  { color: 'blue',  text: '管理员' },
  100: { color: 'red',   text: '超级管理员' },
};

const UserPage = () => {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [editing, setEditing] = useState(null);
  const [confirm, setConfirm] = useState(null);

  const load = async (p = 1, kw = '') => {
    setLoading(true);
    try {
      const url = kw
        ? `/api/user/search?keyword=${encodeURIComponent(kw)}&group=&p=${p}&page_size=${PAGE_SIZE}`
        : `/api/user/?p=${p}&page_size=${PAGE_SIZE}`;
      const res = await API.get(url);
      const { success, data, message } = res.data || {};
      if (success) {
        setRows(data.items || []);
        setTotal(data.total || 0);
        setPage(data.page || p);
      } else showError(message);
    } catch (e) { showError(e); } finally { setLoading(false); }
  };
  useEffect(() => { load(1, ''); }, []);

  const act = async (id, action) => {
    try {
      const res = await API.post('/api/user/manage', { id, action });
      const { success, message } = res.data || {};
      if (success) { showSuccess('操作成功'); load(page, keyword); }
      else showError(message);
    } catch (e) { showError(e); }
  };

  const columns = [
    { key: 'id', title: 'ID', width: 70 },
    { key: 'username', title: '用户名' },
    { key: 'email', title: '邮箱', render: (r) => r.email || '-' },
    { key: 'quota', title: '额度', render: (r) => {
        const remaining = r.quota || 0;
        const used = r.used_quota || 0;
        const total = remaining + used;
        const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0;
        return (
          <div style={{ minWidth: 120 }}>
            <div className='flex justify-between text-xs mb-1'>
              <span style={{ color: '#666' }}>已用 {renderQuota(used, 2)}</span>
              <span style={{ color: '#999' }}>{renderQuota(total, 2)}</span>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: '#F2F0E9', overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 3, width: `${pct}%`, background: pct > 80 ? '#e74c3c' : '#000', transition: 'width 0.3s' }} />
            </div>
          </div>
        );
      } },
    { key: 'role', title: '角色', render: (r) => {
        const t = ROLE_TAG[r.role] || ROLE_TAG[1];
        return <Tag color={t.color}>{t.text}</Tag>;
      } },
    { key: 'aff_count', title: '邀请', render: (r) => r.aff_count || 0 },
    { key: 'aff_quota', title: '收益', render: (r) => renderQuota(r.aff_quota || 0, 2) },
    { key: 'status', title: '状态', render: (r) =>
        r.status === 1 ? <Tag color='green'>正常</Tag> : <Tag color='grey'>已禁用</Tag> },
    { key: 'ops', title: '操作', align: 'right', render: (r) => (
        <div className='flex justify-end gap-1'>
          <IconButton icon={Pencil} title='编辑' onClick={() => setEditing({ ...r })} />
          {r.status === 1
            ? <IconButton icon={ShieldOff} title='禁用' onClick={() => act(r.id, 'disable')} />
            : <IconButton icon={ShieldCheck} title='启用' onClick={() => act(r.id, 'enable')} />}
          {r.role < 10 && <IconButton icon={ArrowUp} title='提升' onClick={() => act(r.id, 'promote')} />}
          {r.role === 10 && <IconButton icon={ArrowDown} title='降级' onClick={() => act(r.id, 'demote')} />}
          <IconButton
            icon={Trash2}
            variant='danger'
            title='删除'
            onClick={() => setConfirm({
              title: `删除用户 ${r.username}?`,
              onOk: () => { act(r.id, 'delete'); setConfirm(null); },
            })}
          />
        </div>
      ) },
  ];

  return (
    <PageShell
      title='用户管理'
      actions={<Button icon={Plus} onClick={() => setEditing({ username: '', password: '', display_name: '' })}>新建用户</Button>}
    >
      <Card className='mb-4'>
        <div className='flex gap-2'>
          <Input
            placeholder='搜索用户名/邮箱'
            value={keyword}
            onChange={setKeyword}
            onKeyDown={(e) => e.key === 'Enter' && load(1, keyword)}
            width={240}
          />
          <Button icon={Search} onClick={() => load(1, keyword)}>搜索</Button>
        </div>
      </Card>

      {loading ? <Loading /> : (
        <>
          <Table columns={columns} rows={rows} />
          <div className='mt-4 flex justify-end'>
            <Pagination total={total} pageSize={PAGE_SIZE} page={page} onChange={(p) => load(p, keyword)} />
          </div>
        </>
      )}

      {editing && (
        <UserEditModal
          user={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(page, keyword); }}
        />
      )}

      {confirm && (
        <ConfirmDialog
          open
          title={confirm.title}
          onConfirm={confirm.onOk}
          onClose={() => setConfirm(null)}
        />
      )}
    </PageShell>
  );
};

const UserEditModal = ({ user, onClose, onSaved }) => {
  const isNew = !user.id;
  const [form, setForm] = useState(user);
  const [saving, setSaving] = useState(false);
  const u = (k) => (v) => setForm((p) => ({ ...p, [k]: v?.target ? v.target.value : v }));
  const save = async () => {
    setSaving(true);
    try {
      const method = isNew ? 'post' : 'put';
      const res = await API[method]('/api/user/', form);
      const { success, message } = res.data || {};
      if (success) { showSuccess('保存成功'); onSaved(); }
      else showError(message);
    } catch (e) { showError(e); } finally { setSaving(false); }
  };
  return (
    <SlideOver open title={<span className='text-lg font-semibold'>{isNew ? '新建用户' : `编辑用户 #${user.id}`}</span>} onClose={onClose} width={440}
      footer={<><Button variant='toggle' onClick={onClose}>取消</Button><Button loading={saving} onClick={save}>{isNew ? '创建' : '保存'}</Button></>}>
      <div className='px-6 pb-6 space-y-4'>
        <div>
          <label className='block text-sm text-ui-text-2 mb-1.5'>用户名</label>
          <Input value={form.username || ''} onChange={u('username')} disabled={!isNew} width='full' />
        </div>
        {isNew && (
          <div>
            <label className='block text-sm text-ui-text-2 mb-1.5'>密码</label>
            <Input type='password' value={form.password || ''} onChange={u('password')} width='full' />
          </div>
        )}
        <div>
          <label className='block text-sm text-ui-text-2 mb-1.5'>显示名</label>
          <Input value={form.display_name || ''} onChange={u('display_name')} width='full' />
        </div>
        <div>
          <label className='block text-sm text-ui-text-2 mb-1.5'>邮箱</label>
          <Input value={form.email || ''} onChange={u('email')} width='full' />
        </div>
      </div>
    </SlideOver>
  );
};

export default UserPage;
