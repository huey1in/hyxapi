import { useContext, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useMobileSidebar } from '../../context/MobileSidebar';
import { StatusContext } from '../../context/Status';
import { logoutAuthentication, updateAPI } from '../../helpers';
import { useAuthStore } from '../../stores/auth-store';
import { useOwnedOperation } from '../../hooks/useOwnedOperation';
import PublicNavLinks from './PublicNavLinks';
import { parseHeaderNavModules } from '../../lib/nav-modules';

export default function HeaderBar({ showMenu = false }: { showMenu?: boolean }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [publicMenu, setPublicMenu] = useState(false);
  const publicMenuButton = useRef<HTMLButtonElement>(null);
  const publicNav = useRef<HTMLElement>(null);
  const consolePage = location.pathname === '/console' || location.pathname.startsWith('/console/');
  useEffect(() => { setPublicMenu(false); }, [location.pathname, location.search]);
  useEffect(() => { if (publicMenu) publicNav.current?.querySelector<HTMLElement>('a,button')?.focus(); }, [publicMenu]);
  const user = useAuthStore((state) => state.auth.user);
  const [status] = useContext(StatusContext);
  const [, setMobileOpen] = useMobileSidebar();
  const { busy, run } = useOwnedOperation();
  const logout = () => void run(async (signal) => {
    const cleared = await logoutAuthentication(signal); if (!cleared) return;
    updateAPI(); setMobileOpen(false); navigate('/');
  });
  return <header className='console-home-nav'>
    <div className='console-home-nav-left'>
      {showMenu && <button type='button' className='console-menu-button md:hidden' onClick={() => setMobileOpen(true)} aria-label={t('Open sidebar')}><Menu size={19} /></button>}
      <Link to='/' className='home-brand'>Hyxware</Link>
    </div>
    <nav ref={publicNav} id='public-header-navigation' aria-label={t('Main navigation')} className={`home-nav-links${consolePage ? ' console-home-nav-links' : ` public-site-navigation${publicMenu ? ' is-open' : ''}`}`} onKeyDown={(event) => { if (event.key === 'Escape' && publicMenu) { setPublicMenu(false); publicMenuButton.current?.focus(); } }}>
      {consolePage ? parseHeaderNavModules(status.status?.HeaderNavModules).home && <Link to='/'>{t('Home')}</Link> : <PublicNavLinks status={status.status} onNavigate={() => setPublicMenu(false)} />}
      {user ? <button type='button' className='home-nav-start' onClick={logout} disabled={busy}>{t('Sign out')}</button> : <>
        <Link to='/auth?mode=login'>{t('Sign in')}</Link>
        {status.status?.register_enabled !== false && <Link className='home-nav-start' to='/auth?mode=register'>{t('Create account')}</Link>}
      </>}
    </nav>
    {!consolePage && <button ref={publicMenuButton} type='button' className='home-menu-button' aria-label={t('Toggle navigation menu')} aria-expanded={publicMenu} aria-controls='public-header-navigation' onClick={() => setPublicMenu((value) => !value)}>{publicMenu ? <X size={19} /> : <Menu size={19} />}</button>}
  </header>;
}
