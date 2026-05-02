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
import { Link, useNavigate } from 'react-router-dom';
import {
  API,
  showError,
  showInfo,
  showSuccess,
  updateAPI,
  getOAuthProviderIcon,
  setUserData,
  onDiscordOAuthClicked,
  onCustomOAuthClicked,
  onGitHubOAuthClicked,
  onLinuxDOOAuthClicked,
  onOIDCClicked,
} from '../../helpers';
import Turnstile from 'react-turnstile';
import { Modal } from '@douyinfe/semi-ui';
import WeChatIcon from '../common/logo/WeChatIcon';
import OIDCIcon from '../common/logo/OIDCIcon';
import LinuxDoIcon from '../common/logo/LinuxDoIcon';
import TelegramLoginButton from 'react-telegram-login/src';
import { UserContext } from '../../context/User';
import { StatusContext } from '../../context/Status';
import { useTranslation } from 'react-i18next';
import { SiDiscord } from 'react-icons/si';

const inputClass =
  'w-full px-4 py-3 text-sm border border-ui-border rounded-lg outline-none focus:ring-2 focus:ring-ui-accent bg-ui-bg text-ui-text placeholder:text-ui-text-3';

const OAuthButton = ({ onClick, loading, disabled, children, icon }) => (
  <button
    onClick={onClick}
    disabled={loading || disabled}
    className='w-full flex items-center justify-center gap-3 px-4 py-3 text-sm font-medium border border-ui-border rounded-lg bg-ui-bg-elevated hover:bg-ui-bg-subtle text-ui-text transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
  >
    {loading ? (
      <span className='w-4 h-4 border-2 border-ui-text-3 border-t-transparent rounded-full animate-spin' />
    ) : icon}
    <span>{children}</span>
  </button>
);

