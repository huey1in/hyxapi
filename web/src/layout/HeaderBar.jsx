/*
 * HeaderBar — 顶部条
 *
 * 已登录：右侧显示用户名 + 登出按钮
 * 未登录：右侧显示登录按钮
 */

import React, { useContext } from 'react';
import { Bell, LogOut, LogIn } from 'lucide-react';
import { Button, IconButton, ThemeToggle } from '../components/ui';
import { UserContext } from '../context/User';
import { useLoginModal } from '../context/LoginModal';
import { API, showError, showSuccess } from '../helpers';

const HeaderBar = () => {
  const [userState, userDispatch] = useContext(UserContext);
  const { openLoginModal } = useLoginModal();
  const user = userState?.user;

  const onLogout = async () => {
    try {
      await API.get('/api/user/logout');
      userDispatch({ type: 'logout' });
      try { localStorage.removeItem('user'); } catch {}
      showSuccess('已退出登录');
    } catch (e) { showError(e); }
  };

  return (
    <header
      className='h-14 flex items-center justify-end gap-2 px-4 border-b border-ui-border flex-shrink-0'
      style={{ backgroundColor: 'var(--page-bg)' }}
    >
      <IconButton icon={Bell} variant='ghost' aria-label='通知' />
      <ThemeToggle />
      {user ? (
        <>
          <span className='text-sm text-ui-text-2 px-2'>{user.display_name || user.username}</span>
          <IconButton icon={LogOut} variant='ghost' onClick={onLogout} aria-label='退出登录' title='退出登录' />
        </>
      ) : (
        <Button icon={LogIn} onClick={() => openLoginModal('login')}>登录</Button>
      )}
    </header>
  );
};

export default HeaderBar;
