/*
 * UsersPage — 用户管理（管理员）
 *
 * 与 web-backup/components/table/users/index.jsx 同构：
 *   Header + 筛选/操作 Card + 表格 Card + 底部 Pagination
 */

import React, { useEffect, useState } from 'react';
import { Plus, RefreshCw, Search, X } from 'lucide-react';
import { useUsersData } from '../../../hooks/users/useUsersData';
import { Button, IconButton, Card, Pagination, Input } from '../../ui';
import UsersTable from './UsersTable';
import AddUserModal from './modals/AddUserModal';
import EditUserModal from './modals/EditUserModal';

const UsersPage = () => {
  const data = useUsersData();
  const {
    showAddUser, showEditUser, editingUser,
    setShowAddUser, closeAddUser, closeEditUser,
    refresh, searchUsers, loadUsers,
    activePage, pageSize, userCount,
    handlePageChange, handlePageSizeChange,
    loading, searching, setFormApi,
    t,
  } = data;

  const [keyword, setKeyword] = useState('');

  useEffect(() => {
    setFormApi({
      getValues: () => ({ searchKeyword: keyword }),
      reset:     () => setKeyword(''),
      setValue:  (f, v) => { if (f === 'searchKeyword') setKeyword(v || ''); },
    });
  }, [keyword, setFormApi]);

  const onSearch = (e) => { e?.preventDefault?.(); searchUsers(1, pageSize); };
  const onReset  = () => { setKeyword(''); setTimeout(() => loadUsers(1, pageSize), 0); };

  return (
    <div className='px-4 pt-8 pb-6 md:px-6 md:pt-10 md:pb-8 overflow-x-hidden' style={{ backgroundColor: 'var(--page-bg)' }}>
      <div className='max-w-[1400px] mx-auto'>
        <div className='flex items-center justify-between gap-3 mb-5'>
          <h1 className='text-2xl font-semibold text-ui-text' style={{ letterSpacing: '-0.02em' }}>{t('用户管理')}</h1>
        </div>

        <Card>
          <div className='flex flex-col md:flex-row md:items-center justify-between gap-2'>
            <div className='flex items-center gap-1.5'>
              <Button icon={Plus} onClick={() => setShowAddUser(true)}>{t('添加用户')}</Button>
              <Button variant='toggle' icon={RefreshCw} onClick={refresh} disabled={loading || searching}>{t('刷新')}</Button>
            </div>
            <form onSubmit={onSearch} className='flex flex-wrap items-center gap-1.5'>
              <Input
                value={keyword}
                onChange={setKeyword}
                placeholder={t('ID / 用户名 / 显示名 / 邮箱')}
                prefix={<Search size={12} />}
                suffix={keyword ? <IconButton size='xs' icon={X} onClick={() => setKeyword('')} /> : null}
                width={260}
              />
              <Button type='submit' variant='toggle' disabled={loading || searching}>{searching ? t('查询中...') : t('查询')}</Button>
              <Button type='button' variant='toggle' onClick={onReset}>{t('重置')}</Button>
            </form>
          </div>
        </Card>

        <div className='h-3' />

        <Card noPadding>
          <UsersTable {...data} />
          {userCount > 0 && (
            <div className='border-t border-ui-divider'>
              <Pagination
                page={activePage}
                pageSize={pageSize}
                total={userCount}
                pageSizeOpts={[10, 20, 50, 100]}
                onChange={handlePageChange}
                onPageSizeChange={handlePageSizeChange}
              />
            </div>
          )}
        </Card>
      </div>

      <AddUserModal refresh={refresh} visible={showAddUser} handleClose={closeAddUser} />
      <EditUserModal refresh={refresh} visible={showEditUser} handleClose={closeEditUser} editingUser={editingUser} />
    </div>
  );
};

export default UsersPage;
