import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { isAxiosError } from 'axios';
import { API } from '../../../helpers';
import type { ApiEnvelope } from '../../../types/api';
import { useAuthStore } from '../../../stores/auth-store';
import { useOwnedOperation } from '../../../hooks/useOwnedOperation';
import { Button, Checkbox, Modal, showSuccess } from '../../../components/ui';
import { Input, Select, Textarea } from './controls';
import { copyModelPricing, parsePricingBatch, serializePricingDraft, pricingSnapshotSchema, PricingConfigError } from './pricing-config';
import type { PricingChange, PricingEntry, PricingSnapshot } from './pricing-config';
import { getModelPricingErrorMessage } from '../pricing-editor';

const requestConfig = { skipErrorHandler: true, disableDuplicate: true, timeout: 30000 };
const pageSize = 20;
type Props = { open: boolean; onClose: () => void; onSaved: () => void; modelNames: string[] };

function PricingBatchContent({ onClose, onSaved, modelNames }: Omit<Props, 'open'>) {
  const { t } = useTranslation();
  const formatError = (cause: unknown, fallback: string) => cause instanceof PricingConfigError
    ? t(cause.message, cause.values) : t(getModelPricingErrorMessage(cause, fallback));
  const [snapshot, setSnapshot] = useState<PricingSnapshot | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [source, setSource] = useState('');
  const [page, setPage] = useState(1);
  const [raw, setRaw] = useState('[]');
  const { busy, run } = useOwnedOperation();
  const [error, setError] = useState('');
  const [generation, setGeneration] = useState(0);
  useEffect(() => {
    const owner = new AbortController();
    setSnapshot(null); setError(''); setRaw('[]'); setSelected(new Set()); setQuery(''); setFilter('all'); setPage(1); setSource('');
    API.get<ApiEnvelope<unknown>>('/api/option/model_pricing', { ...requestConfig, signal: owner.signal }).then(({ data }) => {
      if (owner.signal.aborted) return;
      if (!data.success) throw new Error(data.message || 'Unable to load pricing snapshot');
      const parsed = pricingSnapshotSchema.safeParse(data.data);
      if (!parsed.success) throw new Error('Unable to load pricing snapshot');
      setSnapshot(parsed.data);
    }).catch((cause: unknown) => { if (!owner.signal.aborted) setError(getModelPricingErrorMessage(cause, 'Unable to load pricing snapshot')); });
    return () => owner.abort();
  }, [generation]);
  const entries = useMemo(() => {
    const rows = new Map((snapshot?.entries || []).map((entry) => [entry.model_name, entry]));
    for (const name of modelNames) if (!rows.has(name)) rows.set(name, { model_name: name, version: snapshot?.empty_version || '', configured: {}, effective: {}, source: 'unset' });
    return [...rows.values()].sort((left, right) => left.model_name.localeCompare(right.model_name));
  }, [snapshot, modelNames]);
  const filtered = entries.filter((entry) => entry.model_name.toLowerCase().includes(query.toLowerCase()) && (filter === 'all' || (filter === 'unset'
    ? Object.keys(entry.configured).length === 0 && entry.source !== 'direct' : entry.source === filter)));
  const maxPage = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice((Math.min(page, maxPage) - 1) * pageSize, Math.min(page, maxPage) * pageSize);
  const parsed = useMemo(() => {
    if (!snapshot) return { changes: [] as PricingChange[], error: '' };
    try { return { changes: parsePricingBatch(raw, snapshot), error: '' }; }
    catch (cause) { return { changes: [] as PricingChange[], error: formatError(cause, 'Invalid pricing draft') }; }
  }, [raw, snapshot, t]);
  const toggle = (name: string, checked: boolean) => setSelected((current) => {
    const next = new Set(current); if (checked) next.add(name); else next.delete(name); return next;
  });
  const stage = (reset: boolean) => {
    if (!snapshot || parsed.error) return;
    try {
      const origin = entries.find((entry) => entry.model_name === source.trim());
      if (!reset && (!origin || !Object.keys(origin.effective).length)) throw new Error('Select a source model with saved prices.');
      const changes = new Map(parsed.changes.map((change) => [change.model_name, change]));
      for (const name of selected) {
        const target = entries.find((entry) => entry.model_name === name)!;
        changes.set(name, { model_name: name, expected_version: target.version, pricing: reset ? {} : copyModelPricing(origin!, target), ...(reset ? { reset: true } : {}) });
      }
      setRaw(serializePricingDraft([...changes.values()])); setError('');
    } catch (cause) { setError(formatError(cause, 'Invalid pricing draft')); }
  };
  const exportSelected = () => {
    const changes = entries.filter((entry) => selected.has(entry.model_name)).map((entry) => ({ model_name: entry.model_name, expected_version: entry.version, pricing: entry.configured }));
    const url = URL.createObjectURL(new Blob([serializePricingDraft(changes)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'hyxapi-model-pricing.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const save = () => {
    if (!snapshot || parsed.error || !parsed.changes.length) return;
    setError('');
    void run(async (signal) => { try {
      const { data } = await API.patch<ApiEnvelope<unknown>>('/api/option/model_pricing', { changes: parsed.changes }, { ...requestConfig, signal });
      signal.throwIfAborted();
      if (!data.success) throw new Error(data.message || 'Unable to save');
      showSuccess(t('Saved billing for {{count}} models', { count: parsed.changes.length })); onSaved(); onClose();
    } catch (cause: unknown) {
      if (!signal.aborted) setError(isAxiosError(cause) && cause.response?.status === 409
        ? 'Pricing changed; no models in this batch were saved. The draft is preserved. Export or copy it before reloading and merging changes.'
        : getModelPricingErrorMessage(cause, 'Unable to save'));
    } });
  };
  const sourceLabel = (entry: PricingEntry) => t(({ direct: 'Direct prices', tiered_expr: 'Expression', ratio: 'Ratio', unset: 'Unconfigured' } as Record<string, string>)[entry.source] || entry.source);
  return <Modal open onClose={() => !busy && onClose()} title={t('Batch billing management')} width={880} onConfirm={save}
    footer={<div className='flex w-full flex-wrap justify-end gap-2.5'><Button disabled={busy} variant='secondary' onClick={onClose}>{t('Cancel')}</Button>
      <Button loading={busy} disabled={!snapshot || Boolean(parsed.error) || !parsed.changes.length} onClick={save}>{t('Save batch ({{count}})', { count: parsed.changes.length })}</Button></div>}>
    {error && <p role='alert' className='text-sm text-ui-danger'>{t(error)}</p>}
    {!snapshot ? <div className='text-sm text-ui-text-3'>{error ? <Button variant='secondary' onClick={() => setGeneration((value) => value + 1)}>{t('Retry')}</Button> : t('Loading pricing snapshot…')}</div> : <fieldset disabled={busy} className='min-w-0 space-y-4'>
      <p className='text-xs text-ui-text-3'>{t('Select target models to copy prices or restore defaults, then review the draft before saving. The batch applies atomically; conflicts or validation errors roll it back. Copies preserve each target’s plugin prices.')}</p>
      <div className='grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-[1fr_160px]'>
        <Input aria-label={t('Batch pricing search')} value={query} placeholder={t('Search model names')} onChange={(value) => { setQuery(value); setPage(1); }} />
        <Select width='100%' value={filter} onChange={(value) => { setFilter(value); setPage(1); }} options={[
          { value: 'all', label: t('All billing modes') }, { value: 'tiered_expr', label: t('Expression') }, { value: 'ratio', label: t('Ratio') }, { value: 'direct', label: t('Direct prices') }, { value: 'unset', label: t('No custom pricing') },
        ]} />
      </div>
      <div className='flex flex-wrap items-center gap-2 text-xs text-ui-text-3'>
        <Checkbox aria-label={t('Select billing models on this page')} checked={visible.length > 0 && visible.every((entry) => selected.has(entry.model_name))} onChange={(checked) => setSelected((current) => {
          const next = new Set(current); visible.forEach((entry) => checked ? next.add(entry.model_name) : next.delete(entry.model_name)); return next;
        })} />
        <span>{t('Current page · {{count}} selected', { count: selected.size })}</span>
        <Button size='sm' variant='link' onClick={() => setSelected(new Set())}>{t('Clear selection')}</Button>
        <Button size='sm' variant='secondary' disabled={!selected.size} onClick={exportSelected}>{t('Export selected billing configurations')}</Button>
      </div>
      <div className='min-w-0 divide-y divide-ui-border'>
        {visible.map((entry) => <label key={entry.model_name} className='flex min-w-0 items-center gap-3 py-2 text-xs text-ui-text'>
          <Checkbox aria-label={t('Select billing model {{model}}', { model: entry.model_name })} checked={selected.has(entry.model_name)} onChange={(checked) => toggle(entry.model_name, checked)} />
          <span className='min-w-0 flex-1 break-all'>{entry.model_name}</span>
          <span className='shrink-0 text-ui-text-3'>{sourceLabel(entry)}{entry.configured['billing_setting.plugin_billing_expr'] ? ` · ${t('Plugin overrides')}` : ''}</span>
        </label>)}
        {!visible.length && <p className='py-4 text-xs text-ui-text-3'>{t('No matching models.')}</p>}
      </div>
      <div className='flex flex-wrap items-center justify-between gap-2 text-xs text-ui-text-3'>
        <span>{t('{{count}} models · page {{page}} / {{pages}}', { count: filtered.length, page: Math.min(page, maxPage), pages: maxPage })}</span>
        <div className='flex gap-2'><Button size='sm' variant='secondary' disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>{t('Previous page')}</Button>
          <Button size='sm' variant='secondary' disabled={page >= maxPage} onClick={() => setPage((value) => value + 1)}>{t('Next page')}</Button></div>
      </div>
      <datalist id='advanced-batch-pricing-source'>{entries.map((entry) => <option key={entry.model_name} value={entry.model_name} />)}</datalist>
      <label className='grid min-w-0 gap-1 text-xs text-ui-text-3'>{t('Copy source (saved model default prices)')}
        <Input aria-label={t('Batch pricing copy source')} value={source} list='advanced-batch-pricing-source' onChange={setSource} />
      </label>
      <div className='flex flex-wrap gap-2'>
        <Button size='sm' variant='secondary' disabled={!selected.size || Boolean(parsed.error)} onClick={() => stage(false)}>{t('Copy to selected model drafts')}</Button>
        <Button size='sm' variant='secondary' disabled={!selected.size || Boolean(parsed.error)} onClick={() => stage(true)}>{t('Stage defaults for selected models')}</Button>
        <Button size='sm' variant='link' onClick={() => setGeneration((value) => value + 1)}>{t('Discard draft and reload')}</Button>
      </div>
      <label className='grid min-w-0 gap-1 text-xs text-ui-text-3'>{t('Batch JSON draft (paste exported configurations)')}
        <Textarea aria-label={t('Batch billing draft')} rows={10} value={raw} onChange={(value) => { setRaw(value); setError(''); }} />
      </label>
      {parsed.error ? <p role='alert' className='text-xs text-ui-danger'>{parsed.error}</p> : <p aria-live='polite' className='break-words text-xs text-ui-text-3'>
        {t('Pending {{count}} models: {{models}}', { count: parsed.changes.length, models: parsed.changes.map((change) => `${change.model_name}${change.reset ? ` (${t('Restore upstream defaults')})` : ''}`).join(', ') || t('No changes') })}
      </p>}
    </fieldset>}
  </Modal>;
}

export default function PricingBatchDialog(props: Props) {
  const auth = useAuthStore((state) => state.auth);
  if (!props.open) return null;
  return <PricingBatchContent key={`${auth.user?.id}:${auth.session?.sid}:${auth.user?.role}`} {...props} />;
}
