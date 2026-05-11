/*
 * SiderBar — 左侧导航栏
 *
 * 通过 NavLink 控制 selected 态；折叠功能后续再加。
 */

import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, MessageSquare, Key, BarChart3, CreditCard,
  Tag as TagIcon, Settings, Users, Server, Gift, Boxes,
} from 'lucide-react';
import { cn } from '../components/ui/tokens';

const NAV = [
  { label: '控制台',  to: '/console',               icon: LayoutDashboard },
  { label: 'Playground', to: '/console/playground', icon: MessageSquare },
  { label: '令牌',     to: '/console/token',         icon: Key },
  { label: '日志',     to: '/console/log',           icon: BarChart3 },
  { label: '充值',     to: '/console/topup',         icon: CreditCard },
  { label: '个人',     to: '/console/personal',      icon: Settings },
  { label: '模型广场', to: '/pricing',               icon: Boxes },
  { label: '订阅',     to: '/console/subscription',  icon: TagIcon,  admin: true },
  { label: '渠道',     to: '/console/channel',       icon: Server,   admin: true },
  { label: '兑换码',   to: '/console/redemption',    icon: Gift,     admin: true },
  { label: '用户',     to: '/console/user',          icon: Users,    admin: true },
  { label: '设置',     to: '/console/setting',       icon: Settings, admin: true },
];

const Logo = () => (
  <div className='flex items-center gap-2 px-3 h-12'>
    <div className='w-7 h-7 rounded-lg bg-ui-accent text-ui-accent-fg flex items-center justify-center text-sm font-semibold'>R</div>
    <span className='text-sm font-semibold text-ui-text'>Routify</span>
  </div>
);

const SiderBar = ({ items = NAV }) => {
  const loc = useLocation();
  return (
    <aside className='w-56 flex-shrink-0 flex flex-col border-r border-ui-border' style={{ backgroundColor: 'var(--page-bg)' }}>
      <Logo />
      <nav className='flex-1 px-2 py-2 flex flex-col gap-0.5 overflow-y-auto'>
        {items.map((it) => {
          const active = loc.pathname === it.to || (it.to !== '/' && loc.pathname.startsWith(it.to + '/'));
          const Icon = it.icon;
          return (
            <NavLink
              key={it.to}
              to={it.to}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
                active ? 'bg-ui-bg-subtle text-ui-text' : 'text-ui-text-2 hover:text-ui-text hover:bg-ui-bg-subtle/60',
              )}
            >
              <Icon size={16} className='flex-shrink-0' />
              <span className='truncate'>{it.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
};

export default SiderBar;
