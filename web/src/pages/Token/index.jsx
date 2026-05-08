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
        if (!group && opts[0]) setGroup(opts[0].value);
      }
    }).catch(() => {});
  }, [open]);

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

  const inputCls =
    'w-full px-3 py-2 text-sm bg-transparent border border-ui-border rounded-xl text-ui-text outline-none focus:border-ui-text-3 transition-colors';
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
                style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '-0.015em' }}
              >
                {isEdit ? t('编辑 API key') : t('创建 API key')}
              </h2>
              <p className='text-xs text-ui-text-3 mt-1'>
                {isEdit ? t('修改名称、配额或有效期') : t('为这个 API key 起一个名称')}
              </p>
            </div>
            <button
              onClick={onClose}
              className='p-1.5 -mr-1 rounded-lg text-ui-text-2 hover:text-ui-text hover:bg-ui-bg-subtle transition-colors'
            >
              <X size={16} />
            </button>
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
                  <button
                    type='button'
                    onClick={() => setExpiredTime(-1)}
                    className={`px-3 py-2 text-xs rounded-xl border whitespace-nowrap transition-colors ${
                      expiredTime === -1
                        ? 'border-ui-text-3 bg-ui-bg-subtle text-ui-text font-medium'
                        : 'border-ui-border text-ui-text-2 hover:bg-ui-bg-subtle'
                    }`}
                  >
                    {t('永不')}
                  </button>
                </div>
              </FormField>
            </FormSection>
          </div>

          <div className='flex items-center justify-end gap-2 px-6 py-3.5'>
            <button
              onClick={onClose}
              className='px-4 py-1.5 text-sm font-medium rounded-lg border border-ui-border text-ui-text hover:bg-ui-bg-subtle transition-colors'
            >
              {t('取消')}
            </button>
            <button
              onClick={submit}
              disabled={submitting}
              className='px-4 py-1.5 text-sm font-semibold rounded-lg bg-ui-accent text-ui-accent-fg hover:bg-ui-accent-hover hover:shadow-md active:scale-95 disabled:opacity-50 disabled:hover:shadow-none disabled:active:scale-100 transition-all'
            >
              {submitting ? t('提交中...') : isEdit ? t('保存') : t('创建')}
            </button>
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
  <div
    onClick={onClick}
    className={`p-4 rounded-2xl border border-ui-border bg-ui-bg-elevated transition-colors ${onClick ? 'cursor-pointer hover:bg-ui-bg-subtle' : ''}`}
  >
    <div
      className='text-[13px] text-ui-text-3 font-medium mb-2 tabular-nums'
      style={{ fontFamily: "'Space Grotesk', sans-serif" }}
    >
      {num}
    </div>
    <div className='text-[15px] font-medium text-ui-text mb-1'>{title}</div>
    <div className='text-xs text-ui-text-3 leading-relaxed'>{desc}</div>
  </div>
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
        fontFamily: "'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <div className='flex-1 min-w-0'>
        <div className='flex items-center gap-2 mb-1'>
          <span className='text-[15px] font-medium text-ui-text truncate'>
            {token.name || `Token #${token.id}`}
          </span>
          <button
            onClick={onEdit}
            title={t('编辑')}
            className='inline-flex items-center justify-center w-6 h-6 rounded-md text-ui-text-3 hover:text-ui-text hover:bg-ui-bg-subtle transition-colors'
          >
            <Pencil size={12} />
          </button>
        </div>
        <div className='flex items-center gap-2'>
          <code className='text-[13px] font-mono text-ui-text-2 tabular-nums truncate'>
            {display}
          </code>
          <button
            onClick={onToggle}
            title={revealed ? t('隐藏密钥') : t('显示密钥')}
            className='inline-flex items-center justify-center w-6 h-6 rounded-md text-ui-text-3 hover:text-ui-text hover:bg-ui-bg-subtle transition-colors flex-shrink-0'
          >
            {revealed ? <EyeOff size={12} /> : <Eye size={12} />}
          </button>
          <button
            onClick={onCopy}
            title={t('复制')}
            className='inline-flex items-center justify-center w-6 h-6 rounded-md text-ui-text-3 hover:text-ui-text hover:bg-ui-bg-subtle transition-colors flex-shrink-0'
          >
            <Copy size={12} />
          </button>
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

      <button
        onClick={onDelete}
        title={t('删除')}
        className='inline-flex items-center justify-center w-9 h-9 rounded-xl text-ui-text-3 hover:text-ui-danger hover:bg-ui-danger-bg transition-colors flex-shrink-0 self-end md:self-center'
      >
        <Trash2 size={15} />
      </button>
    </div>
  );
};

