import React, { useEffect, useState } from 'react';
import { CheckCircle2, Database, UserCog, Loader2 } from 'lucide-react';
import { API, showError, showSuccess } from '../../helpers';
import { Button, Card, Input, Loading, Notice, Steps } from '../../components/ui';

const STEPS = [
  { title: '数据库', icon: Database },
  { title: '管理员', icon: UserCog },
  { title: '完成', icon: CheckCircle2 },
];

const Setup = () => {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    username: '',
    password: '',
    confirmPassword: '',
  });

  useEffect(() => {
    (async () => {
      try {
        const res = await API.get('/api/setup');
        const { success, data } = res.data || {};
        if (success) {
          if (data.status) { window.location.href = '/'; return; }
          setStatus(data);
        }
      } catch (e) { showError(e); }
    })();
  }, []);

  const update = (k) => (v) => setForm((p) => ({ ...p, [k]: v?.target ? v.target.value : v }));

  const canProceed = () => {
    if (step === 1 && !status?.root_init) {
      if (!form.username.trim()) return (showError('请输入用户名'), false);
      if (form.password.length < 8) return (showError('密码至少 8 位'), false);
      if (form.password !== form.confirmPassword) return (showError('两次密码不一致'), false);
    }
    return true;
  };

  const next = () => { if (canProceed()) setStep((s) => Math.min(STEPS.length - 1, s + 1)); };
  const prev = () => setStep((s) => Math.max(0, s - 1));

  const submit = async () => {
    setLoading(true);
    try {
      const res = await API.post('/api/setup', {
        username: form.username,
        password: form.password,
        confirmPassword: form.confirmPassword,
      });
      const { success, message } = res.data || {};
      if (success) {
        showSuccess('初始化成功，正在跳转…');
        setTimeout(() => window.location.reload(), 1500);
      } else showError(message || '初始化失败');
    } catch (e) { showError(e); } finally { setLoading(false); }
  };

  if (!status) {
    return (
      <div className='min-h-screen flex items-center justify-center' style={{ backgroundColor: 'var(--page-bg)' }}>
        <Loading />
      </div>
    );
  }

  return (
    <div className='min-h-screen flex items-center justify-center p-6' style={{ backgroundColor: 'var(--page-bg)' }}>
      <Card className='w-full max-w-2xl'>
        <h1 className='text-2xl font-semibold text-ui-text-1 mb-1'>系统初始化</h1>
        <p className='text-ui-text-2 text-sm mb-6'>跟随向导完成 Routify 首次部署</p>

        <div className='mb-8'>
          <Steps
            items={STEPS.map((s) => ({ title: s.title }))}
            current={step}
          />
        </div>

        {step === 0 && (
          <div className='space-y-3'>
            <Notice variant='info'>数据库类型：{status.database_type || '未知'} · 连接正常</Notice>
            <p className='text-sm text-ui-text-2'>数据库已就绪，可以继续下一步。</p>
          </div>
        )}

        {step === 1 && (
          status.root_init ? (
            <Notice variant='success'>管理员账号已存在，跳过此步</Notice>
          ) : (
            <div className='space-y-4'>
              <div>
                <label className='block text-sm text-ui-text-2 mb-1.5'>管理员用户名</label>
                <Input value={form.username} onChange={update('username')} placeholder='admin' />
              </div>
              <div>
                <label className='block text-sm text-ui-text-2 mb-1.5'>密码（至少 8 位）</label>
                <Input type='password' value={form.password} onChange={update('password')} />
              </div>
              <div>
                <label className='block text-sm text-ui-text-2 mb-1.5'>确认密码</label>
                <Input type='password' value={form.confirmPassword} onChange={update('confirmPassword')} />
              </div>
            </div>
          )
        )}

        {step === 2 && (
          <div className='space-y-3'>
            <Notice variant='info'>请确认以下信息后完成初始化：</Notice>
            <ul className='text-sm text-ui-text-1 space-y-1.5 pl-4'>
              <li>• 数据库：{status.database_type || '已就绪'}</li>
              <li>• 管理员：{status.root_init ? '使用现有账号' : form.username}</li>
            </ul>
          </div>
        )}

        <div className='flex justify-between mt-8'>
          <Button variant='toggle' onClick={prev} disabled={step === 0}>上一步</Button>
          {step < STEPS.length - 1
            ? <Button onClick={next}>下一步</Button>
            : <Button loading={loading} onClick={submit}>完成初始化</Button>}
        </div>
      </Card>
    </div>
  );
};

export default Setup;
