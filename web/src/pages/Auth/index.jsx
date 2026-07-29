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
  const [form, setForm] = useState({ username: '', password: '', confirm: '' });
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [oauthBusy, setOauthBusy] = useState(false);
  const [legal, setLegal] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const telegramRef = useRef(null);
  const next = params.get('next') || '/console';

  useEffect(() => {
    const aff = params.get('aff');
    if (aff) localStorage.setItem('aff', aff);
  }, [params]);
  const update = (key) => (event) => {
    setFeedback(null);
    setForm((value) => ({ ...value, [key]: event.target.value }));
  };
  const showFeedback = (message, type = 'error') => setFeedback({ message, type });
  const changeMode = (nextMode) => {
    setMode(nextMode);
    setFeedback(null);
    setResetSent(false);
  };

  const submit = async (event) => {
    event.preventDefault();
    setFeedback(null);
    if (!form.username.trim() || !form.password) return showFeedback(t('auth.errors.credentialsRequired'));
    if (mode === 'register' && form.password !== form.confirm) return showFeedback(t('auth.errors.passwordMismatch'));
    setBusy(true);
    try {
      const endpoint = mode === 'login' ? '/api/user/login' : '/api/user/register';
      const response = await API.post(endpoint, { username: form.username.trim(), password: form.password });
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
  const oauthEnabled = oauthProviders.length > 0 || telegramEnabled;
  const agreementEnabled = Boolean(statusState?.status?.user_agreement_enabled);
  const privacyEnabled = Boolean(statusState?.status?.privacy_policy_enabled);
  const headingKey = isReset ? 'reset' : isLogin ? 'login' : 'register';

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
          {!(isReset && resetSent) && <h1><span>{t(`auth.${headingKey}.title`)}</span><small>{t(`auth.${headingKey}.subtitle`)}</small></h1>}
          {feedback && <div className={`cursor-auth-feedback is-${feedback.type}`} role={feedback.type === 'error' ? 'alert' : 'status'}>
            {feedback.type === 'error' ? <AlertCircle size={21} /> : <CheckCircle2 size={21} />}
            <span>{feedback.message}</span>
          </div>}
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
            <label>{t('auth.fields.username')}<input value={form.username} onChange={update('username')} autoComplete='username' placeholder={t('auth.fields.usernamePlaceholder')} /></label>
            <label>{t('auth.fields.password')}<input value={form.password} onChange={update('password')} type='password' autoComplete={isLogin ? 'current-password' : 'new-password'} placeholder={t('auth.fields.passwordPlaceholder')} /></label>
            {!isLogin && <label>{t('auth.fields.confirmPassword')}<input value={form.confirm} onChange={update('confirm')} type='password' autoComplete='new-password' placeholder={t('auth.fields.confirmPasswordPlaceholder')} /></label>}
            <button className='cursor-auth-submit' disabled={busy}>{busy ? t('auth.processing') : isLogin ? t('auth.login.submit') : t('auth.register.submit')}</button>
          </form>
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
