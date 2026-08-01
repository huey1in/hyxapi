import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  API,
  onCustomOAuthClicked,
  onDiscordOAuthClicked,
  onGitHubOAuthClicked,
  onLinuxDOOAuthClicked,
  onOIDCClicked,
  updateAPI,
  setUserData,
} from '../../helpers';
import { UserContext } from '../../context/User';
import { StatusContext } from '../../context/Status';
import MarkdownRenderer from '../../components/common/markdown/MarkdownRenderer';

const oauthIconCdn = {
  github: 'https://cdn.simpleicons.org/github/181717',
  discord: 'https://cdn.simpleicons.org/discord/5865F2',
  linuxdo: 'https://www.google.com/s2/favicons?domain=linux.do&sz=64',
  oidc: 'https://cdn.simpleicons.org/openid/F78C40',
  telegram: 'https://cdn.simpleicons.org/telegram/26A5E4',
};

const getCustomProviderIcon = (provider) => {
  if (/^https?:\/\//i.test(provider.icon || '')) return provider.icon;
  try {
    const domain = new URL(provider.authorization_endpoint).hostname;
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
  } catch {
    return 'https://cdn.simpleicons.org/openid/F78C40';
  }
};

const ProviderIcon = ({ src, label }) => (
  <span className='cursor-auth-provider-icon'>
    <img src={src} alt='' aria-hidden='true' onError={(event) => { event.currentTarget.hidden = true; event.currentTarget.nextElementSibling.hidden = false; }} />
    <span hidden>{label?.charAt(0)?.toUpperCase() || 'O'}</span>
  </span>
);

const Auth = () => {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [, dispatch] = React.useContext(UserContext);
  const [statusState] = React.useContext(StatusContext);
  const [mode, setMode] = useState(params.get('mode') === 'register' ? 'register' : 'login');
  const [registerStep, setRegisterStep] = useState(1);
  const [form, setForm] = useState({ username: '', password: '', confirm: '', email: '', verificationCode: '' });
  const [codeBusy, setCodeBusy] = useState(false);
  const [codeCountdown, setCodeCountdown] = useState(0);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [oauthBusy, setOauthBusy] = useState(false);
  const [legal, setLegal] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const telegramRef = useRef(null);
  const turnstileRef = useRef(null);
  const next = params.get('next') || '/console';

  useEffect(() => {
    const aff = params.get('aff');
    if (aff) localStorage.setItem('aff', aff);
  }, [params]);
  const update = (key) => (event) => {
    setFeedback(null);
    setForm((value) => ({ ...value, [key]: event.target.value }));
  };
  useEffect(() => {
    if (!codeCountdown) return undefined;
    const timer = setInterval(() => setCodeCountdown((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [codeCountdown]);
  const showFeedback = (message, type = 'error') => setFeedback({ message, type });
  const changeMode = (nextMode) => {
    setMode(nextMode);
    if (nextMode === 'register') setRegisterStep(1);
    setFeedback(null);
    setResetSent(false);
  };

  const submit = async (event) => {
    event.preventDefault();
    setFeedback(null);
    if (!form.username.trim()) return showFeedback(t('auth.errors.credentialsRequired'));
    if (mode === 'register' && registerStep === 1) { setRegisterStep(emailVerificationEnabled ? 2 : 3); return; }
    if (mode === 'register' && registerStep === 2) {
      if (!form.email.trim() || !form.verificationCode.trim()) return showFeedback('请输入邮箱和验证码');
      setRegisterStep(3);
      return;
    }
    if (!form.password) return showFeedback(t('auth.errors.credentialsRequired'));
    if (mode === 'register' && form.password !== form.confirm) return showFeedback(t('auth.errors.passwordMismatch'));
    setBusy(true);
    try {
      const endpoint = mode === 'login' ? '/api/user/login' : '/api/user/register';
      if (statusState?.status?.turnstile_check && !turnstileToken) return showFeedback('请先完成安全验证');
      if (mode === 'register' && (!form.email.trim() || !form.verificationCode.trim())) return showFeedback('请输入邮箱和验证码');
      const response = await API.post(`${endpoint}${turnstileToken ? `?turnstile=${encodeURIComponent(turnstileToken)}` : ''}`, {
        username: form.username.trim(), password: form.password,
        ...(mode === 'register' ? { email: form.email.trim(), verification_code: form.verificationCode.trim() } : {}),
      });
      const data = response?.data;
      if (!data?.success) return showFeedback(data?.message || t('auth.errors.operationFailed'));
      if (mode === 'register') {
        showFeedback(t('auth.register.success'), 'success');
        setMode('login');
        return;
      }
      const user = data.data;
      localStorage.setItem('user', JSON.stringify(user));
      setUserData(user);
      updateAPI();
      dispatch({ type: 'login', payload: user });
      navigate(next.startsWith('/') ? next : '/console', { replace: true });
    } catch (error) {
      showFeedback(error?.response?.data?.message || error?.message || t('auth.errors.networkFailed'));
    } finally {
      setBusy(false);
    }
  };

  const sendVerificationCode = async () => {
    if (!form.email.trim()) return showFeedback('请先输入邮箱');
    if (statusState?.status?.turnstile_check && !turnstileToken) return showFeedback('请先完成安全验证');
    setCodeBusy(true);
    try {
      const response = await API.get('/api/verification', { params: { email: form.email.trim(), turnstile: turnstileToken } });
      if (!response?.data?.success) return showFeedback(response?.data?.message || '验证码发送失败');
      setCodeCountdown(60);
      showFeedback('验证码已发送，请查收邮箱', 'success');
    } catch (error) { showFeedback(error?.response?.data?.message || error?.message || '验证码发送失败'); }
    finally { setCodeBusy(false); }
  };

  const continueWithOAuth = async (provider, action) => {
    setFeedback(null);
    setOauthBusy(provider);
    try {
      await action();
    } catch (error) {
      showFeedback(error?.response?.data?.message || error?.message || t('auth.errors.oauthUnavailable'));
    } finally {
      setOauthBusy(false);
    }
  };

  const finishTelegramLogin = async (response) => {
    setFeedback(null);
    setOauthBusy('telegram');
    const fields = ['id', 'first_name', 'last_name', 'username', 'photo_url', 'auth_date', 'hash', 'lang'];
    const telegramParams = {};
    fields.forEach((field) => { if (response[field]) telegramParams[field] = response[field]; });
    try {
      const result = await API.get('/api/oauth/telegram/login', { params: telegramParams });
      if (!result?.data?.success) return showFeedback(result?.data?.message || t('auth.errors.oauthUnavailable'));
      const user = result.data.data;
      localStorage.setItem('user', JSON.stringify(user));
      setUserData(user);
      updateAPI();
      dispatch({ type: 'login', payload: user });
      navigate(next.startsWith('/') ? next : '/console', { replace: true });
    } catch (error) {
      showFeedback(error?.response?.data?.message || error?.message || t('auth.errors.oauthUnavailable'));
    } finally {
      setOauthBusy(false);
    }
  };

  const requestPasswordReset = async (event) => {
    event.preventDefault();
    setFeedback(null);
    if (!resetEmail.trim()) return showFeedback(t('auth.errors.emailRequired'));
    setBusy(true);
    try {
      const response = await API.get('/api/reset_password', { params: { email: resetEmail.trim() } });
      if (!response?.data?.success) return showFeedback(response?.data?.message || t('auth.errors.sendFailed'));
      setResetSent(true);
    } catch (error) {
      showFeedback(error?.response?.data?.message || error?.message || t('auth.errors.sendFailed'));
    } finally {
      setBusy(false);
    }
  };

  const isLogin = mode === 'login';
  const isReset = mode === 'reset';
  const status = statusState?.status || {};
  const customProviders = Array.isArray(status.custom_oauth_providers) ? status.custom_oauth_providers : [];
  const oauthProviders = [
    status.github_oauth && status.github_client_id && { id: 'github', label: 'GitHub', icon: oauthIconCdn.github, action: () => onGitHubOAuthClicked(status.github_client_id) },
    status.discord_oauth && status.discord_client_id && { id: 'discord', label: 'Discord', icon: oauthIconCdn.discord, action: () => onDiscordOAuthClicked(status.discord_client_id) },
    status.linuxdo_oauth && status.linuxdo_client_id && { id: 'linuxdo', label: 'Linux DO', icon: oauthIconCdn.linuxdo, action: () => onLinuxDOOAuthClicked(status.linuxdo_client_id) },
    status.oidc_enabled && status.oidc_client_id && status.oidc_authorization_endpoint && { id: 'oidc', label: 'OIDC', icon: oauthIconCdn.oidc, action: () => onOIDCClicked(status.oidc_authorization_endpoint, status.oidc_client_id) },
    ...customProviders.map((provider) => ({ id: `custom-${provider.id}`, label: provider.name, icon: getCustomProviderIcon(provider), action: () => onCustomOAuthClicked(provider) })),
  ].filter(Boolean);
  const telegramEnabled = Boolean(status.telegram_oauth && status.telegram_bot_name);
  const emailVerificationEnabled = Boolean(status.email_verification);
  const turnstileEnabled = Boolean(status.turnstile_check && status.turnstile_site_key);
  const oauthEnabled = oauthProviders.length > 0 || telegramEnabled;
  const agreementEnabled = Boolean(statusState?.status?.user_agreement_enabled);
  const privacyEnabled = Boolean(statusState?.status?.privacy_policy_enabled);
  const headingKey = isReset ? 'reset' : isLogin ? 'login' : 'register';
  const registerStepTitle = registerStep === 1 ? '创建用户名' : registerStep === 2 ? '验证邮箱' : '设置密码';

  useEffect(() => {
    if (isReset || !telegramEnabled || !telegramRef.current) return undefined;
    const callbackName = `routifyTelegramLogin_${Date.now()}`;
    window[callbackName] = finishTelegramLogin;
    telegramRef.current.replaceChildren();
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.setAttribute('data-telegram-login', status.telegram_bot_name);
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-radius', '4');
    script.setAttribute('data-userpic', 'false');
    script.setAttribute('data-request-access', 'write');
    script.setAttribute('data-onauth', `${callbackName}(user)`);
    telegramRef.current.appendChild(script);
    return () => { delete window[callbackName]; };
  }, [isReset, telegramEnabled, status.telegram_bot_name]);

  useEffect(() => {
    if (!turnstileEnabled || !turnstileRef.current) return undefined;
    const render = () => {
      if (!window.turnstile || !turnstileRef.current) return;
      turnstileRef.current.replaceChildren();
      window.turnstile.render(turnstileRef.current, { sitekey: status.turnstile_site_key, callback: setTurnstileToken, 'expired-callback': () => setTurnstileToken(''), 'error-callback': () => setTurnstileToken('') });
    };
    if (window.turnstile) render();
    else {
      const script = document.createElement('script'); script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'; script.async = true; script.onload = render; document.head.appendChild(script);
    }
    return () => { if (turnstileRef.current) turnstileRef.current.replaceChildren(); };
  }, [turnstileEnabled, status.turnstile_site_key, mode]);

  const openLegal = async (type) => {
    const endpoint = type === 'terms' ? '/api/user-agreement' : '/api/privacy-policy';
    setLegal({ type, content: '', loading: true });
    try {
      const response = await API.get(endpoint);
      setLegal({ type, content: response?.data?.data || '', loading: false });
    } catch (error) {
      setLegal(null);
      showFeedback(error?.response?.data?.message || error?.message || t('auth.errors.operationFailed'));
    }
  };

  return (
    <div className='cursor-auth-page'>
      <header className='cursor-auth-header'><Link to='/' className='home-brand'>Routify</Link></header>
      <main className='cursor-auth-main'>
        <div className='cursor-auth-panel'>
          {!(isReset && resetSent) && <h1><span>{!isReset && !isLogin ? registerStepTitle : t(`auth.${headingKey}.title`)}</span><small>{t(`auth.${headingKey}.subtitle`)}</small></h1>}
          {feedback && <div className={`cursor-auth-feedback is-${feedback.type}`} role={feedback.type === 'error' ? 'alert' : 'status'}>
            {feedback.type === 'error' ? <AlertCircle size={21} /> : <CheckCircle2 size={21} />}
            <span>{feedback.message}</span>
          </div>}
          {turnstileEnabled && <div ref={turnstileRef} className='cursor-auth-turnstile' />}
          {!isReset && oauthEnabled && <div className='cursor-auth-oauth-list'>
            {oauthProviders.map(({ id, label, icon, action }) => <button className='cursor-auth-oauth' type='button' key={id} onClick={() => continueWithOAuth(id, action)} disabled={Boolean(oauthBusy)}>
              <ProviderIcon src={icon} label={label} />
              {oauthBusy === id ? t('auth.github.redirecting') : t('auth.oauth.continueWith', { provider: label })}
            </button>)}
            {telegramEnabled && <div className='cursor-auth-telegram-row'><ProviderIcon src={oauthIconCdn.telegram} label='Telegram' /><span>{t('auth.oauth.continueWith', { provider: 'Telegram' })}</span><div ref={telegramRef} className='cursor-auth-telegram-widget' /></div>}
          </div>}
          {!isReset && oauthEnabled && <div className='cursor-auth-divider'><span>{t('auth.or')}</span></div>}
          {isReset ? <>
            {resetSent ? <div className='cursor-auth-reset-sent'><strong>{t('auth.reset.checkEmail')}</strong><span>{t('auth.reset.sentDescription')}</span></div> : <form onSubmit={requestPasswordReset} className='auth-form'>
              <label>{t('auth.fields.email')}<input value={resetEmail} onChange={(event) => { setFeedback(null); setResetEmail(event.target.value); }} type='email' autoComplete='email' placeholder={t('auth.fields.emailPlaceholder')} /></label>
              <button className='cursor-auth-submit' disabled={busy}>{busy ? t('auth.reset.sending') : t('auth.reset.sendLink')}</button>
            </form>}
            <p className='cursor-auth-switch'><button onClick={() => changeMode('login')}>{t('auth.reset.backToLogin')}</button></p>
          </> : <><form onSubmit={submit} className='auth-form'>
            {(isLogin || registerStep === 1) && <label>{t('auth.fields.username')}<input value={form.username} onChange={update('username')} autoComplete='username' placeholder={t('auth.fields.usernamePlaceholder')} autoFocus /></label>}
            {(isLogin || registerStep === 3) && <label>{t('auth.fields.password')}<input value={form.password} onChange={update('password')} type='password' autoComplete={isLogin ? 'current-password' : 'new-password'} placeholder={t('auth.fields.passwordPlaceholder')} autoFocus /></label>}
            {!isLogin && registerStep === 2 && emailVerificationEnabled && <>
              <label>{t('auth.fields.email')}<input value={form.email} onChange={update('email')} type='email' autoComplete='email' placeholder={t('auth.fields.emailPlaceholder')} /></label>
              <div className='cursor-auth-code-row'><input value={form.verificationCode} onChange={update('verificationCode')} inputMode='numeric' placeholder='邮箱验证码' /><button type='button' onClick={sendVerificationCode} disabled={codeBusy || codeCountdown > 0}>{codeCountdown ? `${codeCountdown}s` : codeBusy ? '发送中…' : '发送验证码'}</button></div>
            </>}
            {!isLogin && registerStep === 3 && <label>{t('auth.fields.confirmPassword')}<input value={form.confirm} onChange={update('confirm')} type='password' autoComplete='new-password' placeholder={t('auth.fields.confirmPasswordPlaceholder')} /></label>}
            <button className='cursor-auth-submit' disabled={busy}>{busy ? t('auth.processing') : isLogin ? t('auth.login.submit') : registerStep < 3 ? '下一步' : t('auth.register.submit')}</button>
          </form>
          {!isLogin && registerStep > 1 && <button className='cursor-auth-forgot' onClick={() => { setRegisterStep((step) => step - 1); setFeedback(null); }}>上一步</button>}
          {isLogin && <button className='cursor-auth-forgot' onClick={() => changeMode('reset')}>{t('auth.login.forgotPassword')}</button>}
          <p className='cursor-auth-switch'>{t(isLogin ? 'auth.login.noAccount' : 'auth.register.hasAccount')} <button onClick={() => changeMode(isLogin ? 'register' : 'login')}>{t(isLogin ? 'auth.register.action' : 'auth.login.action')}</button></p>
          </>}
        </div>
      </main>
      <footer className='cursor-auth-footer'>
        <span>{t('auth.legalPrefix')}</span>
        {agreementEnabled ? <button type='button' onClick={() => openLegal('terms')}>{t('auth.terms')}</button> : <span>{t('auth.terms')}</span>}
        <span>{t('auth.legalAnd')}</span>
        {privacyEnabled ? <button type='button' onClick={() => openLegal('privacy')}>{t('auth.privacy')}</button> : <span>{t('auth.privacy')}</span>}
      </footer>
      {legal && <div className='cursor-auth-legal-overlay' role='presentation' onMouseDown={() => setLegal(null)}>
        <section className='cursor-auth-legal-dialog' role='dialog' aria-modal='true' aria-labelledby='legal-title' onMouseDown={(event) => event.stopPropagation()}>
          <header><h2 id='legal-title'>{t(legal.type === 'terms' ? 'auth.terms' : 'auth.privacy')}</h2><button type='button' onClick={() => setLegal(null)} aria-label={t('auth.close')}>×</button></header>
          <div className='cursor-auth-legal-content'>{legal.loading ? t('auth.loading') : <MarkdownRenderer content={legal.content} />}</div>
        </section>
      </div>}
    </div>
  );
};

export default Auth;
