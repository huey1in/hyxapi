/*
 * Token (API keys) — 与 web-backup 同构。
 *
 * 顶部标题 + API keys 卡片列表 + 调用示例区（工具 tab + OS 切换 + 安装代码 + 配置代码）。
 * 用 ui/* 替换 backup 的 SquircleBox / Dropdown / 原生 input。
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Plus, Pencil, Trash2, Copy, Eye, EyeOff, Infinity as InfinityIcon, RefreshCw,
} from 'lucide-react';
import {
  API, showError, showSuccess, copy, renderQuota,
} from '../../helpers';
import { quotaToDisplayAmount, displayAmountToQuota } from '../../helpers/quota';
import { usePageTitle } from '../../hooks/common/usePageTitle';
import {
  Button, IconButton, Tabs, Select, Modal, ConfirmDialog, CodeBlock, Switch,
  Input, NumberInput, FieldRow,
} from '../../components/ui';

// ── time helpers ────────────────────────────────────────
const toLocalInput = (ts) => {
  if (!ts || ts === -1) return '';
  const d = new Date(ts * 1000);
  if (isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const toUnix = (val) => (val ? Math.floor(new Date(val).getTime() / 1000) : 0);
const fmtDateTime = (ts) => {
  if (!ts || ts === -1) return null;
  const d = new Date(ts * 1000);
  if (isNaN(d.getTime())) return null;
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

// ── form modal ───────────────────────────────────────────
const TokenFormModal = ({ open, token, onClose, onSaved, t }) => {
  const isEdit = !!token?.id;
  const [name, setName] = useState('');
  const [unlimitedQuota, setUnlimitedQuota] = useState(true);
  const [remainQuota, setRemainQuota] = useState(500000);
  const [expiredTime, setExpiredTime] = useState(-1);
  const [group, setGroup] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [groupOptions, setGroupOptions] = useState([]);

  useEffect(() => {
    if (!open) return;
    setName(token?.name || '');
    setUnlimitedQuota(token?.unlimited_quota ?? true);
    setRemainQuota(token?.remain_quota ?? 500000);
    setExpiredTime(token?.expired_time ?? -1);
    setGroup(token?.group || '');
  }, [open, token]);

  useEffect(() => {
    if (!open) return;
    API.get('/api/user/self/groups').then((res) => {
      if (res.data.success && res.data.data) {
        const opts = Object.entries(res.data.data).map(([value, info]) => ({ value, label: info.desc || value }));
        setGroupOptions(opts);
        if (!token?.id && !token?.group && opts[0]) setGroup((cur) => cur || opts[0].value);
      }
    }).catch(() => {});
  }, [open, token?.id, token?.group]);

  const submit = async () => {
    if (!name.trim()) { showError(t('请输入令牌名称')); return; }
    setSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        unlimited_quota: unlimitedQuota,
        remain_quota: unlimitedQuota ? 0 : Number(remainQuota) || 0,
        expired_time: Number(expiredTime) || -1,
        group,
        model_limits_enabled: false,
        model_limits: '',
        allow_ips: '',
      };
      const res = isEdit
        ? await API.put('/api/token/', { ...payload, id: token.id })
        : await API.post('/api/token/', { ...payload, count: 1 });
      if (res.data.success) {
        showSuccess(isEdit ? t('令牌已更新') : t('令牌已创建'));
        onSaved();
      } else {
        showError(res.data.message);
      }
    } catch (e) {
      showError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? t('编辑 API key') : t('创建 API key')}
      width={480}
      loading={submitting}
      onConfirm={submit}
      confirmText={isEdit ? t('保存') : t('创建')}
      cancelText={t('取消')}
    >
      <div className='space-y-5'>
        <div>
          <h3 className='text-[11px] uppercase tracking-[0.12em] font-semibold text-ui-text-3 mb-3'>{t('基础信息')}</h3>
          <div className='space-y-4'>
            <FieldRow label={t('名称')} required>
              <Input value={name} onChange={setName} placeholder={t('例如 my-app')} autoFocus />
            </FieldRow>
            <FieldRow label={t('分组')}>
              <Select value={group} onChange={setGroup} options={groupOptions} placeholder={t('选择分组')} />
            </FieldRow>
          </div>
        </div>

        <div className='border-t border-ui-divider' />

        <div>
          <h3 className='text-[11px] uppercase tracking-[0.12em] font-semibold text-ui-text-3 mb-3'>{t('配额与时效')}</h3>
          <div className='space-y-4'>
            <div className='flex items-start justify-between gap-4'>
              <div className='flex-1 min-w-0'>
                <div className='text-sm text-ui-text font-medium'>{t('不限额度')}</div>
                <div className='text-[11px] text-ui-text-3 mt-0.5'>{t('开启后令牌可无限制使用，不再扣减额度')}</div>
              </div>
              <Switch checked={unlimitedQuota} onChange={setUnlimitedQuota} />
            </div>
            {!unlimitedQuota && (
              <FieldRow label={t('金额')} hint={t('账户余额单位')}>
                <NumberInput
                  value={quotaToDisplayAmount(remainQuota)}
                  onChange={(v) => setRemainQuota(displayAmountToQuota(String(v)))}
                  min={0}
                  step={0.01}
                />
              </FieldRow>
            )}
            <FieldRow label={t('过期时间')} hint={t('留空或选择「永不」表示长期有效')}>
              <div className='flex gap-2'>
                <Input
                  type='datetime-local'
                  value={toLocalInput(expiredTime)}
                  onChange={(v) => setExpiredTime(toUnix(v) || -1)}
                  width='full'
                />
                <Button variant={expiredTime === -1 ? 'toggle' : 'toggle'} selected={expiredTime === -1} onClick={() => setExpiredTime(-1)}>
                  {t('永不')}
                </Button>
              </div>
            </FieldRow>
          </div>
        </div>
      </div>
    </Modal>
  );
};

// ── data hook ────────────────────────────────────────────
const useTokens = () => {
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await API.get('/api/token/?p=1&size=100');
      if (data.success) setTokens(data.data.items || []);
      else showError(data.message);
    } catch (e) { showError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);
  return { tokens, loading, reload: load };
};

// ── key row ──────────────────────────────────────────────
const KeyRow = ({ token, revealed, keyValue, onToggle, onCopy, onEdit, onDelete, t }) => {
  const masked = useMemo(() => {
    const k = keyValue || '';
    if (!k) return 'sk-••••••••';
    return `sk-${k.slice(0, 5)}*******${k.slice(-4)}`;
  }, [keyValue]);
  const display = revealed && keyValue ? `sk-${keyValue}` : masked;
  return (
    <div
      className='py-4 px-5 border border-ui-border rounded-[28px] flex flex-col md:flex-row md:items-center gap-3 md:gap-6'
      style={{ backgroundColor: 'var(--page-bg)' }}
    >
      <div className='flex-1 min-w-0'>
        <div className='flex items-center gap-2 mb-1'>
          <span className='text-[15px] font-medium text-ui-text truncate'>{token.name || `Token #${token.id}`}</span>
          <IconButton icon={Pencil} size='sm' onClick={onEdit} title={t('编辑')} />
        </div>
        <div className='flex items-center gap-2'>
          <code className='text-[13px] font-mono text-ui-text-2 tabular-nums truncate'>{display}</code>
          <IconButton icon={revealed ? EyeOff : Eye} size='sm' onClick={onToggle} title={revealed ? t('隐藏密钥') : t('显示密钥')} />
          <IconButton icon={Copy} size='sm' onClick={onCopy} title={t('复制')} />
        </div>
      </div>
      <div className='flex items-start gap-6 md:gap-8'>
        <div className='min-w-0'>
          <div className='text-[11px] text-ui-text-3 mb-0.5'>{t('创建时间')}</div>
          <div className='text-[13px] text-ui-text tabular-nums whitespace-nowrap'>{fmtDateTime(token.created_time) || '—'}</div>
        </div>
        <div className='min-w-0'>
          <div className='text-[11px] text-ui-text-3 mb-0.5'>{t('最近使用时间')}</div>
          <div className='text-[13px] text-ui-text tabular-nums whitespace-nowrap'>{fmtDateTime(token.accessed_time) || t('从未使用')}</div>
        </div>
        <div className='min-w-0 hidden md:block'>
          <div className='text-[11px] text-ui-text-3 mb-0.5'>{t('额度')}</div>
          <div className='text-[13px] text-ui-text tabular-nums whitespace-nowrap'>
            {token.unlimited_quota
              ? <span className='inline-flex items-center gap-1 text-ui-text-2'><InfinityIcon size={13} />{t('不限')}</span>
              : renderQuota(token.remain_quota)}
          </div>
        </div>
      </div>
      <IconButton icon={Trash2} variant='danger' onClick={onDelete} title={t('删除')} />
    </div>
  );
};

// ── code samples ─────────────────────────────────────────
const TOOL_INSTALL = {
  claude: {
    macos:  `# 安装 Node.js（如已安装可跳过）\nbrew install node\n\n# 安装 Claude Code\nnpm install -g @anthropic-ai/claude-code`,
    linux:  `# 安装 Node.js（如已安装可跳过）\ncurl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -\nsudo apt-get install -y nodejs\n\n# 安装 Claude Code\nsudo npm install -g @anthropic-ai/claude-code`,
    windows:`# 在 PowerShell 中执行\n# 1) 安装 Node.js（如已安装可跳过）\nwinget install OpenJS.NodeJS.LTS\n\n# 2) 安装 Claude Code\nnpm install -g @anthropic-ai/claude-code`,
  },
  codex: {
    macos:  `# 安装 Node.js（如已安装可跳过）\nbrew install node\n\n# 安装 OpenAI Codex CLI\nnpm install -g @openai/codex`,
    linux:  `# 安装 Node.js（如已安装可跳过）\ncurl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -\nsudo apt-get install -y nodejs\n\n# 安装 OpenAI Codex CLI\nsudo npm install -g @openai/codex`,
    windows:`# 在 PowerShell 中执行\n# 1) 安装 Node.js（如已安装可跳过）\nwinget install OpenJS.NodeJS.LTS\n\n# 2) 安装 OpenAI Codex CLI\nnpm install -g @openai/codex`,
  },
  gemini: {
    macos:  `# 安装 Node.js（如已安装可跳过）\nbrew install node\n\n# 安装 Gemini CLI\nnpm install -g @google/gemini-cli`,
    linux:  `# 安装 Node.js（如已安装可跳过）\ncurl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -\nsudo apt-get install -y nodejs\n\n# 安装 Gemini CLI\nsudo npm install -g @google/gemini-cli`,
    windows:`# 在 PowerShell 中执行\n# 1) 安装 Node.js（如已安装可跳过）\nwinget install OpenJS.NodeJS.LTS\n\n# 2) 安装 Gemini CLI\nnpm install -g @google/gemini-cli`,
  },
};

const buildSamples = (apiBase, apiKey) => {
  const key = apiKey || 'YOUR_API_KEY';
  return {
    claude: { label: 'Claude Code',  lang: 'bash', code: `export ANTHROPIC_BASE_URL="${apiBase}"\nexport ANTHROPIC_AUTH_TOKEN="${key}"\nclaude` },
    codex:  { label: 'OpenAI Codex', lang: 'bash', code: `export OPENAI_BASE_URL="${apiBase}/v1"\nexport OPENAI_API_KEY="${key}"\ncodex` },
    gemini: { label: 'Gemini CLI',   lang: 'bash', code: `export GEMINI_API_BASE="${apiBase}"\nexport GEMINI_API_KEY="${key}"\ngemini` },
  };
};

// ── main ─────────────────────────────────────────────────
const Tokens = () => {
  const { t } = useTranslation();
  usePageTitle(t('令牌'));

  const { tokens, loading, reload } = useTokens();
  const [revealed, setRevealed] = useState({});
  const [keyMap, setKeyMap] = useState({});
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirmRm, setConfirmRm] = useState(null);
  const [activeTab, setActiveTab] = useState('claude');
  const [sampleTokenId, setSampleTokenId] = useState(null);
  const [activeOS, setActiveOS] = useState(() => {
    if (typeof navigator === 'undefined') return 'macos';
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('mac')) return 'macos';
    if (ua.includes('win')) return 'windows';
    return 'linux';
  });

  const apiBase = typeof window !== 'undefined' ? window.location.origin : '';
  const sampleKey = sampleTokenId ? keyMap[sampleTokenId] : null;
  const samples = useMemo(() => buildSamples(apiBase, sampleKey), [apiBase, sampleKey]);

  const ensureKey = async (id) => {
    if (keyMap[id]) return keyMap[id];
    const { data } = await API.post(`/api/token/${id}/key`);
    if (data.success && data.data?.key) {
      setKeyMap((m) => ({ ...m, [id]: data.data.key }));
      return data.data.key;
    }
    showError(data.message || t('获取密钥失败'));
    return null;
  };

  useEffect(() => {
    if (!tokens?.length) { setSampleTokenId(null); return; }
    if (sampleTokenId && tokens.some((tt) => tt.id === sampleTokenId)) return;
    const first = tokens[0];
    setSampleTokenId(first.id);
    if (!keyMap[first.id]) ensureKey(first.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokens]);

  useEffect(() => {
    if (sampleTokenId && !keyMap[sampleTokenId]) ensureKey(sampleTokenId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sampleTokenId]);

  const onToggle = async (token) => {
    if (revealed[token.id]) { setRevealed((r) => ({ ...r, [token.id]: false })); return; }
    const key = await ensureKey(token.id);
    if (key) setRevealed((r) => ({ ...r, [token.id]: true }));
  };
  const onCopy = async (token) => {
    const key = await ensureKey(token.id);
    if (!key) return;
    if (await copy(`sk-${key}`)) showSuccess(t('已复制'));
  };
  const onDelete = async () => {
    if (!confirmRm) return;
    try {
      const { data } = await API.delete(`/api/token/${confirmRm.id}`);
      if (data.success) { showSuccess(t('已删除')); reload(); }
      else showError(data.message);
    } catch (e) { showError(e.message); }
    finally { setConfirmRm(null); }
  };

  return (
    <div className='px-4 pt-8 pb-6 md:px-6 md:pt-10 md:pb-8' style={{ backgroundColor: 'var(--page-bg)' }}>
      <div className='max-w-[960px] mx-auto'>
        <h1 className='text-2xl md:text-3xl font-medium text-ui-text mb-6' style={{ letterSpacing: '-0.02em' }}>{t('令牌')}</h1>

        {/* API keys */}
        <section className='mb-10'>
          <div className='flex items-center justify-between gap-3 mb-3 pb-3 border-b border-ui-border'>
            <h2 className='text-[15px] font-semibold text-ui-text'>API keys</h2>
            <IconButton icon={RefreshCw} size='sm' onClick={() => reload()} title={t('刷新')} />
          </div>
          <div className='flex items-start justify-between gap-4 mb-4'>
            <p className='text-xs text-ui-text-3 leading-relaxed flex-1'>
              {t('创建 API key 用以在你的应用或第三方客户端中使用 Routify 的服务，请妥善保存。不要与他人共享你的 API key，或将其暴露在浏览器或其他客户端代码中。')}
            </p>
            <Button icon={Plus} onClick={() => { setEditing(null); setEditOpen(true); }}>
              {t('创建 API key')}
            </Button>
          </div>
          {loading && tokens.length === 0 ? (
            <div className='py-12 text-center text-ui-text-3 text-sm'>{t('加载中...')}</div>
          ) : tokens.length === 0 ? (
            <div className='py-12 text-center text-ui-text-3 text-sm'>{t('还没有创建 API key')}</div>
          ) : (
            <div className='space-y-3'>
              {tokens.map((token) => (
                <KeyRow
                  key={token.id}
                  token={token}
                  revealed={!!revealed[token.id]}
                  keyValue={keyMap[token.id]}
                  onToggle={() => onToggle(token)}
                  onCopy={() => onCopy(token)}
                  onEdit={() => { setEditing(token); setEditOpen(true); }}
                  onDelete={() => setConfirmRm({ id: token.id, name: token.name })}
                  t={t}
                />
              ))}
            </div>
          )}
        </section>

        {/* Code samples */}
        <section>
          <h2 className='text-[15px] font-semibold text-ui-text mb-3 pb-3 border-b border-ui-border'>{t('调用示例')}</h2>
          <div className='flex items-end justify-between gap-3 mb-3'>
            <div className='flex-1 min-w-0'>
              <Tabs
                variant='underline'
                value={activeTab}
                onChange={setActiveTab}
                items={Object.entries(samples).map(([k, v]) => ({ value: k, label: v.label }))}
              />
            </div>
            {tokens.length > 0 && (
              <div className='flex items-center gap-2 text-xs text-ui-text-2 flex-shrink-0 pb-1'>
                <span className='text-ui-text-3'>{t('使用令牌')}</span>
                <Select
                  value={sampleTokenId}
                  onChange={setSampleTokenId}
                  placeholder={t('选择令牌')}
                  options={tokens.map((tok) => ({ value: tok.id, label: tok.name || `#${tok.id}` }))}
                  width={180}
                  size={28}
                />
                {!sampleKey && sampleTokenId && <span className='text-ui-text-3'>{t('加载密钥中…')}</span>}
              </div>
            )}
          </div>

          {/* OS 选择 */}
          <div className='flex items-center gap-2 mb-3'>
            <span className='text-xs text-ui-text-3'>{t('操作系统')}</span>
            {[{ v: 'macos', l: 'macOS' }, { v: 'linux', l: 'Linux' }, { v: 'windows', l: 'Windows' }].map((os) => (
              <Button key={os.v} variant='toggle' selected={activeOS === os.v} onClick={() => setActiveOS(os.v)}>
                {os.l}
              </Button>
            ))}
          </div>

          {/* 1. 安装 */}
          <div className='mb-2 text-[13px] font-medium text-ui-text-2'>{t('① 安装 {{tool}}', { tool: samples[activeTab].label })}</div>
          <div className='mb-4'>
            <CodeBlock
              language={activeOS === 'windows' ? 'bash' : 'bash'}
              title={activeOS === 'windows' ? 'PowerShell' : 'Shell'}
              code={TOOL_INSTALL[activeTab][activeOS]}
            />
          </div>

          {/* 2. 配置并启动 */}
          <div className='mb-2 text-[13px] font-medium text-ui-text-2'>{t('② 配置并启动')}</div>
          <CodeBlock language='bash' title='Shell' code={samples[activeTab].code} />
        </section>
      </div>

      <TokenFormModal
        open={editOpen}
        token={editing}
        onClose={() => setEditOpen(false)}
        onSaved={() => { setEditOpen(false); reload(); }}
        t={t}
      />

      <ConfirmDialog
        open={!!confirmRm}
        title={t('删除 API key')}
        description={t('确认删除「{{name}}」？此操作不可恢复。').replace('{{name}}', confirmRm?.name || '')}
        confirmText={t('删除')}
        cancelText={t('取消')}
        onConfirm={onDelete}
        onClose={() => setConfirmRm(null)}
      />
    </div>
  );
};

export default Tokens;
