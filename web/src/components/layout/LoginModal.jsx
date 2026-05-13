import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Github, Mail, Fingerprint } from 'lucide-react';
import { SiDiscord } from 'react-icons/si';
import {
  API, showError, showInfo, showSuccess, setUserData, updateAPI, getSystemName,
  onGitHubOAuthClicked, onDiscordOAuthClicked, onOIDCClicked, onLinuxDOOAuthClicked,
} from '../../helpers';
import { isPasskeySupported, prepareCredentialRequestOptions, buildAssertionResult } from '../../helpers/passkey';
import { UserContext } from '../../context/User';
import { StatusContext } from '../../context/Status';
import { useLoginModal } from '../../context/LoginModal';
import { ModalShell, Input, Button, IconButton } from '../ui';

const usernamePattern = /^[A-Za-z0-9_\-.]{1,20}$/;

function evaluatePassword(pw) {
  const tips = [];
  const lengthOk = pw.length >= 8 && pw.length <= 20;
  if (!lengthOk) tips.push('长度需 8-20 位');
  const hasLower = /[a-z]/.test(pw);
  const hasUpper = /[A-Z]/.test(pw);
  const hasDigit = /\d/.test(pw);
  const hasSymbol = /[^A-Za-z0-9]/.test(pw);
  let score = 0;
  if (lengthOk) score += 1;
  const variety = (hasLower ? 1 : 0) + (hasUpper ? 1 : 0) + (hasDigit ? 1 : 0) + (hasSymbol ? 1 : 0);
  if (lengthOk) {
    if (variety >= 2) score = 2;
    if (variety >= 3 || pw.length >= 12) score = 3;
    if (variety >= 4 && pw.length >= 12) score = 4;
  }
  const labels = ['很弱', '弱', '中等', '较强', '很强'];
  const colors = ['#ef4444', '#f97316', '#f59e0b', '#22c55e', '#16a34a'];
  if (variety < 2 && lengthOk) tips.push('建议混合字母、数字或符号');
  return { score, label: labels[score], color: colors[score], tips, valid: lengthOk };
}

const GithubIcon = (props) => (
  <svg viewBox='0 0 24 24' fill='currentColor' {...props}>
    <path d='M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z' />
  </svg>
);

const PasskeySvg = (props) => (
  <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' {...props}>
    <path strokeLinecap='round' strokeLinejoin='round' d='M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z' />
  </svg>
);

const MailSvg = (props) => (
  <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='1.75' {...props}>
    <path strokeLinecap='round' strokeLinejoin='round' d='M3 8l9 6 9-6M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' />
  </svg>
);

const Terms = ({ hasUserAgreement, hasPrivacyPolicy, agreed, onChange }) => {
  if (!hasUserAgreement && !hasPrivacyPolicy) return null;
  return (
    <label className='flex items-start gap-2 cursor-pointer'>
      <input type='checkbox' checked={agreed} onChange={(e) => onChange(e.target.checked)} className='mt-0.5 accent-black' />
      <span className='text-xs text-ui-text-2'>
        我已阅读并同意
        {hasUserAgreement && <a href='/agreement' target='_blank' rel='noopener noreferrer' className='underline mx-1'>用户协议</a>}
        {hasUserAgreement && hasPrivacyPolicy && '和'}
        {hasPrivacyPolicy && <a href='/privacy' target='_blank' rel='noopener noreferrer' className='underline mx-1'>隐私政策</a>}
      </span>
    </label>
  );
};

const LoginModal = () => {
  const { open, mode, closeLoginModal, switchMode } = useLoginModal();
  const [, userDispatch] = useContext(UserContext);
  const [statusState] = useContext(StatusContext);
  const status = statusState?.status || {};
  const navigate = useNavigate();

  const handleAuthed = (data, path = '/console') => {
    closeLoginModal();
    navigate(path);
  };

  if (!open) return null;

  return (
    <ModalShell open={open} onClose={closeLoginModal} maxWidth='28rem' zIndex={1000}>
      <div className='relative p-6 sm:p-8'>
        <IconButton
          icon={X}
          onClick={closeLoginModal}
          aria-label='Close'
          className='absolute top-3 right-3'
        />
        {mode === 'register' ? (
          <RegisterPanel status={status} userDispatch={userDispatch} onSuccess={handleAuthed} onSwitchToLogin={() => switchMode('login')} />
        ) : mode === 'reset' ? (
          <ResetPanel onSwitchToLogin={() => switchMode('login')} />
        ) : (
          <LoginPanel
            status={status}
            userDispatch={userDispatch}
            onSuccess={handleAuthed}
            onSwitchToRegister={() => switchMode('register')}
            onSwitchToReset={() => switchMode('reset')}
          />
        )}
      </div>
    </ModalShell>
  );
};

