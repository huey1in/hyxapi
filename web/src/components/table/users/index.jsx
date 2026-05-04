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

const inputCls =
  'w-full pl-8 pr-7 py-1.5 text-xs bg-ui-bg border border-ui-border rounded-md text-ui-text placeholder:text-ui-text-3 outline-none focus:border-ui-text-3 transition-colors';

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
    <div className='min-h-[calc(100vh-4rem)] mt-16 px-4 py-5 md:px-6 md:py-6 bg-ui-bg'>
      <div className='max-w-[1400px] mx-auto'>
        {/* Header */}
        <div className='flex items-center justify-between gap-3 mb-5'>
          <h1
            className='text-2xl md:text-3xl font-medium text-ui-text'
            style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '-0.02em' }}
          >
            {t('用户管理')}
          </h1>
        </div>

        {/* Filter + actions card */}
        <div className='bg-ui-bg-elevated border border-ui-border rounded-xl p-3 mb-3 flex flex-col md:flex-row md:items-center justify-between gap-2'>
          <div className='flex items-center gap-1.5'>
            <button
              onClick={() => setShowAddUser(true)}
              className='inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-ui-accent text-ui-accent-fg hover:bg-ui-accent-hover active:scale-95 transition-all whitespace-nowrap'
            >
              <Plus size={12} />
              {t('添加用户')}
            </button>
            <button
              onClick={refresh}
              disabled={loading || searching}
              className='inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-ui-border text-ui-text-2 hover:text-ui-text hover:bg-ui-bg-subtle disabled:opacity-50 transition-colors whitespace-nowrap'
            >
              <RefreshCw size={12} className={loading || searching ? 'animate-spin' : ''} />
              {t('刷新')}
            </button>
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
            <button
              type='submit'
              disabled={loading || searching}
              className='inline-flex items-center px-3 py-1.5 text-xs rounded-md border border-ui-border text-ui-text-2 hover:text-ui-text hover:bg-ui-bg-subtle disabled:opacity-50 whitespace-nowrap'
            >
              {searching ? t('查询中...') : t('查询')}
            </button>
            <button
              type='button'
              onClick={onReset}
              className='inline-flex items-center px-3 py-1.5 text-xs rounded-md border border-ui-border text-ui-text-2 hover:text-ui-text hover:bg-ui-bg-subtle whitespace-nowrap'
            >
              {t('重置')}
            </button>
          </form>
        </div>

        {/* Table card */}
        <div className='bg-ui-bg-elevated border border-ui-border rounded-xl overflow-hidden'>
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
