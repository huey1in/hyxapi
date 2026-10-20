import React, { useEffect, useState } from 'react';
import type { FormEvent, ChangeEvent } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { API } from '../../helpers';
import { Modal, Input, Select } from '../../components/ui';
import { applyAuthBundle, isAuthBundle } from '../../lib/auth-session';
import { useAuthStore } from '../../stores/auth-store';
import { encryptPassword } from '../../features/auth/lib/password-encryption';
import { authResult } from '../../lib/secure-verification';
import { authorizationURL } from '../../lib/oauth-exchange';
import { requestPasskeyAssertion, rememberPasskeyRPID } from '../../features/auth/passkey/assertion';
import type { PasskeyDomains } from '../../features/auth/passkey/assertion';
import type { PasskeyOptionsPayload } from '../../features/auth/passkey/types';
import type { LoginChallenge } from '../../features/auth/secure-verification/types';
import type { ApiEnvelope, OAuthProvider } from '../../types/api';
import LoginVerification from '../../components/auth/LoginVerification';
import TurnstileChallenge from '../../components/auth/TurnstileChallenge';
import { UserContext } from '../../context/User';
import { StatusContext } from '../../context/Status';
import MarkdownRenderer from '../../components/common/markdown/MarkdownRenderer';
import { isLoginChallenge, registrationPayload, safeAuthRedirect } from './auth-flow';
import { useAuthOperation } from './useAuthOperation';

