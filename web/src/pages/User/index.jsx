import { useEffect, useState } from 'react';
import { Plus, Search, Pencil, Trash2, ShieldCheck, ShieldOff, ArrowUp, ArrowDown, CreditCard, DollarSign, Dices, Copy } from 'lucide-react';
import { API, showError, showSuccess, renderQuota, timestamp2string } from '../../helpers';
import { displayAmountToQuota } from '../../helpers/quota';
import {
  PageShell, Card, Button, IconButton, Input, NumberInput, Table, Pagination,
  Tag, Modal, SlideOver, ConfirmDialog, Loading, Select,
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
  const [deleting, setDeleting] = useState(null);
  const [subUser, setSubUser] = useState(null);
  const [quotaUser, setQuotaUser] = useState(null);

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
              <span style={{ color: 'var(--ui-text-2)' }}>已用 {renderQuota(used, 2)}</span>
              <span style={{ color: 'var(--ui-text-3)' }}>{renderQuota(total, 2)}</span>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: 'var(--ui-bg-subtle)', overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 3, width: `${pct}%`, background: pct > 80 ? '#e74c3c' : 'var(--ui-accent)', transition: 'width 0.3s' }} />
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
          <IconButton icon={DollarSign} title='额度调整' onClick={() => setQuotaUser(r)} />
          <IconButton icon={CreditCard} title='订阅管理' onClick={() => setSubUser(r)} />
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
            onClick={() => setDeleting(r)}
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
        <div className='flex flex-col md:flex-row gap-2'>
          <div className='flex-1 min-w-[200px] max-w-[320px]'>
            <Input
              placeholder='搜索用户名/邮箱'
              value={keyword}
              onChange={setKeyword}
              onKeyDown={(e) => e.key === 'Enter' && load(1, keyword)}
            />
          </div>
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

      {deleting && (
        <DeleteUserModal
          user={deleting}
          onClose={() => setDeleting(null)}
          onConfirmed={() => { act(deleting.id, 'delete'); setDeleting(null); }}
        />
      )}

      {subUser && (
        <UserSubscriptionsPanel user={subUser} onClose={() => setSubUser(null)} />
      )}

      {quotaUser && (
        <QuotaAdjustModal user={quotaUser} onClose={() => setQuotaUser(null)} onSaved={() => { setQuotaUser(null); load(page, keyword); }} />
      )}
    </PageShell>
  );
};

// 生成随机密码（默认 16 位，含大小写字母+数字，满足后端 min=8/max=20 校验）
const genPassword = (len = 16) => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const arr = new Uint32Array(len);
  (window.crypto || window.msCrypto).getRandomValues(arr);
  let out = '';
  for (let i = 0; i < len; i++) out += chars[arr[i] % chars.length];
  return out;
};

// 删除用户确认：需手动输入用户名以确认，提供一键复制
const DeleteUserModal = ({ user, onClose, onConfirmed }) => {
  const [input, setInput] = useState('');
  const matched = input.trim() === user.username;
  const copyName = async () => {
    try {
      await navigator.clipboard.writeText(user.username);
      showSuccess('已复制用户名');
    } catch { showError('复制失败，请手动输入'); }
  };
  return (
    <Modal
      open
      title='删除用户'
      width={460}
      onClose={onClose}
      footer={
        <>
          <Button variant='toggle' onClick={onClose}>取消</Button>
          <Button disabled={!matched} onClick={onConfirmed} style={matched ? { background: '#dc2626', color: '#fff' } : undefined}>确认删除</Button>
        </>
      }
    >
      <div className='space-y-3'>
        <p className='text-sm text-ui-text-2 leading-relaxed'>
          此操作将永久删除用户 <span className='font-semibold text-ui-text'>#{user.id}</span>，且不可恢复。
          请输入该用户的用户名以确认：
        </p>
        <div className='flex items-center gap-2 rounded-lg bg-ui-bg-subtle px-3 py-2'>
          <code className='flex-1 text-sm font-medium text-ui-text break-all'>{user.username}</code>
          <IconButton icon={Copy} title='复制用户名' onClick={copyName} />
        </div>
        <Input
          value={input}
          onChange={setInput}
          width='full'
          placeholder='输入用户名确认'
          onKeyDown={(e) => { if (e.key === 'Enter' && matched) onConfirmed(); }}
        />
      </div>
    </Modal>
  );
};