/* ───────────────────────── Login Panel ───────────────────────── */

const LoginPanel = ({ status, userDispatch, onSuccess, onSwitchToRegister, onSwitchToReset }) => {
  const [inputs, setInputs] = useState({ username: '', password: '' });
  const [showEmailLogin, setShowEmailLogin] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [githubLoading, setGithubLoading] = useState(false);
  const [discordLoading, setDiscordLoading] = useState(false);
  const [oidcLoading, setOidcLoading] = useState(false);
  const [linuxdoLoading, setLinuxdoLoading] = useState(false);
  const [passkeySupported, setPasskeySupported] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);

  useEffect(() => {
    isPasskeySupported().then(setPasskeySupported).catch(() => setPasskeySupported(false));
  }, []);

  const hasUserAgreement = !!status?.user_agreement_enabled;
  const hasPrivacyPolicy = !!status?.privacy_policy_enabled;
  const termsBlocked = (hasUserAgreement || hasPrivacyPolicy) && !agreedToTerms;
  const hasOAuth = !!(
    status.github_oauth || status.discord_oauth || status.oidc_enabled ||
    status.linuxdo_oauth || (status.passkey_login && passkeySupported)
  );

  const change = (k) => (e) => setInputs((p) => ({ ...p, [k]: e?.target ? e.target.value : e }));

  const submit = async () => {
    if (termsBlocked) return showInfo('请先阅读并同意用户协议和隐私政策');
    if (!inputs.username || !inputs.password) return showError('请输入账号和密码');
    setLoginLoading(true);
    try {
      const res = await API.post('/api/user/login', inputs);
      const { success, message, data } = res.data || {};
      if (success) {
        try { localStorage.setItem('user', JSON.stringify(data)); } catch {}
        try { setUserData?.(data); } catch {}
        updateAPI();
        userDispatch({ type: 'login', payload: data });
        showSuccess('登录成功！');
        onSuccess(data);
      } else showError(message);
    } catch (e) { showError(e); } finally { setLoginLoading(false); }
  };

  const handlePasskey = async () => {
    if (termsBlocked) return showInfo('请先阅读并同意用户协议和隐私政策');
    if (!passkeySupported) return showInfo('当前环境无法使用 Passkey');
    setPasskeyLoading(true);
    try {
      const beginRes = await API.post('/api/user/passkey/login/begin');
      const { success, message, data } = beginRes.data || {};
      if (!success) { showError(message || '无法发起 Passkey 登录'); return; }
      const publicKey = prepareCredentialRequestOptions(data?.options || data?.publicKey || data);
      const assertion = await navigator.credentials.get({ publicKey });
      const payload = buildAssertionResult(assertion);
      const finishRes = await API.post('/api/user/passkey/login/finish', payload);
      const finish = finishRes.data || {};
      if (finish.success) {
        try { localStorage.setItem('user', JSON.stringify(finish.data)); } catch {}
        setUserData?.(finish.data);
        updateAPI();
        userDispatch({ type: 'login', payload: finish.data });
        showSuccess('登录成功！');
        onSuccess(finish.data);
      } else showError(finish.message || 'Passkey 登录失败');
    } catch (e) {
      if (e?.name === 'AbortError') showInfo('已取消 Passkey 登录');
      else showError(e.message || 'Passkey 登录失败');
    } finally { setPasskeyLoading(false); }
  };

  const oauthView = (
    <div className='space-y-2.5'>
      <Terms hasUserAgreement={hasUserAgreement} hasPrivacyPolicy={hasPrivacyPolicy} agreed={agreedToTerms} onChange={setAgreedToTerms} />

      <Button variant='oauth' block onClick={() => setShowEmailLogin(true)}
        icon={<MailSvg style={{ width: 20, height: 20 }} />}
      >使用 邮箱或用户名 登录</Button>

      <div className='flex items-center gap-3'>
        <div className='flex-1 h-px bg-ui-border' />
        <span className='text-xs text-ui-text-3'>或</span>
        <div className='flex-1 h-px bg-ui-border' />
      </div>

      {status.github_oauth && (
        <Button variant='oauth' block disabled={termsBlocked} loading={githubLoading}
          icon={<GithubIcon style={{ width: 22, height: 22 }} />}
          onClick={() => { setGithubLoading(true); try { onGitHubOAuthClicked(status.github_client_id, { shouldLogout: true }); } finally { setTimeout(() => setGithubLoading(false), 3000); } }}
        >GitHub</Button>
      )}
      {status.discord_oauth && (
        <Button variant='oauth' block disabled={termsBlocked} loading={discordLoading}
          icon={<SiDiscord style={{ color: '#5865F2', width: 22, height: 22 }} />}
          onClick={() => { setDiscordLoading(true); try { onDiscordOAuthClicked(status.discord_client_id, { shouldLogout: true }); } finally { setTimeout(() => setDiscordLoading(false), 3000); } }}
        >Discord</Button>
      )}
      {status.oidc_enabled && (
        <Button variant='oauth' block disabled={termsBlocked} loading={oidcLoading}
          onClick={() => { setOidcLoading(true); try { onOIDCClicked(status.oidc_authorization_endpoint, status.oidc_client_id, false, { shouldLogout: true }); } finally { setTimeout(() => setOidcLoading(false), 3000); } }}
        >{status.oidc_name || 'OIDC'}</Button>
      )}
      {status.linuxdo_oauth && (
        <Button variant='oauth' block disabled={termsBlocked} loading={linuxdoLoading}
          onClick={() => { setLinuxdoLoading(true); try { onLinuxDOOAuthClicked(status.linuxdo_client_id, { shouldLogout: true }); } finally { setTimeout(() => setLinuxdoLoading(false), 3000); } }}
        >LinuxDO</Button>
      )}
      {status.passkey_login && passkeySupported && (
        <Button variant='oauth' block disabled={termsBlocked} loading={passkeyLoading}
          icon={<PasskeySvg style={{ width: 22, height: 22 }} />}
          onClick={handlePasskey}
        >Passkey</Button>
      )}
    </div>
  );

  const emailView = (
    <div className='space-y-3'>
      {status.passkey_login && passkeySupported && (
        <Button variant='oauth' block loading={passkeyLoading} icon={<PasskeySvg style={{ width: 20, height: 20 }} />} onClick={handlePasskey}>
          使用 Passkey 登录
        </Button>
      )}

      <div>
        <label className='block mb-1.5 text-sm font-medium text-ui-text-1'>用户名或邮箱</label>
        <Input variant='auth' size={44} width='full' value={inputs.username} onChange={change('username')} placeholder='请输入您的用户名或邮箱地址' />
      </div>

      <div>
        <div className='flex items-center justify-between mb-1.5'>
          <label className='text-sm font-medium text-ui-text-1'>密码</label>
          <Button variant='link' size='sm' onClick={onSwitchToReset}>忘记密码？</Button>
        </div>
        <Input variant='auth' size={44} width='full' type='password' value={inputs.password} onChange={change('password')}
          placeholder='请输入您的密码' onKeyDown={(e) => e.key === 'Enter' && submit()} />
      </div>

      <Terms hasUserAgreement={hasUserAgreement} hasPrivacyPolicy={hasPrivacyPolicy} agreed={agreedToTerms} onChange={setAgreedToTerms} />

      <Button size='lg' block onClick={submit} disabled={termsBlocked} loading={loginLoading}>继续</Button>

      {hasOAuth && (
        <Button variant='toggle' block onClick={() => setShowEmailLogin(false)}>其他登录选项</Button>
      )}
    </div>
  );

  return (
    <>
      <div className='mb-6'>
        <h2 className='text-xl font-semibold text-ui-text-1'>登录</h2>
        <p className='text-[13px] text-ui-text-3 mt-0.5'>{getSystemName()}</p>
      </div>

      {showEmailLogin || !hasOAuth ? emailView : oauthView}

      {!status.self_use_mode_enabled && (
        <p className='mt-5 pt-4 border-t border-ui-border text-[13px] text-ui-text-3'>
          没有账户？{' '}
          <Button variant='link' size='sm' onClick={onSwitchToRegister}>注册</Button>
        </p>
      )}
    </>
  );
};

