import React from 'react';
import { Tag } from '../../components/ui';
import { getLobeHubIcon } from '../../helpers';

export const QuotaTag = ({ type, t }) => {
  if (type !== 0 && type !== 1) return <span className='text-ui-text-3'>{t('未知')}</span>;
  return (
    <Tag tone={type === 1 ? 'success' : 'info'}>
      {type === 1 ? t('按次计费') : t('按量计费')}
    </Tag>
  );
};

export const VendorTag = ({ name, icon }) => {
  if (!name) return <span className='text-ui-text-3'>-</span>;
  return (
    <Tag>
      {getLobeHubIcon(icon || 'Layers', 14)}
      {name}
    </Tag>
  );
};
