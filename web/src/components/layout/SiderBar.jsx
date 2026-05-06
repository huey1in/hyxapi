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

import React, { useEffect, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSidebarCollapsed } from '../../hooks/common/useSidebarCollapsed';
import { useSidebar } from '../../hooks/common/useSidebar';
import { useMinimumLoadingTime } from '../../hooks/common/useMinimumLoadingTime';
import { isAdmin, isRoot } from '../../helpers';
import SkeletonWrapper from './components/SkeletonWrapper';

const routerMap = {
  home: '/',
  channel: '/console/channel',
  token: '/console/token',
  redemption: '/console/redemption',
  topup: '/console/topup',
  user: '/console/user',
  subscription: '/console/subscription',
  log: '/console/log',
  setting: '/console/setting',
  playground: '/console/playground',
  personal: '/console/personal',
  detail: '/console',
};

const SiderBar = ({ onNavigate = () => {} }) => {
  const { t } = useTranslation();
  const [collapsed, toggleCollapsed] = useSidebarCollapsed();
  const { isModuleVisible, hasSectionVisibleModules, loading } = useSidebar();
  const showSkeleton = useMinimumLoadingTime(loading, 200);
  const location = useLocation();

  useEffect(() => {
    if (collapsed) document.body.classList.add('sidebar-collapsed');
    else document.body.classList.remove('sidebar-collapsed');
  }, [collapsed]);

  const activeKey = useMemo(
    () => Object.keys(routerMap).find((key) => routerMap[key] === location.pathname) ?? null,
    [location.pathname],
  );

  const workspaceItems = useMemo(() => [
    { itemKey: 'detail', text: t('数据看板') },
    { itemKey: 'playground', text: t('操练场') },
    { itemKey: 'token', text: t('令牌管理') },
    { itemKey: 'log', text: t('使用日志') },
  ].filter((item) => isModuleVisible('console', item.itemKey)), [t, isModuleVisible]);

  const financeItems = useMemo(() => [
    { itemKey: 'topup', text: t('钱包管理') },
    { itemKey: 'personal', text: t('个人设置') },
  ].filter((item) => isModuleVisible('personal', item.itemKey)), [t, isModuleVisible]);

  const adminItems = useMemo(() => [
    { itemKey: 'channel', text: t('渠道管理'), hidden: !isAdmin() },
    { itemKey: 'subscription', text: t('订阅管理'), hidden: !isAdmin() },
    { itemKey: 'redemption', text: t('兑换码管理'), hidden: !isAdmin() },
    { itemKey: 'user', text: t('用户管理'), hidden: !isAdmin() },
    { itemKey: 'setting', text: t('系统设置'), hidden: !isRoot() },
  ].filter((item) => !item.hidden && isModuleVisible('admin', item.itemKey)), [t, isModuleVisible]);

  const NavItem = ({ itemKey, text }) => {
    const to = routerMap[itemKey];
    if (!to) return null;
    const active = activeKey === itemKey;
    return (
      <Link
        to={to}
        onClick={onNavigate}
        className={`flex items-center mx-2 px-3 py-2 mb-1 rounded-lg text-sm font-medium text-ui-text transition-all duration-150 hover:bg-ui-bg-subtle active:scale-[0.98] ${
          active ? 'bg-ui-bg-subtle' : ''
        }`}
        style={{ fontFamily: "'Plus Jakarta Sans', 'Space Grotesk', sans-serif", letterSpacing: '-0.01em' }}
      >
        {text}
      </Link>
    );
  };

  const SectionLabel = ({ label }) =>
    collapsed ? null : (
      <p className='px-5 pb-1.5 pt-3 text-[11px] font-semibold uppercase tracking-widest text-ui-text-3'>
        {label}
      </p>
    );

  return (
    <div
      className='h-full flex flex-col border-r border-ui-border relative'
      style={{
        width: 'var(--sidebar-current-width)',
        transition: 'width 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
        backgroundColor: 'var(--page-bg)',
        overflow: 'visible',
      }}
    >
      {/* 内容区独立裁剪，不受 overflow:visible 影响 */}
      <div
        className='h-full flex flex-col overflow-hidden w-full'
        style={{
          opacity: collapsed ? 0 : 1,
          transition: collapsed
            ? 'opacity 0.12s ease'
            : 'opacity 0.2s ease 0.15s',
        }}
      >
        <SkeletonWrapper
          loading={showSkeleton}
          type='sidebar'
          collapsed={collapsed}
          showAdmin={isAdmin()}
        >
          <nav className='flex-1 overflow-y-auto py-3 scrollbar-hide'>
            {hasSectionVisibleModules('console') && (
              <div>
                <SectionLabel label={t('控制台')} />
                {workspaceItems.map((item) => <NavItem key={item.itemKey} {...item} />)}
              </div>
            )}

            {hasSectionVisibleModules('console') && hasSectionVisibleModules('personal') && (
              <div className='my-2 mx-4 border-t border-ui-border opacity-40' />
            )}

            {hasSectionVisibleModules('personal') && (
              <div>
                <SectionLabel label={t('个人中心')} />
                {financeItems.map((item) => <NavItem key={item.itemKey} {...item} />)}
              </div>
            )}

            {isAdmin() && hasSectionVisibleModules('admin') && (
              <>
                <div className='my-2 mx-4 border-t border-ui-border opacity-40' />
                <div>
                  <SectionLabel label={t('管理员')} />
                  {adminItems.map((item) => <NavItem key={item.itemKey} {...item} />)}
                </div>
              </>
            )}
          </nav>
        </SkeletonWrapper>
      </div>

      {/* 桌面端右侧凸出 tab */}
      <button
        onClick={toggleCollapsed}
        aria-label={collapsed ? '展开侧边栏' : '收起侧边栏'}
        className='hidden md:flex absolute top-1/2 -translate-y-1/2 items-center justify-center cursor-pointer transition-all duration-200'
        style={{
          right: '-14px',
          width: '14px',
          height: '44px',
          backgroundColor: 'var(--page-bg)',
          border: '1px solid var(--ui-border)',
          borderLeft: 'none',
          borderRadius: '0 8px 8px 0',
          zIndex: 10,
        }}
      >
        <svg
          width='8'
          height='8'
          viewBox='0 0 8 12'
          fill='none'
          stroke='currentColor'
          strokeWidth='1.75'
          strokeLinecap='round'
          strokeLinejoin='round'
          className='text-ui-text-3'
          style={{ transform: collapsed ? 'rotate(0deg)' : 'rotate(180deg)', transition: 'transform 0.2s ease' }}
        >
          <path d='M2 1l4 5-4 5' />
        </svg>
      </button>
    </div>
  );
};

export default SiderBar;
