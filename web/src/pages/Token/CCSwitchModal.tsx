import { useContext, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { API } from '../../helpers';
import { Button, FormField, Input, Modal, Select, showError } from '../../components/ui';
import Combobox from '../../components/ui/select/Combobox';
import { StatusContext } from '../../context/Status';
import type { ApiEnvelope } from '../../types/api';
import { CC_SWITCH_APPS, buildCCSwitchURL, ccSwitchKeySchema, ccSwitchModelsSchema } from './cc-switch';
import type { CCSwitchApp, CCSwitchModels } from './cc-switch';
import { tokenErrorMessage } from './token-management';
import type { TokenListItem } from './token-management';

export default function CCSwitchModal({ token, onClose }: { token: TokenListItem; onClose: () => void }) {
  const { t } = useTranslation();
  const [status] = useContext(StatusContext);
  const [app, setApp] = useState<CCSwitchApp>('claude');
  const [name, setName] = useState(`HyxAPI - ${token.name || t('Untitled')}`);
  const [models, setModels] = useState<CCSwitchModels>({ model: '' });
  const [available, setAvailable] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const secret = useRef('');

  useEffect(() => {
    const owner = new AbortController();
    setLoading(true); setError(''); secret.current = '';
    void Promise.all([
      API.get<ApiEnvelope<unknown>>(`/api/token/${token.id}/models`, { signal: owner.signal, disableDuplicate: true, skipErrorHandler: true }),
      API.post<ApiEnvelope<unknown>>(`/api/token/${token.id}/key`, undefined, { signal: owner.signal, skipErrorHandler: true }),
    ]).then(([modelResponse, keyResponse]) => {
      owner.signal.throwIfAborted();
      if (!modelResponse.data.success || !keyResponse.data.success) throw new Error(modelResponse.data.message || keyResponse.data.message || 'Unable to prepare CC Switch import');
      const modelResult = ccSwitchModelsSchema.safeParse(modelResponse.data);
      const keyResult = ccSwitchKeySchema.safeParse(keyResponse.data);
      if (!modelResult.success || !keyResult.success) throw new Error('Unable to prepare CC Switch import');
      secret.current = keyResult.data.data.key;
      setAvailable([...new Set(modelResult.data.data.map((model) => model.id))].sort());
    }).catch((error: unknown) => {
      if (!owner.signal.aborted) setError(tokenErrorMessage(error) || 'Unable to prepare CC Switch import');
    }).finally(() => { if (!owner.signal.aborted) setLoading(false); });
    return () => { owner.abort(); secret.current = ''; };
  }, [token.id, attempt]);

  const fields = app === 'claude' ? ['model', 'haikuModel', 'sonnetModel', 'opusModel'] as const : ['model'] as const;
  const labels = { model: 'Primary model', haikuModel: 'Haiku model', sonnetModel: 'Sonnet model', opusModel: 'Opus model' };
  const validModels = fields.every((field) => !models[field] || available.includes(models[field]));
  const launch = () => {
    if (loading || error || !models.model || !validModels) return;
    try {
      const serverAddress = typeof status.status?.server_address === 'string' && status.status.server_address.trim() ? status.status.server_address : window.location.origin;
      const link = buildCCSwitchURL({ app, name, models, apiKey: secret.current, serverAddress });
      window.location.assign(link);
      onClose();
    } catch (error) { showError(t(tokenErrorMessage(error))); }
  };
  return <Modal open width={480} title={t('Import to CC Switch')} onClose={onClose} footer={<>
    <Button variant='toggle' onClick={onClose}>{t('Cancel')}</Button>
    <Button loading={loading} disabled={loading || !!error || !name.trim() || !models.model || !validModels} onClick={launch}>{t('Open CC Switch')}</Button>
  </>}>
    <FormField label={t('Application')}><Select<CCSwitchApp> aria-label={t('Application')} placement='bottom-end' value={app} onChange={(value) => { setApp(value); setModels({ model: '' }); }} options={(Object.keys(CC_SWITCH_APPS) as CCSwitchApp[]).map((value) => ({ value, label: CC_SWITCH_APPS[value].label }))} /></FormField>
    <FormField label={t('Name')}><Input aria-label={t('Name')} value={name} onChange={setName} maxLength={100} width='full' /></FormField>
    {fields.map((field) => <FormField key={field} label={t(labels[field])}>
      <Combobox aria-label={t(labels[field])} placement='bottom-end' value={models[field] || ''} disabled={loading || !!error} onChange={(value: string) => setModels((previous) => ({ ...previous, [field]: value }))}
        placeholder={t(loading ? 'Loading models' : field === 'model' ? 'Select model' : 'Optional')}
        searchPlaceholder={t('Search models')} emptyText={t('No models available for this API key')}
        options={[...(field === 'model' ? [] : [{ value: '', label: t('Optional') }]), ...available.map((value) => ({ value, label: value }))]} />
    </FormField>)}
    {error && <div role='alert' className='flex flex-wrap items-center justify-between gap-2 text-sm text-ui-danger'><span>{t(error)}</span><Button variant='link' onClick={() => setAttempt((value) => value + 1)}>{t('Retry')}</Button></div>}
    {!loading && !error && !available.length && <p className='text-sm text-ui-text-3'>{t('No models available for this API key')}</p>}
    <p className='text-xs leading-5 text-ui-text-3'>{t('Install CC Switch on this device before importing.')}</p>
  </Modal>;
}
