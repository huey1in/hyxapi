import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Copy, Pencil } from 'lucide-react';
import { API, showError, showSuccess, copy, timestamp2string } from '../../helpers';
import { quotaToDisplayAmount, displayAmountToQuota } from '../../helpers/quota';
import {
  Button, IconButton, Input, NumberInput, Switch, Select, MultiSelect,
  SlideOver, ConfirmDialog, CodeBlock, Loading,
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

  const copyKey = async (row) => {
    try {
      const res = await API.post(`/api/token/${row.id}/key`);
      const { success, data, message } = res.data || {};
      if (success && data?.key) {
        copy(`sk-${data.key}`);
        showSuccess('已复制');
      } else {
        showError(message || '获取密钥失败');
      }
    } catch (e) { showError(e); }
  };

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://api.example.com';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28, width: '100%', maxWidth: 960, marginInline: 'auto', padding: '24px 16px' }}>
      {/* 快速入门 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
        <StepCard num='01' title='创建 API key' desc='创建 API key 并妥善保存' />
        <StepCard num='02' title='参看示例' desc='请在下方参看调用示例' />
        <StepCard num='03' title='发送请求' desc='接入 AI 服务' />
      </div>

      {/* API keys */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 18, fontWeight: 600, color: '#000' }}>API keys</span>
          <button
            onClick={() => setEditing({ name: '', unlimited_quota: true, remain_quota: 500000, expired_time: -1, group: '' })}
            style={{
              cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
              height: 32, paddingInline: 16, border: '1px solid #000', borderRadius: 24,
              fontSize: 14, color: '#000', background: '#FFFDF7',
              transition: 'background 0.2s ease, color 0.2s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#000'; e.currentTarget.style.color = '#fff'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#FFFDF7'; e.currentTarget.style.color = '#000'; }}
          >
            <Plus size={14} /> 创建 API key
          </button>
        </div>

        {loading ? <Loading /> : rows.length === 0 ? (
          <div style={{ padding: '32px 0', textAlign: 'center', color: '#999', fontSize: 14 }}>暂无 API key</div>
        ) : rows.map((row) => (
          <KeyCard key={row.id} row={row} onCopy={() => copyKey(row)} onDelete={() => setConfirm({ title: `删除令牌 ${row.name}?`, onOk: () => remove(row) })} onEdit={() => setEditing({ ...row })} />
        ))}
      </div>

      {/* 调用示例 */}
      <CodeSamples origin={origin} />

      <TokenEditModal
        open={!!editing}
        token={editing}
        onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); load(); }}
      />

      {confirm && (
        <ConfirmDialog open title={confirm.title} onConfirm={confirm.onOk}
          onClose={() => setConfirm(null)} />
      )}
    </div>
  );
};

const StepCard = ({ num, title, desc }) => (
  <div style={{ padding: 16, border: '1px solid #e9e9e9', borderRadius: 16, background: '#FFFDF7' }}>
    <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, marginBottom: 8, border: '1px solid #e3e8f0', borderRadius: '50%', fontWeight: 700, fontSize: 12, color: '#000' }}>{num}.</div>
    <div style={{ fontSize: 16, fontWeight: 500, color: '#000', marginBottom: 4 }}>{title}</div>
    <div style={{ fontSize: 14, color: '#8f8f8f' }}>{desc}</div>
  </div>
);

