import React, { useContext, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  BarChart3, Key, FileText, Wallet, User,
  Radio, CreditCard, Ticket, Users, Settings,
  ChevronLeft, X, Layers, Store,
} from 'lucide-react';
import { isAdmin, isRoot } from '../../helpers';
import { UserContext } from '../../context/User';
import { useMobileSidebar } from '../../context/MobileSidebar';
import useIsMobile from '../../hooks/useIsMobile';
import { cn } from '../ui/tokens';

const LS_KEY = 'sidebar-collapsed';
const EXPANDED = 256;
const COLLAPSED = 57;

const NAV_ITEMS = [
  { to: '/console',            label: '概览',     icon: BarChart3, end: true },
  { to: '/console/pricing',    label: '模型广场', icon: Store },
  { to: '/console/token',      label: 'API',      icon: Key },
  { to: '/console/topup',      label: '充值',     icon: Wallet },
  { to: '/console/my-subscription', label: '订阅',   icon: CreditCard },
  { to: '/console/log',        label: '日志',     icon: FileText },
  { to: '/console/personal',   label: '设置',     icon: User },
  { divider: true, admin: true },
  { to: '/console/channel',      label: '渠道管理',   icon: Radio,      admin: true },
  { to: '/console/subscription', label: '订阅管理',   icon: Layers,     admin: true },
  { to: '/console/redemption',   label: '兑换码管理', icon: Ticket,     admin: true },
  { to: '/console/user',         label: '用户管理',   icon: Users,      admin: true },
  { divider: true, root: true },
  { to: '/console/setting',      label: '系统设置',   icon: Settings,   root: true },
];

const SiderBar = () => {
  const { t } = useTranslation();
  const [userState] = useContext(UserContext);
  const admin = isAdmin();
  const root = isRoot();
  const isMobile = useIsMobile();
  const [mobileOpen, setMobileOpen] = useMobileSidebar();
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

  const items = NAV_ITEMS.filter((it) => {
    if (it.admin && !admin) return false;
    if (it.root && !root) return false;
    return true;
  });

  const navContent = (
    <nav className='flex-1 flex flex-col gap-1 py-2 px-[10px] overflow-y-auto overflow-x-hidden'>
      {items.map((item, idx) => {
        if (item.divider) {
          return <div key={`div-${idx}`} className='my-1.5 mx-1 h-px bg-ui-divider' />;
        }
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={() => isMobile && setMobileOpen(false)}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2 h-9 px-[10px] rounded-lg text-sm transition-all duration-100 whitespace-nowrap',
                isActive
                  ? 'bg-ui-bg-subtle font-medium text-ui-text'
                  : 'text-ui-text hover:bg-ui-bg-subtle',
              )
            }
          >
            <Icon size={22} className='flex-shrink-0' />
            <span>{t(item.label)}</span>
          </NavLink>
        );
      })}
    </nav>
  );

  if (isMobile) {
    if (!mobileOpen) return null;
    return (
      <div className='fixed inset-0 z-[150] flex'>
        <div className='absolute inset-0 bg-black/40' onClick={() => setMobileOpen(false)} />
        <aside
          className='relative flex flex-col h-full bg-[var(--page-bg)] shadow-2xl animate-slide-in-left'
          style={{ width: EXPANDED }}
        >
          <div className='flex items-center justify-between h-[52px] px-4'>
            <span className='text-[18px] font-semibold text-ui-text tracking-tight'>Console</span>
            <button onClick={() => setMobileOpen(false)} className='p-1 cursor-pointer'>
              <X size={20} className='text-ui-text-2' />
            </button>
          </div>
          {navContent}
        </aside>
      </div>
    );
  }

  return (
    <aside
      className='relative flex-shrink-0 h-full flex flex-col border-r border-ui-divider'
      style={{
        width: collapsed ? COLLAPSED : EXPANDED,
        transition: 'width 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        backgroundColor: 'var(--page-bg)',
      }}
    >
      <div className={cn('flex items-center h-[52px] px-4', collapsed && 'justify-center')}>
        {!collapsed && <span className='text-[18px] font-semibold text-ui-text tracking-tight'>Console</span>}
        {collapsed && <span className='text-[18px] font-semibold text-ui-text'>C</span>}
      </div>

      <nav className='flex-1 flex flex-col gap-1 py-2 px-[10px] overflow-y-auto overflow-x-hidden'>
        {items.map((item, idx) => {
          if (item.divider) {
            return <div key={`div-${idx}`} className='my-1.5 mx-1 h-px bg-ui-divider' />;
          }
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2 h-9 px-[10px] rounded-lg text-sm transition-all duration-100 whitespace-nowrap',
                  isActive
                    ? 'bg-ui-bg-subtle font-medium text-ui-text'
                    : 'text-ui-text hover:bg-ui-bg-subtle',
                )
              }
            >
              <Icon size={22} className='flex-shrink-0' />
              {!collapsed && <span>{t(item.label)}</span>}
            </NavLink>
          );
        })}
      </nav>

      <button
        onClick={toggle}
        aria-label={collapsed ? '展开侧边栏' : '收起侧边栏'}
        className='hidden md:flex absolute top-1/2 -translate-y-1/2 items-center justify-center cursor-pointer hover:bg-[var(--ui-bg-subtle)] transition-colors'
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
        <ChevronLeft
          size={12}
          className='text-[var(--ui-text-3)]'
          style={{
            transform: collapsed ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
          }}
        />
      </button>
    </aside>
  );
};

export default SiderBar;
