/*
 * Passkey / 邮箱白名单 / SMTP / Turnstile — token-system rewrite.
 */
import React from 'react';
import { KeyRound, Mail, Server, Shield } from 'lucide-react';
import {
  FieldRow,
  TextField,
  ToggleField,
  NativeSelect,
  TagInput,
  Notice,
} from '../../common/form/Primitives';

const inputCls = 'w-full rounded border border-ui-border bg-ui-bg-subtle text-ui-text text-xs px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ui-accent/40';

export function PasskeyCard({ inputs, setInputs, submitPasskeySettings, t }) {
  return (
    <div className='space-y-3'>
      <div className='flex items-center gap-2'>
        <div className='w-7 h-7 rounded-md inline-flex items-center justify-center border bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20'>
          <KeyRound size={13} />
        </div>
        <span className='text-sm font-semibold text-ui-text'>{t('配置 Passkey')}</span>
      </div>
      <Notice kind='info'>
        {t('Passkey 是基于 WebAuthn 标准的无密码身份验证方法，支持指纹、面容、硬件密钥等认证方式')}
      </Notice>
      <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
        <FieldRow label={t('服务显示名称')} hint={t('用户注册时看到的网站名称')}>
          <input value={inputs['passkey.rp_display_name'] || ''} onChange={(e) => setInputs((prev) => ({ ...prev, 'passkey.rp_display_name': e.target.value }))} placeholder={t('默认使用系统名称')} className={inputCls} />
        </FieldRow>
        <FieldRow label={t('网站域名标识')} hint={t('留空使用服务器地址，不能携带 http:// 或 https://')}>
          <input value={inputs['passkey.rp_id'] || ''} onChange={(e) => setInputs((prev) => ({ ...prev, 'passkey.rp_id': e.target.value }))} placeholder='example.com' className={inputCls} />
        </FieldRow>
        <FieldRow label={t('安全验证级别')} hint={t('推荐：用户可选择是否使用指纹等验证')}>
          <NativeSelect
            value={inputs['passkey.user_verification'] || 'preferred'}
            onChange={(v) => setInputs((prev) => ({ ...prev, 'passkey.user_verification': v }))}
            options={[
              { value: 'preferred', label: t('推荐使用（用户可选）') },
              { value: 'required', label: t('强制要求') },
              { value: 'discouraged', label: t('不建议使用') },
            ]}
          />
        </FieldRow>
        <FieldRow label={t('设备类型偏好')} hint={t('本设备：手机指纹/面容，外接：USB 安全密钥')}>
          <NativeSelect
            value={inputs['passkey.attachment_preference'] || ''}
            onChange={(v) => setInputs((prev) => ({ ...prev, 'passkey.attachment_preference': v }))}
            options={[
              { value: '', label: t('不限制') },
              { value: 'platform', label: t('本设备内置') },
              { value: 'cross-platform', label: t('外接设备') },
            ]}
          />
        </FieldRow>
      </div>
      <ToggleField label={t('允许不安全的 Origin（HTTP）')} hint={t('仅用于开发环境，生产环境应使用 HTTPS')} checked={!!inputs['passkey.allow_insecure_origin']} onChange={(v) => setInputs((prev) => ({ ...prev, 'passkey.allow_insecure_origin': v }))} />
      <FieldRow label={t('允许的 Origins')} hint={t('留空使用服务器地址，多个 Origin 用逗号分隔')}>
        <input value={inputs['passkey.origins'] || ''} onChange={(e) => setInputs((prev) => ({ ...prev, 'passkey.origins': e.target.value }))} placeholder='https://newapi.pro,https://newapi.com' className={inputCls} />
      </FieldRow>
      <button onClick={submitPasskeySettings} className='px-3 py-1.5 text-xs font-semibold rounded-md bg-ui-accent text-ui-accent-fg hover:opacity-90'>
        {t('保存 Passkey 设置')}
      </button>
    </div>
  );
}