/* ──────────────────────── Register Panel ──────────────────────── */

const RegisterPanel = ({ status, userDispatch, onSuccess, onSwitchToLogin }) => {
  const [inputs, setInputs] = useState({
    username: '', password: '', password2: '', email: '', verification_code: '',
  });
  const [showEmailRegister, setShowEmailRegister] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [verifLoading, setVerifLoading] = useState(false);
  const [disableButton, setDisableButton] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const [usernameStatus, setUsernameStatus] = useState({ state: 'idle', message: '' });
  const checkRef = useRef(0);

  const hasUserAgreement = !!status?.user_agreement_enabled;
  const hasPrivacyPolicy = !!status?.privacy_policy_enabled;
  const showEmailVerification = !!status?.email_verification;
  const termsBlocked = (hasUserAgreement || hasPrivacyPolicy) && !agreedToTerms;
  const hasOAuth = !!(status.github_oauth || status.discord_oauth || status.oidc_enabled || status.linuxdo_oauth);

  const passwordEval = useMemo(() => evaluatePassword(inputs.password), [inputs.password]);
  const passwordsMatch = inputs.password.length > 0 && inputs.password === inputs.password2;

  const change = (k) => (e) => setInputs((p) => ({ ...p, [k]: e?.target ? e.target.value : e }));

  useEffect(() => {
    let id = null;
    if (disableButton && countdown > 0) id = setInterval(() => setCountdown((c) => c - 1), 1000);
    else if (countdown === 0) { setDisableButton(false); setCountdown(30); }
    return () => id && clearInterval(id);
  }, [disableButton, countdown]);

  useEffect(() => {
    const value = inputs.username.trim();
    if (!value) { setUsernameStatus({ state: 'idle', message: '' }); return; }
    if (!usernamePattern.test(value)) {
      setUsernameStatus({ state: 'invalid', message: '1-20 位字母、数字、下划线、点或短横线' });
      return;
    }
    setUsernameStatus({ state: 'checking', message: '正在检测可用性…' });
    const reqId = ++checkRef.current;
    const handle = setTimeout(async () => {
      try {
        const res = await API.get(`/api/user/check_username?username=${encodeURIComponent(value)}`);
        if (reqId !== checkRef.current) return;
        const { success, data, message } = res.data || {};
        if (success && data) {
          setUsernameStatus(data.available
            ? { state: 'available', message: '该用户名可用' }
            : { state: 'taken', message: '该用户名已被占用' });
        } else setUsernameStatus({ state: 'error', message: message || '检测失败' });
      } catch {
        if (reqId !== checkRef.current) return;
        setUsernameStatus({ state: 'error', message: '网络异常，无法检测' });
      }
    }, 450);
    return () => clearTimeout(handle);
  }, [inputs.username]);

  const sendVerificationCode = async () => {
    if (!inputs.email) return;
    setVerifLoading(true);
    try {
      const res = await API.get(`/api/verification?email=${encodeURIComponent(inputs.email)}`);
      const { success, message } = res.data || {};
      if (success) { showSuccess('验证码发送成功，请检查邮箱'); setDisableButton(true); }
      else showError(message);
    } catch (e) { showError(e); } finally { setVerifLoading(false); }
  };

  const submit = async () => {
    if (termsBlocked) return showInfo('请先阅读并同意用户协议和隐私政策');
    if (usernameStatus.state === 'invalid') return showInfo(usernameStatus.message);
    if (usernameStatus.state === 'taken') return showInfo('该用户名已被占用');
    if (!passwordEval.valid) return showInfo('密码长度需 8-20 位');
    if (inputs.password !== inputs.password2) return showInfo('两次输入的密码不一致');
    setRegisterLoading(true);
    try {
      const affCode = new URLSearchParams(window.location.search).get('aff') || localStorage.getItem('aff');
      const body = { ...inputs };
      if (affCode) body.aff_code = affCode;
      const res = await API.post('/api/user/register', body);
      const { success, message } = res.data || {};
      if (success) {
        showSuccess('注册成功！');
        try { localStorage.removeItem('aff'); } catch {}
        onSwitchToLogin();
      } else showError(message);
    } catch (e) { showError(e); } finally { setRegisterLoading(false); }
  };

  const usernameTone =
    usernameStatus.state === 'available' ? 'text-green-600'
      : ['taken', 'invalid', 'error'].includes(usernameStatus.state) ? 'text-red-500'
      : 'text-ui-text-3';

  const oauthView = (
    <div className='space-y-2.5'>
      <Terms hasUserAgreement={hasUserAgreement} hasPrivacyPolicy={hasPrivacyPolicy} agreed={agreedToTerms} onChange={setAgreedToTerms} />

      {status.github_oauth && (
        <Button variant='oauth' block disabled={termsBlocked}
          icon={<GithubIcon style={{ width: 20, height: 20 }} />}
          onClick={() => onGitHubOAuthClicked(status.github_client_id, { shouldLogout: true })}
        >使用 GitHub 继续</Button>
      )}
      {status.discord_oauth && (
        <Button variant='oauth' block disabled={termsBlocked}
          icon={<SiDiscord style={{ color: '#5865F2', width: 20, height: 20 }} />}
          onClick={() => onDiscordOAuthClicked(status.discord_client_id, { shouldLogout: true })}
        >使用 Discord 继续</Button>
      )}
      {status.oidc_enabled && (
        <Button variant='oauth' block disabled={termsBlocked}
          onClick={() => onOIDCClicked(status.oidc_authorization_endpoint, status.oidc_client_id, false, { shouldLogout: true })}
        >使用 {status.oidc_name || 'OIDC'} 继续</Button>
      )}
      {status.linuxdo_oauth && (
        <Button variant='oauth' block disabled={termsBlocked}
          onClick={() => onLinuxDOOAuthClicked(status.linuxdo_client_id, { shouldLogout: true })}
        >使用 LinuxDO 继续</Button>
      )}

      <div className='flex items-center gap-3'>
        <div className='flex-1 h-px bg-ui-border' />
        <span className='text-xs text-ui-text-3'>或</span>
        <div className='flex-1 h-px bg-ui-border' />
      </div>

      <Button size='lg' block onClick={() => setShowEmailRegister(true)}>使用 用户名 注册</Button>
    </div>
  );

  const emailView = (
    <div className='space-y-3'>
      <div>
        <label className='block mb-1.5 text-sm font-medium text-ui-text-1'>用户名</label>
        <Input variant='auth' size={44} width='full' autoComplete='username' placeholder='请输入用户名'
          value={inputs.username} onChange={change('username')} />
        {usernameStatus.state !== 'idle' && (
          <div className={`mt-1 text-[12px] flex items-center gap-1 ${usernameTone}`}>
            {usernameStatus.state === 'checking' && (
              <span className='w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin' />
            )}
            <span>{usernameStatus.message}</span>
          </div>
        )}
      </div>

      <div>
        <label className='block mb-1.5 text-sm font-medium text-ui-text-1'>密码</label>
        <Input variant='auth' size={44} width='full' type='password' autoComplete='new-password'
          placeholder='输入密码，最短 8 位，最长 20 位'
          value={inputs.password} onChange={change('password')} />
        {inputs.password.length > 0 && (
          <div className='mt-1.5 space-y-1'>
            <div className='flex items-center gap-2'>
              <div className='flex-1 flex items-center gap-1'>
                {[0, 1, 2].map((i) => {
                  const filled = passwordEval.score <= 1 ? 1 : passwordEval.score === 2 ? 2 : 3;
                  const active = i < filled;
                  return (
                    <div key={i} className='flex-1 h-1.5 rounded-full transition-colors duration-200'
                      style={{ backgroundColor: active ? passwordEval.color : 'rgba(0,0,0,0.08)' }} />
                  );
                })}
              </div>
              <span className='text-[12px] font-medium' style={{ color: passwordEval.color }}>{passwordEval.label}</span>
            </div>
            {passwordEval.tips.length > 0 && (
              <p className='text-[12px] text-ui-text-3'>{passwordEval.tips.join('；')}</p>
            )}
          </div>
        )}
      </div>

      <div>
        <label className='block mb-1.5 text-sm font-medium text-ui-text-1'>确认密码</label>
        <Input variant='auth' size={44} width='full' type='password' autoComplete='new-password'
          placeholder='确认密码'
          value={inputs.password2} onChange={change('password2')} />
        {inputs.password2.length > 0 && (
          <p className={`mt-1 text-[12px] ${passwordsMatch ? 'text-green-600' : 'text-red-500'}`}>
            {passwordsMatch ? '两次输入一致' : '两次输入的密码不一致'}
          </p>
        )}
      </div>

      {showEmailVerification && (
        <>
          <div>
            <label className='block mb-1.5 text-sm font-medium text-ui-text-1'>邮箱</label>
            <div className='flex gap-2'>
              <Input variant='auth' size={44} width='full' type='email' placeholder='输入邮箱地址'
                value={inputs.email} onChange={change('email')} />
              <Button variant='secondary' size='sm' onClick={sendVerificationCode}
                disabled={disableButton || verifLoading} loading={verifLoading}>
                {disableButton ? `重新发送 (${countdown})` : '获取验证码'}
              </Button>
            </div>
          </div>
          <div>
            <label className='block mb-1.5 text-sm font-medium text-ui-text-1'>验证码</label>
            <Input variant='auth' size={44} width='full' placeholder='输入验证码'
              value={inputs.verification_code} onChange={change('verification_code')} />
          </div>
        </>
      )}

      <Terms hasUserAgreement={hasUserAgreement} hasPrivacyPolicy={hasPrivacyPolicy} agreed={agreedToTerms} onChange={setAgreedToTerms} />

      <Button size='lg' block onClick={submit} disabled={termsBlocked} loading={registerLoading}>注册</Button>

      {hasOAuth && (
        <Button variant='toggle' block onClick={() => setShowEmailRegister(false)}>其他注册选项</Button>
      )}
    </div>
  );

  return (
    <>
      <div className='mb-6'>
        <h2 className='text-xl font-semibold text-ui-text-1'>注册</h2>
        <p className='text-[13px] text-ui-text-3 mt-0.5'>创建你的账户</p>
      </div>

      {showEmailRegister || !hasOAuth ? emailView : oauthView}

      <p className='mt-5 pt-4 border-t border-ui-border text-[13px] text-ui-text-3'>
        已有账户？{' '}
        <Button variant='link' size='sm' onClick={onSwitchToLogin}>登录</Button>
      </p>
    </>
  );
};

