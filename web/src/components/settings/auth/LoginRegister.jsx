/*
 * 登录注册设置 — token-system rewrite.
 * Props: inputs, handleCheckboxChange, showPasswordLoginConfirmModal, setShowPasswordLoginConfirmModal,
 *        handlePasswordLoginConfirm, t
 */
import React from 'react';
import { ToggleField, Notice } from '../../common/form/Primitives';
import { showConfirm } from '../../common/ConfirmDialog';

export default function LoginRegisterCard({ inputs, updateOptions, t }) {
  const toggle = (key) => (checked) => {
    if (key === 'PasswordLoginEnabled' && !checked) {
      showConfirm({
        title: t('确认关闭密码登录？'),
        content: t('关闭后将无法通过密码登录，请确保已启用其他登录方式。'),
        danger: true,
        okText: t('确认关闭'),
        onOk: () => updateOptions([{ key, value: false }]),
      });
      return;
    }
    updateOptions([{ key, value: checked }]);
  };

  return (
    <div className='space-y-3'>
      <span className='text-sm font-semibold text-ui-text'>{t('配置登录注册')}</span>
      <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
        <div className='space-y-2'>
          <ToggleField label={t('允许通过密码进行登录')} checked={!!inputs.PasswordLoginEnabled} onChange={toggle('PasswordLoginEnabled')} />
          <ToggleField label={t('允许通过密码进行注册')} checked={!!inputs.PasswordRegisterEnabled} onChange={toggle('PasswordRegisterEnabled')} />
          <ToggleField label={t('通过密码注册时需要邮箱验证')} checked={!!inputs.EmailVerificationEnabled} onChange={toggle('EmailVerificationEnabled')} />
          <ToggleField label={t('允许新用户注册')} checked={!!inputs.RegisterEnabled} onChange={toggle('RegisterEnabled')} />
          <ToggleField label={t('启用 Turnstile 人机校验')} checked={!!inputs.TurnstileCheckEnabled} onChange={toggle('TurnstileCheckEnabled')} />
        </div>
        <div className='space-y-2'>
          <ToggleField label={t('允许 GitHub 账户登录 & 注册')} checked={!!inputs.GitHubOAuthEnabled} onChange={toggle('GitHubOAuthEnabled')} />
          <ToggleField label={t('允许 Discord 账户登录 & 注册')} checked={!!inputs['discord.enabled']} onChange={toggle('discord.enabled')} />
          <ToggleField label={t('允许 Linux DO 账户登录 & 注册')} checked={!!inputs.LinuxDOOAuthEnabled} onChange={toggle('LinuxDOOAuthEnabled')} />
          <ToggleField label={t('允许 Telegram 登录')} checked={!!inputs.TelegramOAuthEnabled} onChange={toggle('TelegramOAuthEnabled')} />
          <ToggleField label={t('允许 Passkey 登录')} checked={!!inputs['passkey.enabled']} onChange={toggle('passkey.enabled')} />
        </div>
      </div>
    </div>
  );
}
