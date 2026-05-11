import React from 'react';
import { usePageTitle } from '../../hooks/common/usePageTitle';
import ChannelsPage from '../../components/business/channels';

const Channel = () => {
  usePageTitle('渠道管理');
  return <ChannelsPage />;
};

export default Channel;
