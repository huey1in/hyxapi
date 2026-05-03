/*
Copyright (C) 2025 QuantumNous

Tokens management — minimal modern table with full feature parity.
*/

import React, { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import {
  Plus, Search, RefreshCw, Eye, EyeOff, Copy, Pencil, Trash2,
  X, Infinity as InfinityIcon, ChevronDown, Check,
} from 'lucide-react';
import {
  API,
  showError,
  showSuccess,
  copy,
  renderQuota,
  timestamp2string,
} from '../../helpers';
import Pagination from '../../components/common/table/Pagination';
import ConfirmDialog from '../../components/common/ConfirmDialog';

const PAGE_SIZE = 20;

// ── status badge ────────────────────────────────────────
const StatusBadge = ({ status, t }) => {
  const map = {
    1: { label: t('启用'), color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
    2: { label: t('禁用'), color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
    3: { label: t('过期'), color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
    4: { label: t('耗尽'), color: '#a3a3a3', bg: 'rgba(163,163,163,0.18)' },
  };
  const info = map[status] || { label: t('未知'), color: '#a3a3a3', bg: 'rgba(163,163,163,0.18)' };
  return (
    <span
      className='inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium'
      style={{ background: info.bg, color: info.color }}
    >
      <span className='w-1.5 h-1.5 rounded-full' style={{ background: info.color }} />
      {info.label}
    </span>
  );
};

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

// ── multi-select chip ───────────────────────────────────
const MultiSelect = ({ options, value = [], onChange, placeholder, emptyText }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);
  const toggle = (v) => {
    const next = value.includes(v) ? value.filter((x) => x !== v) : [...value, v];
    onChange(next);
  };
  return (
    <div className='relative' ref={ref}>
      <button
        type='button'
        onClick={() => setOpen((o) => !o)}
        className='w-full flex items-center justify-between gap-2 px-3 py-2 text-sm bg-ui-bg border border-ui-border rounded-lg text-ui-text hover:bg-ui-bg-subtle transition-colors'
      >
        <span className='truncate text-left flex-1'>
          {value.length === 0
            ? <span className='text-ui-text-3'>{placeholder}</span>
            : `${value.length} 项`}
        </span>
        <ChevronDown size={14} className='text-ui-text-3 flex-shrink-0' />
      </button>
      {open && (
        <div className='absolute left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-ui-bg-elevated border border-ui-border rounded-lg shadow-lg py-1 z-30'>
          {options.length === 0 ? (
            <div className='px-3 py-2 text-xs text-ui-text-3'>{emptyText}</div>
          ) : (
            options.map((o) => (
              <button
                type='button'
                key={o}
                onClick={() => toggle(o)}
                className='flex items-center justify-between w-full px-3 py-1.5 text-xs text-ui-text hover:bg-ui-bg-subtle text-left'
              >
                <span className='truncate'>{o}</span>
                {value.includes(o) && <Check size={13} className='text-ui-brand flex-shrink-0' />}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};

// ── single-select dropdown ──────────────────────────────
const Select = ({ options, value, onChange, placeholder }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);
  const list = options.map((o) => typeof o === 'string' ? { label: o, value: o } : o);
  const current = list.find((o) => o.value === value);
  return (
    <div className='relative' ref={ref}>
      <button
        type='button'
        onClick={() => setOpen((o) => !o)}
        className='w-full flex items-center justify-between gap-2 px-3 py-2 text-sm bg-ui-bg border border-ui-border rounded-lg text-ui-text hover:bg-ui-bg-subtle transition-colors'
      >
        <span className='truncate text-left flex-1'>
          {current?.label || <span className='text-ui-text-3'>{placeholder}</span>}
        </span>
        <ChevronDown size={14} className='text-ui-text-3 flex-shrink-0' />
      </button>
      {open && (
        <div className='absolute left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-ui-bg-elevated border border-ui-border rounded-lg shadow-lg py-1 z-30'>
          {list.map((o) => (
            <button
              type='button'
              key={o.value}
              onClick={() => { onChange(o.value); setOpen(false); }}
              className={`flex w-full px-3 py-1.5 text-xs text-left transition-colors ${
                value === o.value ? 'bg-ui-bg-subtle text-ui-text font-semibold' : 'text-ui-text hover:bg-ui-bg-subtle'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ── data hook ───────────────────────────────────────────
const useTokensList = () => {
  const [tokens, setTokens] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [tokenSearch, setTokenSearch] = useState('');

  const load = async (p = 1, kw = keyword, tk = tokenSearch) => {
    setLoading(true);
    try {
      const url = (kw || tk)
        ? `/api/token/search?keyword=${encodeURIComponent(kw)}&token=${encodeURIComponent(tk)}&p=${p}&size=${PAGE_SIZE}`
        : `/api/token/?p=${p}&size=${PAGE_SIZE}`;
      const { data } = await API.get(url);
      if (data.success) {
        setTokens(data.data.items || []);
        setTotal(data.data.total || 0);
        setPage(data.data.page || p);
      } else {
        showError(data.message);
      }
    } catch (e) {
      showError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(1); }, []);

  return {
    tokens, total, page, loading,
    keyword, setKeyword, tokenSearch, setTokenSearch,
    load, setPage,
  };
};

// ── edit modal ──────────────────────────────────────────
const TokenFormModal = ({ open, token, onClose, onSaved, t }) => {
  const isEdit = !!token?.id;
  const [name, setName] = useState('');
  const [unlimitedQuota, setUnlimitedQuota] = useState(false);
  const [remainQuota, setRemainQuota] = useState(500000);
  const [expiredTime, setExpiredTime] = useState(-1);
  const [group, setGroup] = useState('');
  const [crossGroupRetry, setCrossGroupRetry] = useState(false);
  const [modelLimitsEnabled, setModelLimitsEnabled] = useState(false);
  const [modelLimits, setModelLimits] = useState([]);
  const [allowIps, setAllowIps] = useState('');
  const [tokenCount, setTokenCount] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  const [groupOptions, setGroupOptions] = useState([]);
  const [modelOptions, setModelOptions] = useState([]);

  useEffect(() => {
    if (!open) return;
    setName(token?.name || '');
    setUnlimitedQuota(token?.unlimited_quota ?? false);
    setRemainQuota(token?.remain_quota ?? 500000);
    setExpiredTime(token?.expired_time ?? -1);
    setGroup(token?.group || '');
    setCrossGroupRetry(token?.cross_group_retry || false);
    setModelLimitsEnabled(token?.model_limits_enabled || false);
    setModelLimits(token?.model_limits ? token.model_limits.split(',').filter(Boolean) : []);
    setAllowIps(token?.allow_ips || '');
    setTokenCount(1);
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
    API.get('/api/user/models').then((res) => {
      if (res.data.success && Array.isArray(res.data.data)) {
        setModelOptions(res.data.data);
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
        cross_group_retry: crossGroupRetry,
        model_limits_enabled: modelLimitsEnabled,
        model_limits: modelLimits.join(','),
        allow_ips: allowIps,
      };
      let res;
      if (isEdit) {
        res = await API.put('/api/token/', { ...payload, id: token.id });
      } else {
        const count = Math.max(1, Math.min(100, Number(tokenCount) || 1));
        res = await API.post('/api/token/', { ...payload, count });
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
    'w-full px-3 py-2 text-sm bg-ui-bg border border-ui-border rounded-lg text-ui-text outline-none focus:border-ui-text-3 transition-colors';
  const Field = ({ label, children, hint }) => (
    <div>
      <label className='block text-xs font-medium text-ui-text-2 mb-1.5'>{label}</label>
      {children}
      {hint && <p className='mt-1 text-[11px] text-ui-text-3'>{hint}</p>}
    </div>
  );
  const Switch = ({ checked, onChange, label }) => (
    <label className='flex items-center justify-between gap-3 text-xs text-ui-text-2 cursor-pointer select-none'>
      <span>{label}</span>
      <span
        role='switch'
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className='relative inline-block w-9 h-5 rounded-full transition-colors flex-shrink-0'
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
    </label>
  );

  return createPortal(
    <div
      className='fixed inset-0 z-[150] flex items-start md:items-center justify-center p-4 overflow-y-auto'
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div
        className='bg-ui-bg-elevated border border-ui-border rounded-2xl shadow-2xl w-full max-w-lg my-8 overflow-hidden'
        onClick={(e) => e.stopPropagation()}
      >
        <div className='flex items-center justify-between px-5 py-3.5 border-b border-ui-border'>
          <span className='text-sm font-semibold text-ui-text'>
            {isEdit ? t('编辑令牌') : t('新建令牌')}
          </span>
          <button onClick={onClose} className='p-1 rounded text-ui-text-2 hover:text-ui-text hover:bg-ui-bg-subtle'>
            <X size={16} />
          </button>
        </div>

        <div className='p-5 space-y-4 max-h-[70vh] overflow-y-auto'>
          <Field label={t('名称')}>
            <input
              type='text'
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('给令牌起个名字')}
              className={`${inputCls} placeholder:text-ui-text-3`}
              autoFocus
            />
          </Field>

          {!isEdit && (
            <Field label={t('批量创建数量')} hint={t('一次最多创建 100 个')}>
              <input
                type='number'
                min={1}
                max={100}
                value={tokenCount}
                onChange={(e) => setTokenCount(e.target.value)}
                className={inputCls}
              />
            </Field>
          )}

          <Field label={t('分组')}>
            <Select
              options={groupOptions}
              value={group}
              onChange={setGroup}
              placeholder={t('选择分组')}
            />
          </Field>

          <Switch
            checked={crossGroupRetry}
            onChange={setCrossGroupRetry}
            label={t('开启跨分组重试（仅 auto 分组生效）')}
          />

          <div>
            <Switch
              checked={unlimitedQuota}
              onChange={setUnlimitedQuota}
              label={t('不限额度')}
            />
            {!unlimitedQuota && (
              <input
                type='number'
                value={remainQuota}
                onChange={(e) => setRemainQuota(e.target.value)}
                placeholder='500000'
                className={`${inputCls} mt-2`}
              />
            )}
          </div>

          <Field label={t('过期时间')} hint={t('留空表示永不过期')}>
            <div className='flex gap-2'>
              <input
                type='datetime-local'
                value={toLocalInput(expiredTime)}
                onChange={(e) => setExpiredTime(toUnix(e.target.value) || -1)}
                className={inputCls}
              />
              <button
                type='button'
                onClick={() => setExpiredTime(-1)}
                className='px-3 py-2 text-xs rounded-lg border border-ui-border text-ui-text-2 hover:bg-ui-bg-subtle whitespace-nowrap'
              >
                {t('永不')}
              </button>
            </div>
          </Field>

          <div>
            <Switch
              checked={modelLimitsEnabled}
              onChange={setModelLimitsEnabled}
              label={t('启用模型限制')}
            />
            {modelLimitsEnabled && (
              <div className='mt-2'>
                <MultiSelect
                  options={modelOptions}
                  value={modelLimits}
                  onChange={setModelLimits}
                  placeholder={t('未选择模型')}
                  emptyText={t('暂无可用模型')}
                />
              </div>
            )}
          </div>

          <Field label={t('IP 白名单')} hint={t('每行一个 IP / CIDR，留空不限制')}>
            <textarea
              value={allowIps}
              onChange={(e) => setAllowIps(e.target.value)}
              rows={3}
              placeholder='192.168.1.1&#10;10.0.0.0/24'
              className={`${inputCls} placeholder:text-ui-text-3 resize-none font-mono text-xs`}
            />
          </Field>
        </div>

        <div className='flex justify-end gap-2 px-5 py-3 border-t border-ui-border'>
          <button
            onClick={onClose}
            className='px-3.5 py-1.5 text-sm font-medium rounded-lg border border-ui-border text-ui-text hover:bg-ui-bg-subtle transition-colors'
          >
            {t('取消')}
          </button>
          <button
            onClick={submit}
            disabled={submitting}
            className='px-3.5 py-1.5 text-sm font-semibold rounded-lg bg-ui-accent text-ui-accent-fg hover:bg-ui-accent-hover disabled:opacity-50 transition-colors'
          >
            {submitting ? t('提交中...') : t('保存')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

// ── main view ───────────────────────────────────────────
const TokensView = () => {
  const { t } = useTranslation();
  const list = useTokensList();
  const [revealed, setRevealed] = useState({});
  const [keys, setKeys] = useState({});
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirm, setConfirm] = useState(null); // {ids[], names[]}
  const [selected, setSelected] = useState(new Set());

  const toggleSelect = (id) => {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };
  const toggleSelectAll = () => {
    setSelected((s) => {
      if (s.size === list.tokens.length) return new Set();
      return new Set(list.tokens.map((t) => t.id));
    });
  };

  const onSearch = (e) => { e.preventDefault(); list.load(1); };

  const toggleReveal = async (token) => {
    const id = token.id;
    if (revealed[id]) { setRevealed((r) => ({ ...r, [id]: false })); return; }
    if (keys[id]) { setRevealed((r) => ({ ...r, [id]: true })); return; }
    try {
      const { data } = await API.get(`/api/token/key/${id}`);
      if (data.success && data.data) {
        setKeys((k) => ({ ...k, [id]: data.data }));
        setRevealed((r) => ({ ...r, [id]: true }));
      } else {
        showError(data.message || t('获取密钥失败'));
      }
    } catch (e) {
      showError(e.message);
    }
  };

  const copyKey = async (token) => {
    try {
      const { data } = await API.get(`/api/token/key/${token.id}`);
      if (data.success && data.data) {
        const ok = await copy(`sk-${data.data}`);
        if (ok) showSuccess(t('已复制'));
      }
    } catch (e) { showError(e.message); }
  };

  const removeMany = async () => {
    if (!confirm) return;
    try {
      for (const id of confirm.ids) {
        await API.delete(`/api/token/${id}`);
      }
      showSuccess(t('已删除'));
      setSelected(new Set());
      list.load(list.page);
    } catch (e) {
      showError(e.message);
    } finally {
      setConfirm(null);
    }
  };

  const batchCopy = async () => {
    if (selected.size === 0) { showError(t('请至少选择一个令牌')); return; }
    try {
      let content = '';
      for (const id of selected) {
        const tk = list.tokens.find((t) => t.id === id);
        if (!tk) continue;
        const { data } = await API.get(`/api/token/key/${id}`);
        if (data.success && data.data) {
          content += `${tk.name}\tsk-${data.data}\n`;
        }
      }
      if (content) {
        const ok = await copy(content.trim());
        if (ok) showSuccess(t('已复制 {{n}} 个令牌').replace('{{n}}', selected.size));
      }
    } catch (e) {
      showError(e.message);
    }
  };

  const fmtKey = (token) => {
    if (!revealed[token.id]) return '••••••••••••';
    const k = keys[token.id];
    return k ? `sk-${k}` : '••••••••••••';
  };

  const fmtTs = (ts) => {
    if (!ts || ts === -1) return null;
    return timestamp2string(ts);
  };

  const cols = [
    '', t('名称'), t('状态'), t('密钥'), t('已用 / 总额度'),
    t('分组'), t('创建时间'), t('最后使用'), t('过期时间'), '',
  ];

  return (
    <div className='min-h-[calc(100vh-4rem)] mt-16 px-4 py-5 md:px-6 md:py-6 bg-ui-bg'>
      {/* Header */}
      <div className='flex items-center justify-between gap-3 mb-5'>
        <h1
          className='text-2xl md:text-3xl font-medium text-ui-text'
          style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '-0.02em' }}
        >
          {t('令牌管理')}
        </h1>
        <button
          onClick={() => { setEditing(null); setEditOpen(true); }}
          className='inline-flex items-center gap-1.5 px-3.5 py-1.5 text-sm font-semibold rounded-lg bg-ui-accent text-ui-accent-fg hover:bg-ui-accent-hover transition-colors'
        >
          <Plus size={14} />
          {t('新建令牌')}
        </button>
      </div>

      {/* Toolbar */}
      <div className='flex flex-col md:flex-row md:items-center gap-2 mb-4'>
        <form onSubmit={onSearch} className='flex flex-1 gap-2'>
          <div className='relative flex-1 max-w-xs'>
            <Search size={14} className='absolute left-3 top-1/2 -translate-y-1/2 text-ui-text-3' />
            <input
              type='text'
              value={list.keyword}
              onChange={(e) => list.setKeyword(e.target.value)}
              placeholder={t('按名称搜索')}
              className='w-full pl-9 pr-3 py-2 text-sm bg-ui-bg-elevated border border-ui-border rounded-lg text-ui-text placeholder:text-ui-text-3 outline-none focus:border-ui-text-3'
            />
          </div>
          <div className='relative flex-1 max-w-xs'>
            <Search size={14} className='absolute left-3 top-1/2 -translate-y-1/2 text-ui-text-3' />
            <input
              type='text'
              value={list.tokenSearch}
              onChange={(e) => list.setTokenSearch(e.target.value)}
              placeholder={t('按密钥搜索')}
              className='w-full pl-9 pr-3 py-2 text-sm bg-ui-bg-elevated border border-ui-border rounded-lg text-ui-text placeholder:text-ui-text-3 outline-none focus:border-ui-text-3'
            />
          </div>
        </form>
        <div className='flex items-center gap-1 ml-auto'>
          {selected.size > 0 && (
            <>
              <span className='text-xs text-ui-text-2 mr-2'>{t('已选')} {selected.size}</span>
              <button
                onClick={batchCopy}
                className='px-2.5 py-1.5 text-xs font-medium rounded-lg border border-ui-border text-ui-text hover:bg-ui-bg-subtle transition-colors'
              >
                {t('批量复制')}
              </button>
              <button
                onClick={() => setConfirm({
                  ids: Array.from(selected),
                  names: list.tokens.filter((tk) => selected.has(tk.id)).map((tk) => tk.name),
                })}
                className='px-2.5 py-1.5 text-xs font-medium rounded-lg text-ui-danger hover:bg-ui-danger-bg transition-colors'
              >
                {t('批量删除')}
              </button>
            </>
          )}
          <button
            onClick={() => list.load(list.page)}
            className='inline-flex items-center justify-center w-9 h-9 rounded-lg text-ui-text-2 hover:text-ui-text hover:bg-ui-bg-subtle transition-colors'
            title={t('刷新')}
          >
            <RefreshCw size={14} className={list.loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className='bg-ui-bg-elevated border border-ui-border rounded-xl overflow-hidden'>
        <div className='overflow-x-auto'>
          <table className='w-full text-sm'>
            <thead>
              <tr className='border-b border-ui-border bg-ui-bg-subtle/50'>
                <th className='px-4 py-3 w-8'>
                  <input
                    type='checkbox'
                    checked={list.tokens.length > 0 && selected.size === list.tokens.length}
                    onChange={toggleSelectAll}
                    className='rounded border-ui-border'
                  />
                </th>
                {cols.slice(1).map((h, i) => (
                  <th
                    key={i}
                    className='text-left text-[11px] uppercase tracking-wider font-medium text-ui-text-3 px-4 py-3 whitespace-nowrap'
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.loading && list.tokens.length === 0 ? (
                <tr><td colSpan={cols.length} className='py-12 text-center text-ui-text-3 text-sm'>{t('加载中...')}</td></tr>
              ) : list.tokens.length === 0 ? (
                <tr><td colSpan={cols.length} className='py-12 text-center text-ui-text-3 text-sm'>{t('暂无令牌')}</td></tr>
              ) : (
                list.tokens.map((token) => (
                  <tr
                    key={token.id}
                    className='border-b border-ui-divider last:border-b-0 hover:bg-ui-bg-subtle/30 transition-colors'
                  >
                    <td className='px-4 py-3'>
                      <input
                        type='checkbox'
                        checked={selected.has(token.id)}
                        onChange={() => toggleSelect(token.id)}
                        className='rounded border-ui-border'
                      />
                    </td>
                    <td className='px-4 py-3 text-ui-text font-medium'>{token.name}</td>
                    <td className='px-4 py-3'><StatusBadge status={token.status} t={t} /></td>
                    <td className='px-4 py-3'>
                      <code className='text-xs font-mono text-ui-text-2'>{fmtKey(token)}</code>
                    </td>
                    <td className='px-4 py-3 text-ui-text tabular-nums whitespace-nowrap'>
                      {token.unlimited_quota ? (
                        <span className='inline-flex items-center gap-1'>
                          <InfinityIcon size={14} className='text-ui-text-3' />
                          <span className='text-ui-text-3'>{t('不限')}</span>
                        </span>
                      ) : (
                        <>
                          <span className='text-ui-text-2'>{renderQuota(token.used_quota)}</span>
                          <span className='text-ui-text-3 mx-1'>/</span>
                          <span>{renderQuota(token.remain_quota)}</span>
                        </>
                      )}
                    </td>
                    <td className='px-4 py-3 text-ui-text-2 text-xs'>
                      {token.group || <span className='text-ui-text-3'>—</span>}
                    </td>
                    <td className='px-4 py-3 text-ui-text-2 text-xs whitespace-nowrap'>
                      {timestamp2string(token.created_time)}
                    </td>
                    <td className='px-4 py-3 text-ui-text-2 text-xs whitespace-nowrap'>
                      {fmtTs(token.accessed_time) || <span className='text-ui-text-3'>—</span>}
                    </td>
                    <td className='px-4 py-3 text-ui-text-2 text-xs whitespace-nowrap'>
                      {fmtTs(token.expired_time) || <span className='text-ui-text-3'>{t('永不')}</span>}
                    </td>
                    <td className='px-4 py-3'>
                      <div className='flex items-center gap-0.5 justify-end'>
                        <button onClick={() => toggleReveal(token)} title={revealed[token.id] ? t('隐藏密钥') : t('显示密钥')}
                          className='p-1.5 rounded text-ui-text-3 hover:text-ui-text hover:bg-ui-bg-subtle transition-colors'>
                          {revealed[token.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                        <button onClick={() => copyKey(token)} title={t('复制密钥')}
                          className='p-1.5 rounded text-ui-text-3 hover:text-ui-text hover:bg-ui-bg-subtle transition-colors'>
                          <Copy size={14} />
                        </button>
                        <button onClick={() => { setEditing(token); setEditOpen(true); }} title={t('编辑')}
                          className='p-1.5 rounded text-ui-text-3 hover:text-ui-text hover:bg-ui-bg-subtle transition-colors'>
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => setConfirm({ ids: [token.id], names: [token.name] })} title={t('删除')}
                          className='p-1.5 rounded text-ui-text-3 hover:text-ui-danger hover:bg-ui-danger-bg transition-colors'>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {list.tokens.length > 0 && (
          <Pagination
            page={list.page} pageSize={PAGE_SIZE} total={list.total}
            onChange={(p) => list.load(p)}
          />
        )}
      </div>

      <TokenFormModal
        open={editOpen} token={editing}
        onClose={() => setEditOpen(false)}
        onSaved={() => { setEditOpen(false); list.load(editing ? list.page : 1); }}
        t={t}
      />

      <ConfirmDialog
        open={!!confirm}
        title={confirm?.ids.length > 1 ? t('批量删除令牌') : t('删除令牌')}
        description={confirm?.ids.length > 1
          ? t('确认删除 {{n}} 个令牌？此操作不可恢复。').replace('{{n}}', confirm?.ids.length || 0)
          : t('确认删除令牌 “{{name}}”？此操作不可恢复。').replace('{{name}}', confirm?.names?.[0] || '')
        }
        confirmText={t('删除')}
        cancelText={t('取消')}
        danger
        onConfirm={removeMany}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
};

export default TokensView;
