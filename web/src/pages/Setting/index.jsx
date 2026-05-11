/*
Copyright (C) 2025 QuantumNous

System settings — token-system page shell + 6-tab navigation.
Style matches Token/Log/Subscription pages: page-bg + rounded-[20px] cards.
*/

import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { RefreshCw } from 'lucide-react';
import { usePageTitle } from '../../hooks/common/usePageTitle';

import SystemSetting from '../../components/settings/SystemSetting';
import { isRoot } from '../../helpers';
import OperationSetting from '../../components/settings/OperationSetting';
import LimitsSetting from '../../components/settings/LimitsSetting';
import DashboardSetting from '../../components/settings/DashboardSetting';
import RatioSetting from '../../components/settings/RatioSetting';
import PerformanceSetting from '../../components/settings/PerformanceSetting';
import { Button, IconButton } from '../../components/ui';

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
  const [refreshBusy, setRefreshBusy] = useState(false);
  const activeRefreshRef = useRef(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    setActive(LEGACY_KEY_MAP[tab] || tab || 'platform');
  }, [location.search]);

  const onChange = (key) => {
    setActive(key);
    navigate(`?tab=${key}`);
  };

  const handleRefresh = async () => {
    const fn = activeRefreshRef.current;
    if (typeof fn !== 'function' || refreshBusy) return;
    setRefreshBusy(true);
    try {
      await fn();
    } finally {
      setRefreshBusy(false);
    }
  };

  const registerRefresh = (fn) => {
    activeRefreshRef.current = fn;
  };

  if (!isRoot()) {
    return (
      <div
        className='px-4 pt-8 pb-6 md:px-6 md:pt-10 md:pb-8'
        style={{ backgroundColor: 'var(--page-bg)' }}
      >
        <div className='max-w-[1400px] mx-auto py-16 text-center text-ui-text-3 text-sm'>
          {t('需要超级管理员权限')}
        </div>
      </div>
    );
  }

  return (
    <div
      className='px-4 pt-8 pb-6 md:px-6 md:pt-10 md:pb-8'
      style={{ backgroundColor: 'var(--page-bg)' }}
    >
      <div className='max-w-[1400px] mx-auto'>
        {/* Header */}
        <div className='flex items-center justify-between gap-3 mb-5'>
          <h1
            className='text-2xl md:text-3xl font-medium text-ui-text'
            style={{ letterSpacing: '-0.02em' }}
          >
            {t('系统设置')}
          </h1>
          <div className='flex items-center gap-1'>
            <IconButton
              icon={RefreshCw}
              onClick={handleRefresh}
              disabled={refreshBusy}
              title={t('刷新')}
              className={refreshBusy ? '[&_svg]:animate-spin' : ''}
            />
          </div>
        </div>

        {/* Tabs */}
        <div
          className='border border-ui-border rounded-[20px] p-1 mb-4 overflow-x-auto'
          style={{ backgroundColor: 'var(--page-bg)' }}
        >
          <div className='flex items-center gap-1 min-w-max'>
            {TABS.map((tb) => {
              const isActive = active === tb.key;
              return (
                <Button
                  key={tb.key}
                  variant={isActive ? 'secondary' : 'ghost'}
                  size='sm'
                  onClick={() => onChange(tb.key)}
                  className='flex-shrink-0'
                >
                  {t(tb.label)}
                </Button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div>
          {active === 'platform' && <OperationSetting registerRefresh={registerRefresh} />}
          {active === 'models' && <RatioSetting registerRefresh={registerRefresh} />}
          {active === 'limits' && <LimitsSetting registerRefresh={registerRefresh} />}
          {active === 'dashboard' && <DashboardSetting registerRefresh={registerRefresh} />}
          {active === 'auth' && <SystemSetting registerRefresh={registerRefresh} />}
          {active === 'performance' && <PerformanceSetting registerRefresh={registerRefresh} />}
        </div>
      </div>
    </div>
  );
};

export default Setting;