const UserEditModal = ({ user, onClose, onSaved }) => {
  const isNew = !user.id;
  const [form, setForm] = useState(user);
  const [saving, setSaving] = useState(false);
  const u = (k) => (v) => setForm((p) => ({ ...p, [k]: v?.target ? v.target.value : v }));
  const fillRandomPassword = () => {
    const pwd = genPassword();
    setForm((p) => ({ ...p, password: pwd }));
    try {
      navigator.clipboard?.writeText(pwd);
      showSuccess('已生成随机密码并复制到剪贴板');
    } catch { showSuccess('已生成随机密码'); }
  };
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
        <div>
          <label className='block text-sm text-ui-text-2 mb-1.5'>密码{!isNew && <span className='text-ui-text-3'>（留空则不修改）</span>}</label>
          <div className='flex items-center gap-2'>
            <Input type='text' value={form.password || ''} onChange={u('password')} width='full' placeholder={isNew ? '请输入密码' : '留空不修改'} />
            <IconButton icon={Dices} title='生成随机密码' onClick={fillRandomPassword} />
          </div>
        </div>
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

const QuotaAdjustModal = ({ user, onClose, onSaved }) => {
  const [mode, setMode] = useState('add');
  const [amount, setAmount] = useState(0);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (amount <= 0 && mode !== 'override') return showError('金额必须大于0');
    setSaving(true);
    try {
      const res = await API.post('/api/user/manage', {
        id: user.id,
        action: 'add_quota',
        mode,
        value: displayAmountToQuota(amount),
      });
      if (res.data?.success) { showSuccess('额度调整成功'); onSaved(); }
      else showError(res.data?.message);
    } catch (e) { showError(e); } finally { setSaving(false); }
  };

  const modeOptions = [
    { value: 'add', label: '增加' },
    { value: 'subtract', label: '减少' },
    { value: 'override', label: '覆盖' },
  ];

  return (
    <Modal open title={`额度调整 - ${user.username}`} onClose={onClose} hideFooter width={400}>
      <div className='space-y-4 p-1'>
        <div>
          <label className='block text-sm text-ui-text-2 mb-1.5'>当前余额</label>
          <span className='text-sm font-medium'>{renderQuota(user.quota || 0, 2)}</span>
        </div>
        <div>
          <label className='block text-sm text-ui-text-2 mb-1.5'>操作类型</label>
          <Select options={modeOptions} value={mode} onChange={setMode} width='full' />
        </div>
        <div>
          <label className='block text-sm text-ui-text-2 mb-1.5'>金额</label>
          <NumberInput value={amount} onChange={setAmount} min={0} step='any' width='full' />
        </div>
        <div className='flex justify-end gap-2 pt-2'>
          <Button variant='toggle' onClick={onClose}>取消</Button>
          <Button loading={saving} onClick={save}>确认</Button>
        </div>
      </div>
    </Modal>
  );
};

const SUB_STATUS_TAG = {
  active:    { color: 'green', text: '生效中' },
  expired:   { color: 'grey',  text: '已过期' },
  cancelled: { color: 'red',   text: '已取消' },
};

