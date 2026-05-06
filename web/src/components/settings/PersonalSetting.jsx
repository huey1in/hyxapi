/*
Copyright (C) 2025 QuantumNous

Modern minimalist personal-settings page.
*/

import React, { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import {
  Copy, Check, RefreshCw, X, ChevronRight, ChevronDown, ShieldAlert,
} from 'lucide-react';
import {
  API, copy, showError, showInfo, showSuccess,
  setStatusData, setUserData, isRoot, isAdmin, renderQuota,
} from '../../helpers';
import { UserContext } from '../../context/User';
import { normalizeLanguage } from '../../i18n/language';

// ── atoms ───────────────────────────────────────────────

const Card = ({ title, icon: Icon, action, children, className = '', bodyClass = 'p-5' }) => (
  <div
    className={`border border-ui-border rounded-[28px] ${className}`}
    style={{ backgroundColor: 'var(--page-bg)' }}
  >
    {(title || action) && (
      <div className='flex items-center justify-between gap-3 px-5 py-3.5'>
        {title && (
          <div className='flex items-center gap-2 text-sm font-semibold text-ui-text'>
            {Icon && <Icon size={15} className='text-ui-text-3' />}
            {title}
          </div>
        )}
        {action}
      </div>
    )}
    <div className={bodyClass}>{children}</div>
  </div>
);

const inputCls =
  'w-full px-3 py-2 text-sm bg-transparent border border-ui-border rounded-xl text-ui-text placeholder:text-ui-text-3 outline-none focus:border-ui-text-3 transition-colors';

const PrimaryBtn = ({ children, ...props }) => (
  <button
    {...props}
    className={`inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg bg-ui-accent text-ui-accent-fg hover:bg-ui-accent-hover hover:shadow-md active:scale-95 disabled:opacity-50 disabled:hover:shadow-none disabled:active:scale-100 transition-all whitespace-nowrap ${props.className || ''}`}
  >
    {children}
  </button>
);

const GhostBtn = ({ children, ...props }) => (
  <button
    {...props}
    className={`inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-md border border-ui-border text-ui-text-2 hover:text-ui-text hover:bg-ui-bg-subtle transition-colors whitespace-nowrap ${props.className || ''}`}
  >
    {children}
  </button>
);

const DangerBtn = ({ children, ...props }) => (
  <button
    {...props}
    className={`inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-md border border-ui-danger/40 text-ui-danger hover:bg-ui-danger-bg transition-colors whitespace-nowrap ${props.className || ''}`}
  >
    {children}
  </button>
);

const Row = ({ icon: Icon, title, desc, children }) => (
  <div className='flex items-center justify-between gap-4 px-5 py-3.5 border-b border-ui-divider last:border-b-0'>
    <div className='flex items-start gap-3 min-w-0'>
      {Icon && (
        <div className='w-8 h-8 rounded-md bg-ui-bg-subtle border border-ui-border flex items-center justify-center flex-shrink-0 mt-0.5'>
          <Icon size={14} className='text-ui-text-2' />
        </div>
      )}
      <div className='min-w-0'>
        <div className='text-sm font-medium text-ui-text'>{title}</div>
        {desc && <div className='text-xs text-ui-text-3 mt-0.5 truncate'>{desc}</div>}
      </div>
    </div>
    <div className='flex items-center gap-2 flex-shrink-0'>{children}</div>
  </div>
);

const Field = ({ label, children, hint }) => (
  <div>
    <label className='block text-xs font-medium text-ui-text-2 mb-1.5'>{label}</label>
    {children}
    {hint && <p className='mt-1 text-[11px] text-ui-text-3'>{hint}</p>}
  </div>
);

// ── modal shell ─────────────────────────────────────────

const ModalShell = ({ open, title, onClose, children, footer, max = 'max-w-md' }) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose();
    const ov = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = ov;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);
  if (!open || typeof document === 'undefined') return null;
  return createPortal(
    <div
      className='fixed inset-0 z-[100] flex items-center justify-center p-4'
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div
        className={`border border-ui-border rounded-2xl shadow-2xl w-full ${max} overflow-hidden`}
        style={{ backgroundColor: 'var(--page-bg)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className='flex items-center justify-between px-5 py-3.5'>
          <span className='text-sm font-semibold text-ui-text'>{title}</span>
          <button onClick={onClose} className='p-1 rounded text-ui-text-2 hover:text-ui-text hover:bg-ui-bg-subtle'>
            <X size={16} />
          </button>
        </div>
        <div className='p-5'>{children}</div>
        {footer && (
          <div className='flex justify-end gap-2 px-5 py-3'>{footer}</div>
        )}
      </div>
    </div>,
    document.body,
  );
};

// ── language options ────────────────────────────────────

const languageOptions = [
  { value: 'zh-CN', label: '简体中文' },
  { value: 'en', label: 'English' },
];

// ── compact dropdown (LanguageSelector style) ───────────

const PrefDropdown = ({ value, options, onChange }) => {
  const [open, setOpen] = useState(false);
  const ref = React.useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const current = options.find((o) => o.value === value);

  return (
    <div className='relative' ref={ref}>
      <button
        type='button'
        onClick={() => setOpen((o) => !o)}
        className='inline-flex items-center justify-between gap-2 min-w-[140px] px-3 py-1.5 text-xs bg-transparent border border-ui-border rounded-xl text-ui-text hover:border-ui-text-3 transition-colors'
      >
        <span className='truncate'>{current?.label || ''}</span>
        <ChevronDown
          size={12}
          className={`text-ui-text-3 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div
          className='absolute right-0 mt-2 w-44 border border-ui-border rounded-2xl shadow-xl overflow-hidden z-50 animate-dropdown'
          style={{ backgroundColor: 'var(--page-bg)' }}
        >
          <div className='px-2 py-2 flex flex-col gap-0.5 max-h-72 overflow-y-auto'>
            {options.map((o) => {
              const sel = value === o.value;
              return (
                <button
                  key={o.value}
                  type='button'
                  onClick={() => { onChange(o.value); setOpen(false); }}
                  className={`flex items-center justify-between w-full px-3 py-2 rounded-xl text-xs transition-colors ${
                    sel
                      ? 'bg-ui-bg-subtle text-ui-text font-medium'
                      : 'text-ui-text hover:bg-ui-bg-subtle'
                  }`}
                >
                  <span className='truncate'>{o.label}</span>
                  {sel && (
                    <svg width='12' height='12' viewBox='0 0 14 14' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' className='flex-shrink-0'>
                      <path d='M2 7l3.5 3.5 6.5-7' />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

// ── main page ───────────────────────────────────────────

const PersonalSetting = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [userState, userDispatch] = useContext(UserContext);

  const [status, setStatus] = useState({});
  const [systemToken, setSystemToken] = useState('');
  const [tokenCopied, setTokenCopied] = useState(false);

  const [showEmail, setShowEmail] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  const [currentLanguage, setCurrentLanguage] = useState(
    normalizeLanguage(i18n.language) || 'zh-CN',
  );

  // load status
  useEffect(() => {
    const saved = localStorage.getItem('status');
    if (saved) {
      try {
        setStatus(JSON.parse(saved));
      } catch {}
    }
    (async () => {
      try {
        const res = await API.get('/api/status');
        if (res.data?.success && res.data.data) {
          setStatus(res.data.data);
          setStatusData(res.data.data);
        }
      } catch {}
    })();
    refreshUser();
  }, []);

  // sync language
  useEffect(() => {
    if (!userState?.user?.setting) return;
    try {
      const s = JSON.parse(userState.user.setting);
      if (s.language) {
        const lang = normalizeLanguage(s.language);
        setCurrentLanguage(lang);
        if (i18n.language !== lang) i18n.changeLanguage(lang);
      }
    } catch {}
  }, [userState?.user?.setting]);

  const refreshUser = async () => {
    try {
      const res = await API.get('/api/user/self');
      if (res.data?.success) {
        userDispatch({ type: 'login', payload: res.data.data });
        setUserData(res.data.data);
      }
    } catch (e) {
      showError(e.message);
    }
  };

  const generateSystemToken = async () => {
    try {
      const res = await API.get('/api/user/token');
      const { success, message, data } = res.data;
      if (success) {
        setSystemToken(data);
        await copy(data);
        setTokenCopied(true);
        setTimeout(() => setTokenCopied(false), 1800);
        showSuccess(t('令牌已重置并已复制到剪贴板'));
      } else {
        showError(message);
      }
    } catch (e) {
      showError(e.message);
    }
  };

  const copySystemToken = async () => {
    if (!systemToken) return;
    if (await copy(systemToken)) {
      setTokenCopied(true);
      setTimeout(() => setTokenCopied(false), 1800);
      showSuccess(t('已复制到剪贴板'));
    }
  };

  const handleLanguageChange = async (lang) => {
    if (lang === currentLanguage) return;
    const prev = currentLanguage;
    setCurrentLanguage(lang);
    i18n.changeLanguage(lang);
    localStorage.setItem('i18nextLng', lang);
    try {
      const res = await API.put('/api/user/self', { language: lang });
      if (res.data.success) {
        showSuccess(t('语言偏好已保存'));
        let s = {};
        try { s = JSON.parse(userState.user?.setting || '{}'); } catch {}
        s.language = lang;
        const next = { ...userState.user, setting: JSON.stringify(s) };
        userDispatch({ type: 'login', payload: next });
        localStorage.setItem('user', JSON.stringify(next));
      } else {
        setCurrentLanguage(prev);
        i18n.changeLanguage(prev);
        showError(res.data.message || t('保存失败'));
      }
    } catch {
      setCurrentLanguage(prev);
      i18n.changeLanguage(prev);
      showError(t('保存失败，请重试'));
    }
  };

  const saveNotif_REMOVED = null;

  const u = userState?.user || {};
  const username = u.username || '';
  const initials = username ? username.slice(0, 2).toUpperCase() : 'NA';
  const roleLabel = isRoot() ? t('超级管理员') : isAdmin() ? t('管理员') : t('普通用户');

  return (
    <div
      className='min-h-[calc(100vh-4rem)] px-4 py-6 md:px-6 md:py-8'
      style={{ backgroundColor: 'var(--page-bg)' }}
    >
      <div className='max-w-[960px] mx-auto'>
        {/* Header */}
        <div className='flex items-center justify-between gap-3 mb-5'>
          <h1
            className='text-2xl md:text-3xl font-medium text-ui-text'
            style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '-0.02em' }}
          >
            {t('个人设置')}
          </h1>
        </div>

        {/* Hero */}
        <div
          className='relative overflow-hidden border border-ui-border rounded-[28px] p-6 md:p-7 mb-5'
          style={{ backgroundColor: 'var(--page-bg)' }}
        >
          <div className='relative z-10 flex flex-col md:flex-row md:items-center gap-5'>
            <div className='flex-1 min-w-0'>
              <div
                className='text-2xl md:text-3xl font-medium text-ui-text truncate'
                style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '-0.02em' }}
              >
                {username}
              </div>
              <div className='flex flex-wrap items-center gap-1.5 mt-2'>
                <span className='inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded-md bg-ui-bg-subtle border border-ui-border text-ui-text-2'>
                  {roleLabel}
                </span>
              </div>
            </div>
            <div className='flex items-center gap-6 md:border-l md:border-ui-divider md:pl-6'>
              <div>
                <div className='text-[11px] uppercase tracking-wider text-ui-text-3 mb-1'>{t('当前余额')}</div>
                <div className='text-xl font-medium text-ui-text tabular-nums'>{renderQuota(u.quota)}</div>
              </div>
              <div className='hidden sm:block'>
                <div className='text-[11px] uppercase tracking-wider text-ui-text-3 mb-1'>{t('历史消耗')}</div>
                <div className='text-xl font-medium text-ui-text-2 tabular-nums'>{renderQuota(u.used_quota)}</div>
              </div>
            </div>
          </div>
        </div>

        <div className='space-y-4'>
          <Card title={t('账户管理')} bodyClass='p-0'>
            <Row title={t('邮箱地址')} desc={u.email || t('未绑定')}>
              <GhostBtn onClick={() => setShowEmail(true)}>
                {u.email ? t('更换') : t('绑定')}
                <ChevronRight size={12} />
              </GhostBtn>
            </Row>
            <Row title={t('登录密码')} desc={t('定期更换密码可提升账号安全')}>
              <GhostBtn onClick={() => setShowPwd(true)}>
                {t('修改')}
                <ChevronRight size={12} />
              </GhostBtn>
            </Row>
            <Row title={t('系统访问令牌')} desc={t('用于调用本系统管理 API（非业务令牌）')}>
              {systemToken ? (
                <GhostBtn onClick={copySystemToken}>
                  {tokenCopied ? <Check size={12} /> : <Copy size={12} />}
                  {tokenCopied ? t('已复制') : t('复制')}
                </GhostBtn>
              ) : null}
              <GhostBtn onClick={generateSystemToken}>
                <RefreshCw size={12} />
                {systemToken ? t('重置') : t('生成')}
              </GhostBtn>
            </Row>
            <Row title={t('删除账户')} desc={t('账户删除后无法恢复，请谨慎操作')}>
              <GhostBtn onClick={() => setShowDelete(true)}>
                {t('删除')}
              </GhostBtn>
            </Row>
          </Card>

          <Card title={t('偏好设置')} bodyClass='p-0'>
            <Row title={t('界面语言')} desc={t('设置自动同步到所有设备')}>
              <PrefDropdown
                value={currentLanguage}
                options={languageOptions}
                onChange={handleLanguageChange}
              />
            </Row>
          </Card>
        </div>
      </div>

      <EmailBindModal
        open={showEmail}
        onClose={() => setShowEmail(false)}
        onBound={(email) => {
          userDispatch({ type: 'login', payload: { ...u, email } });
        }}
        status={status}
        t={t}
      />
      <ChangePasswordModal open={showPwd} onClose={() => setShowPwd(false)} t={t} />
      <DeleteAccountModal
        open={showDelete}
        onClose={() => setShowDelete(false)}
        username={username}
        onDeleted={() => {
          userDispatch({ type: 'logout' });
          localStorage.removeItem('user');
          navigate('/login');
        }}
        t={t}
      />
    </div>
  );
};

// ── toggle row ──────────────────────────────────────────

const ToggleRow = ({ label, desc, value, onChange }) => (
  <div className='flex items-start justify-between gap-4'>
    <div className='min-w-0'>
      <div className='text-sm text-ui-text'>{label}</div>
      {desc && <div className='text-[11px] text-ui-text-3 mt-0.5'>{desc}</div>}
    </div>
    <button
      onClick={() => onChange(!value)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0 ${
        value ? 'bg-ui-accent' : 'bg-ui-bg-subtle border border-ui-border'
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full transition-transform shadow ${
          value ? 'translate-x-[18px]' : 'translate-x-0.5'
        }`}
        style={{ background: '#ffffff' }}
      />
    </button>
  </div>
);

// ── email bind modal ────────────────────────────────────

const EmailBindModal = ({ open, onClose, onBound, status, t }) => {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sending, setSending] = useState(false);
  const [binding, setBinding] = useState(false);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (open) { setEmail(''); setCode(''); setCountdown(0); }
  }, [open]);

  useEffect(() => {
    if (countdown <= 0) return;
    const id = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(id);
  }, [countdown]);

  const send = async () => {
    if (!email) return showInfo(t('请输入邮箱！'));
    setSending(true);
    try {
      const { data } = await API.get(`/api/verification?email=${encodeURIComponent(email)}`);
      if (data.success) {
        showSuccess(t('验证码发送成功，请检查邮箱！'));
        setCountdown(30);
      } else {
        showError(data.message);
      }
    } catch (e) {
      showError(e.message);
    } finally {
      setSending(false);
    }
  };

  const bind = async () => {
    if (!code) return showInfo(t('请输入邮箱验证码！'));
    setBinding(true);
    try {
      const { data } = await API.post('/api/oauth/email/bind', { email, code });
      if (data.success) {
        showSuccess(t('邮箱账户绑定成功！'));
        onBound?.(email);
        onClose();
      } else {
        showError(data.message);
      }
    } catch (e) {
      showError(e.message);
    } finally {
      setBinding(false);
    }
  };

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title={t('绑定邮箱地址')}
      footer={
        <>
          <GhostBtn onClick={onClose}>{t('取消')}</GhostBtn>
          <PrimaryBtn onClick={bind} disabled={binding || !code}>
            {binding ? t('绑定中...') : t('确认绑定')}
          </PrimaryBtn>
        </>
      }
    >
      <div className='space-y-3'>
        <Field label={t('邮箱地址')}>
          <div className='flex gap-2'>
            <input
              type='email'
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder='you@example.com'
              className={inputCls}
            />
            <GhostBtn onClick={send} disabled={sending || countdown > 0 || !email}>
              {countdown > 0 ? `${countdown}s` : t('发送验证码')}
            </GhostBtn>
          </div>
        </Field>
        <Field label={t('验证码')}>
          <input
            type='text'
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder='000000'
            className={inputCls}
          />
        </Field>
      </div>
    </ModalShell>
  );
};

