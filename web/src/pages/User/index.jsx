import React from 'react';
import { usePageTitle } from '../../hooks/common/usePageTitle';
import UsersPage from '../../components/business/users';

const User = () => {
  usePageTitle('用户管理');
  return <UsersPage />;
};

export default User;
