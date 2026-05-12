import React, { useContext, useEffect, useState } from 'react';
import { Copy, RefreshCw, LogOut, ShieldCheck, Shield, Fingerprint, Trash2 } from 'lucide-react';
import { API, showError, showSuccess, copy, timestamp2string, updateAPI } from '../../helpers';
import {
  isPasskeySupported, prepareCredentialCreationOptions, buildRegistrationResult,
} from '../../helpers/passkey';
import { UserContext } from '../../context/User';
import {
  PageShell, Card, Button, IconButton, Input, Modal, Tag, Loading,
} from '../../components/ui';

const Personal = () => {
  const [userState, userDispatch] = useContext(UserContext);
  const [form, setForm] = useState({ display_name: '', email: '', password: '' });
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
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

  const u = userState?.user || {};
  useEffect(() => {
    setForm({ display_name: u.display_name || '', email: u.email || '', password: '' });
    setAccessToken(u.access_token || '');
  }, [u.id]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      const { data } = await API.get('/api/user/self');
      if (data.success) userDispatch?.({ type: 'login', payload: data.data });
    } catch (e) { showError(e); } finally { setRefreshing(false); }
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
  useEffect(() => {
    load2FA();
    loadPasskeys();
    isPasskeySupported().then(setPasskeySupported).catch(() => setPasskeySupported(false));
  }, []);

  const addPasskey = async () => {
    setPasskeyBusy(true);
    try {
      const beginRes = await API.post('/api/user/passkey/register/begin');
      if (!beginRes.data?.success) { showError(beginRes.data?.message || '注册失败'); return; }
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
      else showError(data.message);
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
      if (data.success) {
        showSuccess('已启用 2FA');
        setSetupData(null); setSetupCode(''); load2FA();
      } else showError(data.message);
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
      if (data.success) {
        const codes = (data.data?.backup_codes || []).join('\n');
        await copy(codes);
        showSuccess('备份码已重置并复制到剪贴板');
        load2FA();
      } else showError(data.message);
    } catch (e) { showError(e); }
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = { display_name: form.display_name, email: form.email };
      if (form.password) payload.password = form.password;
      const { data } = await API.put('/api/user/self', payload);
      if (data.success) { showSuccess('已保存'); refresh(); setForm((p) => ({ ...p, password: '' })); }
      else showError(data.message);
    } catch (e) { showError(e); } finally { setSaving(false); }
  };

  const genToken = async () => {
    try {
      const { data } = await API.get('/api/user/token');
      if (data.success) { setAccessToken(data.data); showSuccess('已生成访问令牌'); refresh(); }
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

  if (!u.id) return <Loading />;

  return (
    <PageShell title='个人设置' actions={<IconButton icon={RefreshCw} title='刷新' onClick={refresh} />}>
      <Card className='mb-4'>
        <div className='flex items-center justify-between mb-3'>
          <div className='flex items-center gap-2'>
            <h3 className='text-sm font-semibold text-ui-text-1'>Passkey</h3>
            <Tag color={passkeys.length > 0 ? 'green' : 'grey'}>{passkeys.length} 个</Tag>
          </div>
          {passkeySupported && (
            <Button icon={Fingerprint} loading={passkeyBusy} onClick={addPasskey}>添加 Passkey</Button>
          )}
        </div>
        {!passkeySupported && (
          <p className='text-xs text-ui-text-3'>当前浏览器不支持 Passkey / WebAuthn。</p>
        )}
        {passkeySupported && passkeys.length === 0 && (
          <p className='text-xs text-ui-text-3'>使用设备生物识别（指纹/面容）免密登录。</p>
        )}
        {passkeys.length > 0 && (
          <div className='space-y-2'>
            {passkeys.map((p) => (
              <div key={p.id} className='flex items-center justify-between gap-2 p-2 rounded-lg border border-ui-border text-sm'>
                <div className='flex-1 min-w-0'>
                  <div className='text-ui-text-1 truncate'>{p.name || p.id || 'Unnamed key'}</div>
                  {p.created_at && <div className='text-xs text-ui-text-3 mt-0.5'>创建于 {timestamp2string(p.created_at)}</div>}
                </div>
                <IconButton icon={Trash2} variant='danger' onClick={() => removePasskey(p.id)} />
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className='mb-4'>
        <div className='flex items-center justify-between mb-4'>
          <div className='flex items-center gap-2'>
            <h3 className='text-sm font-semibold text-ui-text-1'>两步验证 (2FA)</h3>
            <Tag color={twoFA.enabled ? 'green' : 'grey'}>{twoFA.enabled ? '已启用' : '未启用'}</Tag>
          </div>
          {twoFA.enabled
            ? <Button variant='toggle' onClick={() => setDisableOpen(true)}>禁用 2FA</Button>
            : <Button icon={ShieldCheck} loading={twoFABusy} onClick={start2FASetup}>启用 2FA</Button>}
        </div>
        <p className='text-xs text-ui-text-3'>
          使用 TOTP 应用（Google Authenticator / 1Password / Authy）保护账号登录。
          {twoFA.enabled && (
            <>
              {' · '}备份码剩余 {twoFA.backup_codes_remaining}
              <button onClick={regenBackup} className='ml-2 text-ui-accent underline'>重新生成</button>
            </>
          )}
        </p>
      </Card>

      <Card className='mb-4'>
        <h3 className='text-sm font-semibold text-ui-text-1 mb-4'>账号信息</h3>
        <div className='space-y-4'>
          <div className='grid grid-cols-2 gap-4'>
            <div>
              <label className='block text-xs text-ui-text-2 mb-1.5'>用户名</label>
              <Input value={u.username || ''} disabled />
            </div>
            <div>
              <label className='block text-xs text-ui-text-2 mb-1.5'>显示名</label>
              <Input value={form.display_name} onChange={(e) => setForm((p) => ({ ...p, display_name: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className='block text-xs text-ui-text-2 mb-1.5'>邮箱</label>
            <Input value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
          </div>
          <div>
            <label className='block text-xs text-ui-text-2 mb-1.5'>修改密码（留空不修改）</label>
            <Input type='password' value={form.password}
              onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} />
          </div>
          <div className='flex justify-end'>
            <Button loading={saving} onClick={save}>保存</Button>
          </div>
        </div>
      </Card>

      <Card className='mb-4'>
        <div className='flex items-center justify-between mb-4'>
          <h3 className='text-sm font-semibold text-ui-text-1'>系统访问令牌</h3>
          <Button variant='toggle' onClick={genToken}>{accessToken ? '重新生成' : '生成令牌'}</Button>
        </div>
        <p className='text-xs text-ui-text-3 mb-3'>该令牌用于调用管理 API，请妥善保管</p>
        {accessToken ? (
          <div className='flex items-center gap-2 p-2 bg-ui-bg-subtle border border-ui-border rounded-lg'>
            <code className='flex-1 text-xs font-mono text-ui-text-2 truncate select-all'>{accessToken}</code>
            <IconButton icon={Copy} onClick={async () => { await copy(accessToken); showSuccess('已复制'); }} />
          </div>
        ) : (
          <p className='text-xs text-ui-text-3'>尚未生成</p>
        )}
      </Card>

      <Card>
        <h3 className='text-sm font-semibold text-ui-text-1 mb-3'>账户元数据</h3>
        <div className='grid grid-cols-2 md:grid-cols-3 gap-3 text-sm'>
          <div><span className='text-ui-text-3'>用户 ID：</span><span className='text-ui-text-1'>{u.id}</span></div>
          <div><span className='text-ui-text-3'>角色：</span><span className='text-ui-text-1'>{u.role}</span></div>
          <div><span className='text-ui-text-3'>创建时间：</span><span className='text-ui-text-1'>{timestamp2string(u.created_time)}</span></div>
        </div>
        <div className='flex justify-end mt-4'>
          <Button variant='toggle' icon={LogOut} onClick={logout}>退出登录</Button>
        </div>
      </Card>

      {setupData && (
        <Modal open title='设置 2FA' onClose={() => { setSetupData(null); setSetupCode(''); }} onConfirm={enable2FA} loading={twoFABusy} confirmText='确认启用'>
          <div className='space-y-4'>
            <div>
              <p className='text-sm text-ui-text-2 mb-2'>请用 TOTP 应用扫描下方二维码，或手动输入密钥：</p>
              {setupData.qr_code_url && (
                <img
                  alt='2FA QR'
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(setupData.qr_code_url)}`}
                  className='mx-auto rounded-lg border border-ui-border'
                />
              )}
              <div className='mt-3 flex items-center gap-2 p-2 bg-ui-bg-subtle border border-ui-border rounded-lg'>
                <code className='flex-1 text-xs font-mono text-ui-text-1 break-all'>{setupData.secret}</code>
                <IconButton icon={Copy} onClick={async () => { await copy(setupData.secret); showSuccess('已复制'); }} />
              </div>
            </div>
            <div>
              <label className='block text-sm text-ui-text-2 mb-1.5'>输入应用中显示的 6 位验证码</label>
              <Input value={setupCode} onChange={(e) => setSetupCode(e.target.value)} placeholder='000000' />
            </div>
            {Array.isArray(setupData.backup_codes) && setupData.backup_codes.length > 0 && (
              <div>
                <p className='text-xs text-ui-text-3 mb-2'>请妥善保存以下备份码：</p>
                <pre className='bg-ui-bg-subtle p-3 rounded-lg text-xs font-mono max-h-32 overflow-auto whitespace-pre-wrap'>
                  {setupData.backup_codes.join('\n')}
                </pre>
              </div>
            )}
          </div>
        </Modal>
      )}

      {disableOpen && (
        <Modal open title='禁用 2FA' onClose={() => { setDisableOpen(false); setDisableCode(''); }} onConfirm={disable2FA} loading={twoFABusy} confirmText='确认禁用'>
          <div className='space-y-3'>
            <p className='text-sm text-ui-text-2'>禁用后账号将不再受 2FA 保护，请确认操作。</p>
            <div>
              <label className='block text-sm text-ui-text-2 mb-1.5'>请输入当前 2FA 验证码</label>
              <Input value={disableCode} onChange={(e) => setDisableCode(e.target.value)} placeholder='000000' />
            </div>
          </div>
        </Modal>
      )}
    </PageShell>
  );
};

export default Personal;