const RegisterForm = () => {
  let navigate = useNavigate();
  const { t } = useTranslation();
  const githubButtonTextKeyByState = {
    idle: '使用 GitHub 继续',
    redirecting: '正在跳转 GitHub...',
    timeout: '请求超时，请刷新页面后重新发起 GitHub 登录',
  };
  const [inputs, setInputs] = useState({
    username: '',
    password: '',
    password2: '',
    email: '',
    verification_code: '',
    wechat_verification_code: '',
  });
  const { username, password, password2 } = inputs;
  const [userState, userDispatch] = useContext(UserContext);
  const [statusState] = useContext(StatusContext);
  const [turnstileEnabled, setTurnstileEnabled] = useState(false);
  const [turnstileSiteKey, setTurnstileSiteKey] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [showWeChatLoginModal, setShowWeChatLoginModal] = useState(false);
  const [showEmailRegister, setShowEmailRegister] = useState(false);
  const [wechatLoading, setWechatLoading] = useState(false);
  const [githubLoading, setGithubLoading] = useState(false);
  const [discordLoading, setDiscordLoading] = useState(false);
  const [oidcLoading, setOidcLoading] = useState(false);
  const [linuxdoLoading, setLinuxdoLoading] = useState(false);
  const [emailRegisterLoading, setEmailRegisterLoading] = useState(false);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [verificationCodeLoading, setVerificationCodeLoading] = useState(false);
  const [otherRegisterOptionsLoading, setOtherRegisterOptionsLoading] = useState(false);
  const [wechatCodeSubmitLoading, setWechatCodeSubmitLoading] = useState(false);
  const [customOAuthLoading, setCustomOAuthLoading] = useState({});
  const [disableButton, setDisableButton] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [hasUserAgreement, setHasUserAgreement] = useState(false);
  const [hasPrivacyPolicy, setHasPrivacyPolicy] = useState(false);
  const [showEmailVerification, setShowEmailVerification] = useState(false);
  const [githubButtonState, setGithubButtonState] = useState('idle');
  const [githubButtonDisabled, setGithubButtonDisabled] = useState(false);
  const githubTimeoutRef = useRef(null);
  const githubButtonText = t(githubButtonTextKeyByState[githubButtonState]);

  let affCode = new URLSearchParams(window.location.search).get('aff');
  if (affCode) localStorage.setItem('aff', affCode);

  const status = useMemo(() => {
    if (statusState?.status) return statusState.status;
    const savedStatus = localStorage.getItem('status');
    if (!savedStatus) return {};
    try { return JSON.parse(savedStatus) || {}; } catch { return {}; }
  }, [statusState?.status]);

  const hasCustomOAuthProviders = (status.custom_oauth_providers || []).length > 0;
  const hasOAuthRegisterOptions = Boolean(
    status.github_oauth || status.discord_oauth || status.oidc_enabled ||
    status.wechat_login || status.linuxdo_oauth || status.telegram_oauth || hasCustomOAuthProviders,
  );

  useEffect(() => {
    setShowEmailVerification(!!status?.email_verification);
    if (status?.turnstile_check) {
      setTurnstileEnabled(true);
      setTurnstileSiteKey(status.turnstile_site_key);
    }
    setHasUserAgreement(status?.user_agreement_enabled || false);
    setHasPrivacyPolicy(status?.privacy_policy_enabled || false);
  }, [status]);

  useEffect(() => {
    let countdownInterval = null;
    if (disableButton && countdown > 0) {
      countdownInterval = setInterval(() => { setCountdown(countdown - 1); }, 1000);
    } else if (countdown === 0) {
      setDisableButton(false);
      setCountdown(30);
    }
    return () => clearInterval(countdownInterval);
  }, [disableButton, countdown]);

  useEffect(() => {
    return () => { if (githubTimeoutRef.current) clearTimeout(githubTimeoutRef.current); };
  }, []);

  function handleChange(name, value) {
    setInputs((inputs) => ({ ...inputs, [name]: value }));
  }

  async function handleSubmit() {
    if (password.length < 8) { showInfo('密码长度不得小于 8 位！'); return; }
    if (password !== password2) { showInfo('两次输入的密码不一致'); return; }
    if (!username || !password) return;
    if (turnstileEnabled && turnstileToken === '') { showInfo('请稍后几秒重试，Turnstile 正在检查用户环境！'); return; }
    setRegisterLoading(true);
    try {
      if (!affCode) affCode = localStorage.getItem('aff');
      inputs.aff_code = affCode;
      const res = await API.post(`/api/user/register?turnstile=${turnstileToken}`, inputs);
      const { success, message } = res.data;
      if (success) {
        navigate('/login');
        showSuccess('注册成功！');
      } else {
        showError(message);
      }
    } catch { showError('注册失败，请重试'); }
    finally { setRegisterLoading(false); }
  }

  const sendVerificationCode = async () => {
    if (inputs.email === '') return;
    if (turnstileEnabled && turnstileToken === '') { showInfo('请稍后几秒重试，Turnstile 正在检查用户环境！'); return; }
    setVerificationCodeLoading(true);
    try {
      const res = await API.get(`/api/verification?email=${encodeURIComponent(inputs.email)}&turnstile=${turnstileToken}`);
      const { success, message } = res.data;
      if (success) {
        showSuccess('验证码发送成功，请检查你的邮箱！');
        setDisableButton(true);
      } else {
        showError(message);
      }
    } catch { showError('发送验证码失败，请重试'); }
    finally { setVerificationCodeLoading(false); }
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
        navigate('/');
        showSuccess('登录成功！');
        setShowWeChatLoginModal(false);
      } else { showError(message); }
    } catch { showError('登录失败，请重试'); }
    finally { setWechatCodeSubmitLoading(false); }
  };

  const handleGitHubClick = () => {
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
    try { onGitHubOAuthClicked(status.github_client_id, { shouldLogout: true }); }
    finally { setTimeout(() => setGithubLoading(false), 3000); }
  };

  const handleDiscordClick = () => {
    setDiscordLoading(true);
    try { onDiscordOAuthClicked(status.discord_client_id, { shouldLogout: true }); }
    finally { setTimeout(() => setDiscordLoading(false), 3000); }
  };

  const handleOIDCClick = () => {
    setOidcLoading(true);
    try { onOIDCClicked(status.oidc_authorization_endpoint, status.oidc_client_id, false, { shouldLogout: true }); }
    finally { setTimeout(() => setOidcLoading(false), 3000); }
  };

  const handleLinuxDOClick = () => {
    setLinuxdoLoading(true);
    try { onLinuxDOOAuthClicked(status.linuxdo_client_id, { shouldLogout: true }); }
    finally { setTimeout(() => setLinuxdoLoading(false), 3000); }
  };

  const handleCustomOAuthClick = (provider) => {
    setCustomOAuthLoading((prev) => ({ ...prev, [provider.slug]: true }));
    try { onCustomOAuthClicked(provider, { shouldLogout: true }); }
    finally { setTimeout(() => setCustomOAuthLoading((prev) => ({ ...prev, [provider.slug]: false })), 3000); }
  };

  const onTelegramLoginClicked = async (response) => {
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
        navigate('/');
      } else { showError(message); }
    } catch { showError('登录失败，请重试'); }
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

  const renderOAuthOptions = () => (
    <div className='space-y-3'>
      {status.wechat_login && (
        <OAuthButton onClick={() => { setWechatLoading(true); setShowWeChatLoginModal(true); setWechatLoading(false); }} loading={wechatLoading}
          icon={<WeChatIcon style={{ width: 18, height: 18, color: '#07C160' }} />}>
          {t('使用 微信 继续')}
        </OAuthButton>
      )}
      {status.github_oauth && (
        <OAuthButton onClick={handleGitHubClick} loading={githubLoading} disabled={githubButtonDisabled}
          icon={<svg viewBox='0 0 24 24' className='w-5 h-5' fill='currentColor'><path d='M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z'/></svg>}>
          {githubButtonText}
        </OAuthButton>
      )}
      {status.discord_oauth && (
        <OAuthButton onClick={handleDiscordClick} loading={discordLoading}
          icon={<SiDiscord style={{ color: '#5865F2', width: 18, height: 18 }} />}>
          {t('使用 Discord 继续')}
        </OAuthButton>
      )}
      {status.oidc_enabled && (
        <OAuthButton onClick={handleOIDCClick} loading={oidcLoading} icon={<OIDCIcon style={{ width: 18, height: 18 }} />}>
          {t('使用 OIDC 继续')}
        </OAuthButton>
      )}
      {status.linuxdo_oauth && (
        <OAuthButton onClick={handleLinuxDOClick} loading={linuxdoLoading}
          icon={<LinuxDoIcon style={{ width: 18, height: 18, color: '#E95420' }} />}>
          {t('使用 LinuxDO 继续')}
        </OAuthButton>
      )}
      {status.custom_oauth_providers && status.custom_oauth_providers.map((provider) => (
        <OAuthButton key={provider.slug} onClick={() => handleCustomOAuthClick(provider)} loading={customOAuthLoading[provider.slug]}
          icon={getOAuthProviderIcon(provider.icon || '', 18)}>
          {t('使用 {{name}} 继续', { name: provider.name })}
        </OAuthButton>
      ))}
      {status.telegram_oauth && (
        <div className='flex justify-center'>
          <TelegramLoginButton dataOnauth={onTelegramLoginClicked} botName={status.telegram_bot_name} />
        </div>
      )}

      <div className='flex items-center gap-3 my-2'>
        <div className='flex-1 h-px bg-gray-200' />
        <span className='text-xs text-ui-text-3'>{t('或')}</span>
        <div className='flex-1 h-px bg-gray-200' />
      </div>

      <button
        onClick={() => { setEmailRegisterLoading(true); setShowEmailRegister(true); setEmailRegisterLoading(false); }}
        className='w-full py-3 text-sm font-medium rounded-lg transition-colors bg-ui-accent text-ui-accent-fg hover:bg-ui-accent-hover'
      >
        {t('使用 用户名 注册')}
      </button>
    </div>
  );

  const renderEmailRegisterForm = () => (
    <div className='space-y-4'>
      <div>
        <label className='block mb-2 text-sm font-medium text-ui-text'>{t('用户名')}</label>
        <input
          type='text'
          placeholder={t('请输入用户名')}
          value={inputs.username}
          onChange={(e) => handleChange('username', e.target.value)}
          className={inputClass}
        />
      </div>

      <div>
        <label className='block mb-2 text-sm font-medium text-ui-text'>{t('密码')}</label>
        <input
          type='password'
          placeholder={t('输入密码，最短 8 位，最长 20 位')}
          value={inputs.password}
          onChange={(e) => handleChange('password', e.target.value)}
          className={inputClass}
        />
      </div>

      <div>
        <label className='block mb-2 text-sm font-medium text-ui-text'>{t('确认密码')}</label>
        <input
          type='password'
          placeholder={t('确认密码')}
          value={inputs.password2}
          onChange={(e) => handleChange('password2', e.target.value)}
          className={inputClass}
        />
      </div>

      {showEmailVerification && (
        <>
          <div>
            <label className='block mb-2 text-sm font-medium text-ui-text'>{t('邮箱')}</label>
            <div className='flex gap-2'>
              <input
                type='email'
                placeholder={t('输入邮箱地址')}
                value={inputs.email}
                onChange={(e) => handleChange('email', e.target.value)}
                className={inputClass + ' flex-1'}
              />
              <button
                onClick={sendVerificationCode}
                disabled={disableButton || verificationCodeLoading}
                className='px-3 py-2 text-sm font-medium border border-black rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap flex items-center gap-1'
              >
                {verificationCodeLoading && (
                  <span className='w-3 h-3 border-2 border-ui-text-3 border-t-transparent rounded-full animate-spin' />
                )}
                {disableButton ? `${t('重新发送')} (${countdown})` : t('获取验证码')}
              </button>
            </div>
          </div>

          <div>
            <label className='block mb-2 text-sm font-medium text-ui-text'>{t('验证码')}</label>
            <input
              type='text'
              placeholder={t('输入验证码')}
              value={inputs.verification_code}
              onChange={(e) => handleChange('verification_code', e.target.value)}
              className={inputClass}
            />
          </div>
        </>
      )}

      {renderTerms()}

      <button
        onClick={handleSubmit}
        disabled={registerLoading || ((hasUserAgreement || hasPrivacyPolicy) && !agreedToTerms)}
        className='w-full py-3 text-sm font-medium rounded-lg transition-colors bg-ui-accent text-ui-accent-fg hover:bg-ui-accent-hover disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2'
      >
        {registerLoading && <span className='w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin' />}
        {t('注册')}
      </button>

      {hasOAuthRegisterOptions && (
        <>
          <div className='flex items-center gap-3'>
            <div className='flex-1 h-px bg-gray-200' />
            <span className='text-xs text-ui-text-3'>{t('或')}</span>
            <div className='flex-1 h-px bg-gray-200' />
          </div>
          <button
            onClick={() => { setOtherRegisterOptionsLoading(true); setShowEmailRegister(false); setOtherRegisterOptionsLoading(false); }}
            className='w-full py-3 text-sm font-medium border border-ui-border rounded-lg bg-ui-bg-elevated hover:bg-ui-bg-subtle text-ui-text transition-colors'
          >
            {t('其他注册选项')}
          </button>
        </>
      )}
    </div>
  );

  return (
    <div className='min-h-[calc(100vh-4rem)] flex items-start sm:items-center justify-center px-0 sm:px-4 pt-24 pb-12'>
      <div className='w-full max-w-sm sm:mt-[60px]'>
        <div className='p-6 sm:bg-ui-bg-elevated sm:rounded-2xl sm:border sm:border-ui-border sm:p-8'>
          <h2 className='text-2xl font-semibold text-ui-text mb-6'>{t('注册')}</h2>

          {showEmailRegister || !hasOAuthRegisterOptions
            ? renderEmailRegisterForm()
            : renderOAuthOptions()}

          <p className='mt-6 text-center text-sm text-ui-text-2'>
            {t('已有账户？')}{' '}
            <Link to='/login' className='text-ui-text font-medium underline'>{t('登录')}</Link>
          </p>
        </div>

        {turnstileEnabled && (
          <div className='flex justify-center mt-6'>
            <Turnstile sitekey={turnstileSiteKey} onVerify={(token) => setTurnstileToken(token)} />
          </div>
        )}
      </div>

      {/* 微信登录弹窗 */}
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
    </div>
  );
};

export default RegisterForm;
