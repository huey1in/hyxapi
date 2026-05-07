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

import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { UserContext } from '../../context/User';
import { StatusContext } from '../../context/Status';
import {
  API,
  getLogo,
  showError,
  showInfo,
  showSuccess,
  updateAPI,
  getSystemName,
  getOAuthProviderIcon,
  setUserData,
  onGitHubOAuthClicked,
  onDiscordOAuthClicked,
  onOIDCClicked,
  onLinuxDOOAuthClicked,
  onCustomOAuthClicked,
  prepareCredentialRequestOptions,
  buildAssertionResult,
  isPasskeySupported,
} from '../../helpers';
import Turnstile from 'react-turnstile';
import { Modal } from '@douyinfe/semi-ui';
import TelegramLoginButton from 'react-telegram-login';
import OIDCIcon from '../common/logo/OIDCIcon';
import WeChatIcon from '../common/logo/WeChatIcon';
import LinuxDoIcon from '../common/logo/LinuxDoIcon';
import TwoFAVerification from './TwoFAVerification';
import { useTranslation } from 'react-i18next';
import { SiDiscord } from 'react-icons/si';

const inputClass =
  'w-full px-4 py-2.5 text-sm border border-ui-border rounded-lg outline-none focus:ring-2 focus:ring-ui-accent bg-transparent text-ui-text placeholder:text-ui-text-3';

const baiFontStyle = {
  fontFamily:
    "'Space Grotesk', Season-Sans, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
};

// BAI-style 2-column OAuth tile with icon + name
const OAuthTile = ({ onClick, loading, disabled, name, icon }) => (
  <button
    onClick={onClick}
    disabled={loading || disabled}
    className='h-11 w-full flex items-center gap-3 px-4 text-sm font-medium border border-ui-border rounded-xl bg-[var(--page-bg)] hover:bg-ui-bg-subtle text-ui-text transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed'
  >
    {loading ? (
      <span className='w-4 h-4 border-2 border-ui-text-3 border-t-transparent rounded-full animate-spin' />
    ) : (
      <span className='flex items-center justify-center w-5 h-5 flex-shrink-0'>{icon}</span>
    )}
    <span>{name}</span>
  </button>
);

const OAuthButton = ({ onClick, loading, disabled, children, icon }) => (
  <button
    onClick={onClick}
    disabled={loading || disabled}
    className='w-full flex items-center justify-center gap-3 px-4 py-2.5 text-sm font-medium border border-ui-border rounded-lg bg-[var(--page-bg)] hover:bg-ui-bg-subtle text-ui-text transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
  >
    {loading ? (
      <span className='w-4 h-4 border-2 border-ui-text-3 border-t-transparent rounded-full animate-spin' />
    ) : icon}
    <span>{children}</span>
  </button>
);

