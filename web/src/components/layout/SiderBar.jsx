import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { isAdmin, isRoot } from '../../helpers';
import { cn } from '../ui/tokens';

const LS_KEY = 'sidebar-collapsed';
const EXPANDED = 200;
const COLLAPSED = 56;

const SECTIONS = [
  {
    label: '工作台',
    items: [
      { to: '/console',            label: '概览', end: true },
      { to: '/console/chat',       label: '对话' },
      { to: '/console/token',      label: 'API Keys' },
      { to: '/console/log',        label: '日志' },
    ],
  },
  {
    label: '账户',
    items: [
      { to: '/console/topup',    label: '钱包' },
      { to: '/console/personal', label: '个人设置' },
    ],
  },
  {
    label: '管理',
    admin: true,
    items: [
      { to: '/console/channel',      label: '渠道管理' },
      { to: '/console/subscription', label: '订阅管理' },
      { to: '/console/redemption',   label: '兑换码管理' },
      { to: '/console/user',         label: '用户管理' },
      { to: '/console/setting',      label: '系统设置', root: true },
    ],
  },
];

const SiderBar = () => {
  const { t } = useTranslation();
  const admin = isAdmin();
  const root = isRoot();
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(LS_KEY) === '1'; } catch { return false; }
  });

  const toggle = () => {
    setCollapsed((c) => {
      const next = !c;
      try { localStorage.setItem(LS_KEY, next ? '1' : '0'); } catch {}
      return next;
    });
  };

  return (
    <aside
      className='flex-shrink-0 h-full relative'
      style={{
        width: collapsed ? COLLAPSED : EXPANDED,
        transition: 'width 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
        backgroundColor: 'var(--page-bg)',
        overflow: 'visible',
      }}
    >
      <div
        className='h-full overflow-hidden'
        style={{
          opacity: collapsed ? 0 : 1,
          pointerEvents: collapsed ? 'none' : 'auto',
          transition: collapsed
            ? 'opacity 0.12s ease'
            : 'opacity 0.2s ease 0.15s',
        }}
      >
        <nav className='flex flex-col gap-1 py-4 px-3 h-full overflow-y-auto ui-scrollbar'>
          {SECTIONS.map((section) => {
            if (section.admin && !admin) return null;
            const items = section.items.filter((it) => !it.root || root);
            if (items.length === 0) return null;
            return (
              <div key={section.label} className='mb-3 last:mb-0'>
                <div className='px-3 mt-2 mb-2 text-[11px] font-semibold uppercase tracking-wider text-ui-text-3'>
                  {t(section.label)}
                </div>
                <div className='flex flex-col gap-1'>
                  {items.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end}
                      className={({ isActive }) =>
                        cn(
                          'group relative flex items-center px-3 py-2 rounded-lg text-sm transition-all duration-200',
                          'hover:bg-ui-accent/10 hover:text-ui-text-1 hover:translate-x-0.5',
                          isActive
                            ? 'text-ui-text-1 font-medium'
                            : 'text-ui-text-2',
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <span
                            aria-hidden
                            className={cn(
                              'absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-r-full bg-ui-accent transition-all',
                              isActive ? 'h-5 opacity-100' : 'h-0 opacity-0',
                            )}
                          />
                          <span>{t(item.label)}</span>
                        </>
                      )}
                    </NavLink>
                  ))}
                </div>
              </div>
            );
          })}
        </nav>
      </div>

      {/* 凸出 tab：14x44 异形，半圆右边 */}
      <button
        onClick={toggle}
        aria-label={collapsed ? '展开侧边栏' : '收起侧边栏'}
        title={collapsed ? '展开侧边栏' : '收起侧边栏'}
        className='hidden md:flex absolute top-1/2 -translate-y-1/2 items-center justify-center cursor-pointer hover:bg-ui-bg-subtle transition-colors'
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
          style={{
            transform: collapsed ? 'rotate(0deg)' : 'rotate(180deg)',
            transition: 'transform 0.2s ease',
          }}
        >
          <path d='M2 1l4 5-4 5' />
        </svg>
      </button>
    </aside>
  );
};

export default SiderBar;
