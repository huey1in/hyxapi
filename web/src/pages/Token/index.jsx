/*
Copyright (C) 2025 QuantumNous

API page (formerly 令牌管理) — quick-start guide, key list, code samples.
*/

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import {
  Plus, Pencil, Trash2, Copy, Check, X,
  Eye, EyeOff, Infinity as InfinityIcon, RefreshCw,
} from 'lucide-react';
import {
  API,
  showError,
  showSuccess,
  copy,
  renderQuota,
  timestamp2string,
} from '../../helpers';
import { quotaToDisplayAmount, displayAmountToQuota } from '../../helpers/quota';
import { usePageTitle } from '../../hooks/common/usePageTitle';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import SquircleBox from '../../components/common/ui/SquircleBox';
import hljs from 'highlight.js/lib/core';
import bashLang from 'highlight.js/lib/languages/bash';
import pythonLang from 'highlight.js/lib/languages/python';
import javascriptLang from 'highlight.js/lib/languages/javascript';

hljs.registerLanguage('bash', bashLang);
hljs.registerLanguage('python', pythonLang);
hljs.registerLanguage('javascript', javascriptLang);

// ── time helpers ────────────────────────────────────────
const toLocalInput = (ts) => {
  if (!ts || ts === -1) return '';
  const d = new Date(ts * 1000);
  if (isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const toUnix = (val) => {
  if (!val) return 0;
  return Math.floor(new Date(val).getTime() / 1000);
};
const fmtDateTime = (ts) => {
  if (!ts || ts === -1) return null;
  const d = new Date(ts * 1000);
  if (isNaN(d.getTime())) return null;
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

// ── select primitives reused inside the form modal ──────
// Use the shared Dropdown for the group picker.
import Dropdown from '../../components/common/ui/Dropdown';
import { Button, IconButton, Tabs as UITabs, Card, inputClass } from '../../components/ui';

// ── token form modal (create/edit) ──────────────────────
const FormSection = ({ title, children }) => (
  <div>
    <h3 className='text-[11px] uppercase tracking-[0.12em] font-semibold text-ui-text-3 mb-3'>
      {title}
    </h3>
    <div className='space-y-4'>{children}</div>
  </div>
);
const FormField = ({ label, hint, children, required }) => (
  <div>
    <div className='flex items-baseline justify-between mb-1.5'>
      <label className='text-xs font-medium text-ui-text'>
        {label}
        {required && <span className='text-ui-danger ml-0.5'>*</span>}
      </label>
      {hint && <span className='text-[11px] text-ui-text-3'>{hint}</span>}
    </div>
    {children}
  </div>
);
const FormToggle = ({ checked, onChange }) => (
  <span
    role='switch'
    aria-checked={checked}
    onClick={() => onChange(!checked)}
    className='relative inline-block w-9 h-5 rounded-full transition-colors flex-shrink-0 cursor-pointer'
    style={{ background: checked ? 'var(--ui-brand)' : 'var(--ui-border)' }}
  >
    <span
      className='absolute top-0.5 w-4 h-4 rounded-full transition-all'
      style={{
        left: checked ? '18px' : '2px',
        background: '#ffffff',
        boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
      }}
    />
  </span>
);
const SwitchRow = ({ title, description, checked, onChange }) => (
  <div className='flex items-start justify-between gap-4'>
    <div className='flex-1 min-w-0'>
      <div className='text-sm text-ui-text font-medium'>{title}</div>
      {description && (
        <div className='text-[11px] text-ui-text-3 mt-0.5'>{description}</div>
      )}
    </div>
    <div className='pt-0.5'>
      <FormToggle checked={checked} onChange={onChange} />
    </div>
  </div>
);

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
        const opts = Object.entries(res.data.data).map(([value, info]) => ({
          value,
          label: info.desc || value,
        }));
        setGroupOptions(opts);
        // 仅在"新建场景且当前 token 完全没有 group"时用第一个选项兜底。
        // 编辑场景下 token.group 已由上一个 effect 设置，绝不能用闭包 group 判断（会读到旧快照导致选错）。
        if (!token?.id && !token?.group && opts[0]) {
          setGroup((cur) => cur || opts[0].value);
        }
      }
    }).catch(() => {});
  }, [open, token?.id, token?.group]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const ov = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = ov;
    };
  }, [open, onClose]);

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
      let res;
      if (isEdit) {
        res = await API.put('/api/token/', { ...payload, id: token.id });
      } else {
        res = await API.post('/api/token/', { ...payload, count: 1 });
      }
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

  if (!open) return null;
  if (typeof document === 'undefined') return null;

  const inputCls = inputClass({ variant: 'admin', size: 'md' });
  const transparentBg = { backgroundColor: 'transparent', colorScheme: 'light' };

  return createPortal(
    <div
      className='fixed inset-0 z-[150] flex items-start md:items-center justify-center p-4 overflow-y-auto'
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onMouseDown={(e) => {
        // close only when both press and release land on the mask
        e.currentTarget._down = e.target === e.currentTarget;
      }}
      onMouseUp={(e) => {
        const ok = e.currentTarget._down && e.target === e.currentTarget;
        e.currentTarget._down = false;
        if (ok) onClose();
      }}
    >
      <SquircleBox
        radius={40}
        smoothing={0.9}
        className='w-full max-w-md my-8 shadow-2xl'
      >
        <div onMouseDown={(e) => e.stopPropagation()}>
          <div className='flex items-start justify-between px-6 pt-5 pb-4'>
            <div>
              <h2
                className='text-lg font-semibold text-ui-text'
                style={{ letterSpacing: '-0.015em' }}
              >
                {isEdit ? t('编辑 API key') : t('创建 API key')}
              </h2>
              <p className='text-xs text-ui-text-3 mt-1'>
                {isEdit ? t('修改名称、配额或有效期') : t('为这个 API key 起一个名称')}
              </p>
            </div>
            <IconButton icon={X} size='sm' onClick={onClose} className='-mr-1' />
          </div>

          <div className='px-6 pb-2 space-y-6'>
            <FormSection title={t('基础信息')}>
              <FormField label={t('名称')} required>
                <input
                  type='text'
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('例如 my-app')}
                  className={`${inputCls} placeholder:text-ui-text-3`}
                  style={transparentBg}
                  autoFocus
                />
              </FormField>
              <FormField label={t('分组')}>
                <Dropdown
                  options={groupOptions}
                  value={group}
                  onChange={setGroup}
                  placeholder={t('选择分组')}
                  triggerClassName='w-full'
                  popupClassName='w-full'
                />
              </FormField>
            </FormSection>

            <div className='border-t border-ui-divider' />

            <FormSection title={t('配额与时效')}>
              <SwitchRow
                title={t('不限额度')}
                description={t('开启后令牌可无限制使用，不再扣减额度')}
                checked={unlimitedQuota}
                onChange={setUnlimitedQuota}
              />
              {!unlimitedQuota && (
                <FormField label={t('金额')} hint={t('账户余额单位')}>
                  <input
                    type='number'
                    min={0}
                    step='any'
                    value={quotaToDisplayAmount(remainQuota)}
                    onChange={(e) => setRemainQuota(displayAmountToQuota(e.target.value))}
                    className={inputCls}
                    style={transparentBg}
                  />
                </FormField>
              )}
              <FormField label={t('过期时间')} hint={t('留空或选择「永不」表示长期有效')}>
                <div className='flex gap-2'>
                  <input
                    type='datetime-local'
                    value={toLocalInput(expiredTime)}
                    onChange={(e) => setExpiredTime(toUnix(e.target.value) || -1)}
                    className={inputCls}
                    style={transparentBg}
                  />
                  <Button
                    variant={expiredTime === -1 ? 'secondary' : 'ghost'}
                    size='sm'
                    onClick={() => setExpiredTime(-1)}
                  >
                    {t('永不')}
                  </Button>
                </div>
              </FormField>
            </FormSection>
          </div>

          <div className='flex items-center justify-end gap-2 px-6 py-3.5'>
            <Button variant='secondary' size='sm' onClick={onClose}>
              {t('取消')}
            </Button>
            <Button size='sm' onClick={submit} disabled={submitting}>
              {submitting ? t('提交中...') : isEdit ? t('保存') : t('创建')}
            </Button>
          </div>
        </div>
      </SquircleBox>
    </div>,
    document.body,
  );
};

