/*
 * TopNavBar — 公共页（Home / Pricing / 协议页 等）顶部导航
 *
 * 对应 backup `components/layout/headerbar/index.jsx` 非 console 分支：
 *   左：Logo + 系统名
 *   中：主导航链接（首页 / 模型广场 / 文档）
 *   右：主题切换 + 登录 / 用户菜单
 */

import React, { useContext } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { LogIn, LogOut } from 'lucide-react';
import { Button, IconButton, ThemeToggle } from '../components/ui';
import { UserContext } from '../context/User';
import { useLoginModal } from '../context/LoginModal';
import { StatusContext } from '../context/Status';
import { API, showError, showSuccess } from '../helpers';
import { cn } from '../components/ui/tokens';

const TopNavBar = () => {
  const [userState, userDispatch] = useContext(UserContext);
  const [statusState] = useContext(StatusContext);
  const { openLoginModal } = useLoginModal();
  const user = userState?.user;
  const systemName = statusState?.status?.system_name || 'Routify';

  const onLogout = async () => {
    try {
      await API.get('/api/user/logout');
      userDispatch({ type: 'logout' });
      try { localStorage.removeItem('user'); } catch {}
      showSuccess('已退出登录');
    } catch (e) { showError(e); }
  };

  const navLinks = [
    { to: '/',         label: '首页',     end: true },
    { to: '/pricing',  label: '模型广场' },
  ];

  return (
    <header
      className='sticky top-0 z-40 h-14 px-4 md:px-6 flex items-center justify-between gap-3 border-b border-ui-border backdrop-blur-md'
      style={{ backgroundColor: 'rgba(248, 248, 246, 0.85)' }}
    >
      {/* Logo */}
      <Link to='/' className='flex items-center gap-2 flex-shrink-0'>
        <div className='w-7 h-7 rounded-lg bg-ui-accent text-ui-accent-fg flex items-center justify-center text-sm font-semibold'>R</div>
        <span className='text-sm font-semibold text-ui-text'>{systemName}</span>
      </Link>

      {/* Nav */}
      <nav className='hidden md:flex items-center gap-1'>
        {navLinks.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.end}
            className={({ isActive }) =>
              cn(
                'px-3 py-1.5 rounded-lg text-sm transition-colors',
                isActive ? 'text-ui-text bg-ui-bg-subtle' : 'text-ui-text-2 hover:text-ui-text hover:bg-ui-bg-subtle/60',
              )
            }
          >
            {l.label}
          </NavLink>
        ))}
        {user && (
          <NavLink
            to='/console'
            className={({ isActive }) =>
              cn(
                'px-3 py-1.5 rounded-lg text-sm transition-colors',
                isActive ? 'text-ui-text bg-ui-bg-subtle' : 'text-ui-text-2 hover:text-ui-text hover:bg-ui-bg-subtle/60',
              )
            }
          >
            控制台
          </NavLink>
        )}
      </nav>

      {/* Right */}
      <div className='flex items-center gap-2'>
        <ThemeToggle />
        {user ? (
          <>
            <span className='hidden md:inline text-sm text-ui-text-2 px-1'>{user.display_name || user.username}</span>
            <IconButton icon={LogOut} variant='ghost' onClick={onLogout} aria-label='退出登录' />
          </>
        ) : (
          <Button icon={LogIn} onClick={() => openLoginModal('login')}>登录</Button>
        )}
      </div>
    </header>
  );
};

export default TopNavBar;
