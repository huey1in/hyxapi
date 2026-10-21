import { useContext, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { StatusContext } from '../../context/Status';
import { useAuthStore } from '../../stores/auth-store';
import { useLogout } from '../../hooks/useLogout';
import PublicNavLinks from './PublicNavLinks';

export default function HeaderBar() {
  const { t } = useTranslation();
  const location = useLocation();
  const [publicMenu, setPublicMenu] = useState(false);
  const publicMenuButton = useRef<HTMLButtonElement>(null);
  const publicNav = useRef<HTMLElement>(null);
  useEffect(() => { setPublicMenu(false); }, [location.pathname, location.search]);
  useEffect(() => { if (publicMenu) publicNav.current?.querySelector<HTMLElement>('a,button')?.focus(); }, [publicMenu]);
  const user = useAuthStore((state) => state.auth.user);
  const [status] = useContext(StatusContext);
  const { busy, logout } = useLogout();
  return <header className='console-home-nav'>
    <div className='console-home-nav-left'>
      <Link to='/' className='home-brand'>HyxAPI</Link>
    </div>
    <nav ref={publicNav} id='public-header-navigation' aria-label={t('Main navigation')} className={`home-nav-links public-site-navigation${publicMenu ? ' is-open' : ''}`} onKeyDown={(event) => { if (event.key === 'Escape' && publicMenu) { setPublicMenu(false); publicMenuButton.current?.focus(); } }}>
      <PublicNavLinks status={status.status} onNavigate={() => setPublicMenu(false)} />
      {user ? <button type='button' className='home-nav-start' onClick={logout} disabled={busy}>{t('Sign out')}</button> : <>
        <Link to='/auth?mode=login'>{t('Sign in')}</Link>
        {status.status?.register_enabled !== false && <Link className='home-nav-start' to='/auth?mode=register'>{t('Create account')}</Link>}
      </>}
    </nav>
    <button ref={publicMenuButton} type='button' className='home-menu-button' aria-label={t('Toggle navigation menu')} aria-expanded={publicMenu} aria-controls='public-header-navigation' onClick={() => setPublicMenu((value) => !value)}>{publicMenu ? <X size={19} /> : <Menu size={19} />}</button>
  </header>;
}