const KeyCard = ({ row, onCopy, onDelete, onEdit }) => (
  <div
    className='group'
    style={{
      position: 'relative', display: 'grid', gridTemplateColumns: '220px 1fr auto',
      gap: 18, alignItems: 'center', paddingBlock: 10, paddingInline: 18,
      border: '1px solid #e9e9e9', borderRadius: 26, background: '#FFFDF7',
    }}
  >
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <span style={{ fontSize: 14, fontWeight: 500, color: '#000', marginBottom: 2 }}>{row.name || '未命名'}</span>
      <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#000', wordBreak: 'break-all' }}>
        sk-{row.key?.slice(0, 5)}*******{row.key?.slice(-4)}
      </span>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px', alignItems: 'center' }}>
      <span style={{ fontSize: 12, color: '#999' }}>创建时间</span>
      <span style={{ fontSize: 14, color: '#000' }}>{row.created_time ? timestamp2string(row.created_time) : '-'}</span>
      <span style={{ fontSize: 12, color: '#999' }}>最近使用时间</span>
      <span style={{ fontSize: 14, color: '#000' }}>{row.accessed_time ? timestamp2string(row.accessed_time) : '从未使用'}</span>
    </div>
    <div className='flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity'>
      <IconButton icon={Copy} title='复制' onClick={onCopy} />
      <IconButton icon={Pencil} title='编辑' onClick={onEdit} />
      <IconButton icon={Trash2} variant='danger' title='删除' onClick={onDelete} />
    </div>
  </div>
);

const CodeSamples = ({ origin }) => {
  const [lang, setLang] = useState('curl');
  const samples = useMemo(() => ({
    curl: `curl -X POST "${origin}/v1/chat/completions" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "gpt-4o-mini",
    "messages": [
      {
        "role": "user",
        "content": "Hello World"
      }
    ],
    "stream": true,
    "temperature": 0.7,
    "max_tokens": 1000
  }'`,
    python: `import requests

response = requests.post(
    "${origin}/v1/chat/completions",
    headers={
        "Authorization": "Bearer YOUR_API_KEY",
        "Content-Type": "application/json",
    },
    json={
        "model": "gpt-4o-mini",
        "messages": [
            {"role": "user", "content": "Hello World"}
        ],
        "stream": True,
        "temperature": 0.7,
        "max_tokens": 1000,
    },
)`,
    nodejs: `const response = await fetch('${origin}/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: 'Hello World' }],
    stream: true,
    temperature: 0.7,
    max_tokens: 1000,
  }),
});`,
  }), [origin]);

  const LANGS = [
    { key: 'curl', label: 'curl' },
    { key: 'python', label: 'python' },
    { key: 'nodejs', label: 'nodejs' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 18, fontWeight: 600, color: '#000' }}>调用示例</span>
        <div style={{ display: 'flex', gap: 4 }}>
          {LANGS.map((l) => (
            <button
              key={l.key}
              onClick={() => setLang(l.key)}
              style={{
                cursor: 'pointer', height: 28, paddingInline: 12, borderRadius: 14,
                fontSize: 13, border: 'none',
                color: lang === l.key ? '#080808' : '#666',
                background: lang === l.key ? '#F2F0E9' : 'transparent',
                transition: 'background 0.15s',
              }}
            >{l.label}</button>
          ))}
        </div>
      </div>
      <CodeBlock code={samples[lang]} language={lang === 'curl' ? 'bash' : lang === 'nodejs' ? 'javascript' : 'python'} />
    </div>
  );
};

