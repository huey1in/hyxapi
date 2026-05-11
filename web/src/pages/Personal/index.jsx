import React from 'react';
import { usePageTitle } from '../../hooks/common/usePageTitle';
import PersonalSetting from '../../components/business/auth/PersonalSetting';

const Personal = () => {
  usePageTitle('个人设置');
  return <PersonalSetting />;
};

export default Personal;