// ── change password modal ───────────────────────────────

const ChangePasswordModal = ({ open, onClose, t }) => {
  const [orig, setOrig] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) { setOrig(''); setNext(''); setConfirm(''); }
  }, [open]);

  const submit = async () => {
    if (!next) return showError(t('请输入新密码！'));
    if (orig === next) return showError(t('新密码需要和原密码不一致！'));
    if (next !== confirm) return showError(t('两次输入的密码不一致！'));
    setSaving(true);
    try {
      const { data } = await API.put('/api/user/self', {
        original_password: orig,
        password: next,
      });
      if (data.success) {
        showSuccess(t('密码修改成功！'));
        onClose();
      } else {
        showError(data.message);
      }
    } catch (e) {
      showError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title={t('修改密码')}
      footer={
        <>
          <GhostBtn onClick={onClose}>{t('取消')}</GhostBtn>
          <PrimaryBtn onClick={submit} disabled={saving}>
            {saving ? t('保存中...') : t('确认修改')}
          </PrimaryBtn>
        </>
      }
    >
      <div className='space-y-3'>
        <Field label={t('原密码')}>
          <input type='password' value={orig} onChange={(e) => setOrig(e.target.value)} className={inputCls} />
        </Field>
        <Field label={t('新密码')}>
          <input type='password' value={next} onChange={(e) => setNext(e.target.value)} className={inputCls} />
        </Field>
        <Field label={t('确认新密码')}>
          <input type='password' value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputCls} />
        </Field>
      </div>
    </ModalShell>
  );
};

