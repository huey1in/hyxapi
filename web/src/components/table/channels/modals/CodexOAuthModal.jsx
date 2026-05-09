/*
 * Codex OAuth modal — token-system rewrite.
 */
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { X, Info, Loader2 } from 'lucide-react';
import { API, copy, showError, showSuccess } from '../../../../helpers';

const CodexOAuthModal = ({ visible, onCancel, onSuccess }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [authorizeUrl, setAuthorizeUrl] = useState('');
  const [input, setInput] = useState('');

  useEffect(() => {
    if (!visible) return;
    setAuthorizeUrl('');
    setInput('');
    const onKey = (e) => e.key === 'Escape' && !loading && onCancel?.();
    document.addEventListener('keydown', onKey);
    const ov = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = ov;
    };
  }, [visible, loading, onCancel]);

  const startOAuth = async () => {
    setLoading(true);
    try {
      const res = await API.post(
        '/api/channel/codex/oauth/start',
        {},
        { skipErrorHandler: true },
      );
      if (!res?.data?.success) throw new Error(t('启动授权失败'));
      const url = res?.data?.data?.authorize_url || '';
      if (!url) throw new Error(t('响应缺少授权链接'));
      setAuthorizeUrl(url);
      window.open(url, '_blank', 'noopener,noreferrer');
      showSuccess(t('已打开授权页面'));
    } catch (error) {
      showError(error?.message || t('启动授权失败'));
    } finally {
      setLoading(false);
    }
  };

  const completeOAuth = async () => {
    if (!input || !input.trim()) {
      showError(t('请先粘贴回调 URL'));
      return;
    }
    setLoading(true);
    try {
      const res = await API.post(
        '/api/channel/codex/oauth/complete',
        { input },
        { skipErrorHandler: true },
      );
      if (!res?.data?.success) throw new Error(t('授权失败'));
      const key = res?.data?.data?.key || '';
      if (!key) throw new Error(t('响应缺少凭据'));
      onSuccess && onSuccess(key);
      showSuccess(t('已生成授权凭据'));
      onCancel && onCancel();
    } catch (error) {
      showError(error?.message || t('授权失败'));
    } finally {
      setLoading(false);
    }
  };

  if (!visible || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className='fixed inset-0 z-[125] flex items-center justify-center p-4'
      style={{ background: 'rgba(0,0,0,0.5)' }}
    >
      <div
        className='bg-ui-bg-elevated border border-ui-border rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden'
        onClick={(e) => e.stopPropagation()}
      >
        <div className='flex items-center justify-between gap-3 px-5 py-3.5 border-b border-ui-border'>
          <span className='text-sm font-semibold text-ui-text'>{t('Codex 授权')}</span>
          <button
            onClick={onCancel}
            disabled={loading}
            className='p-1 rounded text-ui-text-2 hover:text-ui-text hover:bg-ui-bg-subtle disabled:opacity-40'
          >
            <X size={16} />
          </button>
        </div>
        <div className='p-5 space-y-3'>
          <div className='flex items-start gap-2 px-3 py-2 rounded-xl border border-blue-500/30 bg-blue-500/5'>
            <Info size={14} className='text-blue-500 flex-shrink-0 mt-0.5' />
            <div className='text-xs text-ui-text-2 leading-relaxed'>
              {t('1) 点击「打开授权页面」完成登录；2) 浏览器会跳转到 localhost（页面打不开也没关系）；3) 复制地址栏完整 URL 粘贴到下方；4) 点击「生成并填入」。')}
            </div>
          </div>
          <div className='flex flex-wrap items-center gap-2'>
            <button
              onClick={startOAuth}
              disabled={loading}
              className='inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl bg-ui-accent text-ui-accent-fg hover:bg-ui-accent-hover disabled:opacity-50 whitespace-nowrap'
            >
              {loading && <Loader2 size={12} className='animate-spin' />}
              {t('打开授权页面')}
            </button>
            <button
              disabled={!authorizeUrl || loading}
              onClick={() => copy(authorizeUrl)}
              className='inline-flex items-center px-3 py-2 text-sm rounded-xl border border-ui-border text-ui-text-2 hover:text-ui-text hover:bg-ui-bg-subtle disabled:opacity-40 whitespace-nowrap'
            >
              {t('复制授权链接')}
            </button>
          </div>
          <input
            type='text'
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t('请粘贴完整回调 URL（包含 code 与 state）')}
            className='w-full px-3 py-2 text-sm bg-transparent border border-ui-border rounded-xl text-ui-text placeholder:text-ui-text-3 outline-none focus:border-ui-text-3 transition-colors'
          />
          <p className='text-[11px] text-ui-text-3 leading-relaxed'>
            {t('说明：生成结果是可直接粘贴到渠道密钥里的 JSON（包含 access_token / refresh_token / account_id）。')}
          </p>
        </div>
        <div className='flex justify-end gap-2 px-5 py-3 border-t border-ui-border'>
          <button
            onClick={onCancel}
            disabled={loading}
            className='inline-flex items-center px-3.5 py-1.5 text-xs font-medium rounded-xl border border-ui-border text-ui-text-2 hover:text-ui-text hover:bg-ui-bg-subtle disabled:opacity-40 whitespace-nowrap'
          >
            {t('取消')}
          </button>
          <button
            onClick={completeOAuth}
            disabled={loading}
            className='inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-xl bg-ui-accent text-ui-accent-fg hover:bg-ui-accent-hover disabled:opacity-50 whitespace-nowrap'
          >
            {loading && <Loader2 size={11} className='animate-spin' />}
            {t('生成并填入')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default CodexOAuthModal;