// ── helpers ─────────────────────────────────────────────
const useTokens = () => {
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await API.get('/api/token/?p=1&size=100');
      if (data.success) setTokens(data.data.items || []);
      else showError(data.message);
    } catch (e) {
      showError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return { tokens, loading, reload: load };
};

const StepCard = ({ num, title, desc, onClick }) => (
  <Card
    variant='elevated'
    radius='lg'
    padding='md'
    onClick={onClick}
    interactive={!!onClick}
  >
    <div
      className='text-[13px] text-ui-text-3 font-medium mb-2 tabular-nums'
    >
      {num}
    </div>
    <div className='text-[15px] font-medium text-ui-text mb-1'>{title}</div>
    <div className='text-xs text-ui-text-3 leading-relaxed'>{desc}</div>
  </Card>
);

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
      style={{
        backgroundColor: 'var(--page-bg)',
      }}
    >
      <div className='flex-1 min-w-0'>
        <div className='flex items-center gap-2 mb-1'>
          <span className='text-[15px] font-medium text-ui-text truncate'>
            {token.name || `Token #${token.id}`}
          </span>
          <IconButton icon={Pencil} size='sm' onClick={onEdit} title={t('编辑')} className='w-6 h-6' />
        </div>
        <div className='flex items-center gap-2'>
          <code className='text-[13px] font-mono text-ui-text-2 tabular-nums truncate'>
            {display}
          </code>
          <IconButton
            icon={revealed ? EyeOff : Eye}
            size='sm'
            onClick={onToggle}
            title={revealed ? t('隐藏密钥') : t('显示密钥')}
            className='w-6 h-6 flex-shrink-0'
          />
          <IconButton
            icon={Copy}
            size='sm'
            onClick={onCopy}
            title={t('复制')}
            className='w-6 h-6 flex-shrink-0'
          />
        </div>
      </div>

      <div className='flex items-start gap-6 md:gap-8'>
        <div className='min-w-0'>
          <div className='text-[11px] text-ui-text-3 mb-0.5'>{t('创建时间')}</div>
          <div className='text-[13px] text-ui-text tabular-nums whitespace-nowrap'>
            {fmtDateTime(token.created_time) || '—'}
          </div>
        </div>
        <div className='min-w-0'>
          <div className='text-[11px] text-ui-text-3 mb-0.5'>{t('最近使用时间')}</div>
          <div className='text-[13px] text-ui-text tabular-nums whitespace-nowrap'>
            {fmtDateTime(token.accessed_time) || t('从未使用')}
          </div>
        </div>
        <div className='min-w-0 hidden md:block'>
          <div className='text-[11px] text-ui-text-3 mb-0.5'>{t('额度')}</div>
          <div className='text-[13px] text-ui-text tabular-nums whitespace-nowrap'>
            {token.unlimited_quota ? (
              <span className='inline-flex items-center gap-1 text-ui-text-2'>
                <InfinityIcon size={13} />
                {t('不限')}
              </span>
            ) : (
              renderQuota(token.remain_quota)
            )}
          </div>
        </div>
      </div>

      <IconButton
        icon={Trash2}
        variant='danger'
        onClick={onDelete}
        title={t('删除')}
        className='flex-shrink-0 self-end md:self-center'
      />
    </div>
  );
};

