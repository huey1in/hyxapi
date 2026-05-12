import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Copy, RefreshCw, Eye, EyeOff, Code, CheckSquare, Square } from 'lucide-react';
import { API, showError, showSuccess, copy, renderQuota, timestamp2string } from '../../helpers';
import { quotaToDisplayAmount, displayAmountToQuota } from '../../helpers/quota';
import {
  PageShell, Card, Button, IconButton, Input, NumberInput, Switch, Select, Table,
  Tag, Modal, ConfirmDialog, CodeBlock, Loading,
} from '../../components/ui';

const toLocalInput = (ts) => {
  if (!ts || ts === -1) return '';
  const d = new Date(ts * 1000);
  if (isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const toUnix = (v) => (v ? Math.floor(new Date(v).getTime() / 1000) : 0);

const TokenPage = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [reveal, setReveal] = useState({});
  const [selected, setSelected] = useState(new Set());

  const toggleAll = () => {
    if (selected.size === rows.length) setSelected(new Set());
    else setSelected(new Set(rows.map((r) => r.id)));
  };
  const toggleOne = (id) => setSelected((p) => {
    const next = new Set(p);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const batchDelete = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    try {
      await Promise.all(ids.map((id) => API.delete(`/api/token/${id}`)));
      showSuccess(`已删除 ${ids.length} 个令牌`);
      setSelected(new Set()); load();
    } catch (e) { showError(e); }
  };

  const load = async () => {
    setLoading(true);
    try {
      const res = await API.get('/api/token/?p=1&size=200');
      const { success, data, message } = res.data || {};
      if (success) setRows(Array.isArray(data) ? data : data?.items || []);
      else showError(message);
    } catch (e) { showError(e); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const remove = async (row) => {
    try {
      const res = await API.delete(`/api/token/${row.id}`);
      const { success, message } = res.data || {};
      if (success) { showSuccess('已删除'); setConfirm(null); load(); }
      else showError(message);
    } catch (e) { showError(e); }
  };

  const rotate = async (row) => {
    try {
      const res = await API.post(`/api/token/${row.id}/key`);
      const { success, data, message } = res.data || {};
      if (success) { showSuccess('密钥已重置'); copy(data); load(); }
      else showError(message);
    } catch (e) { showError(e); }
  };

  const copyKey = (row) => {
    const k = row.key?.startsWith('sk-') ? row.key : `sk-${row.key}`;
    copy(k); showSuccess('已复制');
  };

  const columns = [
    { key: '_sel', title: (
        <button onClick={toggleAll} className='inline-flex items-center text-ui-text-2 hover:text-ui-text-1'>
          {selected.size > 0 && selected.size === rows.length ? <CheckSquare size={16} /> : <Square size={16} />}
        </button>
      ), width: 36, render: (r) => (
        <button onClick={() => toggleOne(r.id)} className='inline-flex items-center text-ui-text-2 hover:text-ui-text-1'>
          {selected.has(r.id) ? <CheckSquare size={16} /> : <Square size={16} />}
        </button>
      ) },
    { key: 'name', title: '名称' },
    { key: 'key', title: 'Key', render: (r) => (
        <div className='flex items-center gap-2 font-mono text-xs'>
          <span>{reveal[r.id] ? `sk-${r.key}` : `sk-${'•'.repeat(8)}…${r.key?.slice(-4)}`}</span>
          <IconButton icon={reveal[r.id] ? EyeOff : Eye} title='显示/隐藏'
            onClick={() => setReveal((p) => ({ ...p, [r.id]: !p[r.id] }))} />
          <IconButton icon={Copy} title='复制' onClick={() => copyKey(r)} />
        </div>
      ) },
    { key: 'group', title: '分组', render: (r) => r.group || '-' },
    { key: 'remain_quota', title: '余额', render: (r) =>
        r.unlimited_quota ? <Tag color='blue'>无限</Tag> : renderQuota(r.remain_quota || 0, 2) },
    { key: 'used_quota', title: '已用', render: (r) => renderQuota(r.used_quota || 0, 2) },
    { key: 'status', title: '状态', render: (r) =>
        r.status === 1 ? <Tag color='green'>启用</Tag> : <Tag color='grey'>禁用</Tag> },
    { key: 'expired_time', title: '过期', render: (r) =>
        r.expired_time === -1 ? '永不' : timestamp2string(r.expired_time) },
    { key: 'ops', title: '操作', align: 'right', render: (r) => (
        <div className='flex justify-end gap-1'>
          <IconButton icon={Pencil} title='编辑' onClick={() => setEditing({ ...r })} />
          <IconButton icon={RefreshCw} title='重置密钥' onClick={() => rotate(r)} />
          <IconButton icon={Trash2} variant='danger' title='删除'
            onClick={() => setConfirm({ title: `删除令牌 ${r.name}?`, onOk: () => remove(r) })} />
        </div>
      ) },
  ];

  return (
    <PageShell
      title='API Keys'
      actions={
        <>
          {selected.size > 0 && (
            <>
              <span className='text-xs text-ui-text-3 mr-1'>已选 {selected.size} 项</span>
              <Button size='sm' variant='toggle' onClick={() => setConfirm({
                title: `删除选中的 ${selected.size} 个令牌?`,
                onOk: () => { batchDelete(); setConfirm(null); },
              })}>批量删除</Button>
            </>
          )}
          <Button icon={Plus} onClick={() => setEditing({ name: '', unlimited_quota: true, remain_quota: 500000, expired_time: -1, group: '' })}>新建</Button>
        </>
      }
    >
      {loading ? <Loading /> : (
        <>
          <Table columns={columns} rows={rows} />
          {rows[0]?.key && <CodeSamples tokenKey={rows[0].key} />}
        </>
      )}

      {editing && (
        <TokenEditModal token={editing} onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }} />
      )}

      {confirm && (
        <ConfirmDialog open title={confirm.title} onConfirm={confirm.onOk}
          onClose={() => setConfirm(null)} />
      )}
    </PageShell>
  );
};

const CodeSamples = ({ tokenKey }) => {
  const [lang, setLang] = useState('curl');
  const sk = tokenKey?.startsWith('sk-') ? tokenKey : `sk-${tokenKey}`;
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://api.example.com';
  const samples = useMemo(() => ({
    curl: `curl ${origin}/v1/chat/completions \\
  -H "Authorization: Bearer ${sk}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "gpt-4o-mini",
    "messages": [{"role": "user", "content": "Hello"}]
  }'`,
    python: `from openai import OpenAI

client = OpenAI(
    api_key="${sk}",
    base_url="${origin}/v1",
)

resp = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[{"role": "user", "content": "Hello"}],
)
print(resp.choices[0].message.content)`,
    javascript: `import OpenAI from "openai";

const client = new OpenAI({
  apiKey: "${sk}",
  baseURL: "${origin}/v1",
});

const resp = await client.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [{ role: "user", content: "Hello" }],
});
console.log(resp.choices[0].message.content);`,
  }), [sk, origin]);

  const LANGS = [
    { key: 'curl', label: 'cURL', lang: 'bash' },
    { key: 'python', label: 'Python', lang: 'python' },
    { key: 'javascript', label: 'JavaScript', lang: 'javascript' },
  ];

  return (
    <Card className='mt-5'>
      <div className='flex items-center justify-between mb-3'>
        <h3 className='text-sm font-semibold text-ui-text-1 flex items-center gap-2'>
          <Code size={16} /> 调用示例
        </h3>
        <div className='flex items-center gap-1'>
          {LANGS.map((l) => (
            <Button key={l.key} size='sm' variant='toggle' selected={lang === l.key}
              onClick={() => setLang(l.key)}>{l.label}</Button>
          ))}
        </div>
      </div>
      <CodeBlock code={samples[lang]} language={LANGS.find((l) => l.key === lang)?.lang} />
    </Card>
  );
};

const TokenEditModal = ({ token, onClose, onSaved }) => {
  const isEdit = !!token.id;
  const [form, setForm] = useState(token);
  const [groups, setGroups] = useState([]);
  const [saving, setSaving] = useState(false);
  const u = (k) => (v) => setForm((p) => ({ ...p, [k]: v?.target ? v.target.value : v }));

  useEffect(() => {
    API.get('/api/user/self/groups').then((res) => {
      if (res.data?.success && res.data.data) {
        setGroups(Object.entries(res.data.data).map(([value, info]) => ({
          value, label: info.desc || value,
        })));
      }
    }).catch(() => {});
  }, []);

  const save = async () => {
    if (!form.name?.trim()) return showError('请输入名称');
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        unlimited_quota: form.unlimited_quota,
        remain_quota: form.unlimited_quota ? 0 : Number(form.remain_quota) || 0,
        expired_time: Number(form.expired_time) || -1,
        group: form.group || '',
        model_limits_enabled: false,
        model_limits: '',
        allow_ips: '',
      };
      const res = isEdit
        ? await API.put('/api/token/', { ...payload, id: token.id })
        : await API.post('/api/token/', { ...payload, count: 1 });
      const { success, message } = res.data || {};
      if (success) { showSuccess(isEdit ? '已更新' : '已创建'); onSaved(); }
      else showError(message);
    } catch (e) { showError(e); } finally { setSaving(false); }
  };

  return (
    <Modal open title={isEdit ? '编辑 API Key' : '创建 API Key'} onClose={onClose} onConfirm={save} loading={saving} width={520}>
      <div className='space-y-4'>
        <div>
          <label className='block text-sm text-ui-text-2 mb-1.5'>名称</label>
          <Input value={form.name || ''} onChange={u('name')} placeholder='例如 my-app' />
        </div>
        {groups.length > 0 && (
          <div>
            <label className='block text-sm text-ui-text-2 mb-1.5'>分组</label>
            <Select value={form.group} onChange={u('group')} options={groups} placeholder='选择分组' />
          </div>
        )}
        <div className='flex items-center justify-between'>
          <span className='text-sm text-ui-text-1'>不限额度</span>
          <Switch checked={!!form.unlimited_quota} onChange={u('unlimited_quota')} />
        </div>
        {!form.unlimited_quota && (
          <div>
            <label className='block text-sm text-ui-text-2 mb-1.5'>金额</label>
            <NumberInput
              value={quotaToDisplayAmount(form.remain_quota || 0)}
              onChange={(v) => u('remain_quota')(displayAmountToQuota(v))}
              min={0} step='any'
            />
          </div>
        )}
        <div>
          <label className='block text-sm text-ui-text-2 mb-1.5'>过期时间</label>
          <div className='flex gap-2'>
            <input
              type='datetime-local'
              value={toLocalInput(form.expired_time)}
              onChange={(e) => u('expired_time')(toUnix(e.target.value) || -1)}
              className='flex-1 rounded-lg border border-ui-border bg-transparent px-3 py-2 text-sm text-ui-text-1'
            />
            <Button variant='toggle' selected={form.expired_time === -1}
              onClick={() => u('expired_time')(-1)}>永不</Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default TokenPage;
