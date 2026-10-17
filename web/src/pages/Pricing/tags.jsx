import { Tag } from '../../components/ui';
import { getLobeHubIcon } from '../../helpers';

export const QuotaTag = ({ type, t }) => {
  const billingType = type === 0
    ? 'tokens'
    : type === 1
      ? 'request'
      : String(type || '').toLowerCase();
  if (billingType !== 'tokens' && billingType !== 'request') {
    return <span className='text-ui-text-3'>{t('未配置')}</span>;
  }
  return (
    <Tag tone={billingType === 'request' ? 'success' : 'info'}>
      {billingType === 'request' ? t('按次计费') : t('按量计费')}
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
