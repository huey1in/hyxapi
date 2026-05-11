/*
 * Secure verification modal — token-system rewrite. Two methods:
 * TOTP / backup code (entered manually) and Passkey (browser auth).
 */
import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Shield, X, Loader2 } from 'lucide-react';
import { Button, IconButton, Tabs as UITabs } from '../../ui';

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
            <IconButton icon={X} size='sm' onClick={onCancel} />
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
            <Button onClick={onCancel}>
              {t('确定')}
            </Button>
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
          <IconButton icon={X} size='sm' onClick={onCancel} disabled={loading} />
        </div>

        <div className='p-5 space-y-3'>
          {description && <p className='text-sm text-ui-text-2 leading-relaxed'>{description}</p>}

          {/* Tabs */}
          {has2FA && hasPasskey && passkeySupported && (
            <div className='-mx-5 px-5'>
              <UITabs
                variant='underline'
                value={method}
                onChange={(v) => onMethodSwitch?.(v)}
                items={[
                  { value: '2fa', label: t('两步验证') },
                  { value: 'passkey', label: 'Passkey' },
                ]}
              />
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
          <Button variant='secondary' size='sm' onClick={onCancel} disabled={loading}>
            {t('取消')}
          </Button>
          <Button
            size='sm'
            icon={loading ? Loader2 : undefined}
            onClick={() => onVerify(method, code)}
            disabled={loading || (method === '2fa' && !code?.trim())}
          >
            {method === 'passkey' ? t('验证 Passkey') : t('验证')}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default SecureVerificationModal;