const oauthIconCdn = {
  github: 'https://cdn.simpleicons.org/github/181717',
  discord: 'https://cdn.simpleicons.org/discord/5865F2',
  linuxdo: 'https://www.google.com/s2/favicons?domain=linux.do&sz=64',
  oidc: 'https://cdn.simpleicons.org/openid/F78C40',
  telegram: 'https://cdn.simpleicons.org/telegram/26A5E4',
};
const getCustomProviderIcon = (provider: OAuthProvider) => {
  if (/^https?:\/\//i.test(provider.icon || '')) return provider.icon!;
  try { return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(new URL(provider.authorization_endpoint).hostname)}&sz=64`; }
  catch { return oauthIconCdn.oidc; }
};
const ProviderIcon = ({ src, label }: { src: string; label: string }) => (
  <span className='cursor-auth-provider-icon'>
    <img src={src} alt='' aria-hidden='true' onError={(event) => { event.currentTarget.hidden = true; const fallback = event.currentTarget.nextElementSibling; if (fallback instanceof HTMLElement) fallback.hidden = false; }} />
    <span hidden>{label.charAt(0).toUpperCase() || 'O'}</span>
  </span>
);

function WeChatLogin({ qrCode, onClose, onComplete }: { qrCode: string; onClose: () => void; onComplete: (result: unknown) => void }) {
  const { t } = useTranslation();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const { busy, run } = useAuthOperation((message) => setError(t(message)));
  const submit = () => void run('wechat', async (signal) => {
    const value = code.trim();
    if (!value || value.length > 128) throw new Error('Enter a valid WeChat verification code');
    setError('');
    const result = await authResult<unknown>(API.get('/api/oauth/wechat', { params: { code: value }, signal, disableDuplicate: true, skipAuthRefresh: true, skipErrorHandler: true }));
    signal.throwIfAborted(); onComplete(result); onClose();
  });
  return <Modal open title={t('Sign in with WeChat')} onClose={onClose} onConfirm={submit} loading={busy} confirmText={t('Sign in')} cancelText={t('Cancel')}>
    {qrCode ? <img src={qrCode} alt={t('WeChat verification QR code')} className='mx-auto h-48 w-48 object-contain' /> : <p className='text-sm text-ui-text-3'>{t('A WeChat QR code has not been configured')}</p>}
    <p className='text-sm text-ui-text-2'>{t('Scan the QR code and enter the verification code from WeChat')}</p>
    <Input aria-label={t('WeChat verification code')} autoComplete='one-time-code' value={code} onChange={setCode} maxLength={128} disabled={busy} width='full' onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); submit(); } }} />
    {error && <p role='alert' className='text-sm text-ui-danger'>{error}</p>}
  </Modal>;
}

type Mode = 'login' | 'register' | 'reset';
type Feedback = { message: string; type: 'error' | 'success' };
type Legal = { type: 'terms' | 'privacy'; content: string; loading: boolean };
const Auth = () => {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [, dispatch] = React.useContext(UserContext);
  const [statusState] = React.useContext(StatusContext);
  const [mode, setMode] = useState<Mode>(params.get('mode') === 'register' ? 'register' : 'login');
  const [registerStep, setRegisterStep] = useState(1);
  const [form, setForm] = useState({ username: '', password: '', confirm: '', email: '', verificationCode: '' });
  const [codeCountdown, setCodeCountdown] = useState(0);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [turnstileAttempt, setTurnstileAttempt] = useState(0);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [legal, setLegal] = useState<Legal | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [wechat, setWechat] = useState(false);
  const [domains, setDomains] = useState<PasskeyDomains>({ rpIDs: [] });
  const [rpID, setRPID] = useState('');
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const pending = useAuthStore((state) => state.auth.pendingLoginVerification);
  const [challenge, setChallenge] = useState<LoginChallenge | null>(pending?.challenge || null);
  const showFeedback = (message: string, type: Feedback['type'] = 'error') => setFeedback({ message, type });
  const { busy, operation, run, cancel } = useAuthOperation((message) => showFeedback(t(message)));
  const legalOperation = useAuthOperation((message) => { setLegal(null); showFeedback(t(message)); });
  const resetTurnstile = () => { setTurnstileToken(''); setTurnstileAttempt((value) => value + 1); };
  const status = statusState.status ?? {};
  const isLogin = mode === 'login';
  const isReset = mode === 'reset';
  const registerEnabled = status.register_enabled !== false;
  const passwordLoginEnabled = status.password_login_enabled !== false;
  const passwordFormEnabled = isLogin ? passwordLoginEnabled : registerEnabled && status.password_register_enabled !== false;
  const emailVerificationEnabled = Boolean(status.email_verification);
  const turnstileEnabled = Boolean(status.turnstile_check && status.turnstile_site_key);
  const agreementEnabled = Boolean(status.user_agreement_enabled);
  const privacyEnabled = Boolean(status.privacy_policy_enabled);
  const legalReady = !(agreementEnabled || privacyEnabled) || agreed;
  const passkeyEnabled = Boolean(status.passkey_login && window.PublicKeyCredential);
  const wechatEnabled = Boolean(status.wechat_login && (isLogin || registerEnabled));
  const oauthProviders: { id: string; label: string; icon: string }[] = [];
  if (isLogin || registerEnabled) {
    if (status.github_oauth && status.github_client_id) oauthProviders.push({ id: 'github', label: 'GitHub', icon: oauthIconCdn.github });
    if (status.discord_oauth && status.discord_client_id) oauthProviders.push({ id: 'discord', label: 'Discord', icon: oauthIconCdn.discord });
    if (status.linuxdo_oauth && status.linuxdo_client_id) oauthProviders.push({ id: 'linuxdo', label: 'Linux DO', icon: oauthIconCdn.linuxdo });
    if (status.oidc_enabled && status.oidc_client_id && status.oidc_authorization_endpoint) oauthProviders.push({ id: 'oidc', label: status.oidc_display_name || 'OIDC', icon: oauthIconCdn.oidc });
    if (status.telegram_oauth) oauthProviders.push({ id: 'telegram', label: 'Telegram', icon: oauthIconCdn.telegram });
    for (const provider of status.custom_oauth_providers ?? []) oauthProviders.push({ id: provider.slug, label: provider.name || provider.slug, icon: getCustomProviderIcon(provider) });
  }
  const oauthEnabled = oauthProviders.length > 0 || wechatEnabled || (isLogin && passkeyEnabled);
  const headingKey = isReset ? 'reset' : isLogin ? 'login' : 'register';
  const registerStepTitle = registerStep === 1 ? t('Create a username') : registerStep === 2 ? t('Verify your email') : t('Set your password');
  useEffect(() => { const aff = params.get('aff')?.trim(); if (aff) { try { localStorage.setItem('aff', aff); } catch { /* optional storage */ } } }, [params]);
  useEffect(() => {
    if (!codeCountdown) return;
    const timer = window.setTimeout(() => setCodeCountdown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [codeCountdown]);
  useEffect(() => { setAgreed(false); }, [agreementEnabled, privacyEnabled]);
  const update = (key: keyof typeof form) => (event: ChangeEvent<HTMLInputElement>) => { setFeedback(null); setForm((value) => ({ ...value, [key]: event.target.value })); };
  const checkLegal = () => { if (legalReady) return true; showFeedback(t('Please agree to the legal terms first')); return false; };
  const changeMode = (nextMode: Mode) => {
    cancel(); setMode(nextMode); setRegisterStep(1); setFeedback(null); setResetSent(false); setWechat(false); resetTurnstile();
    setForm((value) => ({ ...value, password: '', confirm: '' }));
  };
  const acceptLogin = (result: unknown) => {
    if (isLoginChallenge(result)) { setChallenge(result); return; }
    if (!isAuthBundle(result)) throw new Error(t('Invalid sign-in response. Please try again.'));
    applyAuthBundle(result); dispatch({ type: 'login', payload: result.user });
    navigate(safeAuthRedirect(pending?.redirectTo || params.get('next')), { replace: true });
  };
  const publicOptions = (signal: AbortSignal) => ({ signal, disableDuplicate: true, skipAuthRefresh: true, skipErrorHandler: true });
  const requireTurnstile = () => { if (status.turnstile_check && !turnstileToken) throw new Error('Complete the security verification first'); };
  const loginWithPasskey = () => { if (!checkLegal()) return; void run('passkey', async (signal) => {
    setFeedback(null);
    const passkey = await requestPasskeyAssertion((selected) => authResult<PasskeyOptionsPayload>(API.post('/api/user/passkey/login/begin', selected ? { rp_id: selected } : {}, publicOptions(signal))), signal, { rpID: rpID || undefined, onDomains: setDomains });
    const result = await authResult<unknown>(API.post('/api/user/passkey/login/finish', { flow_token: passkey.flowToken, credential: passkey.assertion }, publicOptions(signal)));
    signal.throwIfAborted(); rememberPasskeyRPID(passkey.rpID); acceptLogin(result);
  }); };
  const submit = (event: FormEvent) => {
    event.preventDefault(); if (!checkLegal() || busy || !passwordFormEnabled) return;
    setFeedback(null);
    if (!form.username.trim()) return showFeedback(t('auth.errors.credentialsRequired'));
    if (!isLogin && Array.from(form.username.trim()).length > 20) return showFeedback(t('Username must contain between 1 and 20 characters'));
    if (!isLogin && registerStep === 1) { setRegisterStep(emailVerificationEnabled ? 2 : 3); return; }
    if (!isLogin && registerStep === 2) {
      if (!form.email.trim() || !form.verificationCode.trim()) return showFeedback(t('Enter your email and verification code'));
      setRegisterStep(3); return;
    }
    if (!form.password) return showFeedback(t('auth.errors.credentialsRequired'));
    void run('submit', async (signal) => {
      requireTurnstile();
      try {
        let affiliate = params.get('aff') || ''; try { affiliate ||= localStorage.getItem('aff') || ''; } catch { /* optional storage */ }
        const fields = isLogin ? { username: form.username.trim(), ...(status.password_login_encryption_enabled ? await encryptPassword(form.password, signal) : { password: form.password }) } : registrationPayload(form, emailVerificationEnabled, affiliate);
        signal.throwIfAborted();
        const endpoint = isLogin ? '/api/user/login' : '/api/user/register';
        const response = await API.post<ApiEnvelope<unknown>>(`${endpoint}${turnstileToken ? `?turnstile=${encodeURIComponent(turnstileToken)}` : ''}`, fields, publicOptions(signal));
        signal.throwIfAborted();
        if (!response.data.success) throw new Error(response.data.message || t('auth.errors.operationFailed'));
        if (!isLogin) { changeMode('login'); showFeedback(t('auth.register.success'), 'success'); return; }
        acceptLogin(response.data.data);
      } finally { if (!signal.aborted) resetTurnstile(); }
    });
  };
  const sendVerificationCode = () => {
    if (codeCountdown > 0 || busy) return;
    void run('code', async (signal) => {
      if (!form.email.trim()) throw new Error('Enter your email address'); requireTurnstile();
      try {
        const response = await API.get<ApiEnvelope<unknown>>('/api/verification', { ...publicOptions(signal), params: { email: form.email.trim().toLowerCase(), turnstile: turnstileToken } });
        signal.throwIfAborted(); if (!response.data.success) throw new Error(response.data.message || 'Failed to send verification code');
        setCodeCountdown(30); showFeedback(t('Verification code sent. Check your email.'), 'success');
      } finally { if (!signal.aborted) resetTurnstile(); }
    });
  };
  const continueWithOAuth = (provider: string) => { if (!checkLegal()) return; void run(`oauth:${provider}`, async (signal) => {
    setFeedback(null); let aff = params.get('aff') || ''; try { aff ||= localStorage.getItem('aff') || ''; } catch { /* optional storage */ }
    const state = await authResult<{ flow_token: string; authorization_url?: string }>(API.post('/api/oauth/state', { provider, intent: 'login', ...(aff.trim() ? { aff: aff.trim() } : {}) }, publicOptions(signal)));
    signal.throwIfAborted(); if (!state.flow_token) throw new Error('OAuth provider is unavailable');
    try { sessionStorage.setItem(`hyxware:oauth-redirect:${state.flow_token}`, safeAuthRedirect(params.get('next'))); } catch { /* optional storage */ }
    const url = new URL(state.authorization_url || authorizationURL(provider, state.flow_token, status));
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('OAuth provider is unavailable');
    window.location.assign(url.toString());
  }); };
  const requestPasswordReset = (event: FormEvent) => {
    event.preventDefault(); void run('reset', async (signal) => {
      setFeedback(null); if (!resetEmail.trim()) throw new Error(t('auth.errors.emailRequired')); requireTurnstile();
      try {
        const response = await API.get<ApiEnvelope<unknown>>('/api/reset_password', { ...publicOptions(signal), params: { email: resetEmail.trim(), turnstile: turnstileToken } });
        signal.throwIfAborted(); if (!response.data.success) throw new Error(response.data.message || t('auth.errors.sendFailed')); setResetSent(true);
      } finally { if (!signal.aborted) resetTurnstile(); }
    });
  };
  const closeLegal = () => { legalOperation.cancel(); setLegal(null); };
  const openLegal = (type: Legal['type']) => {
    legalOperation.cancel(); setLegal({ type, content: '', loading: true });
    void legalOperation.run('legal', async (signal) => {
      const response = await API.get<ApiEnvelope<string>>(type === 'terms' ? '/api/user-agreement' : '/api/privacy-policy', { ...publicOptions(signal) });
      signal.throwIfAborted(); if (!response.data.success) throw new Error(response.data.message || t('auth.errors.operationFailed'));
      setLegal({ type, content: response.data.data || '', loading: false });
    });
  };

  return (
    <div className='cursor-auth-page'>
      <header className='cursor-auth-header'><Link to='/' className='home-brand'>Hyxware</Link></header>
      <main className='cursor-auth-main'>
        <div className='cursor-auth-panel'>
          {!(isReset && resetSent) && <h1><span>{!isReset && !isLogin ? registerStepTitle : t(`auth.${headingKey}.title`)}</span><small>{t(`auth.${headingKey}.subtitle`)}</small></h1>}
          {feedback && <div className={`cursor-auth-feedback is-${feedback.type}`} role={feedback.type === 'error' ? 'alert' : 'status'}>
            {feedback.type === 'error' ? <AlertCircle size={21} /> : <CheckCircle2 size={21} />}
            <span>{feedback.message}</span>
          </div>}
          {turnstileEnabled && <div className='cursor-auth-turnstile'><TurnstileChallenge key={`${mode}:${turnstileAttempt}`} siteKey={status.turnstile_site_key!} onToken={setTurnstileToken} /></div>}
          {!isReset && (agreementEnabled || privacyEnabled) && <label className='flex items-start gap-2 text-xs text-ui-text-2 mb-4'><input type='checkbox' checked={agreed} onChange={(event) => setAgreed(event.target.checked)} aria-label={t('I agree to the terms and privacy policy')} /><span>{t('I agree to the terms and privacy policy')}</span></label>}
          {!isReset && oauthEnabled && <div className='cursor-auth-oauth-list'>
            {oauthProviders.map(({ id, label, icon }) => <button className='cursor-auth-oauth' type='button' key={id} onClick={() => continueWithOAuth(id)} disabled={busy || !legalReady}>
              <ProviderIcon src={icon} label={label} />
              {operation === `oauth:${id}` ? t('auth.github.redirecting') : t('auth.oauth.continueWith', { provider: label })}
            </button>)}
            {wechatEnabled && <button type='button' className='cursor-auth-oauth' onClick={() => { if (checkLegal()) setWechat(true); }} disabled={busy || !legalReady}>{t('auth.oauth.continueWith', { provider: 'WeChat' })}</button>}
            {isLogin && passkeyEnabled && <button type='button' className='cursor-auth-oauth' onClick={loginWithPasskey} disabled={busy || !legalReady}>{t("Sign in with Passkey")}</button>}
            {isLogin && passkeyEnabled && domains.rpIDs.length > 1 && <Select aria-label={t('Passkey domain')} value={rpID || domains.rpID} disabled={busy} options={domains.rpIDs.map((id) => ({ value: id, label: id }))} onChange={setRPID} />}
          </div>}
          {!isReset && oauthEnabled && passwordFormEnabled && <div className='cursor-auth-divider'><span>{t('auth.or')}</span></div>}
          {isReset ? <>
            {resetSent ? <div className='cursor-auth-reset-sent'><strong>{t('auth.reset.checkEmail')}</strong><span>{t('auth.reset.sentDescription')}</span></div> : <form onSubmit={requestPasswordReset} className='auth-form'>
              <label>{t('auth.fields.email')}<input value={resetEmail} onChange={(event) => { setFeedback(null); setResetEmail(event.target.value); }} type='email' autoComplete='email' placeholder={t('auth.fields.emailPlaceholder')} /></label>
              <button className='cursor-auth-submit' disabled={busy}>{busy ? t('auth.reset.sending') : t('auth.reset.sendLink')}</button>
            </form>}
            <p className='cursor-auth-switch'><button onClick={() => changeMode('login')}>{t('auth.reset.backToLogin')}</button></p>
          </> : <>{passwordFormEnabled ? <form onSubmit={submit} className='auth-form'>
            {(isLogin || registerStep === 1) && <label>{t('auth.fields.username')}<input value={form.username} onChange={update('username')} autoComplete='username' placeholder={t('auth.fields.usernamePlaceholder')} autoFocus /></label>}
            {(isLogin || registerStep === 3) && <label>{t('auth.fields.password')}<input value={form.password} onChange={update('password')} type='password' autoComplete={isLogin ? 'current-password' : 'new-password'} placeholder={t('auth.fields.passwordPlaceholder')} autoFocus /></label>}
            {!isLogin && registerStep === 2 && emailVerificationEnabled && <>
              <label>{t('auth.fields.email')}<input value={form.email} onChange={update('email')} type='email' autoComplete='email' placeholder={t('auth.fields.emailPlaceholder')} /></label>
              <div className='cursor-auth-code-row'><input value={form.verificationCode} onChange={update('verificationCode')} aria-label={t('Email verification code')} autoComplete='one-time-code' placeholder={t("Email verification code")} /><button type='button' onClick={sendVerificationCode} disabled={busy || codeCountdown > 0}>{codeCountdown ? `${codeCountdown}s` : operation === 'code' ? t("Sending…") : t("Send verification code")}</button></div>
            </>}
            {!isLogin && registerStep === 3 && <label>{t('auth.fields.confirmPassword')}<input value={form.confirm} onChange={update('confirm')} type='password' autoComplete='new-password' placeholder={t('auth.fields.confirmPasswordPlaceholder')} /></label>}
            <button className='cursor-auth-submit' disabled={busy || !legalReady}>{busy ? t('auth.processing') : isLogin ? t('auth.login.submit') : registerStep < 3 ? t("Next") : t('auth.register.submit')}</button>
          </form> : <p role='status' className='text-sm text-ui-text-2'>{t(!registerEnabled && !isLogin ? 'New user registration is disabled' : 'Password authentication is disabled. Use an available sign-in method.')}</p>}
          {!isLogin && passwordFormEnabled && registerStep > 1 && <button className='cursor-auth-forgot' disabled={busy} onClick={() => { setRegisterStep((step) => step === 3 && !emailVerificationEnabled ? 1 : step - 1); setFeedback(null); }}>{t("Previous")}</button>}
          {isLogin && passwordLoginEnabled && <button className='cursor-auth-forgot' onClick={() => changeMode('reset')}>{t('auth.login.forgotPassword')}</button>}
          {(!isLogin || registerEnabled) && <p className='cursor-auth-switch'>{t(isLogin ? 'auth.login.noAccount' : 'auth.register.hasAccount')} <button onClick={() => changeMode(isLogin ? 'register' : 'login')}>{t(isLogin ? 'auth.register.action' : 'auth.login.action')}</button></p>}
          </>}
        </div>
      </main>
      {wechat && <WeChatLogin qrCode={status.wechat_qrcode || ''} onClose={() => setWechat(false)} onComplete={acceptLogin} />}
      {challenge && <LoginVerification challenge={challenge} onComplete={acceptLogin} onCancel={() => { setChallenge(null); useAuthStore.getState().auth.setPendingLoginVerification(null); }} />}
      <footer className='cursor-auth-footer'>
        <span>{t('auth.legalPrefix')}</span>
        {agreementEnabled ? <button type='button' onClick={() => openLegal('terms')}>{t('auth.terms')}</button> : <span>{t('auth.terms')}</span>}
        <span>{t('auth.legalAnd')}</span>
        {privacyEnabled ? <button type='button' onClick={() => openLegal('privacy')}>{t('auth.privacy')}</button> : <span>{t('auth.privacy')}</span>}
      </footer>
      {legal && <div className='cursor-auth-legal-overlay' role='presentation' onMouseDown={closeLegal}>
        <section className='cursor-auth-legal-dialog' role='dialog' aria-modal='true' aria-labelledby='legal-title' onMouseDown={(event) => event.stopPropagation()}>
          <header><h2 id='legal-title'>{t(legal.type === 'terms' ? 'auth.terms' : 'auth.privacy')}</h2><button type='button' onClick={closeLegal} aria-label={t('auth.close')}>×</button></header>
          <div className='cursor-auth-legal-content'>{legal.loading ? t('auth.loading') : <MarkdownRenderer content={legal.content} />}</div>
        </section>
      </div>}
    </div>
  );
};

export default Auth;
