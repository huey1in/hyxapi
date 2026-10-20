import { Tag } from '../../components/ui';
import { getLobeHubIcon } from '../../helpers';
import type { TFunction } from 'i18next';

export const QuotaTag = ({ type, t }: { type?: string | number; t: TFunction }) => {
  const billingType = type === 0
    ? 'tokens'
    : type === 1
      ? 'request'
      : String(type || '').toLowerCase();
  if (billingType === 'expression') return <Tag>{t("Expression billing")}</Tag>;
  if (billingType !== 'tokens' && billingType !== 'request') {
    return <span className='text-ui-text-3'>{t("Not configured")}</span>;
  }
  return (
    <Tag tone={billingType === 'request' ? 'success' : 'info'}>
      {billingType === 'request' ? t("Pay per request") : t("Pay as you go")}
    </Tag>
  );
};

export const VendorTag = ({ name, icon }: { name?: string; icon?: string }) => {
  if (!name) return <span className='text-ui-text-3'>-</span>;
  return (
    <Tag>
      {getLobeHubIcon(icon || 'Layers', 14)}
      {name}
    </Tag>
  );
};
