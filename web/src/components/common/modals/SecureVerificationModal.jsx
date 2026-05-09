/*
 * Secure verification modal — token-system rewrite. Two methods:
 * TOTP / backup code (entered manually) and Passkey (browser auth).
 */
import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Shield, X, Loader2 } from 'lucide-react';

const SecureVerificationModal = ({
  visible,
  verificationMethods,
  verificationState,
  onVerify,
  onCancel,
  onCodeChange,
  onMethodSwitch,
  title,
  description,
}) => {
  const { t } = useTranslation();
  const { has2FA, hasPasskey, passkeySupported } = verificationMethods;
  const { method, loading, code } = verificationState;

  useEffect(() => {
    if (!visible) return;
    const onKey = (e) => {
      if (e.key === 'Escape' && !loading) onCancel?.();
      if (e.key === 'Enter' && code?.trim() && !loading && method === '2fa') {
        onVerify(method, code);
      }
    };
    document.addEventListener('keydown', onKey);
    const ov = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = ov;
    };
  }, [visible, loading, code, method, onCancel, onVerify]);

  if (!visible || typeof document === 'undefined') return null;

  // No verification method enabled
  if (!has2FA && !hasPasskey) {
    return createPortal(
      <div
        className='fixed inset-0 z-[140] flex items-center justify-center p-4'
        style={{ background: 'rgba(0,0,0,0.5)' }}
        onClick={onCancel}
      >
        <div
          className='bg-ui-bg-elevated border border-ui-border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden'
          onClick={(e) => e.stopPropagation()}
        >
          <div className='flex items-center justify-between gap-3 px-5 py-3.5 border-b border-ui-border'>
            <span className='text-sm font-semibold text-ui-text'>{title || t('安全验证')}</span>
            <button onClick={onCancel} className='p-1 rounded text-ui-text-2 hover:text-ui-text hover:bg-ui-bg-subtle'>
              <X size={16} />
            </button>
          </div>
          <div className='py-8 px-5 text-center'>
            <AlertTriangle size={40} className='text-amber-500 mx-auto mb-3' />
            <h3 className='text-base font-semibold text-ui-text mb-2'>{t('需要安全验证')}</h3>
            <p className='text-sm text-ui-text-2 leading-relaxed'>
              {t('您需要先启用两步验证或 Passkey 才能查看敏感信息。')}
            </p>
            <p className='text-sm text-ui-text-3 mt-1'>{t('请前往个人设置 → 安全设置进行配置。')}</p>
          </div>
          <div className='flex justify-end px-5 py-3 border-t border-ui-border'>
            <button
              onClick={onCancel}
              className='inline-flex items-center px-4 py-1.5 text-xs font-semibold rounded-xl bg-ui-accent text-ui-accent-fg hover:bg-ui-accent-hover whitespace-nowrap'
            >
              {t('确定')}
            </button>
          </div>
        </div>
      </div>,
      document.body,
    );
  }

  return createPortal(
    <div
      className='fixed inset-0 z-[140] flex items-center justify-center p-4'
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={loading ? undefined : onCancel}
    >
      <div
        className='bg-ui-bg-elevated border border-ui-border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden'
        onClick={(e) => e.stopPropagation()}
      >
        <div className='flex items-center justify-between gap-3 px-5 py-3.5 border-b border-ui-border'>
          <span className='text-sm font-semibold text-ui-text'>{title || t('安全验证')}</span>
          <button
            onClick={onCancel}
            disabled={loading}
            className='p-1 rounded text-ui-text-2 hover:text-ui-text hover:bg-ui-bg-subtle disabled:opacity-40'
          >
            <X size={16} />
          </button>
        </div>

        <div className='p-5 space-y-3'>
          {description && <p className='text-sm text-ui-text-2 leading-relaxed'>{description}</p>}

          {/* Tabs */}
          {has2FA && hasPasskey && passkeySupported && (
            <div className='flex border-b border-ui-border -mx-5 px-5'>
              <button
                onClick={() => onMethodSwitch?.('2fa')}
                className={`px-3 py-1.5 text-sm border-b-2 -mb-px transition-colors ${
                  method === '2fa' ? 'border-ui-text text-ui-text font-semibold' : 'border-transparent text-ui-text-2 hover:text-ui-text'
                }`}
              >
                {t('两步验证')}
              </button>
              <button
                onClick={() => onMethodSwitch?.('passkey')}
                className={`px-3 py-1.5 text-sm border-b-2 -mb-px transition-colors ${
                  method === 'passkey' ? 'border-ui-text text-ui-text font-semibold' : 'border-transparent text-ui-text-2 hover:text-ui-text'
                }`}
              >
                Passkey
              </button>
            </div>
          )}

          {method === '2fa' && has2FA && (
            <>
              <div className='relative'>
                <Shield size={14} className='absolute left-2.5 top-1/2 -translate-y-1/2 text-ui-text-3 pointer-events-none' />
                <input
                  type='text'
                  placeholder={t('请输入6位验证码或8位备用码')}
                  value={code || ''}
                  onChange={(e) => onCodeChange?.(e.target.value)}
                  maxLength={8}
                  autoFocus
                  disabled={loading}
                  className='w-full pl-8 pr-3 py-2 text-sm bg-transparent border border-ui-border rounded-md text-ui-text placeholder:text-ui-text-3 outline-none focus:border-ui-text-3 disabled:opacity-60'
                />
              </div>
              <p className='text-[11px] text-ui-text-3'>{t('从认证器应用中获取验证码，或使用备用码')}</p>
            </>
          )}

          {method === 'passkey' && hasPasskey && passkeySupported && (
            <div className='text-center py-6'>
              <div className='w-14 h-14 mx-auto mb-3 rounded-full bg-ui-bg-subtle border border-ui-border flex items-center justify-center'>
                <Shield size={24} className='text-ui-brand' />
              </div>
              <h3 className='text-sm font-semibold text-ui-text mb-1.5'>{t('使用 Passkey 验证')}</h3>
              <p className='text-[12px] text-ui-text-2 leading-relaxed'>
                {t('点击验证按钮，使用您的生物特征或安全密钥')}
              </p>
            </div>
          )}
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
            onClick={() => onVerify(method, code)}
            disabled={loading || (method === '2fa' && !code?.trim())}
            className='inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-xl bg-ui-accent text-ui-accent-fg hover:bg-ui-accent-hover disabled:opacity-50 whitespace-nowrap'
          >
            {loading && <Loader2 size={11} className='animate-spin' />}
            {method === 'passkey' ? t('验证 Passkey') : t('验证')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default SecureVerificationModal;