const LoginForm = ({ embedded = false, onSuccess, onSwitchToRegister, onSwitchToReset }) => {
  let navigate = useNavigate();
  const handleAuthed = (data, defaultPath = '/console') => {
    if (typeof onSuccess === 'function') {
      onSuccess(data);
    }
    navigate(defaultPath);
  };
  const { t } = useTranslation();
  const githubButtonTextKeyByState = {
    idle: '使用 GitHub 继续',
    redirecting: '正在跳转 GitHub...',
    timeout: '请求超时，请刷新页面后重新发起 GitHub 登录',
  };
  const [inputs, setInputs] = useState({ username: '', password: '', wechat_verification_code: '' });
  const { username, password } = inputs;
  const [searchParams] = useSearchParams();
  const [submitted, setSubmitted] = useState(false);
  const [userState, userDispatch] = useContext(UserContext);
  const [statusState] = useContext(StatusContext);
  const [turnstileEnabled, setTurnstileEnabled] = useState(false);
  const [turnstileSiteKey, setTurnstileSiteKey] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [showWeChatLoginModal, setShowWeChatLoginModal] = useState(false);
  const [showEmailLogin, setShowEmailLogin] = useState(false);
  const [wechatLoading, setWechatLoading] = useState(false);
  const [githubLoading, setGithubLoading] = useState(false);
  const [discordLoading, setDiscordLoading] = useState(false);
  const [oidcLoading, setOidcLoading] = useState(false);
  const [linuxdoLoading, setLinuxdoLoading] = useState(false);
  const [emailLoginLoading, setEmailLoginLoading] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [resetPasswordLoading, setResetPasswordLoading] = useState(false);
  const [otherLoginOptionsLoading, setOtherLoginOptionsLoading] = useState(false);
  const [wechatCodeSubmitLoading, setWechatCodeSubmitLoading] = useState(false);
  const [showTwoFA, setShowTwoFA] = useState(false);
  const [passkeySupported, setPasskeySupported] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [hasUserAgreement, setHasUserAgreement] = useState(false);
  const [hasPrivacyPolicy, setHasPrivacyPolicy] = useState(false);
  const [githubButtonState, setGithubButtonState] = useState('idle');
  const [githubButtonDisabled, setGithubButtonDisabled] = useState(false);
  const githubTimeoutRef = useRef(null);
  const githubButtonText = t(githubButtonTextKeyByState[githubButtonState]);
  const [customOAuthLoading, setCustomOAuthLoading] = useState({});

  const logo = getLogo();
  const systemName = getSystemName();

  let affCode = new URLSearchParams(window.location.search).get('aff');
  if (affCode) localStorage.setItem('aff', affCode);

  const status = useMemo(() => {
    if (statusState?.status) return statusState.status;
    const savedStatus = localStorage.getItem('status');
    if (!savedStatus) return {};
    try { return JSON.parse(savedStatus) || {}; } catch { return {}; }
  }, [statusState?.status]);

  const hasCustomOAuthProviders = (status.custom_oauth_providers || []).length > 0;
  const hasOAuthLoginOptions = Boolean(
    status.github_oauth || status.discord_oauth || status.oidc_enabled ||
    status.wechat_login || status.linuxdo_oauth || status.telegram_oauth || hasCustomOAuthProviders,
  );

  useEffect(() => {
    if (status?.turnstile_check) {
      setTurnstileEnabled(true);
      setTurnstileSiteKey(status.turnstile_site_key);
    }
    setHasUserAgreement(status?.user_agreement_enabled || false);
    setHasPrivacyPolicy(status?.privacy_policy_enabled || false);
  }, [status]);

  useEffect(() => {
    isPasskeySupported().then(setPasskeySupported).catch(() => setPasskeySupported(false));
    return () => { if (githubTimeoutRef.current) clearTimeout(githubTimeoutRef.current); };
  }, []);

  useEffect(() => {
    if (searchParams.get('expired')) showError(t('未登录或登录已过期，请重新登录'));
  }, []);

  const onWeChatLoginClicked = () => {
    if ((hasUserAgreement || hasPrivacyPolicy) && !agreedToTerms) { showInfo(t('请先阅读并同意用户协议和隐私政策')); return; }
    setWechatLoading(true);
    setShowWeChatLoginModal(true);
    setWechatLoading(false);
  };

  const onSubmitWeChatVerificationCode = async () => {
    if (turnstileEnabled && turnstileToken === '') { showInfo('请稍后几秒重试，Turnstile 正在检查用户环境！'); return; }
    setWechatCodeSubmitLoading(true);
    try {
      const res = await API.get(`/api/oauth/wechat?code=${inputs.wechat_verification_code}`);
      const { success, message, data } = res.data;
      if (success) {
        userDispatch({ type: 'login', payload: data });
        localStorage.setItem('user', JSON.stringify(data));
        setUserData(data);
        updateAPI();
        showSuccess('登录成功！');
        setShowWeChatLoginModal(false);
        handleAuthed(data, '/');
      } else showError(message);
    } catch { showError('登录失败，请重试'); }
    finally { setWechatCodeSubmitLoading(false); }
  };

  function handleChange(name, value) {
    setInputs((inputs) => ({ ...inputs, [name]: value }));
  }

  async function handleSubmit(e) {
    if ((hasUserAgreement || hasPrivacyPolicy) && !agreedToTerms) { showInfo(t('请先阅读并同意用户协议和隐私政策')); return; }
    if (turnstileEnabled && turnstileToken === '') { showInfo('请稍后几秒重试，Turnstile 正在检查用户环境！'); return; }
    setSubmitted(true);
    setLoginLoading(true);
    try {
      if (username && password) {
        const res = await API.post(`/api/user/login?turnstile=${turnstileToken}`, { username, password });
        const { success, message, data } = res.data;
        if (success) {
          if (data && data.require_2fa) { setShowTwoFA(true); setLoginLoading(false); return; }
          userDispatch({ type: 'login', payload: data });
          setUserData(data);
          updateAPI();
          showSuccess('登录成功！');
          if (username === 'root' && password === '123456') {
            Modal.error({ title: '您正在使用默认密码！', content: '请立刻修改默认密码！', centered: true });
          }
          handleAuthed(data, '/console');
        } else showError(message);
      } else showError('请输入用户名和密码！');
    } catch { showError('登录失败，请重试'); }
    finally { setLoginLoading(false); }
  }

  const onTelegramLoginClicked = async (response) => {
    if ((hasUserAgreement || hasPrivacyPolicy) && !agreedToTerms) { showInfo(t('请先阅读并同意用户协议和隐私政策')); return; }
    const fields = ['id', 'first_name', 'last_name', 'username', 'photo_url', 'auth_date', 'hash', 'lang'];
    const params = {};
    fields.forEach((field) => { if (response[field]) params[field] = response[field]; });
    try {
      const res = await API.get(`/api/oauth/telegram/login`, { params });
      const { success, message, data } = res.data;
      if (success) {
        userDispatch({ type: 'login', payload: data });
        localStorage.setItem('user', JSON.stringify(data));
        showSuccess('登录成功！');
        setUserData(data);
        updateAPI();
        handleAuthed(data, '/');
      } else showError(message);
    } catch { showError('登录失败，请重试'); }
  };

  const handleGitHubClick = () => {
    if ((hasUserAgreement || hasPrivacyPolicy) && !agreedToTerms) { showInfo(t('请先阅读并同意用户协议和隐私政策')); return; }
    if (githubButtonDisabled) return;
    setGithubLoading(true);
    setGithubButtonDisabled(true);
    setGithubButtonState('redirecting');
    if (githubTimeoutRef.current) clearTimeout(githubTimeoutRef.current);
    githubTimeoutRef.current = setTimeout(() => {
      setGithubLoading(false);
      setGithubButtonState('timeout');
      setGithubButtonDisabled(true);
    }, 20000);
    try {
      onGitHubOAuthClicked(status.github_client_id, { shouldLogout: true });
    } finally { setTimeout(() => setGithubLoading(false), 3000); }
  };

  const handleDiscordClick = () => {
    if ((hasUserAgreement || hasPrivacyPolicy) && !agreedToTerms) { showInfo(t('请先阅读并同意用户协议和隐私政策')); return; }
    setDiscordLoading(true);
    try { onDiscordOAuthClicked(status.discord_client_id, { shouldLogout: true }); }
    finally { setTimeout(() => setDiscordLoading(false), 3000); }
  };

  const handleOIDCClick = () => {
    if ((hasUserAgreement || hasPrivacyPolicy) && !agreedToTerms) { showInfo(t('请先阅读并同意用户协议和隐私政策')); return; }
    setOidcLoading(true);
    try { onOIDCClicked(status.oidc_authorization_endpoint, status.oidc_client_id, false, { shouldLogout: true }); }
    finally { setTimeout(() => setOidcLoading(false), 3000); }
  };

  const handleLinuxDOClick = () => {
    if ((hasUserAgreement || hasPrivacyPolicy) && !agreedToTerms) { showInfo(t('请先阅读并同意用户协议和隐私政策')); return; }
    setLinuxdoLoading(true);
    try { onLinuxDOOAuthClicked(status.linuxdo_client_id, { shouldLogout: true }); }
    finally { setTimeout(() => setLinuxdoLoading(false), 3000); }
  };

  const handleCustomOAuthClick = (provider) => {
    if ((hasUserAgreement || hasPrivacyPolicy) && !agreedToTerms) { showInfo(t('请先阅读并同意用户协议和隐私政策')); return; }
    setCustomOAuthLoading((prev) => ({ ...prev, [provider.slug]: true }));
    try { onCustomOAuthClicked(provider, { shouldLogout: true }); }
    finally { setTimeout(() => setCustomOAuthLoading((prev) => ({ ...prev, [provider.slug]: false })), 3000); }
  };

  const handlePasskeyLogin = async () => {
    if ((hasUserAgreement || hasPrivacyPolicy) && !agreedToTerms) { showInfo(t('请先阅读并同意用户协议和隐私政策')); return; }
    if (!passkeySupported || !window.PublicKeyCredential) { showInfo('当前环境无法使用 Passkey 登录'); return; }
    setPasskeyLoading(true);
    try {
      const beginRes = await API.post('/api/user/passkey/login/begin');
      const { success, message, data } = beginRes.data;
      if (!success) { showError(message || '无法发起 Passkey 登录'); return; }
      const publicKeyOptions = prepareCredentialRequestOptions(data?.options || data?.publicKey || data);
      const assertion = await navigator.credentials.get({ publicKey: publicKeyOptions });
      const payload = buildAssertionResult(assertion);
      if (!payload) { showError('Passkey 验证失败，请重试'); return; }
      const finishRes = await API.post('/api/user/passkey/login/finish', payload);
      const finish = finishRes.data;
      if (finish.success) {
        userDispatch({ type: 'login', payload: finish.data });
        setUserData(finish.data);
        updateAPI();
        showSuccess('登录成功！');
        handleAuthed(finish.data, '/console');
      } else showError(finish.message || 'Passkey 登录失败，请重试');
    } catch (error) {
      if (error?.name === 'AbortError') showInfo('已取消 Passkey 登录');
      else showError('Passkey 登录失败，请重试');
    } finally { setPasskeyLoading(false); }
  };

  const handle2FASuccess = (data) => {
    userDispatch({ type: 'login', payload: data });
    setUserData(data);
    updateAPI();
    showSuccess('登录成功！');
    handleAuthed(data, '/console');
  };

  const handleBackToLogin = () => {
    setShowTwoFA(false);
    setInputs({ username: '', password: '', wechat_verification_code: '' });
  };

  const renderTerms = () => (
    (hasUserAgreement || hasPrivacyPolicy) && (
      <label className='flex items-start gap-2 cursor-pointer'>
        <input
          type='checkbox'
          checked={agreedToTerms}
          onChange={(e) => setAgreedToTerms(e.target.checked)}
          className='mt-0.5 accent-black'
        />
        <span className='text-xs text-ui-text-2'>
          {t('我已阅读并同意')}
          {hasUserAgreement && (
            <a href='/user-agreement' target='_blank' rel='noopener noreferrer' className='underline mx-1'>{t('用户协议')}</a>
          )}
          {hasUserAgreement && hasPrivacyPolicy && t('和')}
          {hasPrivacyPolicy && (
            <a href='/privacy-policy' target='_blank' rel='noopener noreferrer' className='underline mx-1'>{t('隐私政策')}</a>
          )}
        </span>
      </label>
    )
  );

  const renderOAuthOptions = () => {
    const tiles = [];
    const termsBlocked = (hasUserAgreement || hasPrivacyPolicy) && !agreedToTerms;
    if (status.wechat_login)
      tiles.push(
        <OAuthTile key='wechat' onClick={onWeChatLoginClicked} loading={wechatLoading} disabled={termsBlocked}
          name={t('微信')} icon={<WeChatIcon style={{ width: 22, height: 22, color: '#07C160' }} />} />
      );
    if (status.github_oauth)
      tiles.push(
        <OAuthTile key='github' onClick={handleGitHubClick} loading={githubLoading} disabled={githubButtonDisabled || termsBlocked}
          name='GitHub' icon={<svg viewBox='0 0 24 24' className='w-[22px] h-[22px]' fill='currentColor'><path d='M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z' /></svg>} />
      );
    if (status.discord_oauth)
      tiles.push(
        <OAuthTile key='discord' onClick={handleDiscordClick} loading={discordLoading} disabled={termsBlocked}
          name='Discord' icon={<SiDiscord style={{ color: '#5865F2', width: 22, height: 22 }} />} />
      );
    if (status.oidc_enabled)
      tiles.push(
        <OAuthTile key='oidc' onClick={handleOIDCClick} loading={oidcLoading} disabled={termsBlocked}
          name='OIDC' icon={<OIDCIcon style={{ width: 22, height: 22 }} />} />
      );
    if (status.linuxdo_oauth)
      tiles.push(
        <OAuthTile key='linuxdo' onClick={handleLinuxDOClick} loading={linuxdoLoading} disabled={termsBlocked}
          name='LinuxDO' icon={<LinuxDoIcon style={{ width: 22, height: 22, color: '#E95420' }} />} />
      );
    if (status.custom_oauth_providers)
      status.custom_oauth_providers.forEach((provider) => {
        tiles.push(
          <OAuthTile key={provider.slug} onClick={() => handleCustomOAuthClick(provider)}
            loading={customOAuthLoading[provider.slug]} disabled={termsBlocked}
            name={provider.name} icon={getOAuthProviderIcon(provider.icon || '', 22)} />
        );
      });
    if (status.passkey_login && passkeySupported)
      tiles.push(
        <OAuthTile key='passkey' onClick={handlePasskeyLogin} loading={passkeyLoading} disabled={termsBlocked}
          name={t('Passkey')} icon={<svg viewBox='0 0 24 24' className='w-[22px] h-[22px]' fill='none' stroke='currentColor' strokeWidth='2'><path strokeLinecap='round' strokeLinejoin='round' d='M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z' /></svg>} />
      );

    return (
      <div className='space-y-2.5'>
        {renderTerms()}

        {tiles.length > 0 && tiles}

        {status.telegram_oauth && (
          <div className='flex justify-center'>
            <TelegramLoginButton dataOnauth={onTelegramLoginClicked} botName={status.telegram_bot_name} />
          </div>
        )}

        {tiles.length > 0 && (
          <div className='flex items-center gap-3'>
            <div className='flex-1 h-px bg-ui-border' />
            <span className='text-xs text-ui-text-3'>{t('或')}</span>
            <div className='flex-1 h-px bg-ui-border' />
          </div>
        )}

        <button
          onClick={() => { setEmailLoginLoading(true); setShowEmailLogin(true); setEmailLoginLoading(false); }}
          className='h-11 w-full flex items-center gap-3 px-4 text-sm font-medium border border-ui-border rounded-xl bg-[var(--page-bg)] hover:bg-ui-bg-subtle text-ui-text transition-all duration-150'
        >
          <svg viewBox='0 0 24 24' className='w-5 h-5 flex-shrink-0' fill='none' stroke='currentColor' strokeWidth='1.75'>
            <path strokeLinecap='round' strokeLinejoin='round' d='M3 8l9 6 9-6M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' />
          </svg>
          {t('使用 邮箱或用户名 登录')}
        </button>
      </div>
    );
  };

  const renderEmailLoginForm = () => (
    <div className='space-y-3'>
      {status.passkey_login && passkeySupported && (
        <OAuthButton onClick={handlePasskeyLogin} loading={passkeyLoading}
          icon={<svg viewBox='0 0 24 24' className='w-5 h-5' fill='none' stroke='currentColor' strokeWidth='2'><path strokeLinecap='round' strokeLinejoin='round' d='M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z'/></svg>}>
          {t('使用 Passkey 登录')}
        </OAuthButton>
      )}

      <div>
        <label className='block mb-1.5 text-sm font-medium text-ui-text'>{t('用户名或邮箱')}</label>
        <input
          type='text'
          placeholder={t('请输入您的用户名或邮箱地址')}
          value={inputs.username}
          onChange={(e) => handleChange('username', e.target.value)}
          className={inputClass}
        />
      </div>

      <div>
        <div className='flex items-center justify-between mb-1.5'>
          <label className='text-sm font-medium text-ui-text'>{t('密码')}</label>
          <button
            type='button'
            onClick={() => {
              if (embedded && onSwitchToReset) { onSwitchToReset(); }
              else { setResetPasswordLoading(true); navigate('/reset'); setResetPasswordLoading(false); }
            }}
            className='text-xs text-ui-text-3 hover:text-ui-text transition-colors'
          >
            {t('忘记密码？')}
          </button>
        </div>
        <input
          type='password'
          placeholder={t('请输入您的密码')}
          value={inputs.password}
          onChange={(e) => handleChange('password', e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          className={inputClass}
        />
      </div>

      {renderTerms()}

      <button
        onClick={handleSubmit}
        disabled={loginLoading || ((hasUserAgreement || hasPrivacyPolicy) && !agreedToTerms)}
        className='w-full h-11 text-sm font-medium rounded-xl transition-colors bg-ui-accent text-ui-accent-fg hover:bg-ui-accent-hover disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2'
      >
        {loginLoading && <span className='w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin' />}
        {t('继续')}
      </button>

      {hasOAuthLoginOptions && (
        <button
          onClick={() => { setOtherLoginOptionsLoading(true); setShowEmailLogin(false); setOtherLoginOptionsLoading(false); }}
          className='w-full h-10 text-sm border border-ui-border rounded-xl text-ui-text-2 hover:text-ui-text hover:bg-ui-bg-subtle transition-all duration-150'
        >
          {t('其他登录选项')}
        </button>
      )}
    </div>
  );

  const cardContent = (
    <>
      <div className='mb-6'>
        <h2 className='text-xl font-semibold text-ui-text' style={baiFontStyle}>
          {t('登录')}
        </h2>
        <p className='text-[13px] text-ui-text-3 mt-0.5'>{systemName}</p>
      </div>

      {showEmailLogin || !hasOAuthLoginOptions ? renderEmailLoginForm() : renderOAuthOptions()}

      {!status.self_use_mode_enabled && (
        <p className='mt-5 pt-4 border-t border-ui-border text-[13px] text-ui-text-3'>
          {t('没有账户？')}{' '}
          {embedded && onSwitchToRegister ? (
            <button onClick={onSwitchToRegister} className='text-ui-text font-medium hover:underline bg-transparent cursor-pointer'>
              {t('注册')}
            </button>
          ) : (
            <Link to='/register' className='text-ui-text font-medium hover:underline'>{t('注册')}</Link>
          )}
        </p>
      )}
    </>
  );

  const turnstileNode = turnstileEnabled && (
    <div className='flex justify-center mt-6'>
      <Turnstile sitekey={turnstileSiteKey} onVerify={(token) => setTurnstileToken(token)} />
    </div>
  );

  const wechatModalNode = (
    <Modal
      title={t('微信扫码登录')}
      visible={showWeChatLoginModal}
      maskClosable={true}
      onOk={onSubmitWeChatVerificationCode}
      onCancel={() => setShowWeChatLoginModal(false)}
      okText={t('登录')}
      centered={true}
      okButtonProps={{ loading: wechatCodeSubmitLoading }}
    >
      <div className='flex flex-col items-center'>
        <img src={status.wechat_qrcode} alt='微信二维码' className='mb-4' />
      </div>
      <p className='text-center text-sm text-ui-text-2 mb-4'>
        {t('微信扫码关注公众号，输入「验证码」获取验证码（三分钟内有效）')}
      </p>
      <input
        type='text'
        placeholder={t('验证码')}
        value={inputs.wechat_verification_code}
        onChange={(e) => handleChange('wechat_verification_code', e.target.value)}
        className={inputClass}
      />
    </Modal>
  );

  const twoFAModalNode = (
    <Modal
      title='两步验证'
      visible={showTwoFA}
      onCancel={handleBackToLogin}
      footer={null}
      width={450}
      centered
    >
      <TwoFAVerification onSuccess={handle2FASuccess} onBack={handleBackToLogin} isModal={true} />
    </Modal>
  );

  if (embedded) {
    return (
      <>
        {cardContent}
        {turnstileNode}
        {wechatModalNode}
        {twoFAModalNode}
      </>
    );
  }

  return (
    <div className='min-h-[calc(100vh-4rem)] flex items-start sm:items-center justify-center px-0 sm:px-4 pt-24 pb-12'>
      <div className='w-full max-w-md sm:mt-[40px]'>
        <div className='p-6 sm:bg-white sm:rounded-2xl sm:border sm:border-black/5 sm:p-8 sm:shadow-sm'>
          {cardContent}
        </div>

        {turnstileNode}
      </div>

      {wechatModalNode}
      {twoFAModalNode}
    </div>
  );
};

export default LoginForm;