const TokenEditModal = ({ open, token, onClose, onSaved }) => {
  const isEdit = !!token?.id;
  const [form, setForm] = useState({});
  const [groups, setGroups] = useState([]);
  const [models, setModels] = useState([]);
  const [saving, setSaving] = useState(false);
  const u = (k) => (v) => setForm((p) => ({ ...p, [k]: v?.target ? v.target.value : v }));

  useEffect(() => {
    if (!token) return;
    setForm({
      ...token,
      model_limits_enabled: token.model_limits_enabled || false,
      model_limits: token.model_limits || '',
      allow_ips: token.allow_ips || '',
    });
  }, [token]);

  useEffect(() => {
    API.get('/api/user/self/groups').then((res) => {
      if (res.data?.success && res.data.data) {
        setGroups(Object.entries(res.data.data).map(([value, info]) => ({
          value, label: info.desc || value,
        })));
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const group = form.group || '';
    const url = group ? `/api/user/models?group=${encodeURIComponent(group)}` : '/api/user/models';
    API.get(url).then((res) => {
      if (res.data?.success && Array.isArray(res.data.data)) {
        setModels(res.data.data.map((m) => ({ value: m, label: m })));
      }
    }).catch(() => setModels([]));
  }, [form.group]);

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
        model_limits_enabled: !!form.model_limits_enabled,
        model_limits: form.model_limits || '',
        allow_ips: form.allow_ips || '',
      };
      const res = isEdit
        ? await API.put('/api/token/', { ...payload, id: token.id })
        : await API.post('/api/token/', { ...payload, count: 1 });
      const { success, message } = res.data || {};
      if (success) { showSuccess(isEdit ? '已更新' : '已创建'); onSaved(); }
      else showError(message);
    } catch (e) { showError(e); } finally { setSaving(false); }
  };

  const selectedModels = form.model_limits ? form.model_limits.split(',').filter(Boolean) : [];

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title={<span style={{ fontSize: 18, fontWeight: 600, color: '#000' }}>{isEdit ? '编辑令牌' : '创建令牌'}</span>}
      width={480}
      footer={
        <>
          <Button variant='toggle' onClick={onClose}>取消</Button>
          <Button onClick={save} loading={saving}>{isEdit ? '保存' : '创建'}</Button>
        </>
      }
    >
      <div className='px-6 py-4 space-y-5'>
        <div>
          <label className='block text-sm text-[#666] mb-1.5'>名称</label>
          <Input value={form.name || ''} onChange={u('name')} placeholder='例如 my-app' />
        </div>

        {groups.length > 0 && (
          <div>
            <label className='block text-sm text-[#666] mb-1.5'>分组</label>
            <Select value={form.group} onChange={u('group')} options={groups} placeholder='选择分组' />
          </div>
        )}

        <div className='flex items-center justify-between'>
          <span className='text-sm text-[#000]'>不限额度</span>
          <Switch checked={!!form.unlimited_quota} onChange={u('unlimited_quota')} />
        </div>

        {!form.unlimited_quota && (
          <div>
            <label className='block text-sm text-[#666] mb-1.5'>金额</label>
            <NumberInput
              value={quotaToDisplayAmount(form.remain_quota || 0)}
              onChange={(v) => u('remain_quota')(displayAmountToQuota(v))}
              min={0} step='any'
            />
          </div>
        )}

        <div>
          <label className='block text-sm text-[#666] mb-1.5'>过期时间</label>
          <div className='flex gap-2'>
            <input
              type='datetime-local'
              value={toLocalInput(form.expired_time)}
              onChange={(e) => u('expired_time')(toUnix(e.target.value) || -1)}
              className='flex-1 rounded-lg border border-[#e3e3e3] bg-transparent px-3 py-2 text-sm text-[#000]'
            />
            <Button variant='toggle' selected={form.expired_time === -1}
              onClick={() => u('expired_time')(-1)}>永不</Button>
          </div>
        </div>

        <div className='flex items-center justify-between'>
          <span className='text-sm text-[#000]'>模型限制</span>
          <Switch checked={!!form.model_limits_enabled} onChange={u('model_limits_enabled')} />
        </div>

        {form.model_limits_enabled && (
          <div>
            <label className='block text-sm text-[#666] mb-1.5'>允许的模型</label>
            <MultiSelect
              options={models}
              value={selectedModels}
              onChange={(arr) => u('model_limits')(arr.join(','))}
              placeholder='选择允许的模型'
              searchable
            />
          </div>
        )}

        <div>
          <label className='block text-sm text-[#666] mb-1.5'>IP 白名单</label>
          <textarea
            value={form.allow_ips || ''}
            onChange={(e) => u('allow_ips')(e.target.value)}
            placeholder='每行一个 IP 地址，留空则不限制'
            rows={3}
            className='w-full rounded-lg border border-[#e3e3e3] bg-transparent px-3 py-2 text-sm text-[#000] resize-none outline-none focus:border-[#999] transition-colors'
          />
        </div>
      </div>
    </SlideOver>
  );
};

export default TokenPage;