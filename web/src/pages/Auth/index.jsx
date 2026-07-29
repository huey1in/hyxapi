import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, Github } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { API, updateAPI, setUserData } from '../../helpers';
import { UserContext } from '../../context/User';
import { StatusContext } from '../../context/Status';
import MarkdownRenderer from '../../components/common/markdown/MarkdownRenderer';

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
  const next = params.get('next') || '/console';
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

  const continueWithGitHub = async () => {
    setFeedback(null);
    setOauthBusy(true);
    try {
      const response = await API.get('/api/oauth/state');
      const state = response?.data?.data;
      const clientId = statusState?.status?.github_client_id;
      if (!state || !clientId) throw new Error(t('auth.errors.githubUnavailable'));
      const query = new URLSearchParams({ client_id: clientId, state, scope: 'user:email' });
      window.location.assign(`https://github.com/login/oauth/authorize?${query.toString()}`);
    } catch (error) {
      showFeedback(error?.response?.data?.message || error?.message || t('auth.errors.githubUnavailable'));
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
  const githubEnabled = Boolean(statusState?.status?.github_oauth && statusState?.status?.github_client_id);
  const agreementEnabled = Boolean(statusState?.status?.user_agreement_enabled);
  const privacyEnabled = Boolean(statusState?.status?.privacy_policy_enabled);
  const headingKey = isReset ? 'reset' : isLogin ? 'login' : 'register';

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
          {!isReset && githubEnabled && <button className='cursor-auth-oauth' type='button' onClick={continueWithGitHub} disabled={oauthBusy}><Github size={17} />{oauthBusy ? t('auth.github.redirecting') : t('auth.github.continue')}</button>}
          {!isReset && githubEnabled && <div className='cursor-auth-divider'><span>{t('auth.or')}</span></div>}
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
