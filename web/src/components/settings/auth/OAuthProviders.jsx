/*
 * OAuth provider settings — token-system rewrite.
 * OIDC / GitHub / Discord / LinuxDO / WeChat / Telegram
 */
import React from 'react';
import {
  Globe,
  Github,
  MessageCircle,
  Terminal,
  Smartphone,
  Send,
} from 'lucide-react';
import { FieldRow, TextField, Notice } from '../../common/form/Primitives';

const inputCls = 'w-full rounded border border-ui-border bg-ui-bg-subtle text-ui-text text-xs px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ui-accent/40';

export function OIDCCard({ inputs, setInputs, submitOIDCSettings, t }) {
  return (
    <div className='space-y-3'>
      <div className='flex items-center gap-2'>
        <div className='w-7 h-7 rounded-md inline-flex items-center justify-center border bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'>
          <Globe size={13} />
        </div>
        <span className='text-sm font-semibold text-ui-text'>{t('配置 OIDC')}</span>
      </div>
      <p className='text-xs text-ui-text-3'>{t('用以支持通过 OIDC 登录，例如 Okta、Auth0 等')}</p>
      <Notice kind='info'>
        {t('主页链接填')} {inputs.ServerAddress || t('网站地址')}，{t('重定向 URL 填')} {inputs.ServerAddress || t('网站地址')}/oauth/oidc
      </Notice>
      <p className='text-xs text-ui-text-3'>{t('若你的 OIDC Provider 支持 Discovery Endpoint，你可以仅填写 Well-Known URL')}</p>
      <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
        <FieldRow label={t('Well-Known URL')}>
          <input value={inputs['oidc.well_known'] || ''} onChange={(e) => setInputs((prev) => ({ ...prev, 'oidc.well_known': e.target.value }))} placeholder={t('请输入 OIDC 的 Well-Known URL')} className={inputCls} />
        </FieldRow>
        <FieldRow label={t('Client ID')}>
          <input value={inputs['oidc.client_id'] || ''} onChange={(e) => setInputs((prev) => ({ ...prev, 'oidc.client_id': e.target.value }))} className={inputCls} />
        </FieldRow>
        <FieldRow label={t('Client Secret')}>
          <input type='password' value={inputs['oidc.client_secret'] || ''} onChange={(e) => setInputs((prev) => ({ ...prev, 'oidc.client_secret': e.target.value }))} placeholder={t('敏感信息不会发送到前端显示')} className={inputCls} />
        </FieldRow>
        <FieldRow label={t('Authorization Endpoint')}>
          <input value={inputs['oidc.authorization_endpoint'] || ''} onChange={(e) => setInputs((prev) => ({ ...prev, 'oidc.authorization_endpoint': e.target.value }))} className={inputCls} />
        </FieldRow>
        <FieldRow label={t('Token Endpoint')}>
          <input value={inputs['oidc.token_endpoint'] || ''} onChange={(e) => setInputs((prev) => ({ ...prev, 'oidc.token_endpoint': e.target.value }))} className={inputCls} />
        </FieldRow>
        <FieldRow label={t('User Info Endpoint')}>
          <input value={inputs['oidc.user_info_endpoint'] || ''} onChange={(e) => setInputs((prev) => ({ ...prev, 'oidc.user_info_endpoint': e.target.value }))} className={inputCls} />
        </FieldRow>
      </div>
      <button onClick={submitOIDCSettings} className='px-3 py-1.5 text-xs font-semibold rounded-md bg-ui-accent text-ui-accent-fg hover:opacity-90'>{t('保存 OIDC 设置')}</button>
    </div>
  );
}