const UserSubscriptionsPanel = ({ user, onClose }) => {
  const [subs, setSubs] = useState([]);
  const [plans, setPlans] = useState([]);
  const [allPlans, setAllPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState('');
  const [creating, setCreating] = useState(false);

  const loadSubs = async () => {
    try {
      const res = await API.get(`/api/subscription/admin/users/${user.id}/subscriptions`);
      if (res.data?.success) setSubs((res.data.data || []).map((item) => item.subscription || item));
    } catch (e) { showError(e); }
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        await loadSubs();
        const pRes = await API.get('/api/subscription/admin/plans');
        if (pRes.data?.success) {
          const all = (pRes.data.data || []).map((p) => p.plan || p);
          setAllPlans(all);
          setPlans(all.filter((p) => p.enabled));
        }
      } catch (e) { showError(e); }
      finally { setLoading(false); }
    })();
  }, []);

  const create = async () => {
    if (!selectedPlan) return;
    setCreating(true);
    try {
      const res = await API.post(`/api/subscription/admin/users/${user.id}/subscriptions`, { plan_id: Number(selectedPlan) });
      if (res.data?.success) { showSuccess('分配成功'); setSelectedPlan(''); await loadSubs(); }
      else showError(res.data?.message);
    } catch (e) { showError(e); }
    finally { setCreating(false); }
  };

  const cancel = async (subId) => {
    try {
      const res = await API.post(`/api/subscription/admin/user_subscriptions/${subId}/invalidate`);
      if (res.data?.success) { showSuccess('已取消'); await loadSubs(); }
      else showError(res.data?.message);
    } catch (e) { showError(e); }
  };

  const planOptions = plans.map((p) => ({ value: String(p.id), label: p.title }));

  return (
    <SlideOver open title={<span className='text-lg font-semibold'>订阅管理 - {user.username}</span>} onClose={onClose} width={480}>
      <div className='px-6 pb-6 space-y-5'>
        {loading ? <Loading /> : (
          <>
            <div style={{ padding: '16px', border: '1px solid #e9e9e9', borderRadius: 16 }}>
              <label className='block text-sm text-ui-text-2 mb-2'>分配套餐</label>
              <div className='flex gap-2'>
                <div className='flex-1'>
                  <Select options={planOptions} value={selectedPlan} onChange={setSelectedPlan} placeholder='选择套餐' />
                </div>
                <Button loading={creating} onClick={create} disabled={!selectedPlan}>分配</Button>
              </div>
            </div>

            <div>
              <label className='block text-sm font-medium text-ui-text-1 mb-3'>订阅记录</label>
              {subs.length === 0 ? (
                <p className='text-sm text-ui-text-3 text-center py-6'>暂无订阅</p>
              ) : (
                <div className='space-y-3'>
                  {subs.map((s) => {
                    const st = SUB_STATUS_TAG[s.status] || SUB_STATUS_TAG.expired;
                    const total = s.amount_total || 0;
                    const used = s.amount_used || 0;
                    const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0;
                    const planName = allPlans.find((p) => p.id === s.plan_id)?.title || `套餐 #${s.plan_id}`;
                    return (
                      <div key={s.id} style={{ padding: '14px 16px', border: '1px solid #e9e9e9', borderRadius: 12 }}>
                        <div className='flex items-center justify-between mb-2'>
                          <span className='text-sm font-medium'>{planName}</span>
                          <Tag color={st.color}>{st.text}</Tag>
                        </div>
                        <div className='text-xs text-ui-text-3 mb-2'>
                          {timestamp2string(s.start_time)} ~ {timestamp2string(s.end_time)}
                        </div>
                        <div className='flex items-center gap-2 mb-2'>
                          <div style={{ flex: 1, height: 6, borderRadius: 3, background: '#F2F0E9', overflow: 'hidden' }}>
                            <div style={{ height: '100%', borderRadius: 3, width: `${pct}%`, background: pct > 80 ? '#e74c3c' : '#000', transition: 'width 0.3s' }} />
                          </div>
                          <span className='text-xs text-ui-text-3 whitespace-nowrap'>{renderQuota(used, 2)} / {renderQuota(total, 2)}</span>
                        </div>
                        {s.status === 'active' && (
                          <Button size='sm' variant='toggle' onClick={() => cancel(s.id)}>取消订阅</Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </SlideOver>
  );
};

export default UserPage;
