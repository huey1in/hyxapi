import { useTranslation } from 'react-i18next';
import { Select, Switch } from '../../components/ui';
import { Field } from './ChannelFormParts';

type TransportConfig = {
  http_protocol?: string; http2_connection_shards?: number; tls_insecure_skip_verify?: boolean;
  [key: string]: unknown;
};

export default function TransportSettings({ value, onChange, disabled = false }: {
  value: TransportConfig; onChange: (value: TransportConfig) => void; disabled?: boolean;
}) {
  const { t } = useTranslation();
  const protocol = value.http_protocol || 'auto';
  return <div className='space-y-4 border-b border-ui-border pb-4' role='group' aria-label={t('Upstream transport')}>
    <h3 className='text-xs font-medium text-ui-text-2'>{t('Upstream transport')}</h3>
    <div className='space-y-4'>
      <Field label={t('HTTP protocol')}><Select popover width='full' aria-label={t('HTTP protocol')} value={protocol} disabled={disabled} onChange={(next) => onChange({ ...value, http_protocol: next, ...(next === 'http1' ? { http2_connection_shards: 1 } : {}) })} options={[{ value: 'auto', label: t('Automatic HTTP negotiation') }, { value: 'http1', label: 'HTTP/1.1' }]} /></Field>
      <Field label={t('HTTP/2 connection shards')}><Select popover width='full' aria-label={t('HTTP/2 connection shards')} value={protocol === 'http1' ? 1 : value.http2_connection_shards || 1} disabled={disabled || protocol === 'http1'} onChange={(next) => onChange({ ...value, http2_connection_shards: next })} options={[1, 2, 3, 4, 5, 6, 7, 8]} /></Field>
    </div>
    <p className='text-xs text-ui-text-3'>{t('HTTP/2 shards spread requests across independent connection pools. HTTP/1.1 uses one pool.')}</p>
    <Field compact label={t('Allow unverified upstream certificates')} hint={t('For this channel only. Enable for trusted endpoints with self-signed certificates.')}>
      <Switch size='sm' aria-label={t('Allow unverified upstream certificates')} checked={value.tls_insecure_skip_verify === true} disabled={disabled} onChange={(next) => onChange({ ...value, tls_insecure_skip_verify: next })} />
    </Field>
  </div>;
}
