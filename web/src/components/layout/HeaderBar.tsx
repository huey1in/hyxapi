import { useContext, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { StatusContext } from '../../context/Status';
import { useAuthStore } from '../../stores/auth-store';
import { useLogout } from '../../hooks/useLogout';
import { parseHeaderNavModules } from '../../lib/nav-modules';
import PublicNavLinks from './PublicNavLinks';
import PublicNavigation from './PublicNavigation';

export default function HeaderBar() {
  const { t } = useTranslation();
  const location = useLocation();
  const [publicMenu, setPublicMenu] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const publicMenuButton = useRef<HTMLButtonElement>(null);
  const publicNav = useRef<HTMLElement>(null);
  useEffect(() => { setPublicMenu(false); }, [location.pathname, location.search]);
  useEffect(() => { if (publicMenu) publicNav.current?.querySelector<HTMLElement>('a,button')?.focus(); }, [publicMenu]);
  const user = useAuthStore((state) => state.auth.user);
  const [status] = useContext(StatusContext);
  const modules = parseHeaderNavModules(status.status?.HeaderNavModules);
  const showPublicModels = Boolean(status.status) && modules.pricing.enabled && !modules.pricing.requireAuth;
  const { busy, logout } = useLogout();

  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;
    // Homepage headers sit inside the main element; public page headers sit beside it.
    const container = header.closest<HTMLElement>('.app-layout-main')
      ?? header.closest('.app-layout')?.querySelector<HTMLElement>('.app-layout-main');
    const target = container ?? window;
    let frame = 0;
    const update = () => {
      frame = 0;
      const progress = Math.min(1, Math.max(0, (container?.scrollTop ?? window.scrollY) / 160));
      header.style.setProperty('--home-nav-progress', String(progress));
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    target.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      target.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
    };
  }, [location.pathname]);

  return <header ref={headerRef} className='public-header'>
    <Link to='/' className='home-brand'>HyxAPI</Link>
    <nav ref={publicNav} id='home-navigation' aria-label={t('Main navigation')} className={`home-nav-links public-site-navigation${publicMenu ? ' is-open' : ''}`} onKeyDown={(event) => { if (event.key === 'Escape' && publicMenu) { setPublicMenu(false); publicMenuButton.current?.focus(); } }}>
      <PublicNavigation>
        <PublicNavLinks status={status.status} includeHome={false} includePricing={showPublicModels} onNavigate={() => setPublicMenu(false)} />
        {user ? <button type='button' onClick={logout} disabled={busy}>{t('Sign out')}</button> : <>
          <Link to='/auth?mode=login'>{t('Sign in')}</Link>
          {status.status?.register_enabled !== false && <Link to='/auth?mode=register'>{t('Create account')}</Link>}
        </>}
      </PublicNavigation>
    </nav>
    <button ref={publicMenuButton} type='button' className='home-menu-button' aria-label={t('Toggle navigation menu')} aria-expanded={publicMenu} aria-controls='home-navigation' onClick={() => setPublicMenu((value) => !value)}>{publicMenu ? <X size={19} /> : <Menu size={19} />}</button>
  </header>;
}