// ── code samples ────────────────────────────────────────
// 这些示例是配置 Claude Code / Codex / Gemini CLI 等开发工具的环境变量。
// 用户登录后会自动填入选中令牌的真实 key；直接复制粘贴到终端执行即可。
const TOOL_INSTALL = {
  claude: {
    macos: `# 安装 Node.js（如已安装可跳过）
brew install node

# 安装 Claude Code
npm install -g @anthropic-ai/claude-code`,
    linux: `# 安装 Node.js（如已安装可跳过）
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs

# 安装 Claude Code
sudo npm install -g @anthropic-ai/claude-code`,
    windows: `# 在 PowerShell 中执行
# 1) 安装 Node.js（如已安装可跳过）
winget install OpenJS.NodeJS.LTS

# 2) 安装 Claude Code
npm install -g @anthropic-ai/claude-code`,
  },
  codex: {
    macos: `# 安装 Node.js（如已安装可跳过）
brew install node

# 安装 OpenAI Codex CLI
npm install -g @openai/codex`,
    linux: `# 安装 Node.js（如已安装可跳过）
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs

# 安装 OpenAI Codex CLI
sudo npm install -g @openai/codex`,
    windows: `# 在 PowerShell 中执行
# 1) 安装 Node.js（如已安装可跳过）
winget install OpenJS.NodeJS.LTS

# 2) 安装 OpenAI Codex CLI
npm install -g @openai/codex`,
  },
  gemini: {
    macos: `# 安装 Node.js（如已安装可跳过）
brew install node

# 安装 Gemini CLI
npm install -g @google/gemini-cli`,
    linux: `# 安装 Node.js（如已安装可跳过）
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs

# 安装 Gemini CLI
sudo npm install -g @google/gemini-cli`,
    windows: `# 在 PowerShell 中执行
# 1) 安装 Node.js（如已安装可跳过）
winget install OpenJS.NodeJS.LTS

# 2) 安装 Gemini CLI
npm install -g @google/gemini-cli`,
  },
};