export function EmailWhitelistCard({ inputs, updateOptions, emailDomainWhitelist, setEmailDomainWhitelist, emailToAdd, setEmailToAdd, t }) {
  const handleAddEmail = () => {
    if (!emailToAdd?.trim()) return;
    const domain = emailToAdd.trim();
    const domainRegex = /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
    if (!domainRegex.test(domain)) { showError(t('邮箱域名格式不正确')); return; }
    if (emailDomainWhitelist.includes(domain)) { showError(t('该域名已存在于白名单中')); return; }
    setEmailDomainWhitelist([...emailDomainWhitelist, domain]);
    setEmailToAdd('');
  };

  return (
    <div className='space-y-3'>
      <div className='flex items-center gap-2'>
        <div className='w-7 h-7 rounded-md inline-flex items-center justify-center border bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'>
          <Mail size={13} />
        </div>
        <span className='text-sm font-semibold text-ui-text'>{t('配置邮箱域名白名单')}</span>
      </div>
      <p className='text-xs text-ui-text-3'>{t('用以防止恶意用户利用临时邮箱批量注册')}</p>
      <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
        <ToggleField label={t('启用邮箱域名白名单')} checked={!!inputs.EmailDomainRestrictionEnabled} onChange={(v) => updateOptions([{ key: 'EmailDomainRestrictionEnabled', value: v }])} />
        <ToggleField label={t('启用邮箱别名限制')} checked={!!inputs.EmailAliasRestrictionEnabled} onChange={(v) => updateOptions([{ key: 'EmailAliasRestrictionEnabled', value: v }])} />
      </div>
      <TagInput value={emailDomainWhitelist} onChange={setEmailDomainWhitelist} placeholder={t('输入域名后回车')} />
      <div className='flex gap-2'>
        <input value={emailToAdd || ''} onChange={(e) => setEmailToAdd(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddEmail()} placeholder={t('输入要添加的邮箱域名')} className={inputCls + ' flex-1'} />
        <button onClick={handleAddEmail} className='px-3 py-1.5 text-xs font-semibold rounded-md bg-ui-accent text-ui-accent-fg hover:opacity-90 whitespace-nowrap'>{t('添加')}</button>
      </div>
      <button onClick={() => { if (Array.isArray(emailDomainWhitelist)) updateOptions([{ key: 'EmailDomainWhitelist', value: emailDomainWhitelist.join(',') }]); }} className='px-3 py-1.5 text-xs font-semibold rounded-md bg-ui-accent text-ui-accent-fg hover:opacity-90'>
        {t('保存邮箱域名白名单设置')}
      </button>
    </div>
  );
}

export function SMTPCard({ inputs, setInputs, submitSMTP, t }) {
  return (
    <div className='space-y-3'>
      <div className='flex items-center gap-2'>
        <div className='w-7 h-7 rounded-md inline-flex items-center justify-center border bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20'>
          <Server size={13} />
        </div>
        <span className='text-sm font-semibold text-ui-text'>{t('配置 SMTP')}</span>
      </div>
      <p className='text-xs text-ui-text-3'>{t('用以支持系统的邮件发送')}</p>
      <div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3'>
        <FieldRow label={t('SMTP 服务器地址')}>
          <input value={inputs.SMTPServer || ''} onChange={(e) => setInputs((prev) => ({ ...prev, SMTPServer: e.target.value }))} className={inputCls} />
        </FieldRow>
        <FieldRow label={t('SMTP 端口')}>
          <input value={inputs.SMTPPort || ''} onChange={(e) => setInputs((prev) => ({ ...prev, SMTPPort: e.target.value }))} className={inputCls} />
        </FieldRow>
        <FieldRow label={t('SMTP 账户')}>
          <input value={inputs.SMTPAccount || ''} onChange={(e) => setInputs((prev) => ({ ...prev, SMTPAccount: e.target.value }))} className={inputCls} />
        </FieldRow>
        <FieldRow label={t('SMTP 发送者邮箱')}>
          <input value={inputs.SMTPFrom || ''} onChange={(e) => setInputs((prev) => ({ ...prev, SMTPFrom: e.target.value }))} className={inputCls} />
        </FieldRow>
        <FieldRow label={t('SMTP 访问凭证')}>
          <input type='password' value={inputs.SMTPToken || ''} onChange={(e) => setInputs((prev) => ({ ...prev, SMTPToken: e.target.value }))} placeholder={t('敏感信息不会发送到前端显示')} className={inputCls} />
        </FieldRow>
      </div>
      <div className='grid grid-cols-2 gap-3'>
        <ToggleField label={t('启用 SMTP SSL')} checked={!!inputs.SMTPSSLEnabled} onChange={(v) => updateOptions([{ key: 'SMTPSSLEnabled', value: v }])} />
        <ToggleField label={t('强制使用 AUTH LOGIN')} checked={!!inputs.SMTPForceAuthLogin} onChange={(v) => updateOptions([{ key: 'SMTPForceAuthLogin', value: v }])} />
      </div>
      <button onClick={submitSMTP} className='px-3 py-1.5 text-xs font-semibold rounded-md bg-ui-accent text-ui-accent-fg hover:opacity-90'>
        {t('保存 SMTP 设置')}
      </button>
    </div>
  );
}

export function TurnstileCard({ inputs, setInputs, submitTurnstile, t }) {
  return (
    <div className='space-y-3'>
      <div className='flex items-center gap-2'>
        <div className='w-7 h-7 rounded-md inline-flex items-center justify-center border bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'>
          <Shield size={13} />
        </div>
        <span className='text-sm font-semibold text-ui-text'>{t('配置 Turnstile')}</span>
      </div>
      <p className='text-xs text-ui-text-3'>{t('用以支持用户校验')}</p>
      <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
        <FieldRow label={t('Turnstile Site Key')}>
          <input value={inputs.TurnstileSiteKey || ''} onChange={(e) => setInputs((prev) => ({ ...prev, TurnstileSiteKey: e.target.value }))} className={inputCls} />
        </FieldRow>
        <FieldRow label={t('Turnstile Secret Key')}>
          <input type='password' value={inputs.TurnstileSecretKey || ''} onChange={(e) => setInputs((prev) => ({ ...prev, TurnstileSecretKey: e.target.value }))} placeholder={t('敏感信息不会发送到前端显示')} className={inputCls} />
        </FieldRow>
      </div>
      <button onClick={submitTurnstile} className='px-3 py-1.5 text-xs font-semibold rounded-md bg-ui-accent text-ui-accent-fg hover:opacity-90'>
        {t('保存 Turnstile 设置')}
      </button>
    </div>
  );
}