export function GitHubOAuthCard({ inputs, setInputs, submitGitHubOAuth, t }) {
  return (
    <div className='space-y-3'>
      <div className='flex items-center gap-2'>
        <div className='w-7 h-7 rounded-md inline-flex items-center justify-center border bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20'>
          <Github size={13} />
        </div>
        <span className='text-sm font-semibold text-ui-text'>{t('配置 GitHub OAuth App')}</span>
      </div>
      <Notice kind='info'>
        {t('Homepage URL 填')} {inputs.ServerAddress || t('网站地址')}，{t('Authorization callback URL 填')} {inputs.ServerAddress || t('网站地址')}/oauth/github
      </Notice>
      <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
        <FieldRow label={t('GitHub Client ID')}>
          <input value={inputs.GitHubClientId || ''} onChange={(e) => setInputs((prev) => ({ ...prev, GitHubClientId: e.target.value }))} className={inputCls} />
        </FieldRow>
        <FieldRow label={t('GitHub Client Secret')}>
          <input type='password' value={inputs.GitHubClientSecret || ''} onChange={(e) => setInputs((prev) => ({ ...prev, GitHubClientSecret: e.target.value }))} placeholder={t('敏感信息不会发送到前端显示')} className={inputCls} />
        </FieldRow>
      </div>
      <button onClick={submitGitHubOAuth} className='px-3 py-1.5 text-xs font-semibold rounded-md bg-ui-accent text-ui-accent-fg hover:opacity-90'>{t('保存 GitHub OAuth 设置')}</button>
    </div>
  );
}

export function DiscordOAuthCard({ inputs, setInputs, submitDiscordOAuth, t }) {
  return (
    <div className='space-y-3'>
      <div className='flex items-center gap-2'>
        <div className='w-7 h-7 rounded-md inline-flex items-center justify-center border bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20'>
          <MessageCircle size={13} />
        </div>
        <span className='text-sm font-semibold text-ui-text'>{t('配置 Discord OAuth')}</span>
      </div>
      <Notice kind='info'>
        {t('Homepage URL 填')} {inputs.ServerAddress || t('网站地址')}，{t('Authorization callback URL 填')} {inputs.ServerAddress || t('网站地址')}/oauth/discord
      </Notice>
      <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
        <FieldRow label={t('Discord Client ID')}>
          <input value={inputs['discord.client_id'] || ''} onChange={(e) => setInputs((prev) => ({ ...prev, 'discord.client_id': e.target.value }))} className={inputCls} />
        </FieldRow>
        <FieldRow label={t('Discord Client Secret')}>
          <input type='password' value={inputs['discord.client_secret'] || ''} onChange={(e) => setInputs((prev) => ({ ...prev, 'discord.client_secret': e.target.value }))} placeholder={t('敏感信息不会发送到前端显示')} className={inputCls} />
        </FieldRow>
      </div>
      <button onClick={submitDiscordOAuth} className='px-3 py-1.5 text-xs font-semibold rounded-md bg-ui-accent text-ui-accent-fg hover:opacity-90'>{t('保存 Discord OAuth 设置')}</button>
    </div>
  );
}

export function LinuxDOOAuthCard({ inputs, setInputs, submitLinuxDOOAuth, t }) {
  return (
    <div className='space-y-3'>
      <div className='flex items-center gap-2'>
        <div className='w-7 h-7 rounded-md inline-flex items-center justify-center border bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20'>
          <Terminal size={13} />
        </div>
        <span className='text-sm font-semibold text-ui-text'>{t('配置 Linux DO OAuth')}</span>
      </div>
      <p className='text-xs text-ui-text-3'>
        {t('用以支持通过 Linux DO 进行登录注册')}{' '}
        <a href='https://connect.linux.do/' target='_blank' rel='noreferrer' className='text-ui-accent hover:underline'>{t('点击此处')}</a>
        {' '}{t('管理你的 LinuxDO OAuth App')}
      </p>
      <Notice kind='info'>
        {t('回调 URL 填')} {inputs.ServerAddress || t('网站地址')}/oauth/linuxdo
      </Notice>
      <div className='grid grid-cols-1 sm:grid-cols-3 gap-3'>
        <FieldRow label={t('Linux DO Client ID')}>
          <input value={inputs.LinuxDOClientId || ''} onChange={(e) => setInputs((prev) => ({ ...prev, LinuxDOClientId: e.target.value }))} className={inputCls} />
        </FieldRow>
        <FieldRow label={t('Linux DO Client Secret')}>
          <input type='password' value={inputs.LinuxDOClientSecret || ''} onChange={(e) => setInputs((prev) => ({ ...prev, LinuxDOClientSecret: e.target.value }))} placeholder={t('敏感信息不会发送到前端显示')} className={inputCls} />
        </FieldRow>
        <FieldRow label='Minimum Trust Level' hint={t('允许注册的最低信任等级')}>
          <input value={inputs.LinuxDOMinimumTrustLevel || ''} onChange={(e) => setInputs((prev) => ({ ...prev, LinuxDOMinimumTrustLevel: e.target.value }))} className={inputCls} />
        </FieldRow>
      </div>
      <button onClick={submitLinuxDOOAuth} className='px-3 py-1.5 text-xs font-semibold rounded-md bg-ui-accent text-ui-accent-fg hover:opacity-90'>{t('保存 Linux DO OAuth 设置')}</button>
    </div>
  );
}

