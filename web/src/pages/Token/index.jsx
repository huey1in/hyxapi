import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Copy, Pencil } from 'lucide-react';
import { API, showError, showSuccess, timestamp2string, renderQuota, copy } from '../../helpers';
import { quotaToDisplayAmount, displayAmountToQuota } from '../../helpers/quota';
import {
  Button, IconButton, Input, NumberInput, Switch, Select, MultiSelect,
  SlideOver, ConfirmDialog, CodeBlock, Loading,
} from '../../components/ui';
import useIsMobile from '../../hooks/useIsMobile';

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
  const [keys, setKeys] = useState({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const isMobile = useIsMobile();

  const load = async () => {
    setLoading(true);
    try {
      const res = await API.get('/api/token/?p=1&size=200');
      const { success, data, message } = res.data || {};
      if (success) {
        const list = Array.isArray(data) ? data : data?.items || [];
        setRows(list);
        const keyMap = {};
        await Promise.all(list.map(async (t) => {
          try {
            const r = await API.post(`/api/token/${t.id}/key`);
            if (r.data?.success && r.data.data?.key) keyMap[t.id] = `sk-${r.data.data.key}`;
          } catch {}
        }));
        setKeys(keyMap);
      }
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
    const text = keys[row.id];
    if (!text) { showError('密钥加载中，请稍后再试'); return; }
    const ok = await copy(text);
    ok ? showSuccess('已复制') : showError('复制失败，请手动复制');
  };

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://api.example.com';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 20 : 28, width: '100%', maxWidth: 960, marginInline: 'auto', padding: isMobile ? '16px' : '24px 16px' }}>
      {/* 快速入门 */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
        <StepCard num='01' title='创建 API key' desc='创建 API key 并妥善保存' />
        <StepCard num='02' title='参看示例' desc='请在下方参看调用示例' />
        <StepCard num='03' title='发送请求' desc='接入 AI 服务' />
      </div>

      {/* API keys */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--ui-text)' }}>API keys</span>
          <button
            onClick={() => setEditing({ name: '', unlimited_quota: true, remain_quota: 500000, expired_time: -1, group: '' })}
            style={{
              cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
              height: 32, paddingInline: 16, border: '1px solid var(--ui-text)', borderRadius: 24,
              fontSize: 14, color: 'var(--ui-text)', background: 'var(--page-bg)',
              transition: 'background 0.2s ease, color 0.2s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--ui-accent)'; e.currentTarget.style.color = 'var(--ui-accent-fg)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--page-bg)'; e.currentTarget.style.color = 'var(--ui-text)'; }}
          >
            <Plus size={14} /> 创建 API key
          </button>
        </div>

        {loading ? <Loading /> : rows.length === 0 ? (
          <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--ui-text-3)', fontSize: 14 }}>暂无 API key</div>
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
  <div style={{ padding: 16, border: '1px solid var(--ui-border)', borderRadius: 16, background: 'var(--page-bg)' }}>
    <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, marginBottom: 8, border: '1px solid #e3e8f0', borderRadius: '50%', fontWeight: 700, fontSize: 12, color: 'var(--ui-text)' }}>{num}.</div>
    <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--ui-text)', marginBottom: 4 }}>{title}</div>
    <div style={{ fontSize: 14, color: 'var(--ui-text-3)' }}>{desc}</div>
  </div>
);

const PILL = { display: 'inline-flex', alignItems: 'center', height: 20, paddingInline: 6, borderRadius: 5, fontSize: 11, whiteSpace: 'nowrap' };

const KeyCard = ({ row, onCopy, onDelete, onEdit }) => {
  const isMobile = useIsMobile();
  const usageText = row.unlimited_quota
    ? `已用 ${renderQuota(row.used_quota || 0)}`
    : `${renderQuota(row.used_quota || 0)} / ${renderQuota((row.used_quota || 0) + (row.remain_quota || 0))}`;

  return (
  <div
    className='group'
    style={{
      position: 'relative', display: 'flex', flexDirection: 'column', gap: 10,
      paddingBlock: isMobile ? 14 : 12, paddingInline: isMobile ? 14 : 18,
      border: '1px solid var(--ui-border)', borderRadius: 26, background: 'var(--page-bg)',
    }}
  >
    {/* 第一行：名称 + 分组 + 操作 */}
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1 }}>
        <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--ui-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.name || '未命名'}</span>
        {row.group && (
          <span style={{ ...PILL, color: 'var(--ui-text-3)', border: '1px solid var(--ui-border)' }}>{row.group}</span>
        )}
      </div>
      <div className={`flex gap-1 shrink-0 ${isMobile ? '' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
        <IconButton icon={Copy} title='复制' onClick={onCopy} />
        <IconButton icon={Pencil} title='编辑' onClick={onEdit} />
        <IconButton icon={Trash2} variant='danger' title='删除' onClick={onDelete} />
      </div>
    </div>
    {/* 第二行：密钥 + 用量 + 时间 */}
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: 'var(--ui-text-2)' }}>
        sk-{row.key?.slice(0, 5)}···{row.key?.slice(-4)}
      </span>
      <span style={{ ...PILL, color: 'var(--ui-text-2)', background: 'var(--ui-bg-subtle)', fontVariantNumeric: 'tabular-nums' }}>
        {usageText}
      </span>
      {row.unlimited_quota && (
        <span style={{ ...PILL, color: '#16a34a', background: '#f0fdf4', border: '1px solid #bbf7d0' }}>无限</span>
      )}
      <span style={{ fontSize: 11, color: 'var(--ui-text-3)', marginLeft: 'auto', whiteSpace: 'nowrap' }}>
        {row.accessed_time ? timestamp2string(row.accessed_time) : '从未使用'}
      </span>
    </div>
  </div>
  );
};

const CodeSamples = ({ origin }) => {
  const [tool, setTool] = useState('claude');
  const [shell, setShell] = useState('unix');
  const KEY = 'YOUR_API_KEY';

  const shells = useMemo(() => ({
    unix: {
      label: 'macOS / Linux',
      title: 'Terminal',
      code: `export ANTHROPIC_BASE_URL="${origin}"
export ANTHROPIC_AUTH_TOKEN="${KEY}"
export CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1`,
    },
    cmd: {
      label: 'Windows CMD',
      title: 'Command Prompt',
      code: `set ANTHROPIC_BASE_URL=${origin}
set ANTHROPIC_AUTH_TOKEN=${KEY}
set CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1`,
    },
    powershell: {
      label: 'PowerShell',
      title: 'PowerShell',
      code: `$env:ANTHROPIC_BASE_URL="${origin}"
$env:ANTHROPIC_AUTH_TOKEN="${KEY}"
$env:CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1`,
    },
  }), [origin]);

  const claudeSettings = `{
  "env": {
    "ANTHROPIC_BASE_URL": "${origin}",
    "ANTHROPIC_AUTH_TOKEN": "${KEY}",
    "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": "1",
    "CLAUDE_CODE_ATTRIBUTION_HEADER": "0"
  }
}`;

  const opencodeConfig = `{
  "provider": {
    "anthropic": {
      "options": {
        "baseURL": "${origin}/v1",
        "apiKey": "${KEY}"
      },
      "npm": "@ai-sdk/anthropic"
    }
  },
  "$schema": "https://opencode.ai/config.json"
}`;

  const TOOLS = [
    { key: 'claude', label: 'Claude Code' },
    { key: 'opencode', label: 'OpenCode' },
  ];

  const tabBtn = (active) => ({
    cursor: 'pointer', height: 28, paddingInline: 12, borderRadius: 14,
    fontSize: 13, border: 'none',
    color: active ? 'var(--ui-text)' : 'var(--ui-text-2)',
    background: active ? 'var(--ui-bg-subtle)' : 'transparent',
    transition: 'background 0.15s',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--ui-text)' }}>调用示例</span>
        <div style={{ display: 'flex', gap: 4 }}>
          {TOOLS.map((tl) => (
            <button key={tl.key} onClick={() => setTool(tl.key)} style={tabBtn(tool === tl.key)}>{tl.label}</button>
          ))}
        </div>
      </div>

      <p style={{ fontSize: 14, color: 'var(--ui-text-3)', margin: 0 }}>
        使用 API 密钥配置，将下方环境变量添加到您的终端配置文件，或直接在终端中运行。
      </p>

      {tool === 'claude' ? (
        <>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {Object.entries(shells).map(([k, s]) => (
              <button key={k} onClick={() => setShell(k)} style={tabBtn(shell === k)}>{s.label}</button>
            ))}
          </div>
          <CodeBlock code={shells[shell].code} language='bash' title={shells[shell].title} />

          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ui-text)', marginTop: 4 }}>VSCode Claude Code</div>
          <CodeBlock code={claudeSettings} language='json' title='~/.claude/settings.json' />
        </>
      ) : (
        <>
          <p style={{ fontSize: 13, color: 'var(--ui-text-3)', margin: 0 }}>
            配置文件路径：~/.config/opencode/opencode.json（不存在需手动创建）。可使用默认 provider 或自定义，示例仅供参考。
          </p>
          <CodeBlock code={opencodeConfig} language='json' title='opencode.json' />
        </>
      )}

      <p style={{ fontSize: 12, color: 'var(--ui-text-3)', margin: 0 }}>
        这些环境变量将在当前终端会话中生效。如需永久配置，请添加到 ~/.bashrc、~/.zshrc 或相应的配置文件中。
      </p>
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
      title={<span style={{ fontSize: 18, fontWeight: 600, color: 'var(--ui-text)' }}>{isEdit ? '编辑令牌' : '创建令牌'}</span>}
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
          <span className='text-sm text-ui-text'>不限额度</span>
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
              className='flex-1 rounded-lg border border-ui-border bg-transparent px-3 py-2 text-sm text-ui-text'
            />
            <Button variant='toggle' selected={form.expired_time === -1}
              onClick={() => u('expired_time')(-1)}>永不</Button>
          </div>
        </div>

        <div className='flex items-center justify-between'>
          <span className='text-sm text-ui-text'>模型限制</span>
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
            className='w-full rounded-lg border border-ui-border bg-transparent px-3 py-2 text-sm text-ui-text resize-none outline-none focus:border-[#999] transition-colors'
          />
        </div>
      </div>
    </SlideOver>
  );
};

export default TokenPage;