const buildSamples = (apiBase, apiKey) => {
  const key = apiKey || 'YOUR_API_KEY';
  return {
    claude: {
      label: 'Claude Code',
      lang: 'Shell',
      hljsLang: 'bash',
      code: `export ANTHROPIC_BASE_URL="${apiBase}"
export ANTHROPIC_AUTH_TOKEN="${key}"
claude`,
    },
    codex: {
      label: 'OpenAI Codex',
      lang: 'Shell',
      hljsLang: 'bash',
      code: `export OPENAI_BASE_URL="${apiBase}/v1"
export OPENAI_API_KEY="${key}"
codex`,
    },
    gemini: {
      label: 'Gemini CLI',
      lang: 'Shell',
      hljsLang: 'bash',
      code: `export GEMINI_API_BASE="${apiBase}"
export GEMINI_API_KEY="${key}"
gemini`,
    },
  };
};

// 复制时剥离注释行（# 开头）和空行，让用户粘到终端就是干净的可执行命令。
// PowerShell 注释也是 # 开头，所以这套规则同时适用 bash/zsh/powershell。
const stripCommentsForCopy = (code) =>
  String(code || '')
    .split('\n')
    .filter((line) => {
      const t = line.trim();
      return t !== '' && !t.startsWith('#');
    })
    .join('\n');

const CodeBlock = ({ sample, t }) => {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    const ok = await copy(stripCommentsForCopy(sample.code));
    if (ok) {
      setCopied(true);
      showSuccess(t('已复制'));
      setTimeout(() => setCopied(false), 1500);
    }
  };
  const html = useMemo(() => {
    try {
      return hljs.highlight(sample.code, {
        language: sample.hljsLang,
        ignoreIllegals: true,
      }).value;
    } catch {
      return sample.code;
    }
  }, [sample.code, sample.hljsLang]);

  return (
    <div
      className='token-codeblock rounded-[28px] overflow-hidden'
      style={{ backgroundColor: '#f4f3ec' }}
    >
      <div className='flex items-center justify-between px-5 py-2.5'>
        <span className='text-[13px] text-ui-text-2 font-medium tabular-nums'>{sample.lang}</span>
        <Button
          variant='ghost'
          size='sm'
          icon={copied ? Check : Copy}
          onClick={onCopy}
        >
          {copied ? t('已复制') : t('复制')}
        </Button>
      </div>
      <pre
        className='px-5 pb-5 pt-1 text-[12.5px] leading-relaxed text-ui-text overflow-x-auto bg-transparent'
        style={{
          fontFamily: "'JetBrains Mono', 'SF Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace",
          fontVariantLigatures: 'contextual',
        }}
      >
        <code dangerouslySetInnerHTML={{ __html: html }} />
      </pre>
    </div>
  );
};