// ── code samples ────────────────────────────────────────
const buildSamples = (apiBase) => ({
  curl: {
    label: 'cURL',
    lang: 'Shell',
    hljsLang: 'bash',
    code: `curl -X POST "${apiBase}/v1/chat/completions" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "gpt-4o-mini",
    "messages": [
      { "role": "user", "content": "Hello World" }
    ],
    "stream": true,
    "temperature": 0.7
  }'`,
  },
  python: {
    label: 'Python',
    lang: 'Python',
    hljsLang: 'python',
    code: `import requests

response = requests.post(
    "${apiBase}/v1/chat/completions",
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
    },
)
print(response.text)`,
  },
  nodejs: {
    label: 'Node.js',
    lang: 'JavaScript',
    hljsLang: 'javascript',
    code: `const response = await fetch('${apiBase}/v1/chat/completions', {
  method: 'POST',
  headers: {
    Authorization: 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: 'Hello World' }],
    stream: true,
    temperature: 0.7,
  }),
});
const data = await response.json();
console.log(data);`,
  },
});

const CodeBlock = ({ sample, t }) => {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    const ok = await copy(sample.code);
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
        <button
          onClick={onCopy}
          className='inline-flex items-center gap-1 px-2 py-1 text-[12px] text-ui-text-2 hover:text-ui-text hover:bg-ui-bg-elevated rounded-md transition-colors'
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? t('已复制') : t('复制')}
        </button>
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
  const [activeTab, setActiveTab] = useState('curl');

  const apiBase = typeof window !== 'undefined' ? window.location.origin : '';
  const samples = useMemo(() => buildSamples(apiBase), [apiBase]);

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
      className='min-h-[calc(100vh-4rem)] px-4 py-6 md:px-6 md:py-8'
      style={{ backgroundColor: 'var(--page-bg)' }}
    >
      <div className='max-w-[960px] mx-auto'>
        {/* Title */}
        <h1
          className='text-2xl md:text-3xl font-medium text-ui-text mb-6'
          style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '-0.02em' }}
        >
          {t('令牌')}
        </h1>

        {/* API keys */}
        <section className='mb-10'>
          <div className='flex items-center justify-between gap-3 mb-3 pb-3 border-b border-ui-border'>
            <h2 className='text-[15px] font-semibold text-ui-text'>API keys</h2>
            <button
              onClick={() => reload()}
              title={t('刷新')}
              className='inline-flex items-center justify-center w-8 h-8 rounded-lg text-ui-text-3 hover:text-ui-text hover:bg-ui-bg-subtle transition-colors'
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
          <div className='flex items-start justify-between gap-4 mb-4'>
            <p className='text-xs text-ui-text-3 leading-relaxed flex-1'>
              {t('创建 API key 用以在你的应用或第三方客户端中使用 Routify 的服务，请妥善保存。不要与他人共享你的 API key，或将其暴露在浏览器或其他客户端代码中。')}
            </p>
            <button
              onClick={() => { setEditing(null); setEditOpen(true); }}
              className='inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-ui-border text-ui-text hover:bg-ui-bg-subtle transition-colors whitespace-nowrap'
            >
              <Plus size={13} />
              {t('创建 API key')}
            </button>
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
          <div className='flex items-center gap-1 mb-3 border-b border-ui-border'>
            {Object.entries(samples).map(([k, v]) => (
              <button
                key={k}
                onClick={() => setActiveTab(k)}
                className={`px-3 py-2 text-sm transition-colors -mb-px border-b-2 ${
                  activeTab === k
                    ? 'border-ui-text text-ui-text font-medium'
                    : 'border-transparent text-ui-text-2 hover:text-ui-text'
                }`}
              >
                {v.label}
              </button>
            ))}
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
