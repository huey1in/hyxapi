import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LayoutDashboard, UserCog, Menu } from 'lucide-react';
import { ThemeToggle, Button, IconButton } from '../ui';
import { UserContext } from '../../context/User';
import { StatusContext } from '../../context/Status';
import { useLoginModal } from '../../context/LoginModal';
import { useMobileSidebar } from '../../context/MobileSidebar';
import useIsMobile from '../../hooks/useIsMobile';
import { API, showError, updateAPI } from '../../helpers';
import NoticeModal from './NoticeModal';
import {
  BellIcon, GlobeIcon, ChevronDownIcon, WalletIcon, LogOutIcon,
} from './headerIcons';

const LANGUAGES = [
  { value: 'zh-CN', label: '简体中文' },
  { value: 'en',    label: 'English' },
];

const HeaderBar = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [userState, userDispatch] = useContext(UserContext);
  const [statusState] = useContext(StatusContext);
  const { openLoginModal } = useLoginModal();
  const [, setMobileOpen] = useMobileSidebar();
  const isMobile = useIsMobile();
  const user = userState?.user;
  const isConsoleRoute = location.pathname.startsWith('/console');
  const hideLogoOnMobile = isConsoleRoute
    || location.pathname.startsWith('/pricing')
    || location.pathname.startsWith('/status');

  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const userMenuRef = useRef(null);
  const langMenuRef = useRef(null);
  const mobileNavRef = useRef(null);

  const status = statusState?.status || {};
  const docsLink = status?.docs_link || '';
  const pricingRequireAuth = !!status?.pricing_require_auth;

  const navLinks = useMemo(() => {
    const links = [
      { key: 'home',    text: t('首页'),     to: '/' },
      { key: 'console', text: t('控制台'),   to: '/console' },
      { key: 'pricing', text: t('模型广场'), to: '/pricing' },
      { key: 'status',  text: t('服务状态'), to: '/status' },
    ];
    if (docsLink) links.push({ key: 'docs', text: t('文档'), externalLink: docsLink });
    return links;
  }, [t, docsLink]);

  const activeKey = useMemo(() => {
    const link = navLinks.find((l) => {
      if (l.externalLink) return false;
      if (l.to === '/') return location.pathname === '/';
      return location.pathname.startsWith(l.to);
    });
    return link?.key ?? null;
  }, [location.pathname, navLinks]);

  // click-outside closers
  useEffect(() => {
    const onDown = (e) => {
      if (!userMenuRef.current?.contains(e.target)) setUserMenuOpen(false);
      if (!langMenuRef.current?.contains(e.target)) setLangMenuOpen(false);
      if (!mobileNavRef.current?.contains(e.target)) setMobileNavOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  // unread badge (compare announcement keys against localStorage)
  const announcements = status?.announcements || [];
  const unreadCount = useMemo(() => {
    try {
      const seen = JSON.parse(localStorage.getItem('seen_notices') || '[]');
      const seenSet = new Set(seen);
      return announcements.filter((it) => {
        const k = `${it?.publishDate || ''}-${(it?.content || '').slice(0, 30)}`;
        return !seenSet.has(k);
      }).length;
    } catch { return 0; }
  }, [announcements, noticeOpen]);

  const markAllRead = () => {
    try {
      const keys = announcements.map((it) => `${it?.publishDate || ''}-${(it?.content || '').slice(0, 30)}`);
      localStorage.setItem('seen_notices', JSON.stringify(keys));
    } catch {}
  };

  const handleNoticeClick = () => {
    setNoticeOpen(true);
    markAllRead();
  };

  const switchLanguage = (lang) => {
    i18n.changeLanguage(lang);
    try { localStorage.setItem('i18nextLng', lang); } catch {}
    setLangMenuOpen(false);
  };

  const logout = async () => {
    try { await API.get('/api/user/logout'); } catch (e) { showError(e); }
    localStorage.removeItem('user');
    updateAPI();
    userDispatch?.({ type: 'logout' });
    setUserMenuOpen(false);
    navigate('/');
  };

  const linkClass = (isActive) =>
    `group flex items-center gap-1 text-[15px] font-medium transition-colors py-2 px-1 whitespace-nowrap cursor-pointer ${
      isActive ? 'text-ui-text-1' : 'text-ui-text-2 hover:text-ui-text-1'
    }`;

  const renderLabel = (text, isActive) => (
    <span className={`underline-offset-[5px] decoration-current group-hover:underline ${isActive ? 'underline' : ''}`}>
      {text}
    </span>
  );

  const currentLang = LANGUAGES.find((l) => i18n.language?.startsWith(l.value.split('-')[0]))?.value || 'zh-CN';

  return (
    <header
      className='flex items-center justify-between gap-2 md:gap-4 px-3 md:px-6 h-[56px] md:h-[64px]'
      style={{ backgroundColor: 'var(--page-bg)' }}
    >
      <div className='flex items-center gap-4 md:gap-8'>
        {isMobile && isConsoleRoute && (
          <button onClick={() => setMobileOpen(true)} className='p-1 cursor-pointer md:hidden'>
            <Menu size={22} className='text-ui-text' />
          </button>
        )}
        {!(isMobile && hideLogoOnMobile) && (
          <Link to='/' className='flex items-center gap-2 text-ui-text-1 font-semibold'>
            <span style={{ letterSpacing: '-0.02em', fontSize: isMobile ? 22 : 30 }}>Routify</span>
          </Link>
        )}

        <nav className='hidden md:inline-flex items-center gap-4'>
          {navLinks.map((link) => {
            const isActive = link.key === activeKey;
            if (link.externalLink) {
              return (
                <a
                  key={link.key}
                  href={link.externalLink}
                  target='_blank'
                  rel='noopener noreferrer'
                  className={linkClass(isActive)}
                >
                  {renderLabel(link.text, isActive)}
                </a>
              );
            }
            const needsLogin = (link.key === 'console' && !user) || (link.key === 'pricing' && pricingRequireAuth && !user);
            if (needsLogin) {
              return (
                <button key={link.key} onClick={() => openLoginModal?.()} className={linkClass(isActive)}>
                  {renderLabel(link.text, isActive)}
                </button>
              );
            }
            return (
              <NavLink key={link.key} to={link.to} end={link.to === '/'}
                className={({ isActive: a }) => linkClass(a)}>
                {({ isActive: a }) => renderLabel(link.text, a)}
              </NavLink>
            );
          })}
        </nav>

        {/* Mobile nav dropdown trigger */}
        <div ref={mobileNavRef} className='relative md:hidden'>
          <button
            onClick={() => setMobileNavOpen((p) => !p)}
            className='flex items-center gap-1 px-2 h-8 rounded-lg text-sm text-ui-text-1 hover:bg-ui-bg-subtle transition-colors'
          >
            <span>{navLinks.find((l) => l.key === activeKey)?.text || t('菜单')}</span>
            <ChevronDownIcon size={14} className='text-ui-text-3' />
          </button>
          {mobileNavOpen && (
            <div className='absolute left-0 top-full mt-1 w-44 rounded-xl border border-ui-border bg-[var(--page-bg)] shadow-lg overflow-hidden z-50'>
              {navLinks.map((link) => {
                const isActive = link.key === activeKey;
                const itemClass = `w-full flex items-center px-3 py-2 text-sm transition-colors ${
                  isActive ? 'bg-ui-bg-subtle text-ui-text-1 font-medium' : 'text-ui-text-2 hover:bg-ui-bg-subtle'
                }`;
                if (link.externalLink) {
                  return (
                    <a
                      key={link.key}
                      href={link.externalLink}
                      target='_blank'
                      rel='noopener noreferrer'
                      onClick={() => setMobileNavOpen(false)}
                      className={itemClass}
                    >
                      {link.text}
                    </a>
                  );
                }
                const needsLogin = (link.key === 'console' && !user) || (link.key === 'pricing' && pricingRequireAuth && !user);
                if (needsLogin) {
                  return (
                    <button
                      key={link.key}
                      onClick={() => { setMobileNavOpen(false); openLoginModal?.(); }}
                      className={itemClass}
                    >
                      {link.text}
                    </button>
                  );
                }
                return (
                  <button
                    key={link.key}
                    onClick={() => { setMobileNavOpen(false); navigate(link.to); }}
                    className={itemClass}
                  >
                    {link.text}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className='flex items-center gap-2 md:gap-3'>
        {/* Notifications */}
        <div className='relative inline-flex'>
          <IconButton size='lg' icon={BellIcon} title={t('系统公告')} onClick={handleNoticeClick} />
          {unreadCount > 0 && (
            <span className='pointer-events-none absolute top-0.5 right-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center text-[10px] font-bold bg-red-500 text-white rounded-full leading-none'>
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>

        <ThemeToggle size='lg' />

        {/* Language */}
        <div ref={langMenuRef} className='relative'>
          <IconButton size='lg' icon={GlobeIcon} title={t('切换语言')} onClick={() => setLangMenuOpen((p) => !p)} />
          {langMenuOpen && (
            <div className='absolute right-0 top-full mt-1 w-44 rounded-xl border border-ui-border bg-[var(--page-bg)] shadow-lg overflow-hidden z-50'>
              {LANGUAGES.map((l) => (
                <button
                  key={l.value}
                  onClick={() => switchLanguage(l.value)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-sm transition-colors ${
                    currentLang === l.value ? 'bg-ui-bg-subtle text-ui-text-1' : 'text-ui-text-2 hover:bg-ui-bg-subtle'
                  }`}
                >
                  <span>{l.label}</span>
                  {currentLang === l.value && <span className='text-ui-accent text-xs'>●</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {user ? (
          <div ref={userMenuRef} className='relative ml-1'>
            <button
              onClick={() => setUserMenuOpen((p) => !p)}
              className='flex items-center gap-1.5 px-2.5 h-9 rounded-lg text-sm text-ui-text-1 hover:bg-ui-bg-subtle transition-colors'
            >
              <span>{user.username}</span>
              <ChevronDownIcon size={14} className='text-ui-text-3' />
            </button>
            {userMenuOpen && (
              <div className='absolute right-0 top-full mt-1 w-48 rounded-xl border border-ui-border bg-[var(--page-bg)] shadow-lg overflow-hidden z-50'>
                <MenuItem icon={LayoutDashboard} label={t('控制台')}   onClick={() => { setUserMenuOpen(false); navigate('/console'); }} />
                <MenuItem icon={WalletIcon}      label={t('钱包')}     onClick={() => { setUserMenuOpen(false); navigate('/console/topup'); }} />
                <MenuItem icon={UserCog}         label={t('个人设置')} onClick={() => { setUserMenuOpen(false); navigate('/console/personal'); }} />
                <div className='h-px bg-ui-divider' />
                <MenuItem icon={LogOutIcon} label={t('退出登录')} onClick={logout} />
              </div>
            )}
          </div>
        ) : (
          <Button onClick={() => openLoginModal?.()}>{t('登录')}</Button>
        )}
      </div>

      <NoticeModal
        open={noticeOpen}
        onClose={() => setNoticeOpen(false)}
        defaultTab={unreadCount > 0 ? 'system' : 'inApp'}
      />
    </header>
  );
};

const MenuItem = ({ icon: Icon, label, onClick }) => (
  <button
    onClick={onClick}
    className='w-full flex items-center gap-2.5 px-3 py-2 text-sm text-ui-text-1 hover:bg-ui-bg-subtle transition-colors'
  >
    <Icon size={15} className='text-ui-text-3' />
    {label}
  </button>
);

export default HeaderBar;
