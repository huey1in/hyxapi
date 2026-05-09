/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import React from 'react';
import { Key, Lock, Trash2, Shield, Mail, Github, Loader2, Copy } from 'lucide-react';
import { SiTelegram, SiWechat, SiLinux, SiDiscord } from 'react-icons/si';
import TelegramLoginButton from 'react-telegram-login';
import {
  API,
  showError,
  showSuccess,
  onGitHubOAuthClicked,
  onOIDCClicked,
  onLinuxDOOAuthClicked,
  onDiscordOAuthClicked,
  onCustomOAuthClicked,
  getOAuthProviderIcon,
} from '../../../../helpers';
import { showConfirm } from '../../../common/ConfirmDialog';
import ModalDialog from '../../../common/ModalDialog';
import { TextField } from '../../../common/form/Primitives';
import TwoFASetting from '../components/TwoFASetting';

const AccountManagement = ({
  t,
  userState,
  status,
  systemToken,
  setShowEmailBindModal,
  setShowWeChatBindModal,
  generateAccessToken,
  handleSystemTokenClick,
  setShowChangePasswordModal,
  setShowAccountDeleteModal,
  passkeyStatus,
  passkeySupported,
  passkeyRegisterLoading,
  passkeyDeleteLoading,
  onPasskeyRegister,
  onPasskeyDelete,
}) => {
  const renderAccountInfo = (accountId, label) => {
    if (!accountId || accountId === '') {
      return <span className='text-ui-text-2'>{t('未绑定')}</span>;
    }

    return (
      <span
        className='block max-w-full truncate text-ui-text-2 hover:text-blue-600 cursor-pointer'
        title={`${accountId}${label ? ` (${label})` : ''}`}
        onClick={() => {
          navigator.clipboard.writeText(accountId);
          showSuccess(t('已复制'));
        }}
      >
        {accountId}
      </span>
    );
  };
  const isBound = (accountId) => Boolean(accountId);
  const [showTelegramBindModal, setShowTelegramBindModal] =
    React.useState(false);
  const [customOAuthBindings, setCustomOAuthBindings] = React.useState([]);
  const [customOAuthLoading, setCustomOAuthLoading] = React.useState({});
  const [activeTab, setActiveTab] = React.useState('binding');

  // Fetch custom OAuth bindings
  const loadCustomOAuthBindings = async () => {
    try {
      const res = await API.get('/api/user/oauth/bindings');
      if (res.data.success) {
        setCustomOAuthBindings(res.data.data || []);
      } else {
        showError(res.data.message || t('获取绑定信息失败'));
      }
    } catch (error) {
      showError(error.response?.data?.message || error.message || t('获取绑定信息失败'));
    }
  };

  // Unbind custom OAuth provider
  const handleUnbindCustomOAuth = async (providerId, providerName) => {
    showConfirm({
      title: t('确认解绑'),
      content: t('确定要解绑 {{name}} 吗？', { name: providerName }),
      okText: t('确认'),
      cancelText: t('取消'),
      onOk: async () => {
        setCustomOAuthLoading((prev) => ({ ...prev, [providerId]: true }));
        try {
          const res = await API.delete(`/api/user/oauth/bindings/${providerId}`);
          if (res.data.success) {
            showSuccess(t('解绑成功'));
            await loadCustomOAuthBindings();
          } else {
            showError(res.data.message);
          }
        } catch (error) {
          showError(error.response?.data?.message || error.message || t('操作失败'));
        } finally {
          setCustomOAuthLoading((prev) => ({ ...prev, [providerId]: false }));
        }
      },
    });
  };

  // Handle bind custom OAuth
  const handleBindCustomOAuth = (provider) => {
    onCustomOAuthClicked(provider);
  };

  // Check if custom OAuth provider is bound
  const isCustomOAuthBound = (providerId) => {
    const normalizedId = Number(providerId);
    return customOAuthBindings.some((b) => Number(b.provider_id) === normalizedId);
  };

  // Get binding info for a provider
  const getCustomOAuthBinding = (providerId) => {
    const normalizedId = Number(providerId);
    return customOAuthBindings.find((b) => Number(b.provider_id) === normalizedId);
  };

  React.useEffect(() => {
    loadCustomOAuthBindings();
  }, []);

  const passkeyEnabled = passkeyStatus?.enabled;
  const lastUsedLabel = passkeyStatus?.last_used_at
    ? new Date(passkeyStatus.last_used_at).toLocaleString()
    : t('尚未使用');

  return (
    <div className='border border-ui-border rounded-2xl p-4' style={{ backgroundColor: 'var(--page-bg)' }}>
      {/* Card header */}
      <div className='flex items-center mb-4'>
        <div className='w-8 h-8 rounded-full bg-teal-500/10 flex items-center justify-center mr-3'>
          <Shield size={16} className='text-teal-600' />
        </div>
        <div>
          <span className='text-lg font-medium text-ui-text'>
            {t('账户管理')}
          </span>
          <div className='text-xs text-ui-text-2'>
            {t('账户绑定、安全设置和身份验证')}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className='flex gap-1 mb-4 border-b border-ui-border'>
        <button
          onClick={() => setActiveTab('binding')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'binding'
              ? 'border-ui-accent text-ui-text'
              : 'border-transparent text-ui-text-2 hover:text-ui-text'
          }`}
        >
          {t('账户绑定')}
        </button>
        <button
          onClick={() => setActiveTab('security')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'security'
              ? 'border-ui-accent text-ui-text'
              : 'border-transparent text-ui-text-2 hover:text-ui-text'
          }`}
        >
          {t('安全设置')}
        </button>
      </div>

      {/* Binding Tab */}
      {activeTab === 'binding' && (
        <div className='py-4'>
          <div className='grid grid-cols-1 lg:grid-cols-2 gap-4'>
            {/* Email binding */}
            <div className='border border-ui-border rounded-xl p-4' style={{ backgroundColor: 'var(--page-bg)' }}>
              <div className='flex items-center justify-between gap-3'>
                <div className='flex items-center flex-1 min-w-0'>
                  <div className='w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mr-3 flex-shrink-0'>
                    <Mail size={18} className='text-slate-600 dark:text-slate-300' />
                  </div>
                  <div className='flex-1 min-w-0'>
                    <div className='font-medium text-ui-text'>{t('邮箱')}</div>
                    <div className='text-sm text-ui-text-2 truncate'>
                      {renderAccountInfo(userState.user?.email, t('邮箱地址'))}
                    </div>
                  </div>
                </div>
                <div className='flex-shrink-0'>
                  <button
                    onClick={() => setShowEmailBindModal(true)}
                    className='inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-ui-border text-ui-text hover:bg-ui-bg-subtle transition-colors'
                  >
                    {isBound(userState.user?.email) ? t('修改绑定') : t('绑定')}
                  </button>
                </div>
              </div>
            </div>

            {/* WeChat binding */}
            <div className='border border-ui-border rounded-xl p-4' style={{ backgroundColor: 'var(--page-bg)' }}>
              <div className='flex items-center justify-between gap-3'>
                <div className='flex items-center flex-1 min-w-0'>
                  <div className='w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mr-3 flex-shrink-0'>
                    <SiWechat size={18} className='text-green-600' />
                  </div>
                  <div className='flex-1 min-w-0'>
                    <div className='font-medium text-ui-text'>{t('微信')}</div>
                    <div className='text-sm text-ui-text-2 truncate'>
                      {!status.wechat_login
                        ? t('未启用')
                        : isBound(userState.user?.wechat_id)
                          ? t('已绑定')
                          : t('未绑定')}
                    </div>
                  </div>
                </div>
                <div className='flex-shrink-0'>
                  <button
                    disabled={!status.wechat_login}
                    onClick={() => setShowWeChatBindModal(true)}
                    className='inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-ui-border text-ui-text hover:bg-ui-bg-subtle transition-colors disabled:opacity-50'
                  >
                    {isBound(userState.user?.wechat_id)
                      ? t('修改绑定')
                      : status.wechat_login
                        ? t('绑定')
                        : t('未启用')}
                  </button>
                </div>
              </div>
            </div>

            {/* GitHub binding */}
            <div className='border border-ui-border rounded-xl p-4' style={{ backgroundColor: 'var(--page-bg)' }}>
              <div className='flex items-center justify-between gap-3'>
                <div className='flex items-center flex-1 min-w-0'>
                  <div className='w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mr-3 flex-shrink-0'>
                    <Github size={18} className='text-slate-600 dark:text-slate-300' />
                  </div>
                  <div className='flex-1 min-w-0'>
                    <div className='font-medium text-ui-text'>{t('GitHub')}</div>
                    <div className='text-sm text-ui-text-2 truncate'>
                      {renderAccountInfo(userState.user?.github_id, t('GitHub ID'))}
                    </div>
                  </div>
                </div>
                <div className='flex-shrink-0'>
                  <button
                    onClick={() => onGitHubOAuthClicked(status.github_client_id)}
                    disabled={isBound(userState.user?.github_id) || !status.github_oauth}
                    className='inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-ui-border text-ui-text hover:bg-ui-bg-subtle transition-colors disabled:opacity-50'
                  >
                    {status.github_oauth ? t('绑定') : t('未启用')}
                  </button>
                </div>
              </div>
            </div>

            {/* Discord binding */}
            <div className='border border-ui-border rounded-xl p-4' style={{ backgroundColor: 'var(--page-bg)' }}>
              <div className='flex items-center justify-between gap-3'>
                <div className='flex items-center flex-1 min-w-0'>
                  <div className='w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mr-3 flex-shrink-0'>
                    <SiDiscord size={18} className='text-indigo-500' />
                  </div>
                  <div className='flex-1 min-w-0'>
                    <div className='font-medium text-ui-text'>{t('Discord')}</div>
                    <div className='text-sm text-ui-text-2 truncate'>
                      {renderAccountInfo(userState.user?.discord_id, t('Discord ID'))}
                    </div>
                  </div>
                </div>
                <div className='flex-shrink-0'>
                  <button
                    onClick={() => onDiscordOAuthClicked(status.discord_client_id)}
                    disabled={isBound(userState.user?.discord_id) || !status.discord_oauth}
                    className='inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-ui-border text-ui-text hover:bg-ui-bg-subtle transition-colors disabled:opacity-50'
                  >
                    {status.discord_oauth ? t('绑定') : t('未启用')}
                  </button>
                </div>
              </div>
            </div>

            {/* OIDC binding */}
            <div className='border border-ui-border rounded-xl p-4' style={{ backgroundColor: 'var(--page-bg)' }}>
              <div className='flex items-center justify-between gap-3'>
                <div className='flex items-center flex-1 min-w-0'>
                  <div className='w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mr-3 flex-shrink-0'>
                    <Shield size={18} className='text-slate-600 dark:text-slate-300' />
                  </div>
                  <div className='flex-1 min-w-0'>
                    <div className='font-medium text-ui-text'>{t('OIDC')}</div>
                    <div className='text-sm text-ui-text-2 truncate'>
                      {renderAccountInfo(userState.user?.oidc_id, t('OIDC ID'))}
                    </div>
                  </div>
                </div>
                <div className='flex-shrink-0'>
                  <button
                    onClick={() => onOIDCClicked(status.oidc_authorization_endpoint, status.oidc_client_id)}
                    disabled={isBound(userState.user?.oidc_id) || !status.oidc_enabled}
                    className='inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-ui-border text-ui-text hover:bg-ui-bg-subtle transition-colors disabled:opacity-50'
                  >
                    {status.oidc_enabled ? t('绑定') : t('未启用')}
                  </button>
                </div>
              </div>
            </div>

            {/* Telegram binding */}
            <div className='border border-ui-border rounded-xl p-4' style={{ backgroundColor: 'var(--page-bg)' }}>
              <div className='flex items-center justify-between gap-3'>
                <div className='flex items-center flex-1 min-w-0'>
                  <div className='w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mr-3 flex-shrink-0'>
                    <SiTelegram size={18} className='text-blue-500' />
                  </div>
                  <div className='flex-1 min-w-0'>
                    <div className='font-medium text-ui-text'>{t('Telegram')}</div>
                    <div className='text-sm text-ui-text-2 truncate'>
                      {renderAccountInfo(userState.user?.telegram_id, t('Telegram ID'))}
                    </div>
                  </div>
                </div>
                <div className='flex-shrink-0'>
                  {status.telegram_oauth ? (
                    isBound(userState.user?.telegram_id) ? (
                      <button disabled className='inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-ui-border text-ui-text disabled:opacity-50'>
                        {t('已绑定')}
                      </button>
                    ) : (
                      <button
                        onClick={() => setShowTelegramBindModal(true)}
                        className='inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-ui-border text-ui-text hover:bg-ui-bg-subtle transition-colors'
                      >
                        {t('绑定')}
                      </button>
                    )
                  ) : (
                    <button disabled className='inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-ui-border text-ui-text disabled:opacity-50'>
                      {t('未启用')}
                    </button>
                  )}
                </div>
              </div>
            </div>
            <ModalDialog
              open={showTelegramBindModal}
              onClose={() => setShowTelegramBindModal(false)}
              title={t('绑定 Telegram')}
              hideFooter
            >
              <div className='my-3 text-sm text-ui-text-2'>
                {t('点击下方按钮通过 Telegram 完成绑定')}
              </div>
              <div className='flex justify-center'>
                <div className='scale-90'>
                  <TelegramLoginButton
                    dataAuthUrl='/api/oauth/telegram/bind'
                    botName={status.telegram_bot_name}
                  />
                </div>
              </div>
            </ModalDialog>

            {/* LinuxDO binding */}
            <div className='border border-ui-border rounded-xl p-4' style={{ backgroundColor: 'var(--page-bg)' }}>
              <div className='flex items-center justify-between gap-3'>
                <div className='flex items-center flex-1 min-w-0'>
                  <div className='w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mr-3 flex-shrink-0'>
                    <SiLinux size={18} className='text-slate-600 dark:text-slate-300' />
                  </div>
                  <div className='flex-1 min-w-0'>
                    <div className='font-medium text-ui-text'>{t('LinuxDO')}</div>
                    <div className='text-sm text-ui-text-2 truncate'>
                      {renderAccountInfo(userState.user?.linux_do_id, t('LinuxDO ID'))}
                    </div>
                  </div>
                </div>
                <div className='flex-shrink-0'>
                  <button
                    onClick={() => onLinuxDOOAuthClicked(status.linuxdo_client_id)}
                    disabled={isBound(userState.user?.linux_do_id) || !status.linuxdo_oauth}
                    className='inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-ui-border text-ui-text hover:bg-ui-bg-subtle transition-colors disabled:opacity-50'
                  >
                    {status.linuxdo_oauth ? t('绑定') : t('未启用')}
                  </button>
                </div>
              </div>
            </div>

            {/* Custom OAuth providers */}
            {status.custom_oauth_providers &&
              status.custom_oauth_providers.map((provider) => {
                const bound = isCustomOAuthBound(provider.id);
                const binding = getCustomOAuthBinding(provider.id);
                return (
                  <div key={provider.slug} className='border border-ui-border rounded-xl p-4' style={{ backgroundColor: 'var(--page-bg)' }}>
                    <div className='flex items-center justify-between gap-3'>
                      <div className='flex items-center flex-1 min-w-0'>
                        <div className='w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mr-3 flex-shrink-0'>
                          {getOAuthProviderIcon(provider.icon || binding?.provider_icon || '', 20)}
                        </div>
                        <div className='flex-1 min-w-0'>
                          <div className='font-medium text-ui-text'>{provider.name}</div>
                          <div className='text-sm text-ui-text-2 truncate'>
                            {bound
                              ? renderAccountInfo(binding?.provider_user_id, t('{{name}} ID', { name: provider.name }))
                              : t('未绑定')}
                          </div>
                        </div>
                      </div>
                      <div className='flex-shrink-0'>
                        {bound ? (
                          <button
                            onClick={() => handleUnbindCustomOAuth(provider.id, provider.name)}
                            disabled={customOAuthLoading[provider.id]}
                            className='inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50'
                          >
                            {customOAuthLoading[provider.id] && <Loader2 size={12} className='animate-spin' />}
                            {t('解绑')}
                          </button>
                        ) : (
                          <button
                            onClick={() => handleBindCustomOAuth(provider)}
                            className='inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-ui-border text-ui-text hover:bg-ui-bg-subtle transition-colors'
                          >
                            {t('绑定')}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Security Tab */}
      {activeTab === 'security' && (
        <div className='py-4'>
          <div className='space-y-4'>
            {/* System access token */}
            <div className='border border-ui-border rounded-xl p-4' style={{ backgroundColor: 'var(--page-bg)' }}>
              <div className='flex flex-col sm:flex-row items-start sm:justify-between gap-4'>
                <div className='flex items-start w-full sm:w-auto'>
                  <div className='w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mr-4 flex-shrink-0'>
                    <Key size={20} className='text-slate-600 dark:text-slate-300' />
                  </div>
                  <div className='flex-1'>
                    <h6 className='text-sm font-semibold text-ui-text mb-1'>
                      {t('系统访问令牌')}
                    </h6>
                    <span className='text-sm text-ui-text-2'>
                      {t('用于API调用的身份验证令牌，请妥善保管')}
                    </span>
                    {systemToken && (
                      <div className='mt-3'>
                        <TextField
                          value={systemToken}
                          onChange={() => {}}
                          disabled
                          prefix={<Key size={14} />}
                          onClick={handleSystemTokenClick}
                        />
                      </div>
                    )}
                  </div>
                </div>
                <button
                  onClick={generateAccessToken}
                  className='inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl bg-ui-accent text-ui-accent-fg hover:bg-ui-accent-hover transition-colors w-full sm:w-auto'
                >
                  {systemToken ? t('重新生成') : t('生成令牌')}
                </button>
              </div>
            </div>

            {/* Password management */}
            <div className='border border-ui-border rounded-xl p-4' style={{ backgroundColor: 'var(--page-bg)' }}>
              <div className='flex flex-col sm:flex-row items-start sm:justify-between gap-4'>
                <div className='flex items-start w-full sm:w-auto'>
                  <div className='w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mr-4 flex-shrink-0'>
                    <Lock size={20} className='text-slate-600 dark:text-slate-300' />
                  </div>
                  <div>
                    <h6 className='text-sm font-semibold text-ui-text mb-1'>
                      {t('密码管理')}
                    </h6>
                    <span className='text-sm text-ui-text-2'>
                      {t('定期更改密码可以提高账户安全性')}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setShowChangePasswordModal(true)}
                  className='inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl bg-ui-accent text-ui-accent-fg hover:bg-ui-accent-hover transition-colors w-full sm:w-auto'
                >
                  {t('修改密码')}
                </button>
              </div>
            </div>

            {/* Passkey setting */}
            <div className='border border-ui-border rounded-xl p-4' style={{ backgroundColor: 'var(--page-bg)' }}>
              <div className='flex flex-col sm:flex-row items-start sm:justify-between gap-4'>
                <div className='flex items-start w-full sm:w-auto'>
                  <div className='w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mr-4 flex-shrink-0'>
                    <Key size={20} className='text-slate-600 dark:text-slate-300' />
                  </div>
                  <div>
                    <h6 className='text-sm font-semibold text-ui-text mb-1'>
                      {t('Passkey 登录')}
                    </h6>
                    <span className='text-sm text-ui-text-2'>
                      {passkeyEnabled
                        ? t('已启用 Passkey，无需密码即可登录')
                        : t('使用 Passkey 实现免密且更安全的登录体验')}
                    </span>
                    <div className='mt-2 text-xs text-ui-text-2 space-y-1'>
                      <div>
                        {t('最后使用时间')}：{lastUsedLabel}
                      </div>
                      {!passkeySupported && (
                        <div className='text-amber-600'>
                          {t('当前设备不支持 Passkey')}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={
                    passkeyEnabled
                      ? () => {
                          showConfirm({
                            title: t('确认解绑 Passkey'),
                            content: t('解绑后将无法使用 Passkey 登录，确定要继续吗？'),
                            okText: t('确认解绑'),
                            cancelText: t('取消'),
                            danger: true,
                            onOk: onPasskeyDelete,
                          });
                        }
                      : onPasskeyRegister
                  }
                  disabled={(!passkeySupported && !passkeyEnabled) || (passkeyEnabled ? passkeyDeleteLoading : passkeyRegisterLoading)}
                  className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl transition-colors w-full sm:w-auto disabled:opacity-50 ${
                    passkeyEnabled
                      ? 'bg-ui-danger text-white hover:opacity-90'
                      : 'bg-ui-accent text-ui-accent-fg hover:bg-ui-accent-hover'
                  }`}
                >
                  {(passkeyEnabled ? passkeyDeleteLoading : passkeyRegisterLoading) && (
                    <Loader2 size={14} className='animate-spin' />
                  )}
                  {passkeyEnabled ? t('解绑 Passkey') : t('注册 Passkey')}
                </button>
              </div>
            </div>

            {/* Two-factor auth */}
            <TwoFASetting t={t} />

            {/* Danger zone */}
            <div className='border border-ui-border rounded-xl p-4' style={{ backgroundColor: 'var(--page-bg)' }}>
              <div className='flex flex-col sm:flex-row items-start sm:justify-between gap-4'>
                <div className='flex items-start w-full sm:w-auto'>
                  <div className='w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mr-4 flex-shrink-0'>
                    <Trash2 size={20} className='text-slate-600 dark:text-slate-300' />
                  </div>
                  <div>
                    <h6 className='text-sm font-semibold text-ui-text mb-1'>
                      {t('删除账户')}
                    </h6>
                    <span className='text-sm text-ui-text-2'>
                      {t('此操作不可逆，所有数据将被永久删除')}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setShowAccountDeleteModal(true)}
                  className='inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl bg-ui-danger text-white hover:opacity-90 transition-opacity disabled:opacity-50 w-full sm:w-auto'
                >
                  {t('删除账户')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountManagement;
