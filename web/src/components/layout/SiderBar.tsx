import { useContext, useEffect, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { canOpenConsolePage } from '../../lib/console-routes';
import { Link, NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  BarChart3, Key, FileText, Wallet, User,
  Radio, CreditCard, Ticket, Users, Settings,
  ChevronLeft, Menu, X, Layers, Store, Bell, TrendingUp, Activity, Shield,
} from 'lucide-react';
import { StatusContext } from '../../context/Status';
import { useMobileSidebar } from '../../context/MobileSidebar';
import useIsMobile from '../../hooks/useIsMobile';
import { cn } from '../ui/tokens';
import { filterSidebarItems } from './sidebarItems';
import { useAuthStore } from '../../stores/auth-store';
import { isSidebarModuleVisible, parseSidebarModules } from '../../lib/sidebar-modules';
import { useNotifications } from '../../features/notifications/use-notifications';
import Skeleton from '../ui/feedback/Skeleton';
import SidebarLogoutButton from './SidebarLogoutButton';
import { getSystemName } from '../../helpers';

const LS_KEY = 'sidebar-collapsed';
const EXPANDED = 256;
const COLLAPSED = 57;

type NavItem = { to: string; label: string; icon: LucideIcon; end?: boolean; admin?: boolean; root?: boolean; divider?: false } | { divider: true; admin?: boolean; root?: boolean; to?: never; label?: never; icon?: never; end?: never };
const NAV_ITEMS: NavItem[] = [
  { to: '/console',            label: '概览',     icon: BarChart3, end: true },
  { to: '/pricing',    label: 'Models',   icon: Store },
  { to: '/token',      label: 'API',      icon: Key },
  { to: '/topup',      label: '充值',     icon: Wallet },
  { to: '/subscription', label: '订阅',   icon: CreditCard },
  { to: '/log',        label: '日志',     icon: FileText },
  { to: '/notices',    label: '通知',     icon: Bell },
  { to: '/personal',   label: '设置',     icon: User },
  { divider: true, admin: true },
  { to: '/console/operations',   label: '线索运营',   icon: TrendingUp, admin: true },
  { to: '/console/system-status', label: '系统状态',   icon: Activity,   admin: true },
  { to: '/console/channel',      label: '渠道管理',   icon: Radio,      admin: true },
  { to: '/console/models',       label: '模型管理',   icon: Layers,     admin: true },
  { to: '/console/vendors',      label: '供应商管理', icon: Store,      admin: true },
  { to: '/console/subscription', label: '订阅管理',   icon: Layers,     admin: true },
  { to: '/console/redemption',   label: '兑换码管理', icon: Ticket,     admin: true },
  { to: '/console/user',         label: '用户管理',   icon: Users,      admin: true },
  { to: '/console/audit',        label: '审计日志',   icon: Shield,     admin: true },
  { divider: true, root: true },
  { to: '/console/setting',      label: '系统设置',   icon: Settings,   root: true },
];

const SiderBar = ({ preview = false, previewActive = '/console', loading = false }: { preview?: boolean; previewActive?: string; loading?: boolean }) => {
  const { t } = useTranslation();
  const [statusState] = useContext(StatusContext);
  const currentUser = useAuthStore((state) => state.auth.user);
  const admin = (currentUser?.role ?? 0) >= 10;
  const root = (currentUser?.role ?? 0) >= 100;
  const isMobile = useIsMobile();
  const [mobileOpen, setMobileOpen] = useMobileSidebar();
  const brand = getSystemName() || 'Hyxware';
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(LS_KEY) === '1'; } catch { return false; }
  });

  const drawer = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!isMobile || !mobileOpen || preview) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const element = drawer.current;
    const focusable = () => Array.from(element?.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),[tabindex="0"]') ?? []);
    focusable()[0]?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); setMobileOpen(false); }
      if (event.key !== 'Tab') return;
      const items = focusable(); const first = items[0]; const last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    element?.addEventListener('keydown', keydown);
    return () => { element?.removeEventListener('keydown', keydown); if (previousFocus?.isConnected) previousFocus.focus(); };
  }, [isMobile, mobileOpen, preview, setMobileOpen]);

  const { unread: unreadNotices } = useNotifications(!preview && !loading);

  const toggle = () => {
    setCollapsed((c) => {
      const next = !c;
      try { localStorage.setItem(LS_KEY, next ? '1' : '0'); } catch {}
      return next;
    });
  };

  const adminModules = parseSidebarModules(statusState?.status?.SidebarModulesAdmin);
  const items = filterSidebarItems(NAV_ITEMS, { preview, admin, root, isVisible: (route) => preview || (canOpenConsolePage(route, currentUser) && isSidebarModuleVisible(route, adminModules)) });
  const compact = collapsed && !isMobile;
  const itemClass = cn(
    'flex min-w-0 items-center rounded-lg text-base leading-6 whitespace-nowrap',
    compact ? 'min-h-11 justify-center px-0 py-2.5' : isMobile ? 'min-h-12 gap-3 px-3.5 py-3' : 'min-h-11 gap-3 px-3 py-2.5',
  );

  const navContent = (
    <nav aria-label={t('Console navigation')} aria-busy={loading} className={cn('console-sidebar-nav flex-1 flex flex-col gap-1 py-2 overflow-y-auto overflow-x-hidden', compact ? 'px-1.5' : 'px-[10px]')}>
      {loading ? Array.from({ length: 9 }, (_, index) => <div key={index} className={itemClass}>
        <Skeleton width={isMobile ? 20 : 22} height={isMobile ? 20 : 22} className='shrink-0' />
        {!compact && <Skeleton width={index % 3 === 0 ? 90 : 65} height={16} />}
      </div>) : items.map((item, idx) => {
        if (item.divider) {
          return <div key={`div-${idx}`} className='my-1.5 mx-1 h-px bg-ui-divider' />;
        }
        const Icon = item.icon;
        if (preview) {
          return (
            <div
              key={item.to}
              className={cn(
                itemClass,
                item.to === previewActive ? 'bg-ui-bg-subtle font-medium text-ui-text' : 'text-ui-text',
              )}
            >
              <span className='relative shrink-0'><Icon size={22} /></span>
              {!compact && <span className='min-w-0 truncate'>{t(item.label)}</span>}
            </div>
          );
        }
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            aria-label={t(item.label)}
            title={t(item.label)}
            onClick={() => isMobile && setMobileOpen(false)}
            className={({ isActive }) =>
              cn(
                itemClass,
                'transition-all duration-100',
                isActive
                  ? 'bg-ui-bg-subtle font-medium text-ui-text'
                  : 'text-ui-text hover:bg-ui-bg-subtle',
              )
            }
          >
            <span className='relative shrink-0'>
              <Icon size={isMobile ? 20 : 22} />
              {item.icon === Bell && unreadNotices > 0 && (
                <span className='absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500' />
              )}
            </span>
            {!compact && <span className='min-w-0 truncate'>{t(item.label)}</span>}
          </NavLink>
        );
      })}
    </nav>
  );

  const brandDisplay = compact ? <img src='/logo/hyxware-light.svg' alt='' width={32} height={32} className='h-8 w-8 shrink-0 object-contain' /> : brand;
  const brandClass = cn('home-brand max-w-full', compact ? 'flex items-center justify-center' : 'truncate');
  const brandContent = preview ? <span className={brandClass} title={brand}>{brandDisplay}</span> : <Link to='/' className={brandClass} aria-label={brand} title={brand}>{brandDisplay}</Link>;

  if (isMobile) {
    if (preview) return null;
    return <>
      <button type='button' className='console-menu-button fixed left-0 top-1/2 z-40 -translate-y-1/2 rounded-r-xl border border-l-0 border-ui-border bg-[var(--page-bg)] shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui-text' style={{ width: 28, height: 48 }} onClick={() => setMobileOpen(true)} aria-label={t('Open sidebar')} aria-expanded={mobileOpen} aria-controls='console-mobile-sidebar' aria-hidden={mobileOpen || undefined} tabIndex={mobileOpen ? -1 : undefined}><Menu size={16} /></button>
      {mobileOpen && <div className='fixed inset-0 z-[150] flex'>
        <div className='absolute inset-0 bg-black/40' onClick={() => setMobileOpen(false)} />
        <aside id='console-mobile-sidebar' ref={drawer} role='dialog' aria-modal='true' aria-label={t('Console navigation')}
          className='console-sidebar relative flex flex-col h-full bg-[var(--page-bg)] shadow-2xl animate-slide-in-left'
          style={{ width: EXPANDED }}
        >
          <div className='console-sidebar-brand relative flex items-center h-[60px] pl-6 pr-12 border-b border-ui-divider shrink-0'>
            {brandContent}
            <button type='button' aria-label={t('Close sidebar')} onClick={() => setMobileOpen(false)} className='absolute right-3 p-1.5 cursor-pointer'>
              <X size={22} className='text-ui-text-2' />
            </button>
          </div>
          {navContent}
          <SidebarLogoutButton loading={loading} preview={preview} className={itemClass} iconSize={20} />
        </aside>
      </div>}
    </>;
  }

  return (
    <aside
      className='console-sidebar relative shrink-0 h-full flex flex-col border-r border-ui-divider'
      style={{
        width: collapsed ? COLLAPSED : EXPANDED,
        transition: 'width 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        backgroundColor: 'var(--page-bg)',
      }}
    >
      <div className={cn('console-sidebar-brand flex shrink-0 items-center h-[60px]', collapsed ? 'justify-center px-1' : 'px-6')}>
        {brandContent}
      </div>

      {navContent}
      <SidebarLogoutButton compact={collapsed} loading={loading} preview={preview} className={itemClass} />

      {preview && (
        <div
          aria-hidden='true'
          className='hidden md:flex absolute top-1/2 -translate-y-1/2 items-center justify-center'
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
          <ChevronLeft size={12} className='text-[var(--ui-text-3)]' />
        </div>
      )}

      {!preview && <button
        onClick={toggle}
        aria-label={t(collapsed ? 'Expand sidebar' : 'Collapse sidebar')}
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
      </button>}
    </aside>
  );
};

export default SiderBar;