// ── delete account modal ────────────────────────────────

const DeleteAccountModal = ({ open, onClose, username, onDeleted, t }) => {
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (open) setConfirmText('');
  }, [open]);

  const submit = async () => {
    if (confirmText !== username) {
      return showError(t('请输入你的账户名以确认删除！'));
    }
    setDeleting(true);
    try {
      const { data } = await API.delete('/api/user/self');
      if (data.success) {
        showSuccess(t('账户已删除！'));
        await API.get('/api/user/logout');
        onDeleted?.();
      } else {
        showError(data.message);
      }
    } catch (e) {
      showError(e.message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title={t('删除账户')}
      footer={
        <>
          <GhostBtn onClick={onClose}>{t('取消')}</GhostBtn>
          <button
            onClick={submit}
            disabled={deleting || confirmText !== username}
            className='inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg bg-ui-danger text-white hover:opacity-90 active:scale-95 disabled:opacity-40 disabled:active:scale-100 transition-all whitespace-nowrap'
          >
            {deleting ? t('删除中...') : t('永久删除')}
          </button>
        </>
      }
    >
      <div className='space-y-3'>
        <p className='text-xs text-ui-text-2 leading-relaxed'>
          {t('此操作不可恢复，账户、令牌、日志等数据将被永久删除。')}
        </p>
        <Field label={t('请输入你的账户名以确认')}>
          <input
            type='text'
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={username}
            className={inputCls}
          />
        </Field>
      </div>
    </ModalShell>
  );
};

export default PersonalSetting;
