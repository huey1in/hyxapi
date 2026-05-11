/*
 * User admin page — token-system rewrite.
 */
import React, { useEffect, useState } from 'react';
import { Plus, RefreshCw, Search, X } from 'lucide-react';
import { useUsersData } from '../../../hooks/users/useUsersData';
import Pagination from '../../common/table/Pagination';
import UsersTable from './UsersTable';
import AddUserModal from './modals/AddUserModal';
import EditUserModal from './modals/EditUserModal';
import { Button } from '../../ui';

const inputCls =
  'w-full pl-8 pr-7 py-2 text-sm bg-transparent border border-ui-border rounded-xl text-ui-text placeholder:text-ui-text-3 outline-none focus:border-ui-text-3 transition-colors';

const UsersPage = () => {
  const data = useUsersData();
  const {
    showAddUser,
    showEditUser,
    editingUser,
    setShowAddUser,
    closeAddUser,
    closeEditUser,
    refresh,
    searchUsers,
    loadUsers,
    activePage,
    pageSize,
    userCount,
    handlePageChange,
    handlePageSizeChange,
    loading,
    searching,
    setFormApi,
    t,
  } = data;

  const [keyword, setKeyword] = useState('');

  useEffect(() => {
    setFormApi({
      getValues: () => ({ searchKeyword: keyword }),
      reset: () => setKeyword(''),
      setValue: (f, v) => {
        if (f === 'searchKeyword') setKeyword(v || '');
      },
    });
  }, [keyword, setFormApi]);

  const onSearch = (e) => {
    e?.preventDefault?.();
    searchUsers(1, pageSize);
  };

  const onReset = () => {
    setKeyword('');
    setTimeout(() => loadUsers(1, pageSize), 0);
  };

  return (
    <div className='px-4 pt-8 pb-6 md:px-6 md:pt-10 md:pb-8 overflow-x-hidden'>
      <div className='max-w-[1400px] mx-auto'>
        {/* Header */}
        <div className='flex items-center justify-between gap-3 mb-5'>
          <h1
            className='text-2xl font-semibold text-ui-text'
            style={{ letterSpacing: '-0.02em' }}
          >
            {t('用户管理')}
          </h1>
        </div>

        {/* Filter + actions card */}
        <div className='border border-ui-border rounded-2xl p-4 mb-3 bg-[var(--page-bg)] overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-2'>
          <div className='flex items-center gap-1.5'>
            <Button icon={Plus} onClick={() => setShowAddUser(true)}>
              {t('添加用户')}
            </Button>
            <Button
              variant='ghost'
              icon={RefreshCw}
              onClick={refresh}
              disabled={loading || searching}
            >
              {t('刷新')}
            </Button>
          </div>

          <form onSubmit={onSearch} className='flex flex-wrap items-center gap-1.5'>
            <div className='relative w-full md:w-64'>
              <Search size={12} className='absolute left-2.5 top-1/2 -translate-y-1/2 text-ui-text-3 pointer-events-none' />
              <input
                type='text'
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder={t('ID / 用户名 / 显示名 / 邮箱')}
                className={inputCls}
              />
              {keyword && (
                <button
                  type='button'
                  onClick={() => setKeyword('')}
                  className='absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-ui-text-3 hover:text-ui-text hover:bg-ui-bg-subtle'
                >
                  <X size={11} />
                </button>
              )}
            </div>
            <Button type='submit' variant='ghost' disabled={loading || searching}>
              {searching ? t('查询中...') : t('查询')}
            </Button>
            <Button type='button' variant='ghost' onClick={onReset}>
              {t('重置')}
            </Button>
          </form>
        </div>

        {/* Table card */}
        <div className='border border-ui-border rounded-2xl overflow-hidden bg-[var(--page-bg)]'>
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
        </div>
      </div>

      <AddUserModal refresh={refresh} visible={showAddUser} handleClose={closeAddUser} />
      <EditUserModal
        refresh={refresh}
        visible={showEditUser}
        handleClose={closeEditUser}
        editingUser={editingUser}
      />
    </div>
  );
};

export default UsersPage;
