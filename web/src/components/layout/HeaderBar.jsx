import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LayoutDashboard, UserCog, Menu } from 'lucide-react';
import { ThemeToggle, IconButton } from '../ui';
import { UserContext } from '../../context/User';
import { StatusContext } from '../../context/Status';
import { useMobileSidebar } from '../../context/MobileSidebar';
import useIsMobile from '../../hooks/useIsMobile';
import { API, showError, updateAPI, homeSiteUrl } from '../../helpers';
import {
  GlobeIcon, ChevronDownIcon, WalletIcon, LogOutIcon,
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
  const [, setMobileOpen] = useMobileSidebar();
  const isMobile = useIsMobile();
  const user = userState?.user;
  const isConsoleRoute = location.pathname.startsWith('/console');
  const hideLogoOnMobile = isConsoleRoute;

  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const userMenuRef = useRef(null);
  const langMenuRef = useRef(null);
  const mobileNavRef = useRef(null);

  const status = statusState?.status || {};
  const docsLink = status?.docs_link || '';

  const navLinks = useMemo(() => {
    const links = [];
    if (isConsoleRoute) {
      // 已在控制台内，导航项改为返回首页（独立部署的 home-site）
      links.push({ key: 'home', text: t('首页'), externalLink: homeSiteUrl() });
    } else {
      links.push({ key: 'console', text: t('控制台'), to: '/console' });
    }
    if (docsLink) links.push({ key: 'docs', text: t('文档'), externalLink: docsLink, newTab: true });
    return links;
  }, [t, docsLink, isConsoleRoute]);

  const activeKey = useMemo(() => {
    const link = navLinks.find((l) => {
      if (l.externalLink) return false;
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
    `flex items-center gap-1 px-3 h-9 rounded-lg text-[15px] font-medium transition-colors whitespace-nowrap cursor-pointer ${
      isActive ? 'bg-ui-bg-subtle text-ui-text-1' : 'text-ui-text-2 hover:bg-ui-bg-subtle hover:text-ui-text-1'
    }`;

  const renderLabel = (text) => <span>{text}</span>;

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

        <nav className='hidden md:inline-flex items-center gap-1'>
          {navLinks.map((link) => {
            const isActive = link.key === activeKey;
            if (link.externalLink) {
              return (
                <a
                  key={link.key}
                  href={link.externalLink}
                  target={link.newTab ? '_blank' : undefined}
                  rel={link.newTab ? 'noopener noreferrer' : undefined}
                  className={linkClass(isActive)}
                >
                  {renderLabel(link.text, isActive)}
                </a>
              );
            }
            return (
              <NavLink key={link.key} to={link.to}
                className={({ isActive: a }) => linkClass(a)}>
                {({ isActive: a }) => renderLabel(link.text, a)}
              </NavLink>
            );
          })}
        </nav>

        {/* Mobile nav dropdown trigger（控制台已有侧边栏，无需此下拉） */}
        {!isConsoleRoute && (
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
                      target={link.newTab ? '_blank' : undefined}
                      rel={link.newTab ? 'noopener noreferrer' : undefined}
                      onClick={() => setMobileNavOpen(false)}
                      className={itemClass}
                    >
                      {link.text}
                    </a>
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
        )}
      </div>

      <div className='flex items-center gap-2 md:gap-3'>
        {/* Theme */}

        {/* Language */}
        <div ref={langMenuRef} className='relative'>
          <IconButton size='lg' variant='outline' shape='square' icon={GlobeIcon} title={t('切换语言')} onClick={() => setLangMenuOpen((p) => !p)} />
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

        {user && (
          <div ref={userMenuRef} className='relative ml-1'>
            <button
              onClick={() => setUserMenuOpen((p) => !p)}
              className='flex items-center gap-1.5 px-3 h-9 rounded-full border border-ui-border text-sm text-ui-text-1 hover:bg-ui-bg-subtle transition-colors'
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
        )}
      </div>
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
