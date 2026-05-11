import React from 'react';
import { usePageTitle } from '../../hooks/common/usePageTitle';
import SubscriptionsPage from '../../components/business/subscriptions';

const Subscription = () => {
  usePageTitle('订阅管理');
  return <SubscriptionsPage />;
};

export default Subscription;
