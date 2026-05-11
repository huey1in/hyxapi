import React from 'react';
import { usePageTitle } from '../../hooks/common/usePageTitle';
import RedemptionsPage from '../../components/business/redemptions';

const Redemption = () => {
  usePageTitle('兑换码管理');
  return <RedemptionsPage />;
};

export default Redemption;
