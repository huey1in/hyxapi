import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CodeBlock, Select } from '../../components/ui';
import { buildModelRequest, renderModelRequest } from './request-examples';
import type { EndpointInfo, ExampleLanguage } from './request-examples';
import type { PricingModel } from './types';

export default function ModelApiExamples({ model, endpoints }: { model: PricingModel; endpoints: Record<string, EndpointInfo> }) {
  const { t } = useTranslation();
  const [endpoint, setEndpoint] = useState('');
  const [language, setLanguage] = useState<ExampleLanguage>('curl');
  const examples = useMemo(() => (model.supported_endpoint_types ?? []).flatMap((type) => {
    const request = buildModelRequest(model.model_name, type, endpoints[type], window.location.origin);
    return request ? [{ type, request }] : [];
  }), [model.model_name, model.supported_endpoint_types, endpoints]);
  const active = examples.find((example) => example.type === endpoint) ?? examples[0];
  if (!active) return null;
  return <Card><section aria-label={t('API examples')} className='min-w-0 space-y-3'>
    <h2 className='text-sm font-medium text-ui-text'>{t('API examples')}</h2>
    <p className='text-xs text-ui-text-3'>{t('Set HYXWARE_API_KEY to a token from the Tokens page before running these examples.')}</p>
    <div className='flex flex-wrap gap-2'>
      <Select aria-label={t('Example protocol')} value={active.type} options={examples.map(({ type }) => ({ value: type, label: type }))} onChange={setEndpoint} />
      <Select aria-label={t('Example language')} value={language} options={[{ value: 'curl' as const, label: 'cURL' }, { value: 'python' as const, label: 'Python' }, { value: 'typescript' as const, label: 'TypeScript' }, { value: 'javascript' as const, label: 'JavaScript' }]} onChange={setLanguage} />
    </div>
    <div className='min-w-0'><CodeBlock code={renderModelRequest(active.request, language)} language={language === 'curl' ? 'bash' : language} maxHeight={360} /></div>
  </section></Card>;
}
