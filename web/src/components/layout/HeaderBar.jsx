import { useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { UserContext } from '../../context/User';
import { useMobileSidebar } from '../../context/MobileSidebar';
import { API, showError, updateAPI } from '../../helpers';

const HeaderBar = () => {
  const navigate = useNavigate();
  const [, userDispatch] = useContext(UserContext);
  const [, setMobileOpen] = useMobileSidebar();

  const logout = async () => {
    try {
      await API.get('/api/user/logout');
    } catch (error) {
      showError(error);
    }
    localStorage.removeItem('user');
    updateAPI();
    userDispatch?.({ type: 'logout' });
    navigate('/');
  };

  return (
    <header className='console-home-nav'>
      <div className='console-home-nav-left'>
        <button
          type='button'
          className='console-menu-button md:hidden'
          onClick={() => setMobileOpen(true)}
          aria-label='打开侧边栏'
        >
          <Menu size={19} />
        </button>
        <Link to='/' className='home-brand'>Hyxware</Link>
      </div>
      <nav className='home-nav-links console-home-nav-links'>
        <Link to='/'>首页</Link>
        <button type='button' className='home-nav-start' onClick={logout}>
          退出登录
        </button>
      </nav>
    </header>
  );
};

export default HeaderBar;
