import React, { useContext, useEffect, useState, useCallback } from 'react';
import { Copy, Fingerprint, Trash2, KeyRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { API, showError, showSuccess, copy, timestamp2string, updateAPI } from '../../helpers';
import {
  isPasskeySupported, prepareCredentialCreationOptions, buildRegistrationResult,
} from '../../helpers/passkey';
import { UserContext } from '../../context/User';
import {
  Button, IconButton, Input, Modal, Tag, Loading, Select,
} from '../../components/ui';
import useIsMobile from '../../hooks/useIsMobile';

const LANGUAGES = [
  { value: 'zh-CN', label: '简体中文' },
  { value: 'en',    label: 'English' },
];

const Personal = () => {
  const { i18n } = useTranslation();
  const [userState, userDispatch] = useContext(UserContext);
  const [form, setForm] = useState({ original_password: '', password: '' });
  const [saving, setSaving] = useState(false);
  const [accessToken, setAccessToken] = useState('');
  const [twoFA, setTwoFA] = useState({ enabled: false, backup_codes_remaining: 0 });
  const [setupData, setSetupData] = useState(null);
  const [setupCode, setSetupCode] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [twoFABusy, setTwoFABusy] = useState(false);
  const [disableOpen, setDisableOpen] = useState(false);
  const [passkeys, setPasskeys] = useState([]);
  const [passkeySupported, setPasskeySupported] = useState(false);
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  const [emailBindOpen, setEmailBindOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [bindEmail, setBindEmail] = useState('');
  const [bindCode, setBindCode] = useState('');
  const [emailBusy, setEmailBusy] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [secureVerifyOpen, setSecureVerifyOpen] = useState(false);
  const [secureVerifyCode, setSecureVerifyCode] = useState('');
  const [secureVerifyBusy, setSecureVerifyBusy] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const isMobile = useIsMobile();

  const u = userState?.user || {};
  useEffect(() => {
    setForm({ original_password: '', password: '' });
    setAccessToken(u.access_token || '');
  }, [u.id]);

  const refresh = async () => {
    try {
      const { data } = await API.get('/api/user/self');
      if (data.success) userDispatch?.({ type: 'login', payload: data.data });
    } catch (e) { showError(e); }
  };

  const load2FA = async () => {
    try {
      const { data } = await API.get('/api/user/2fa/status');
      if (data.success) setTwoFA(data.data || { enabled: false });
    } catch {}
  };
  const loadPasskeys = async () => {
    try {
      const { data } = await API.get('/api/user/passkey');
      if (data.success) setPasskeys(data.data || []);
    } catch {}
  };
  useEffect(() => { load2FA(); loadPasskeys(); isPasskeySupported().then(setPasskeySupported).catch(() => {}); }, []);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const sendEmailCode = async () => {
    if (!bindEmail.trim()) return showError('请输入邮箱地址');
    setEmailBusy(true);
    try {
      const { data } = await API.get(`/api/verification?email=${encodeURIComponent(bindEmail.trim())}`);
      if (data.success) { showSuccess('验证码已发送'); setCodeSent(true); setCountdown(60); }
      else showError(data.message);
    } catch (e) { showError(e); } finally { setEmailBusy(false); }
  };

  const confirmBindEmail = async () => {
    if (!bindCode.trim()) return showError('请输入验证码');
    setEmailBusy(true);
    try {
      const { data } = await API.post('/api/oauth/email/bind', { email: bindEmail.trim(), code: bindCode.trim() });
      if (data.success) { showSuccess('邮箱绑定成功'); setEmailBindOpen(false); setBindEmail(''); setBindCode(''); setCodeSent(false); refresh(); }
      else showError(data.message);
    } catch (e) { showError(e); } finally { setEmailBusy(false); }
  };

  const doSecureVerify = async (action) => {
    if (!secureVerifyCode.trim()) return showError('请输入 2FA 验证码');
    setSecureVerifyBusy(true);
    try {
      const res = await API.post('/api/verify', { method: '2fa', code: secureVerifyCode.trim() });
      if (!res.data?.success) { showError(res.data?.message || '验证失败'); return; }
      setSecureVerifyOpen(false);
      setSecureVerifyCode('');
      if (action) await action();
    } catch (e) { showError(e.message || '验证失败'); }
    finally { setSecureVerifyBusy(false); }
  };

  const requireVerification = (action) => {
    setPendingAction(() => action);
    setSecureVerifyOpen(true);
    setSecureVerifyCode('');
  };

  const addPasskey = async () => {
    setPasskeyBusy(true);
    try {
      const beginRes = await API.post('/api/user/passkey/register/begin');
      if (!beginRes.data?.success) {
        const msg = beginRes.data?.message || '注册失败';
        if (msg.includes('安全验证')) {
          requireVerification(addPasskey);
          return;
        }
        showError(msg); return;
      }
      const publicKey = prepareCredentialCreationOptions(beginRes.data.data);
      const credential = await navigator.credentials.create({ publicKey });
      const finishRes = await API.post('/api/user/passkey/register/finish', buildRegistrationResult(credential));
      if (finishRes.data?.success) { showSuccess('Passkey 添加成功'); loadPasskeys(); }
      else showError(finishRes.data?.message || '注册失败');
    } catch (e) { showError(e.message || 'Passkey 注册失败'); }
    finally { setPasskeyBusy(false); }
  };

  const removePasskey = async (id) => {
    try {
      const { data } = await API.delete(`/api/user/passkey/${id}`);
      if (data.success) { showSuccess('已删除'); loadPasskeys(); }
      else {
        if ((data.message || '').includes('安全验证')) {
          requireVerification(() => removePasskey(id));
          return;
        }
        showError(data.message);
      }
    } catch (e) { showError(e); }
  };

  const start2FASetup = async () => {
    setTwoFABusy(true);
    try {
      const { data } = await API.post('/api/user/2fa/setup');
      if (data.success) setSetupData(data.data);
      else showError(data.message);
    } catch (e) { showError(e); } finally { setTwoFABusy(false); }
  };

  const enable2FA = async () => {
    if (!setupCode.trim()) return showError('请输入验证码');
    setTwoFABusy(true);
    try {
      const { data } = await API.post('/api/user/2fa/enable', { code: setupCode.trim() });
      if (data.success) { showSuccess('已启用 2FA'); setSetupData(null); setSetupCode(''); load2FA(); }
      else showError(data.message);
    } catch (e) { showError(e); } finally { setTwoFABusy(false); }
  };

  const disable2FA = async () => {
    if (!disableCode.trim()) return showError('请输入验证码');
    setTwoFABusy(true);
    try {
      const { data } = await API.post('/api/user/2fa/disable', { code: disableCode.trim() });
      if (data.success) { showSuccess('已禁用 2FA'); setDisableOpen(false); setDisableCode(''); load2FA(); }
      else showError(data.message);
    } catch (e) { showError(e); } finally { setTwoFABusy(false); }
  };

  const regenBackup = async () => {
    const code = prompt('请输入当前 2FA 验证码以重新生成备份码');
    if (!code) return;
    try {
      const { data } = await API.post('/api/user/2fa/backup_codes', { code });
      if (data.success) { await copy((data.data?.backup_codes || []).join('\n')); showSuccess('备份码已复制到剪贴板'); load2FA(); }
      else showError(data.message);
    } catch (e) { showError(e); }
  };

  const save = async () => {
    if (!form.password) return showError('请输入新密码');
    if (!form.original_password) return showError('请输入原密码');
    setSaving(true);
    try {
      const payload = { password: form.password, original_password: form.original_password };
      const { data } = await API.put('/api/user/self', payload);
      if (data.success) { showSuccess('密码已修改'); refresh(); setForm({ original_password: '', password: '' }); setChangePasswordOpen(false); }
      else showError(data.message);
    } catch (e) { showError(e); } finally { setSaving(false); }
  };

  const genToken = async () => {
    try {
      const { data } = await API.get('/api/user/token');
      if (data.success) { setAccessToken(data.data); showSuccess('已生成'); refresh(); }
      else showError(data.message);
    } catch (e) { showError(e); }
  };

  const logout = async () => {
    try {
      await API.get('/api/user/logout');
      localStorage.removeItem('user');
      updateAPI();
      userDispatch?.({ type: 'logout' });
      window.location.href = '/';
    } catch (e) { showError(e); }
  };

  const f = (k) => (v) => setForm((p) => ({ ...p, [k]: v }));
  if (!u.id) return <Loading />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, width: '100%', maxWidth: 720, marginInline: 'auto', padding: isMobile ? '16px' : '24px 16px' }}>

      {/* 账号 */}
      <SettingGroup title='账号'>
        <SettingRow title='邮箱' description={u.email || '未绑定邮箱'}>
          <Button variant='toggle' onClick={() => { setEmailBindOpen(true); setBindEmail(u.email || ''); }}>
            {u.email ? '换绑' : '绑定'}
          </Button>
        </SettingRow>
        <SettingRow title='密码' description='修改登录密码' last>
          <Button variant='toggle' onClick={() => { setForm({ original_password: '', password: '' }); setChangePasswordOpen(true); }}>修改</Button>
        </SettingRow>
      </SettingGroup>

      {/* 安全 */}
      <SettingGroup title='安全'>
        <SettingRow
          title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Fingerprint size={15} style={{ color: '#666' }} />Passkey<Tag color={passkeys.length > 0 ? 'green' : 'grey'}>{passkeys.length > 0 ? `${passkeys.length} 个` : '未启用'}</Tag></span>}
          description={passkeySupported ? '指纹 / 面容免密登录' : '当前浏览器不支持 Passkey'}
          last={passkeys.length === 0}
        >
          {passkeySupported && <Button loading={passkeyBusy} onClick={addPasskey}>添加</Button>}
        </SettingRow>
        {passkeys.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '12px 16px', borderBottom: '1px solid #eee' }}>
            {passkeys.map((p) => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--ui-bg-subtle)', borderRadius: 10 }}>
                <div>
                  <span style={{ fontSize: 13, color: 'var(--ui-text)' }}>{p.name || 'Passkey'}</span>
                  {p.created_at && <span style={{ fontSize: 11, color: 'var(--ui-text-3)', marginLeft: 8 }}>{timestamp2string(p.created_at)}</span>}
                </div>
                <IconButton icon={Trash2} variant='danger' onClick={() => removePasskey(p.id)} />
              </div>
            ))}
          </div>
        )}
        <SettingRow
          title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><KeyRound size={15} style={{ color: '#666' }} />两步验证<Tag color={twoFA.enabled ? 'green' : 'grey'}>{twoFA.enabled ? '已启用' : '未启用'}</Tag></span>}
          description={
            twoFA.enabled
              ? <span>TOTP 应用保护 · 备份码剩余 <strong style={{ color: 'var(--ui-text)' }}>{twoFA.backup_codes_remaining}</strong> <button onClick={regenBackup} style={{ marginLeft: 4, cursor: 'pointer', color: 'var(--ui-text)', textDecoration: 'underline', background: 'none', border: 'none', fontSize: 12, padding: 0 }}>重新生成</button></span>
              : '使用 TOTP 应用保护登录安全'
          }
          last
        >
          {twoFA.enabled
            ? <Button variant='toggle' onClick={() => setDisableOpen(true)}>禁用</Button>
            : <Button loading={twoFABusy} onClick={start2FASetup}>启用</Button>}
        </SettingRow>
      </SettingGroup>

      {/* 偏好 */}
      <SettingGroup title='偏好'>
        <SettingRow title='语言' description='界面显示语言'>
          <Select
            options={LANGUAGES}
            value={LANGUAGES.find((l) => i18n.language?.startsWith(l.value.split('-')[0]))?.value || 'zh-CN'}
            onChange={(val) => { i18n.changeLanguage(val); try { localStorage.setItem('i18nextLng', val); } catch {} }}
            width={160}
          />
        </SettingRow>
        <SettingRow title='系统访问令牌' description='调用管理 API 的令牌，请妥善保管' last={!accessToken}>
          <Button variant='toggle' onClick={genToken}>{accessToken ? '重新生成' : '生成令牌'}</Button>
        </SettingRow>
        {accessToken && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px' }}>
            <code style={{ flex: 1, fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: 'var(--ui-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', background: 'var(--ui-bg-subtle)', padding: '8px 12px', borderRadius: 10 }}>{accessToken}</code>
            <IconButton icon={Copy} onClick={async () => { await copy(accessToken); showSuccess('已复制'); }} />
          </div>
        )}
      </SettingGroup>

      {/* 弹窗 */}
      {changePasswordOpen && (
        <Modal open title='修改密码' onClose={() => { setChangePasswordOpen(false); setForm({ original_password: '', password: '' }); }} onConfirm={save} loading={saving} confirmText='保存'>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <FieldGroup label='原密码'>
              <Input type='password' value={form.original_password} onChange={f('original_password')} width='full' placeholder='••••••••' />
            </FieldGroup>
            <FieldGroup label='新密码'>
              <Input type='password' value={form.password} onChange={f('password')} width='full' placeholder='••••••••' />
            </FieldGroup>
          </div>
        </Modal>
      )}

      {setupData && (
        <Modal open title='设置两步验证' onClose={() => { setSetupData(null); setSetupCode(''); }} onConfirm={enable2FA} loading={twoFABusy} confirmText='确认启用'>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p style={{ fontSize: 14, color: 'var(--ui-text-2)', margin: 0 }}>使用 TOTP 应用扫描二维码或手动输入密钥</p>
            {setupData.qr_code_url && (
              <img alt='2FA QR' src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(setupData.qr_code_url)}`}
                style={{ display: 'block', margin: '0 auto', borderRadius: 12, border: '1px solid var(--ui-border)' }} />
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'var(--ui-bg-subtle)', borderRadius: 12 }}>
              <code style={{ flex: 1, fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: 'var(--ui-text)', wordBreak: 'break-all' }}>{setupData.secret}</code>
              <IconButton icon={Copy} onClick={async () => { await copy(setupData.secret); showSuccess('已复制'); }} />
            </div>
            <FieldGroup label='输入 6 位验证码'>
              <Input value={setupCode} onChange={setSetupCode} placeholder='000000' width='full' />
            </FieldGroup>
            {Array.isArray(setupData.backup_codes) && setupData.backup_codes.length > 0 && (
              <div>
                <p style={{ fontSize: 12, color: 'var(--ui-text-3)', marginBottom: 6 }}>请保存备份码：</p>
                <pre style={{ background: 'var(--ui-bg-subtle)', padding: 12, borderRadius: 12, fontSize: 12, fontFamily: "'JetBrains Mono', monospace", maxHeight: 100, overflow: 'auto', whiteSpace: 'pre-wrap', margin: 0 }}>
                  {setupData.backup_codes.join('\n')}
                </pre>
              </div>
            )}
          </div>
        </Modal>
      )}

      {disableOpen && (
        <Modal open title='禁用两步验证' onClose={() => { setDisableOpen(false); setDisableCode(''); }} onConfirm={disable2FA} loading={twoFABusy} confirmText='确认禁用'>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ fontSize: 14, color: 'var(--ui-text-2)', margin: 0 }}>禁用后账号将不再受两步验证保护</p>
            <FieldGroup label='输入当前验证码'>
              <Input value={disableCode} onChange={setDisableCode} placeholder='000000' width='full' />
            </FieldGroup>
          </div>
        </Modal>
      )}

      {emailBindOpen && (
        <Modal open title={u.email ? '换绑邮箱' : '绑定邮箱'} onClose={() => { setEmailBindOpen(false); setBindEmail(''); setBindCode(''); setCodeSent(false); }} onConfirm={confirmBindEmail} loading={emailBusy} confirmText='确认绑定'>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <FieldGroup label='邮箱地址'>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Input value={bindEmail} onChange={setBindEmail} placeholder='your@email.com' width='full' />
                <Button variant='toggle' onClick={sendEmailCode} loading={emailBusy} disabled={countdown > 0} style={{ flexShrink: 0, whiteSpace: 'nowrap' }}>
                  {countdown > 0 ? `${countdown}s` : '发送验证码'}
                </Button>
              </div>
            </FieldGroup>
            {codeSent && (
              <FieldGroup label='验证码'>
                <Input value={bindCode} onChange={setBindCode} placeholder='输入邮箱收到的验证码' width='full' />
              </FieldGroup>
            )}
          </div>
        </Modal>
      )}

      {secureVerifyOpen && (
        <Modal open title='安全验证' onClose={() => { setSecureVerifyOpen(false); setSecureVerifyCode(''); setPendingAction(null); }} onConfirm={() => doSecureVerify(pendingAction)} loading={secureVerifyBusy} confirmText='验证'>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ fontSize: 14, color: 'var(--ui-text-2)', margin: 0 }}>请输入两步验证码以继续操作</p>
            <FieldGroup label='验证码'>
              <Input value={secureVerifyCode} onChange={setSecureVerifyCode} placeholder='6 位验证码' width='full'
                onKeyDown={(e) => e.key === 'Enter' && doSecureVerify(pendingAction)} />
            </FieldGroup>
          </div>
        </Modal>
      )}
    </div>
  );
};

const SettingGroup = ({ title, children }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ui-text-3)', letterSpacing: '0.03em', paddingLeft: 2 }}>{title}</span>
    <div style={{ border: '1px solid #e9e9e9', borderRadius: 16, overflow: 'hidden' }}>
      {children}
    </div>
  </div>
);

const SettingRow = ({ title, description, children, last }) => (
  <div style={{
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: '14px 16px',
    borderBottom: last ? 'none' : '1px solid #eee',
  }}>
    <div style={{ minWidth: 0, flex: 1 }}>
      <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ui-text)' }}>{title}</div>
      {description && <div style={{ fontSize: 12, color: 'var(--ui-text-3)', marginTop: 3, lineHeight: 1.5 }}>{description}</div>}
    </div>
    <div style={{ flexShrink: 0 }}>{children}</div>
  </div>
);

const FieldGroup = ({ label, hint, span, children }) => (
  <div style={span ? { gridColumn: '1 / -1' } : undefined}>
    <label style={{ display: 'block', fontSize: 12, color: 'var(--ui-text-3)', marginBottom: 5 }}>
      {label}
      {hint && <span style={{ marginLeft: 6, color: 'var(--ui-text-3)' }}>({hint})</span>}
    </label>
    {children}
  </div>
);

export default Personal;
