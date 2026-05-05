/*
Copyright (C) 2025 QuantumNous

System settings — token-system page shell + 6-tab navigation.
Tabs render as horizontal pills (consistent with channels/pricing/etc).
Sub-tabs within each section use their own internal nav.
*/

import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usePageTitle } from '../../hooks/common/usePageTitle';

import SystemSetting from '../../components/settings/SystemSetting';
import { isRoot } from '../../helpers';
import OperationSetting from '../../components/settings/OperationSetting';
import LimitsSetting from '../../components/settings/LimitsSetting';
import DashboardSetting from '../../components/settings/DashboardSetting';
import RatioSetting from '../../components/settings/RatioSetting';
import PerformanceSetting from '../../components/settings/PerformanceSetting';

const TABS = [
  { key: 'platform', label: '平台设置' },
  { key: 'models', label: '模型与定价' },
  { key: 'limits', label: '限制与监控' },
  { key: 'dashboard', label: '仪表盘内容' },
  { key: 'auth', label: '用户认证' },
  { key: 'performance', label: '性能' },
];

const LEGACY_KEY_MAP = {
  operation: 'platform',
  ratio: 'models',
  ratelimit: 'limits',
  system: 'auth',
  other: 'platform',
};

const Setting = () => {
  const { t } = useTranslation();
  usePageTitle(t('系统设置'));
  const navigate = useNavigate();
  const location = useLocation();
  const [active, setActive] = useState('platform');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    setActive(LEGACY_KEY_MAP[tab] || tab || 'platform');
  }, [location.search]);

  const onChange = (key) => {
    setActive(key);
    navigate(`?tab=${key}`);
  };

  if (!isRoot()) {
    return (
      <div className='min-h-[calc(100vh-4rem)] mt-16 px-4 py-5 md:px-6 md:py-6 bg-ui-bg'>
        <div className='max-w-[1400px] mx-auto py-16 text-center text-ui-text-3 text-sm'>
          {t('需要超级管理员权限')}
        </div>
      </div>
    );
  }

  const Active = TABS.find((t) => t.key === active) || TABS[0];

  return (
    <div className='min-h-[calc(100vh-4rem)] mt-16 px-4 py-5 md:px-6 md:py-6 bg-ui-bg'>
      <div className='max-w-[1400px] mx-auto'>
        {/* Header */}
        <div className='flex items-center justify-between gap-3 mb-5'>
          <h1
            className='text-2xl md:text-3xl font-medium text-ui-text'
            style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '-0.02em' }}
          >
            {t('系统设置')}
          </h1>
        </div>

        {/* Tabs */}
        <div className='bg-ui-bg-elevated border border-ui-border rounded-xl p-1 mb-3 overflow-x-auto'>
          <div className='flex items-center gap-1 min-w-max'>
            {TABS.map((tb) => {
              const isActive = active === tb.key;
              return (
                <button
                  key={tb.key}
                  onClick={() => onChange(tb.key)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md whitespace-nowrap transition-colors flex-shrink-0 ${
                    isActive
                      ? 'bg-ui-bg-subtle text-ui-text font-semibold border border-ui-text-3'
                      : 'border border-transparent text-ui-text-2 hover:text-ui-text hover:bg-ui-bg-subtle'
                  }`}
                >
                  {t(tb.label)}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div>
          {active === 'platform' && <OperationSetting />}
          {active === 'models' && <RatioSetting />}
          {active === 'limits' && <LimitsSetting />}
          {active === 'dashboard' && <DashboardSetting />}
          {active === 'auth' && <SystemSetting />}
          {active === 'performance' && <PerformanceSetting />}
        </div>
      </div>
    </div>
  );
};

export default Setting;