export default LoginModal;

/* ──────────────────────── Reset Panel ──────────────────────── */

const ResetPanel = ({ onSwitchToLogin }) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [disableButton, setDisableButton] = useState(false);
  const [countdown, setCountdown] = useState(30);

  useEffect(() => {
    let id = null;
    if (disableButton && countdown > 0) id = setInterval(() => setCountdown((c) => c - 1), 1000);
    else if (countdown === 0) { setDisableButton(false); setCountdown(30); }
    return () => id && clearInterval(id);
  }, [disableButton, countdown]);

  const submit = async () => {
    if (!email) return showError('请输入邮箱地址');
    setDisableButton(true);
    setLoading(true);
    try {
      const res = await API.get(`/api/reset_password?email=${encodeURIComponent(email)}`);
      const { success, message } = res.data || {};
      if (success) { showSuccess('重置邮件发送成功，请检查邮箱！'); setEmail(''); }
      else showError(message);
    } catch (e) { showError(e); } finally { setLoading(false); }
  };

  return (
    <>
      <div className='mb-6'>
        <h2 className='text-xl font-semibold text-ui-text-1'>密码重置</h2>
        <p className='text-[13px] text-ui-text-3 mt-0.5'>我们将向你的邮箱发送重置链接</p>
      </div>

      <div className='space-y-4'>
        <div>
          <label className='block mb-1.5 text-sm font-medium text-ui-text-1'>邮箱</label>
          <Input
            variant='auth'
            size={44}
            width='full'
            type='email'
            placeholder='请输入您的邮箱地址'
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
        </div>

        <Button size='lg' block onClick={submit} disabled={loading || disableButton} loading={loading}>
          {disableButton ? `重试 (${countdown})` : '发送重置邮件'}
        </Button>
      </div>

      <p className='mt-5 pt-4 border-t border-ui-border text-[13px] text-ui-text-3'>
        想起来了？{' '}
        <Button variant='link' size='sm' onClick={onSwitchToLogin}>登录</Button>
      </p>
    </>
  );
};