export function WeChatCard({ inputs, setInputs, submitWeChat, t }) {
  return (
    <div className='space-y-3'>
      <div className='flex items-center gap-2'>
        <div className='w-7 h-7 rounded-md inline-flex items-center justify-center border bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20'>
          <Smartphone size={13} />
        </div>
        <span className='text-sm font-semibold text-ui-text'>{t('配置 WeChat Server')}</span>
      </div>
      <p className='text-xs text-ui-text-3'>{t('用以支持通过微信进行登录注册')}</p>
      <div className='grid grid-cols-1 sm:grid-cols-3 gap-3'>
        <FieldRow label={t('WeChat Server 服务器地址')}>
          <input value={inputs.WeChatServerAddress || ''} onChange={(e) => setInputs((prev) => ({ ...prev, WeChatServerAddress: e.target.value }))} className={inputCls} />
        </FieldRow>
        <FieldRow label={t('WeChat Server 访问凭证')}>
          <input type='password' value={inputs.WeChatServerToken || ''} onChange={(e) => setInputs((prev) => ({ ...prev, WeChatServerToken: e.target.value }))} placeholder={t('敏感信息不会发送到前端显示')} className={inputCls} />
        </FieldRow>
        <FieldRow label={t('微信公众号二维码图片链接')}>
          <input value={inputs.WeChatAccountQRCodeImageURL || ''} onChange={(e) => setInputs((prev) => ({ ...prev, WeChatAccountQRCodeImageURL: e.target.value }))} className={inputCls} />
        </FieldRow>
      </div>
      <button onClick={submitWeChat} className='px-3 py-1.5 text-xs font-semibold rounded-md bg-ui-accent text-ui-accent-fg hover:opacity-90'>{t('保存 WeChat Server 设置')}</button>
    </div>
  );
}

export function TelegramCard({ inputs, setInputs, submitTelegramSettings, t }) {
  return (
    <div className='space-y-3'>
      <div className='flex items-center gap-2'>
        <div className='w-7 h-7 rounded-md inline-flex items-center justify-center border bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20'>
          <Send size={13} />
        </div>
        <span className='text-sm font-semibold text-ui-text'>{t('配置 Telegram 登录')}</span>
      </div>
      <p className='text-xs text-ui-text-3'>{t('用以支持通过 Telegram 进行登录注册')}</p>
      <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
        <FieldRow label={t('Telegram Bot Token')}>
          <input type='password' value={inputs.TelegramBotToken || ''} onChange={(e) => setInputs((prev) => ({ ...prev, TelegramBotToken: e.target.value }))} placeholder={t('敏感信息不会发送到前端显示')} className={inputCls} />
        </FieldRow>
        <FieldRow label={t('Telegram Bot 名称')}>
          <input value={inputs.TelegramBotName || ''} onChange={(e) => setInputs((prev) => ({ ...prev, TelegramBotName: e.target.value }))} className={inputCls} />
        </FieldRow>
      </div>
      <button onClick={submitTelegramSettings} className='px-3 py-1.5 text-xs font-semibold rounded-md bg-ui-accent text-ui-accent-fg hover:opacity-90'>{t('保存 Telegram 登录设置')}</button>
    </div>
  );
}
