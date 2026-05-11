/*
 * LoginModal — 最小可用版（与 web-backup 同接口）
 *
 * - Tab 切换：登录 / 注册 / 忘记密码
 * - 登录：POST /api/user/login，成功后 dispatch 用户态
 * - 注册：POST /api/user/register
 * - 重置：POST /api/user/reset_password（仅请求邮件）
 *
 * 不含 OAuth / Passkey / Telegram / 微信 / Turnstile 等扩展（后续补）。
 */

import React, { useContext, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLoginModal } from '../../../context/LoginModal';
import { UserContext } from '../../../context/User';
import { API, showError, showSuccess, setUserData } from '../../../helpers';
import { ModalShell, Button, IconButton, Input, FieldRow, Tabs } from '../../ui';
import { X } from 'lucide-react';

const LoginModal = () => {
  const { open, mode, closeLoginModal, switchMode } = useLoginModal();
  const { t } = useTranslation();

  return (
    <ModalShell open={open} onClose={closeLoginModal} maxWidth={448} zIndex={1000}>
      <div className='relative p-6'>
        <IconButton icon={X} variant='ghost' onClick={closeLoginModal} absolute position='tr' aria-label='close' />
        <h2 className='text-xl font-semibold text-ui-text mb-1 mt-2' style={{ letterSpacing: '-0.02em' }}>
          {mode === 'register' ? t('注册账号') : mode === 'reset' ? t('找回密码') : t('登录')}
        </h2>
        <p className='text-xs text-ui-text-3 mb-5'>
          {mode === 'register' ? t('创建一个新账户') : mode === 'reset' ? t('我们会向你的邮箱发送重置链接') : t('使用账号密码登录')}
        </p>

        <Tabs
          variant='underline'
          value={mode}
          onChange={switchMode}
          items={[
            { value: 'login',    label: t('登录') },
            { value: 'register', label: t('注册') },
            { value: 'reset',    label: t('重置密码') },
          ]}
        />

        <div className='mt-5'>
          {mode === 'login'    && <LoginForm    closeLoginModal={closeLoginModal} t={t} />}
          {mode === 'register' && <RegisterForm closeLoginModal={closeLoginModal} switchMode={switchMode} t={t} />}
          {mode === 'reset'    && <ResetForm    switchMode={switchMode} t={t} />}
        </div>
      </div>
    </ModalShell>
  );
};

/* ---------- 登录 ---------- */
const LoginForm = ({ closeLoginModal, t }) => {
  const [, userDispatch] = useContext(UserContext);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e?.preventDefault?.();
    if (!username || !password) return showError(t('请输入用户名和密码'));
    setLoading(true);
    try {
      const res = await API.post('/api/user/login', { username, password });
      const { success, message, data } = res.data || {};
      if (success) {
        userDispatch({ type: 'login', payload: data });
        setUserData(data);
        showSuccess(t('登录成功！'));
        closeLoginModal();
      } else {
        showError(message || t('登录失败'));
      }
    } catch (e) { showError(e); }
    finally { setLoading(false); }
  };

  return (
    <form onSubmit={submit} className='space-y-4'>
      <FieldRow label={t('用户名')} required>
        <Input value={username} onChange={setUsername} placeholder={t('用户名或邮箱')} autoFocus autoComplete='username' />
      </FieldRow>
      <FieldRow label={t('密码')} required>
        <Input type='password' value={password} onChange={setPassword} placeholder='••••••••' autoComplete='current-password' />
      </FieldRow>
      <Button type='submit' block loading={loading}>{loading ? t('登录中...') : t('登录')}</Button>
    </form>
  );
};

/* ---------- 注册 ---------- */
const RegisterForm = ({ closeLoginModal, switchMode, t }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [email, setEmail] = useState('');
  const [verification_code, setVerificationCode] = useState('');
  const [aff_code] = useState(() => {
    try { return localStorage.getItem('aff') || ''; } catch { return ''; }
  });
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e?.preventDefault?.();
    if (!username || !password) return showError(t('请填写完整信息'));
    if (password !== confirmPassword) return showError(t('两次密码不一致'));
    if (password.length < 8) return showError(t('密码至少 8 位'));
    setLoading(true);
    try {
      const res = await API.post('/api/user/register', {
        username, password, password2: confirmPassword,
        email, verification_code, aff_code,
      });
      const { success, message } = res.data || {};
      if (success) {
        showSuccess(t('注册成功，请登录'));
        switchMode('login');
      } else showError(message || t('注册失败'));
    } catch (e) { showError(e); }
    finally { setLoading(false); }
  };

  const sendCode = async () => {
    if (!email) return showError(t('请先填写邮箱'));
    try {
      const res = await API.get(`/api/verification?email=${encodeURIComponent(email)}`);
      const { success, message } = res.data || {};
      if (success) showSuccess(t('验证码已发送'));
      else showError(message || t('发送失败'));
    } catch (e) { showError(e); }
  };

  return (
    <form onSubmit={submit} className='space-y-4'>
      <FieldRow label={t('用户名')} required>
        <Input value={username} onChange={setUsername} placeholder={t('用户名')} autoComplete='username' />
      </FieldRow>
      <FieldRow label={t('密码')} required hint={t('至少 8 位')}>
        <Input type='password' value={password} onChange={setPassword} autoComplete='new-password' />
      </FieldRow>
      <FieldRow label={t('确认密码')} required>
        <Input type='password' value={confirmPassword} onChange={setConfirmPassword} autoComplete='new-password' />
      </FieldRow>
      <FieldRow label={t('邮箱')} hint={t('用于找回密码与验证码')}>
        <div className='flex gap-2'>
          <Input value={email} onChange={setEmail} type='email' width='full' />
          <Button type='button' variant='toggle' onClick={sendCode}>{t('获取验证码')}</Button>
        </div>
      </FieldRow>
      {email && (
        <FieldRow label={t('验证码')}>
          <Input value={verification_code} onChange={setVerificationCode} />
        </FieldRow>
      )}
      <Button type='submit' block loading={loading}>{loading ? t('注册中...') : t('注册')}</Button>
    </form>
  );
};

/* ---------- 重置密码 ---------- */
const ResetForm = ({ switchMode, t }) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e?.preventDefault?.();
    if (!email) return showError(t('请输入邮箱'));
    setLoading(true);
    try {
      const res = await API.get(`/api/reset_password?email=${encodeURIComponent(email)}`);
      const { success, message } = res.data || {};
      if (success) {
        showSuccess(t('重置邮件已发送'));
        switchMode('login');
      } else showError(message || t('发送失败'));
    } catch (e) { showError(e); }
    finally { setLoading(false); }
  };

  return (
    <form onSubmit={submit} className='space-y-4'>
      <FieldRow label={t('邮箱')} required>
        <Input value={email} onChange={setEmail} type='email' />
      </FieldRow>
      <Button type='submit' block loading={loading}>{loading ? t('提交中...') : t('发送重置邮件')}</Button>
    </form>
  );
};

export default LoginModal;