// ── main ────────────────────────────────────────────────
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

  // 当 tokens 加载完成时，默认选第一个用于示例，并预拉 key
  useEffect(() => {
    if (!tokens?.length) {
      setSampleTokenId(null);
      return;
    }
    if (sampleTokenId && tokens.some((t) => t.id === sampleTokenId)) return;
    const first = tokens[0];
    setSampleTokenId(first.id);
    if (!keyMap[first.id]) ensureKey(first.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokens]);

  // 切换示例令牌时确保对应 key 已拉取
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
    const ok = await copy(`sk-${key}`);
    if (ok) showSuccess(t('已复制'));
  };

  const onDelete = async () => {
    if (!confirmRm) return;
    try {
      const { data } = await API.delete(`/api/token/${confirmRm.id}`);
      if (data.success) {
        showSuccess(t('已删除'));
        reload();
      } else {
        showError(data.message);
      }
    } catch (e) {
      showError(e.message);
    } finally {
      setConfirmRm(null);
    }
  };

  return (
    <div
      className='px-4 pt-8 pb-6 md:px-6 md:pt-10 md:pb-8'
      style={{ backgroundColor: 'var(--page-bg)' }}
    >
      <div className='max-w-[960px] mx-auto'>
        {/* Title */}
        <h1
          className='text-2xl md:text-3xl font-medium text-ui-text mb-6'
          style={{ letterSpacing: '-0.02em' }}
        >
          {t('令牌')}
        </h1>

        {/* API keys */}
        <section className='mb-10'>
          <div className='flex items-center justify-between gap-3 mb-3 pb-3 border-b border-ui-border'>
            <h2 className='text-[15px] font-semibold text-ui-text'>API keys</h2>
            <IconButton
              icon={RefreshCw}
              size='sm'
              onClick={() => reload()}
              title={t('刷新')}
              className={loading ? '[&_svg]:animate-spin' : ''}
            />
          </div>
          <div className='flex items-start justify-between gap-4 mb-4'>
            <p className='text-xs text-ui-text-3 leading-relaxed flex-1'>
              {t('创建 API key 用以在你的应用或第三方客户端中使用 Routify 的服务，请妥善保存。不要与他人共享你的 API key，或将其暴露在浏览器或其他客户端代码中。')}
            </p>
            <Button
              variant='secondary'
              size='sm'
              icon={Plus}
              onClick={() => { setEditing(null); setEditOpen(true); }}
            >
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
          <h2 className='text-[15px] font-semibold text-ui-text mb-3 pb-3 border-b border-ui-border'>
            {t('调用示例')}
          </h2>
          <div className='flex items-end justify-between gap-3 mb-3'>
            <div className='flex-1 min-w-0'>
              <UITabs
                variant='underline'
                value={activeTab}
                onChange={setActiveTab}
                items={Object.entries(samples).map(([k, v]) => ({ value: k, label: v.label }))}
              />
            </div>
            {tokens.length > 0 && (
              <div className='flex items-center gap-2 text-xs text-ui-text-2 flex-shrink-0 pb-1'>
                <span className='text-ui-text-3'>{t('使用令牌')}</span>
                <Dropdown
                  options={tokens.map((tok) => ({
                    value: tok.id,
                    label: tok.name || `#${tok.id}`,
                  }))}
                  value={sampleTokenId}
                  onChange={setSampleTokenId}
                  placeholder={t('选择令牌')}
                  popupClassName='min-w-[180px]'
                  triggerClassName='!py-1.5 !px-2.5 !text-xs'
                />
                {!sampleKey && sampleTokenId && (
                  <span className='text-ui-text-3'>{t('加载密钥中…')}</span>
                )}
              </div>
            )}
          </div>

          {/* OS 选择 */}
          <div className='flex items-center gap-2 mb-3'>
            <span className='text-xs text-ui-text-3'>{t('操作系统')}</span>
            {[
              { v: 'macos', l: 'macOS' },
              { v: 'linux', l: 'Linux' },
              { v: 'windows', l: 'Windows' },
            ].map((os) => (
              <Button
                key={os.v}
                variant={activeOS === os.v ? 'secondary' : 'ghost'}
                size='sm'
                onClick={() => setActiveOS(os.v)}
              >
                {os.l}
              </Button>
            ))}
          </div>

          {/* 1. 安装 */}
          <div className='mb-2 text-[13px] font-medium text-ui-text-2'>
            {t('① 安装 {{tool}}', { tool: samples[activeTab].label })}
          </div>
          <div className='mb-4'>
            <CodeBlock
              sample={{
                lang: activeOS === 'windows' ? 'PowerShell' : 'Shell',
                hljsLang: activeOS === 'windows' ? 'powershell' : 'bash',
                code: TOOL_INSTALL[activeTab][activeOS],
              }}
              t={t}
            />
          </div>

          {/* 2. 配置并启动 */}
          <div className='mb-2 text-[13px] font-medium text-ui-text-2'>
            {t('② 配置并启动')}
          </div>
          <CodeBlock sample={samples[activeTab]} t={t} />
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
        danger
        onConfirm={onDelete}
        onCancel={() => setConfirmRm(null)}
      />
    </div>
  );
};

export default Tokens;
