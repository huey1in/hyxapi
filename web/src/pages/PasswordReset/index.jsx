import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { API, copy, showError, showSuccess } from '../../helpers';
import { Card, Input, Button, Notice } from '../../components/ui';

const PasswordResetConfirm = () => {
  const [searchParams] = useSearchParams();
  const email = searchParams.get('email') || '';
  const token = searchParams.get('token') || '';
  const isValid = email && token;

  const [loading, setLoading] = useState(false);
  const [disableButton, setDisableButton] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    let id = null;
    if (disableButton && countdown > 0) id = setInterval(() => setCountdown((c) => c - 1), 1000);
    else if (countdown === 0) { setDisableButton(false); setCountdown(30); }
    return () => id && clearInterval(id);
  }, [disableButton, countdown]);

  const submit = async () => {
    if (!isValid) return showError('无效的重置链接，请重新发起密码重置请求');
    setDisableButton(true);
    setLoading(true);
    try {
      const res = await API.post('/api/user/reset', { email, token });
      const { success, data, message } = res.data || {};
      if (success) {
        setNewPassword(data);
        await copy(data);
        showSuccess(`密码已重置并已复制到剪贴板：${data}`);
      } else showError(message);
    } catch (e) { showError(e); } finally { setLoading(false); }
  };

  return (
    <div className='min-h-screen flex items-start sm:items-center justify-center px-4 pt-24 pb-12'
      style={{ backgroundColor: 'var(--page-bg)' }}
    >
      <Card className='w-full max-w-sm'>
        <h2 className='text-2xl font-semibold text-ui-text-1 mb-6'>密码重置确认</h2>

        <div className='space-y-4'>
          {!isValid && (
            <Notice variant='warning'>无效的重置链接，请重新发起密码重置请求</Notice>
          )}

          <div>
            <label className='block mb-2 text-sm font-medium text-ui-text-1'>邮箱</label>
            <Input variant='auth' size={44} width='full' type='email' value={email} disabled
              placeholder='等待获取邮箱信息...' />
          </div>

          {newPassword && (
            <div>
              <label className='block mb-2 text-sm font-medium text-ui-text-1'>新密码</label>
              <div className='flex gap-2 items-center'>
                <Input variant='auth' size={44} width='full' value={newPassword} disabled />
                <Button variant='secondary' onClick={async () => {
                  await copy(newPassword);
                  showSuccess(`密码已复制：${newPassword}`);
                }}>复制</Button>
              </div>
            </div>
          )}

          <Button block size='lg' onClick={submit}
            disabled={loading || disableButton || !!newPassword || !isValid}
            loading={loading}
          >
            {newPassword ? '密码重置完成' : disableButton ? `重试 (${countdown})` : '确认重置密码'}
          </Button>
        </div>

        <p className='mt-6 text-center text-sm text-ui-text-2'>
          <Link to='/' className='text-ui-text-1 font-medium underline'>返回首页</Link>
        </p>
      </Card>
    </div>
  );
};

export default PasswordResetConfirm;
