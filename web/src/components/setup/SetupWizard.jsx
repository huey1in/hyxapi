/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import React, { useEffect, useState } from 'react';
import { API, showError, showNotice } from '../../helpers';
import { useTranslation } from 'react-i18next';

import StepNavigation from './components/StepNavigation';
import DatabaseStep from './components/steps/DatabaseStep';
import AdminStep from './components/steps/AdminStep';
import UsageModeStep from './components/steps/UsageModeStep';
import CompleteStep from './components/steps/CompleteStep';

const SetupWizard = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [setupStatus, setSetupStatus] = useState({
    status: false,
    root_init: false,
    database_type: '',
  });
  const [currentStep, setCurrentStep] = useState(0);

  const [formData, setFormData] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    usageMode: 'external',
  });

  // 定义步骤内容
  const steps = [
    {
      title: t('数据库检查'),
      description: t('验证数据库连接状态'),
    },
    {
      title: t('管理员账号'),
      description: t('设置管理员登录信息'),
    },
    {
      title: t('使用模式'),
      description: t('选择系统运行模式'),
    },
    {
      title: t('完成初始化'),
      description: t('确认设置并完成初始化'),
    },
  ];

  useEffect(() => {
    fetchSetupStatus();
  }, []);

  const fetchSetupStatus = async () => {
    try {
      const res = await API.get('/api/setup');
      const { success, data } = res.data;
      if (success) {
        setSetupStatus(data);

        // If setup is already completed, redirect to home
        if (data.status) {
          window.location.href = '/';
          return;
        }

        // 设置当前步骤 - 默认从数据库检查开始
        setCurrentStep(0);
      } else {
        showError(t('获取初始化状态失败'));
      }
    } catch (error) {
      console.error('Failed to fetch setup status:', error);
      showError(t('获取初始化状态失败'));
    }
  };

  const handleUsageModeChange = (e) => {
    const nextMode = e?.target?.value ?? e;
    setFormData((prev) => ({ ...prev, usageMode: nextMode }));
  };

  const next = () => {
    // 验证当前步骤是否可以继续
    if (!canProceedToNext()) {
      return;
    }

    const current = currentStep + 1;
    setCurrentStep(current);
  };

  // 验证是否可以继续到下一步
  const canProceedToNext = () => {
    switch (currentStep) {
      case 0: // 数据库检查步骤
        return true; // 数据库检查总是可以继续
      case 1: // 管理员账号步骤
        if (setupStatus.root_init) {
          return true; // 如果已经初始化，可以继续
        }
        // 检查必填字段
        if (
          !formData.username ||
          !formData.password ||
          !formData.confirmPassword
        ) {
          showError(t('请填写完整的管理员账号信息'));
          return false;
        }
        if (formData.password !== formData.confirmPassword) {
          showError(t('两次输入的密码不一致'));
          return false;
        }
        if (formData.password.length < 8) {
          showError(t('密码长度至少为8个字符'));
          return false;
        }
        return true;
      case 2: // 使用模式步骤
        if (!formData.usageMode) {
          showError(t('请选择使用模式'));
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  const prev = () => {
    const current = currentStep - 1;
    setCurrentStep(current);
  };

  const onSubmit = () => {
    // For root_init=false, validate admin username and password
    if (!setupStatus.root_init) {
      if (!formData.username || !formData.username.trim()) {
        showError(t('请输入管理员用户名'));
        return;
      }
      if (!formData.password || formData.password.length < 8) {
        showError(t('密码长度至少为8个字符'));
        return;
      }
      if (formData.password !== formData.confirmPassword) {
        showError(t('两次输入的密码不一致'));
        return;
      }
    }

    const payload = {
      username: formData.username,
      password: formData.password,
      confirmPassword: formData.confirmPassword,
      SelfUseModeEnabled: formData.usageMode === 'self',
      DemoSiteEnabled: formData.usageMode === 'demo',
    };

    setLoading(true);
    API.post('/api/setup', payload)
      .then((res) => {
        const { success, message } = res.data;
        if (success) {
          showNotice(t('系统初始化成功，正在跳转...'));
          setTimeout(() => { window.location.reload(); }, 1500);
        } else {
          showError(message || t('初始化失败，请重试'));
        }
      })
      .catch((error) => {
        console.error('API error:', error);
        showError(t('系统初始化失败，请重试'));
      })
      .finally(() => {
        setLoading(false);
      });
  };

  // 获取步骤内容
  const getStepContent = (step) => {
    switch (step) {
      case 0:
        return <DatabaseStep setupStatus={setupStatus} t={t} />;
      case 1:
        return (
          <AdminStep
            setupStatus={setupStatus}
            formData={formData}
            setFormData={setFormData}
            t={t}
          />
        );
      case 2:
        return (
          <UsageModeStep
            formData={formData}
            handleUsageModeChange={handleUsageModeChange}
            t={t}
          />
        );
      case 3:
        return (
          <CompleteStep setupStatus={setupStatus} formData={formData} t={t} />
        );
      default:
        return null;
    }
  };

  const stepNavigationProps = {
    currentStep,
    steps,
    prev,
    next,
    onSubmit,
    loading,
    t,
  };

  return (
    <div className='min-h-screen bg-ui-bg-elevated flex items-center justify-center p-6'>
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
          <h1 className='text-4xl font-semibold tracking-tight mb-3 text-ui-text'>
            {t('系统初始化')}
          </h1>
          <p className='text-ui-text-2 text-base'>
            {t('欢迎使用，请完成以下设置以开始使用系统')}
          </p>
        </div>

        {/* 内容区域 */}
        <div className='space-y-6'>
          <div className='steps-content'>
            {[0, 1, 2, 3].map((idx) => (
              <div
                key={idx}
                style={{ display: currentStep === idx ? 'block' : 'none' }}
              >
                {React.cloneElement(getStepContent(idx), {
                  ...stepNavigationProps,
                  renderNavigationButtons: () => (
                    <StepNavigation {...stepNavigationProps} />
                  ),
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SetupWizard;
