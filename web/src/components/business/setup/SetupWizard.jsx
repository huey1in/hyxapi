/*
 * Setup 向导（与 web-backup 同构）
 *
 * 顶部极简进度指示器 + 大标题 + 4 步内容 + 底部上一步/下一步/初始化 按钮。
 */

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { API, showError, showSuccess } from '../../../helpers';
import { Button, Card, Input, Radio, RadioGroup } from '../../ui';
import { cn } from '../../ui/tokens';

const SetupWizard = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [setupStatus, setSetupStatus] = useState({ status: false, root_init: false, database_type: '' });
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    usageMode: 'external',
  });

  const steps = [
    { title: t('数据库检查'),  description: t('验证数据库连接状态') },
    { title: t('管理员账号'),  description: t('设置管理员登录信息') },
    { title: t('使用模式'),    description: t('选择系统运行模式') },
    { title: t('完成初始化'),  description: t('确认设置并完成初始化') },
  ];

  useEffect(() => { fetchSetupStatus(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const fetchSetupStatus = async () => {
    try {
      const res = await API.get('/api/setup');
      const { success, data } = res.data || {};
      if (success && data) {
        setSetupStatus(data);
        if (data.status) { window.location.href = '/'; return; }
        setCurrentStep(0);
      } else showError(t('获取初始化状态失败'));
    } catch {
      showError(t('获取初始化状态失败'));
    }
  };

  const handleUsageModeChange = (v) => setFormData((s) => ({ ...s, usageMode: v }));

  const canProceedToNext = () => {
    switch (currentStep) {
      case 0: return true;
      case 1:
        if (setupStatus.root_init) return true;
        if (!formData.username || !formData.password || !formData.confirmPassword) {
          showError(t('请填写完整的管理员账号信息'));
          return false;
        }
        if (formData.password !== formData.confirmPassword) { showError(t('两次输入的密码不一致')); return false; }
        if (formData.password.length < 8) { showError(t('密码长度至少为8个字符')); return false; }
        return true;
      case 2:
        if (!formData.usageMode) { showError(t('请选择使用模式')); return false; }
        return true;
      default: return true;
    }
  };

  const next = () => { if (canProceedToNext()) setCurrentStep((s) => s + 1); };
  const prev = () => setCurrentStep((s) => s - 1);

  const onSubmit = () => {
    if (!setupStatus.root_init) {
      if (!formData.username?.trim()) { showError(t('请输入管理员用户名')); return; }
      if (!formData.password || formData.password.length < 8) { showError(t('密码长度至少为8个字符')); return; }
      if (formData.password !== formData.confirmPassword) { showError(t('两次输入的密码不一致')); return; }
    }
    setLoading(true);
    API.post('/api/setup', {
      username: formData.username,
      password: formData.password,
      confirmPassword: formData.confirmPassword,
      SelfUseModeEnabled: formData.usageMode === 'self',
      DemoSiteEnabled:    formData.usageMode === 'demo',
    }).then((res) => {
      const { success, message } = res.data;
      if (success) {
        showSuccess(t('系统初始化成功，正在跳转...'));
        setTimeout(() => window.location.reload(), 1500);
      } else {
        showError(message || t('初始化失败，请重试'));
      }
    }).catch(() => showError(t('系统初始化失败，请重试')))
      .finally(() => setLoading(false));
  };

  const stepNavigationProps = { currentStep, steps, prev, next, onSubmit, loading, t };

  const renderStep = (idx) => {
    switch (idx) {
      case 0: return <DatabaseStep setupStatus={setupStatus} t={t} renderNavigationButtons={() => <StepNavigation {...stepNavigationProps} />} />;
      case 1: return <AdminStep setupStatus={setupStatus} formData={formData} setFormData={setFormData} t={t} renderNavigationButtons={() => <StepNavigation {...stepNavigationProps} />} />;
      case 2: return <UsageModeStep formData={formData} handleUsageModeChange={handleUsageModeChange} t={t} renderNavigationButtons={() => <StepNavigation {...stepNavigationProps} />} />;
      case 3: return <CompleteStep setupStatus={setupStatus} formData={formData} t={t} renderNavigationButtons={() => <StepNavigation {...stepNavigationProps} />} />;
      default: return null;
    }
  };

  return (
    <div className='min-h-screen flex items-center justify-center p-6' style={{ backgroundColor: 'var(--page-bg)' }}>
      <div className='w-full max-w-xl'>
        {/* 极简进度指示器 */}
        <div className='flex items-center space-x-2 mb-12 text-sm'>
          {steps.map((item, index) => (
            <React.Fragment key={item.title}>
              <span className={index === currentStep ? 'font-semibold text-ui-text' : 'text-ui-text-3'}>
                {index + 1}. {item.title}
              </span>
              {index < steps.length - 1 && <span className='text-ui-text-3'>/</span>}
            </React.Fragment>
          ))}
        </div>

        {/* 头部标题 */}
        <div className='mb-10'>
          <h1 className='text-4xl font-semibold tracking-tight mb-3 text-ui-text'>{t('系统初始化')}</h1>
          <p className='text-ui-text-2 text-base'>{t('欢迎使用，请完成以下设置以开始使用系统')}</p>
        </div>

        <div className='space-y-6'>
          <div className='steps-content'>
            {[0, 1, 2, 3].map((idx) => (
              <div key={idx} style={{ display: currentStep === idx ? 'block' : 'none' }}>
                {renderStep(idx)}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ---------- Step Navigation ---------- */
const StepNavigation = ({ currentStep, steps, prev, next, onSubmit, loading, t }) => (
  <div className='flex justify-end items-center pt-12 gap-4'>
    {currentStep > 0 && (
      <Button onClick={prev}>{t('上一步')}</Button>
    )}
    {currentStep < steps.length - 1 && (
      <Button onClick={next}>{t('下一步')}</Button>
    )}
    {currentStep === steps.length - 1 && (
      <Button onClick={onSubmit} disabled={loading} loading={loading}>
        {loading ? t('初始化中...') : t('初始化系统')}
      </Button>
    )}
  </div>
);

/* ---------- Step 1: Database ---------- */
const DatabaseStep = ({ setupStatus, renderNavigationButtons, t }) => {
  const isElectron = typeof window !== 'undefined' && window.electron?.isElectron;
  return (
    <>
      {setupStatus.database_type === 'sqlite' && (
        <Card variant='filled'>
          <h3 className='font-semibold text-lg text-ui-text mb-4'>{isElectron ? t('本地数据存储') : t('数据库警告')}</h3>
          {isElectron ? (
            <div className='text-ui-text-2 text-sm leading-relaxed space-y-4'>
              <p>{t('您的数据将安全地存储在本地计算机上。所有配置、用户信息和使用记录都会自动保存，关闭应用后不会丢失。')}</p>
              {window.electron?.dataDir && (
                <div>
                  <p className='font-medium text-ui-text mb-2'>{t('数据存储位置：')}</p>
                  <div className='p-4 bg-ui-bg-subtle rounded-xl font-mono text-xs text-ui-text overflow-x-auto'>
                    {window.electron.dataDir}
                  </div>
                </div>
              )}
              <p>{t('提示：如需备份数据，只需复制上述目录即可')}</p>
            </div>
          ) : (
            <div className='text-ui-text-2 text-sm leading-relaxed space-y-4'>
              <p>{t('您正在使用 SQLite 数据库。如果您在容器环境中运行，请确保已正确设置数据库文件的持久化映射，否则容器重启后所有数据将丢失！')}</p>
              <p>{t('建议在生产环境中使用 MySQL 或 PostgreSQL 数据库，或确保 SQLite 数据库文件已映射到宿主机的持久化存储。')}</p>
            </div>
          )}
        </Card>
      )}
      {setupStatus.database_type === 'mysql' && (
        <Card variant='filled'>
          <h3 className='font-semibold text-lg text-ui-text mb-4'>{t('数据库信息')}</h3>
          <p className='text-ui-text-2 text-sm leading-relaxed'>{t('您正在使用 MySQL 数据库。MySQL 是一个可靠的关系型数据库管理系统，适合生产环境使用。')}</p>
        </Card>
      )}
      {setupStatus.database_type === 'postgres' && (
        <Card variant='filled'>
          <h3 className='font-semibold text-lg text-ui-text mb-4'>{t('数据库信息')}</h3>
          <p className='text-ui-text-2 text-sm leading-relaxed'>{t('您正在使用 PostgreSQL 数据库。PostgreSQL 是一个功能强大的开源关系型数据库系统，提供了出色的可靠性和数据完整性，适合生产环境使用。')}</p>
        </Card>
      )}
      {renderNavigationButtons && renderNavigationButtons()}
    </>
  );
};

/* ---------- Step 2: Admin ---------- */
const AdminStep = ({ setupStatus, formData, setFormData, renderNavigationButtons, t }) => {
  const [errors, setErrors] = useState({});
  const validate = (field, value) => {
    const ne = { ...errors };
    if (field === 'username') ne.username = value.trim() ? '' : t('请输入管理员用户名');
    if (field === 'password') ne.password = !value ? t('请输入管理员密码') : value.length < 8 ? t('密码长度至少为8个字符') : '';
    if (field === 'confirmPassword') ne.confirmPassword = !value ? t('请确认管理员密码') : value !== formData.password ? t('两次输入的密码不一致') : '';
    setErrors(ne);
  };
  if (setupStatus.root_init) {
    return (
      <>
        <Card variant='filled'>
          <p className='text-ui-text-2 text-sm leading-relaxed'>{t('管理员账号已经初始化过，请继续设置其他参数')}</p>
        </Card>
        {renderNavigationButtons && renderNavigationButtons()}
      </>
    );
  }
  return (
    <>
      <div className='space-y-6'>
        <div>
          <label className='block mb-2 text-sm font-medium text-ui-text'>{t('用户名')}</label>
          <Input
            value={formData.username}
            onChange={(v) => setFormData({ ...formData, username: v })}
            onBlur={(e) => validate('username', e.target.value)}
            placeholder={t('请输入管理员用户名')}
            invalid={!!errors.username}
            size={44}
            width='full'
          />
          {errors.username && <p className='mt-1 text-xs text-ui-danger'>{errors.username}</p>}
        </div>
        <div>
          <label className='block mb-2 text-sm font-medium text-ui-text'>{t('密码')}</label>
          <Input
            type='password'
            value={formData.password}
            onChange={(v) => setFormData({ ...formData, password: v })}
            onBlur={(e) => validate('password', e.target.value)}
            placeholder={t('请输入管理员密码')}
            invalid={!!errors.password}
            size={44}
            width='full'
          />
          {errors.password && <p className='mt-1 text-xs text-ui-danger'>{errors.password}</p>}
        </div>
        <div>
          <label className='block mb-2 text-sm font-medium text-ui-text'>{t('确认密码')}</label>
          <Input
            type='password'
            value={formData.confirmPassword}
            onChange={(v) => setFormData({ ...formData, confirmPassword: v })}
            onBlur={(e) => validate('confirmPassword', e.target.value)}
            placeholder={t('请确认管理员密码')}
            invalid={!!errors.confirmPassword}
            size={44}
            width='full'
          />
          {errors.confirmPassword && <p className='mt-1 text-xs text-ui-danger'>{errors.confirmPassword}</p>}
        </div>
      </div>
      {renderNavigationButtons && renderNavigationButtons()}
    </>
  );
};

/* ---------- Step 3: Usage Mode ---------- */
const UsageModeStep = ({ formData, handleUsageModeChange, renderNavigationButtons, t }) => {
  const options = [
    { value: 'external', label: t('对外运营模式'), description: t('适用于为多个用户提供服务的场景') },
    { value: 'self',     label: t('自用模式'),     description: t('适用于个人使用的场景，不需要设置模型价格') },
    { value: 'demo',     label: t('演示站点模式'), description: t('适用于展示系统功能的场景，提供基础功能演示') },
  ];
  return (
    <>
      <div className='space-y-3'>
        {options.map((opt) => {
          const selected = formData.usageMode === opt.value;
          return (
            <div
              key={opt.value}
              onClick={() => handleUsageModeChange(opt.value)}
              className={cn(
                'border rounded-2xl p-5 cursor-pointer transition-colors',
                selected ? 'border-ui-accent ring-1 ring-ui-accent bg-ui-bg-subtle/60' : 'border-ui-border hover:bg-ui-bg-subtle/40',
              )}
            >
              <div className='flex items-center gap-3'>
                <Radio checked={selected} onChange={() => handleUsageModeChange(opt.value)} />
                <div>
                  <span className='text-base font-semibold text-ui-text'>{opt.label}</span>
                  <p className='text-sm text-ui-text-2 mt-0.5'>{opt.description}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {renderNavigationButtons && renderNavigationButtons()}
    </>
  );
};

/* ---------- Step 4: Complete ---------- */
const CompleteStep = ({ setupStatus, formData, renderNavigationButtons, t }) => {
  const dbName = setupStatus.database_type === 'sqlite' ? 'SQLite'
    : setupStatus.database_type === 'mysql' ? 'MySQL' : 'PostgreSQL';
  const modeLabel = formData.usageMode === 'external' ? t('对外运营模式')
    : formData.usageMode === 'self' ? t('自用模式') : t('演示站点模式');
  return (
    <div className='py-4'>
      <h2 className='text-2xl font-semibold text-ui-text mb-3'>{t('准备完成初始化')}</h2>
      <p className='text-ui-text-2 text-base mb-8'>{t('请确认以下设置信息，点击"初始化系统"开始配置')}</p>
      <Card variant='filled'>
        <div className='space-y-4'>
          <div className='flex justify-between items-center pb-4 border-b border-ui-divider'>
            <span className='text-sm text-ui-text-2'>{t('数据库类型')}</span>
            <span className='text-base font-medium text-ui-text'>{dbName}</span>
          </div>
          <div className='flex justify-between items-center pb-4 border-b border-ui-divider'>
            <span className='text-sm text-ui-text-2'>{t('管理员账号')}</span>
            <span className='text-base font-medium text-ui-text'>{setupStatus.root_init ? t('已初始化') : formData.username || t('未设置')}</span>
          </div>
          <div className='flex justify-between items-center'>
            <span className='text-sm text-ui-text-2'>{t('使用模式')}</span>
            <span className='text-base font-medium text-ui-text'>{modeLabel}</span>
          </div>
        </div>
      </Card>
      <div>{renderNavigationButtons && renderNavigationButtons()}</div>
    </div>
  );
};

export default SetupWizard;
