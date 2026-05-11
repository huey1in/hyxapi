/*
 * OAuth provider settings — token-system rewrite.
 * OIDC / GitHub / Discord / LinuxDO / WeChat / Telegram
 */
import React from 'react';
import { FieldRow, TextField, Notice } from '../../common/form/Primitives';
import { Button } from '../../ui';

const inputCls = 'w-full rounded border border-ui-border bg-ui-bg-subtle text-ui-text text-xs px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ui-accent/40';

export function GitHubOAuthCard({ inputs, setInputs, submitGitHubOAuth, t }) {
  return (
    <div className='space-y-3'>
      <span className='text-sm font-semibold text-ui-text'>{t('配置 GitHub OAuth App')}</span>
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
      <Button size='sm' onClick={submitGitHubOAuth}>{t('保存 GitHub OAuth 设置')}</Button>
    </div>
  );
}

export function DiscordOAuthCard({ inputs, setInputs, submitDiscordOAuth, t }) {
  return (
    <div className='space-y-3'>
      <span className='text-sm font-semibold text-ui-text'>{t('配置 Discord OAuth')}</span>
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
      <Button size='sm' onClick={submitDiscordOAuth}>{t('保存 Discord OAuth 设置')}</Button>
    </div>
  );
}

export function LinuxDOOAuthCard({ inputs, setInputs, submitLinuxDOOAuth, t }) {
  return (
    <div className='space-y-3'>
      <span className='text-sm font-semibold text-ui-text'>{t('配置 Linux DO OAuth')}</span>
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
      <Button size='sm' onClick={submitLinuxDOOAuth}>{t('保存 Linux DO OAuth 设置')}</Button>
    </div>
  );
}

export function TelegramCard({ inputs, setInputs, submitTelegramSettings, t }) {
  return (
    <div className='space-y-3'>
      <span className='text-sm font-semibold text-ui-text'>{t('配置 Telegram 登录')}</span>
      <p className='text-xs text-ui-text-3'>{t('用以支持通过 Telegram 进行登录注册')}</p>
      <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
        <FieldRow label={t('Telegram Bot Token')}>
          <input type='password' value={inputs.TelegramBotToken || ''} onChange={(e) => setInputs((prev) => ({ ...prev, TelegramBotToken: e.target.value }))} placeholder={t('敏感信息不会发送到前端显示')} className={inputCls} />
        </FieldRow>
        <FieldRow label={t('Telegram Bot 名称')}>
          <input value={inputs.TelegramBotName || ''} onChange={(e) => setInputs((prev) => ({ ...prev, TelegramBotName: e.target.value }))} className={inputCls} />
        </FieldRow>
      </div>
      <Button size='sm' onClick={submitTelegramSettings}>{t('保存 Telegram 登录设置')}</Button>
    </div>
  );
}
